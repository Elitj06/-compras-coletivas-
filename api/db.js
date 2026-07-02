/**
 * @fileoverview Compras Coletivas API — Vida Forte Nutrientes
 *
 * API REST principal (Edge Runtime) para o sistema de compras coletivas.
 * Todas as rotas estão sob `/api/db`.
 *
 * Funcionalidades:
 * - CRUD de pedidos e itens
 * - Autenticação de compradores via PIN (SHA-256)
 * - Autenticação de admin via senha
 * - Aplicação de descontos globais
 * - Exportação CSV
 * - Dashboard com estatísticas
 *
 * Banco: PostgreSQL (Supabase), schema isolado `compras_coletivas`
 * Runtime: Vercel Edge (usa `@vercel/postgres` com connection pooler)
 *
 * @module api/db
 */

import { createClient } from '@vercel/postgres';

// @vercel/postgres createClient with explicit connectionString
// Bypasses POSTGRES_URL_NON_POOLING env var check
// Supabase pooler URL doesn't match Vercel's "-pooler." pattern so we pass it explicitly

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token, X-Buyer-Token',
};

/**
 * Cria uma Response JSON com headers CORS padrão.
 * @param {object} data - Payload da resposta.
 * @param {number} [status=200] - HTTP status code.
 * @returns {Response}
 */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}

const SESSION_TTL_SECONDS = 60 * 60 * 12;
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8;
const SESSION_ENCODER = new TextEncoder();

function toBase64Url(input) {
  const text = typeof input === 'string' ? input : JSON.stringify(input);
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  return atob(padded);
}

function getSessionSecret() {
  return (
    process.env.APP_SESSION_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    'compras-coletivas-session-secret'
  );
}

async function sha256Hex(text) {
  const buffer = await crypto.subtle.digest('SHA-256', SESSION_ENCODER.encode(text));
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function signSessionToken(payload, ttlSeconds = SESSION_TTL_SECONDS) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = { ...payload, exp };
  const encodedBody = toBase64Url(body);
  const signature = await sha256Hex(`${encodedBody}.${getSessionSecret()}`);
  return `${encodedBody}.${signature}`;
}

async function verifySessionToken(token, expectedType) {
  if (!token || !token.includes('.')) return null;
  const [encodedBody, signature] = token.split('.');
  const expectedSignature = await sha256Hex(`${encodedBody}.${getSessionSecret()}`);
  if (signature !== expectedSignature) return null;
  try {
    const body = JSON.parse(fromBase64Url(encodedBody));
    if (!body?.exp || body.exp < Math.floor(Date.now() / 1000)) return null;
    if (expectedType && body.type !== expectedType) return null;
    return body;
  } catch {
    return null;
  }
}

function getTokenFromRequest(req, headerName) {
  const explicitToken = req.headers.get(headerName);
  if (explicitToken) return explicitToken;
  const authHeader = req.headers.get('authorization') || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
}

async function requireAdminSession(req) {
  return verifySessionToken(getTokenFromRequest(req, 'x-admin-token'), 'admin');
}

async function requireBuyerSession(req) {
  return verifySessionToken(getTokenFromRequest(req, 'x-buyer-token'), 'buyer');
}

async function hashAdminPassword(password) {
  return `sha256:${await sha256Hex(`admin::${password}::${getSessionSecret()}`)}`;
}

async function verifyAdminPassword(client, password) {
  const envPassword = process.env.ADMIN_PASSWORD;
  if (envPassword) {
    return password === envPassword;
  }
  const config = await client.query("SELECT valor FROM configuracoes WHERE chave = 'admin_senha'");
  if (!config.rows.length) return false;
  const savedValue = String(config.rows[0].valor || '');
  if (savedValue.startsWith('sha256:')) {
    return (await hashAdminPassword(password)) === savedValue;
  }
  if (password !== savedValue) return false;
  await client.query(
    "UPDATE configuracoes SET valor = $1, updated_at = NOW() WHERE chave = 'admin_senha'",
    [await hashAdminPassword(password)]
  );
  return true;
}

function unauthorized(message = 'Não autorizado') {
  return json({ success: false, error: message }, 401);
}

let _migrationDone = false;
/**
 * Executa migrations pendentes (idempotente). Roda apenas uma vez por cold start.
 * - Adiciona coluna pin_hash em compradores
 * - Remove duplicatas e cria UNIQUE constraint em nome
 * - Atualiza constraint de status para incluir 'aberto_edicao'
 * @param {import('@vercel/postgres').Client} client - Cliente PostgreSQL conectado.
 * @returns {Promise<void>}
 */
async function ensureMigrations(client) {
  if (_migrationDone) return;
  try {
    await client.query(`ALTER TABLE compradores ADD COLUMN IF NOT EXISTS pin_hash TEXT`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_compradores_nome_unique ON compradores(nome)`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_compradores_nome_lower ON compradores(LOWER(nome))`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_compradores_nome_tel ON compradores(nome, telefone)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_compradores_telefone_digits ON compradores((regexp_replace(COALESCE(telefone,''), '\\D', '', 'g')))`);
    // Atualiza constraint de status para incluir 'aberto_edicao'
    await client.query(`ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_status_check`);
    await client.query(`ALTER TABLE pedidos ADD CONSTRAINT pedidos_status_check CHECK (status IN ('pendente','confirmado','cancelado','entregue','aberto_edicao'))`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS pagamentos (
        id SERIAL PRIMARY KEY,
        pedido_id INTEGER UNIQUE REFERENCES pedidos(id) ON DELETE CASCADE,
        comprador TEXT NOT NULL,
        valor_compra DECIMAL(10,2) NOT NULL DEFAULT 0,
        parc1 DECIMAL(10,2),
        parc2 DECIMAL(10,2),
        parc3 DECIMAL(10,2),
        observacoes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    _migrationDone = true;
  } catch (e) {
    console.error('Migration error:', e.message);
  }
}

/**
 * Cria e conecta um cliente PostgreSQL configurado para o schema `compras_coletivas`.
 * Executa migrations pendentes na primeira chamada.
 * @returns {Promise<import('@vercel/postgres').Client>} Cliente conectado.
 * @throws {Error} Se POSTGRES_URL não estiver configurada.
 */
async function getClient() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('POSTGRES_URL env var not configured');
  }
  const client = createClient({ connectionString });
  await client.connect();
  await client.query('SET search_path TO compras_coletivas');
  await ensureMigrations(client);
  return client;
}

/**
 * Gera hash SHA-256 de um PIN com salt.
 * Usa WebCrypto API (disponível no Edge Runtime).
 * @param {string} pin - PIN em texto plano (4-6 dígitos).
 * @param {string} salt - Salt (formato: `nome:telefone` do banco).
 * @returns {Promise<string>} Hash hexadecimal de 64 caracteres.
 */
async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(`${salt}::${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Normaliza nome (trim) e telefone (remove não-dígitos).
 * @param {string} nome - Nome do comprador.
 * @param {string} telefone - Telefone com ou sem formatação.
 * @returns {{ nome: string, telefone: string }} Dados normalizados.
 */
function normalizeNomeTel(nome, telefone) {
  return {
    nome: String(nome || '').trim(),
    telefone: String(telefone || '').replace(/\D/g, ''),
  };
}

/**
 * Handler principal da API — roteia todas as requisições para `/api/db/*`.
 *
 * Rotas GET:
 *   - `/` ou `/health` — Health check
 *   - `/tables` — Lista tabelas do schema
 *   - `/pedidos` — Todos os itens de pedidos
 *   - `/pedidos/por-usuario` — Pedidos agregados por comprador
 *   - `/pedidos/consolidado` — Relatório consolidado por produto
 *   - `/stats` — Estatísticas do dashboard
 *   - `/descontos` — Descontos ativos
 *   - `/faixas-desconto` — Faixas de desconto progressivo
 *   - `/categorias` — Categorias de produtos
 *   - `/compradores` — Relatório de compradores
 *   - `/compradores/lista` — Lista simples de compradores
 *   - `/pedidos/historico?usuario=...&telefone=...` — Histórico de pedidos
 *   - `/exportar-csv` — Download CSV
 *
 * Rotas POST:
 *   - `/pedidos` — Criar pedido
 *   - `/descontos` — Aplicar desconto
 *   - `/comprador/registro` — Registrar/atualizar comprador com PIN
 *   - `/comprador/login` — Login via PIN
 *   - `/admin/login` — Login admin
 *
 * Rotas PUT:
 *   - `/pedidos/:id/status` — Alterar status do pedido
 *   - `/pedidos/usuario/:name/status` — Alterar status de todos os pedidos do comprador
 *   - `/itens/:id/qty` — Alterar quantidade de item
 *   - `/pedidos/usuario/:name/merge` — Mesclar pedidos duplicados
 *   - `/pedidos/:id/itens` — Adicionar item a pedido
 *
 * Rotas DELETE:
 *   - `/pedidos` — Apagar todos os pedidos
 *   - `/pedidos/:id` — Apagar pedido por ID
 *   - `/pedidos/usuario/:name` — Apagar pedidos de um comprador
 *   - `/itens/:id` — Remover item específico
 *   - `/produtos/:codigo` — Remover produto de todos os pedidos
 *   - `/descontos` — Desativar descontos
 *
 * @param {Request} req - Requisição HTTP.
 * @returns {Promise<Response>} Resposta JSON ou CSV.
 */
export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace('/api/db', '').replace(/^\//, '');
  const adminSession = await requireAdminSession(req);
  const buyerSession = await requireBuyerSession(req);

  let client;
  try {
    client = await getClient();

    // ===== GET ROUTES =====
    if (req.method === 'GET') {

      if (path === '' || path === 'health') {
        const result = await client.query("SELECT COUNT(*) as tabelas FROM information_schema.tables WHERE table_schema = 'compras_coletivas'");
        await client.end();
        return json({
          success: true,
          message: 'Compras Coletivas API online',
          tabelas: result.rows[0].tabelas,
          timestamp: new Date().toISOString()
        });
      }

      if (path === 'tables') {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        const rows = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'compras_coletivas' ORDER BY table_name");
        await client.end();
        return json({ success: true, data: rows.rows });
      }

      if (path === 'pedidos') {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        const rows = await client.query(`
          SELECT ip.*, p.usuario, p.status, p.created_at as pedido_data
          FROM itens_pedido ip
          JOIN pedidos p ON ip.pedido_id = p.id
          WHERE p.status != 'cancelado'
          ORDER BY p.created_at DESC
        `);
        await client.end();
        return json({ success: true, data: rows.rows });
      }

      if (path === 'pedidos/por-usuario') {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        const rows = await client.query(`
          SELECT
            p.usuario,
            MAX(c.telefone) as telefone,
            MAX(c.email) as email,
            array_agg(DISTINCT p.id) as pedido_ids,
            array_agg(DISTINCT p.status) as statuses,
            json_agg(DISTINCT jsonb_build_object(
              'item_id', ip.id,
              'pedido_id', p.id,
              'codigo', ip.codigo,
              'nome', ip.nome_produto,
              'quantidade', ip.quantidade,
              'preco_bruto', ip.preco_unitario,
              'preco_desconto', ip.preco_com_desconto,
              'categoria', ip.categoria
            )) as itens,
            SUM(ip.quantidade) as total_itens,
            SUM(ip.subtotal_bruto) as total_bruto,
            SUM(ip.subtotal_final) as total_desconto
          FROM pedidos p
          JOIN itens_pedido ip ON ip.pedido_id = p.id
          LEFT JOIN compradores c ON c.nome = p.usuario
          WHERE p.status != 'cancelado'
          GROUP BY p.usuario
          ORDER BY p.usuario
        `);
        await client.end();
        return json({ success: true, data: rows.rows });
      }

      if (path === 'pedidos/consolidado') {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        const rows = await client.query('SELECT * FROM vw_relatorio_produtos');
        await client.end();
        return json({ success: true, data: rows.rows });
      }

      if (path === 'stats') {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        const stats = await client.query('SELECT * FROM vw_dashboard_stats');
        await client.end();
        return json({ success: true, data: stats.rows[0] });
      }

      if (path === 'descontos') {
        const rows = await client.query('SELECT * FROM descontos WHERE ativo = TRUE ORDER BY categoria');
        await client.end();
        return json({ success: true, data: rows.rows });
      }

      if (path === 'faixas-desconto') {
        const rows = await client.query('SELECT * FROM faixas_desconto WHERE ativo = TRUE ORDER BY valor_minimo');
        await client.end();
        return json({ success: true, data: rows.rows });
      }

      if (path === 'categorias') {
        const rows = await client.query('SELECT * FROM categorias ORDER BY nome');
        await client.end();
        return json({ success: true, data: rows.rows });
      }

      if (path === 'compradores') {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        const rows = await client.query('SELECT * FROM vw_relatorio_compradores');
        await client.end();
        return json({ success: true, data: rows.rows });
      }

      // Lista todos os compradores (para o admin escolher de quem ver o histórico)
      if (path === 'compradores/lista') {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        const rows = await client.query(`
          SELECT DISTINCT c.nome, c.telefone, c.email,
            (SELECT COUNT(*) FROM pedidos p WHERE p.usuario = c.nome AND p.status != 'cancelado') AS total_pedidos
          FROM compradores c
          ORDER BY c.nome
        `);
        await client.end();
        return json({ success: true, data: rows.rows });
      }

      // Histórico de pedidos de um comprador (por nome + telefone)
      // GET /pedidos/historico?usuario=...&telefone=...
      if (path === 'pedidos/historico') {
        const usuario = adminSession
          ? (url.searchParams.get('usuario') || '')
          : String(buyerSession?.nome || '');
        const telefone = adminSession
          ? (url.searchParams.get('telefone') || '').replace(/\D/g, '')
          : String(buyerSession?.telefone || '').replace(/\D/g, '');
        if (!usuario || !telefone) {
          await client.end();
          return unauthorized('Sessão do comprador inválida');
        }
        const params = [usuario, telefone];
        const where = `LOWER(p.usuario) = LOWER($1) AND regexp_replace(COALESCE(c.telefone,''), '\\D', '', 'g') = $2`;
        const rows = await client.query(`
          SELECT p.id, p.created_at, p.status, p.total_bruto, p.total_final, p.total_desconto,
            json_agg(json_build_object(
              'item_id', ip.id,
              'codigo', ip.codigo,
              'nome', ip.nome_produto,
              'quantidade', ip.quantidade,
              'preco_bruto', ip.preco_unitario,
              'preco_desconto', ip.preco_com_desconto,
              'subtotal_bruto', ip.subtotal_bruto,
              'subtotal_final', ip.subtotal_final
            ) ORDER BY ip.nome_produto) AS itens
          FROM pedidos p
          LEFT JOIN itens_pedido ip ON ip.pedido_id = p.id
          LEFT JOIN compradores c ON c.nome = p.usuario
          WHERE ${where} AND p.status != 'cancelado'
          GROUP BY p.id
          ORDER BY p.created_at DESC
        `, params);
        await client.end();
        return json({ success: true, data: rows.rows });
      }

      // GET /pagamentos — lista todos os pagamentos com totais calculados (máx 3 parcelas)
      if (path === 'pagamentos') {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        const rows = await client.query(`
          SELECT p.id, p.pedido_id, p.comprador, p.valor_compra,
            p.parc1, p.parc2, p.parc3, p.observacoes, p.created_at, p.updated_at,
            COALESCE(p.parc1,0) + COALESCE(p.parc2,0) + COALESCE(p.parc3,0) as total_pago,
            p.valor_compra - (COALESCE(p.parc1,0) + COALESCE(p.parc2,0) + COALESCE(p.parc3,0)) as total_devido
          FROM pagamentos p ORDER BY p.comprador
        `);
        await client.end();
        return json({ success: true, data: rows.rows });
      }

      // GET /pagamentos/resumo — totais gerais (máx 3 parcelas)
      if (path === 'pagamentos/resumo') {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        const rows = await client.query(`
          SELECT COUNT(*) as total_compradores, SUM(valor_compra) as total_compras, 
            SUM(COALESCE(parc1,0)+COALESCE(parc2,0)+COALESCE(parc3,0)) as total_recebido,
            SUM(valor_compra) - SUM(COALESCE(parc1,0)+COALESCE(parc2,0)+COALESCE(parc3,0)) as total_pendente
          FROM pagamentos
        `);
        await client.end();
        return json({ success: true, data: rows.rows[0] });
      }

      if (path === 'exportar-csv') {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        const rows = await client.query(`
          SELECT p.usuario AS comprador, ip.codigo, ip.nome_produto AS produto,
            ip.quantidade, ip.preco_unitario, ip.desconto_percentual,
            ip.preco_com_desconto, ip.subtotal_bruto, ip.subtotal_final,
            p.created_at AS data_pedido
          FROM itens_pedido ip
          JOIN pedidos p ON ip.pedido_id = p.id
          WHERE p.status != 'cancelado'
          ORDER BY p.usuario, ip.nome_produto
        `);
        const data = rows.rows;
        let csv = 'Comprador;Código;Produto;Qtd;Preço Unit.;Desconto %;Preço c/ Desc.;Total Bruto;Total Final;Data\n';
        for (const r of data) {
          const dt = new Date(r.data_pedido).toLocaleDateString('pt-BR');
          csv += `${r.comprador};${r.codigo};${r.produto};${r.quantidade};${String(r.preco_unitario).replace('.', ',')};${r.desconto_percentual}%;${String(r.preco_com_desconto).replace('.', ',')};${String(r.subtotal_bruto).replace('.', ',')};${String(r.subtotal_final).replace('.', ',')};${dt}\n`;
        }
        await client.end();
        return new Response('\uFEFF' + csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename=relatorio_compras_coletivas.csv',
            'Access-Control-Allow-Origin': '*',
          }
        });
      }

      if (path === 'admin/session') {
        await client.end();
        if (!adminSession) return unauthorized();
        return json({ success: true, data: adminSession });
      }

      if (path === 'comprador/session') {
        await client.end();
        if (!buyerSession) return unauthorized();
        return json({ success: true, data: buyerSession });
      }
    }

    // ===== POST ROUTES =====
    if (req.method === 'POST') {
      const body = await req.json();

      if (path === 'pedidos') {
        if (!buyerSession) {
          await client.end();
          return unauthorized('Faça login novamente para enviar seu pedido');
        }
        const { usuario, telefone, email, itens } = body;
        if (!usuario || !itens || !itens.length) {
          await client.end();
          return json({ success: false, error: 'Dados incompletos' }, 400);
        }
        const normalizedBody = normalizeNomeTel(usuario, telefone);
        if (
          normalizedBody.nome.toLowerCase() !== String(buyerSession.nome || '').toLowerCase() ||
          normalizedBody.telefone !== String(buyerSession.telefone || '').replace(/\D/g, '')
        ) {
          await client.end();
          return unauthorized('Sessão não corresponde ao comprador informado');
        }

        await client.query('BEGIN');
        try {
          // Upsert comprador com telefone e email
          if (telefone || email) {
            await client.query(
              `INSERT INTO compradores (nome, telefone, email)
               VALUES ($1, $2, $3)
               ON CONFLICT (nome) DO UPDATE SET
                 telefone = COALESCE(EXCLUDED.telefone, compradores.telefone),
                 email = COALESCE(EXCLUDED.email, compradores.email)`,
              [usuario, telefone || null, email || null]
            );
          }

          // Proteção contra envios duplicados: verifica se já existe pedido
          const dup = await client.query(
            `SELECT id FROM pedidos WHERE usuario = $1 AND status IN ('pendente','aberto_edicao') AND created_at > NOW() - INTERVAL '60 seconds' LIMIT 1`,
            [usuario]
          );
          if (dup.rows.length) {
            await client.query('ROLLBACK');
            await client.end();
            return json({ success: false, duplicate: true, error: 'Pedido recente já existe. Aguarde ou edite o pedido existente.' }, 409);
          }

          const pedidoResult = await client.query(
            'INSERT INTO pedidos (usuario, status) VALUES ($1, $2) RETURNING id',
            [usuario, 'pendente']
          );
          const pedidoId = pedidoResult.rows[0].id;

          let totalBruto = 0;
          let totalFinal = 0;

          for (const item of itens) {
            const precoBruto = parseFloat(item.preco_bruto) || 0;
            const precoDesconto = parseFloat(item.preco_desconto) || precoBruto;
            const qty = parseInt(item.quantidade) || 1;
            const subtBruto = precoBruto * qty;
            const subtFinal = precoDesconto * qty;

            await client.query(
              `INSERT INTO itens_pedido (
                pedido_id, codigo, nome_produto, quantidade,
                preco_unitario, preco_bruto, preco_com_desconto, preco_desconto,
                desconto_percentual, subtotal_bruto, subtotal_final, categoria
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
              [pedidoId, item.codigo, item.nome, qty, precoBruto, precoBruto, precoDesconto, precoDesconto, item.desconto || 0, subtBruto, subtFinal, item.categoria || '']
            );
            totalBruto += subtBruto;
            totalFinal += subtFinal;
          }

          await client.query(
            'UPDATE pedidos SET total_bruto = $1, total_final = $2, total_desconto = $3 WHERE id = $4',
            [totalBruto, totalFinal, totalBruto - totalFinal, pedidoId]
          );
          await client.query('COMMIT');

          await client.end();
          return json({
            success: true,
            message: `Pedido de ${usuario} registrado com ${itens.length} itens`,
            pedido_id: pedidoId
          });
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }

      if (path === 'descontos') {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        const { categoria, percentual } = body;
        if (categoria === undefined || percentual === undefined) {
          await client.end();
          return json({ success: false, error: 'Dados incompletos' }, 400);
        }
        await client.query('SELECT aplicar_desconto($1, $2)', [categoria, percentual]);
        await client.end();
        return json({ success: true, message: `Desconto de ${percentual}% aplicado em ${categoria}` });
      }

      // ===== Autenticação do comprador via PIN =====
      // POST /comprador/registro  { nome, telefone, email, pin }
      // Cria ou define o PIN de um comprador. Se já existia pin_hash, exige
      // o pin_atual (não permite sobrescrever sem conhecer o atual).
      if (path === 'comprador/registro') {
        const { nome, telefone, email, pin, pin_atual } = body;
        const { nome: n, telefone: t } = normalizeNomeTel(nome, telefone);
        if (!n || !t) { await client.end(); return json({ success: false, error: 'Nome e telefone são obrigatórios' }, 400); }
        if (!/^\d{4,6}$/.test(String(pin || ''))) {
          await client.end();
          return json({ success: false, error: 'PIN deve ter de 4 a 6 dígitos numéricos' }, 400);
        }
        // Verifica se já existe (case-insensitive)
        const existing = await client.query(
          `SELECT id, nome, telefone, email, pin_hash FROM compradores
           WHERE LOWER(nome) = LOWER($1) AND regexp_replace(COALESCE(telefone,''), '\\D', '', 'g') = $2
           LIMIT 1`,
          [n, t]
        );
        const row = existing.rows[0];
        if (row) {
          // Já existe — usa o nome exato do banco
          const dbNome = row.nome;
          const dbTel = (row.telefone || '').replace(/\D/g, '');
          if (row.pin_hash) {
            if (!pin_atual) {
              await client.end();
              return json({ success: false, error: 'PIN já cadastrado. Faça login ou informe o PIN atual para alterá-lo.', requires_current_pin: true }, 409);
            }
            const atualHash = await hashPin(pin_atual, dbNome + ':' + dbTel);
            if (atualHash !== row.pin_hash) {
              await client.end();
              return json({ success: false, error: 'PIN atual incorreto' }, 401);
            }
          }
          const newHash = await hashPin(pin, dbNome + ':' + (t || dbTel));
          await client.query(
            `UPDATE compradores SET pin_hash = $1, telefone = COALESCE($2, telefone), email = COALESCE($3, email) WHERE nome = $4`,
            [newHash, t || null, email || null, dbNome]
          );
          await client.end();
          return json({
            success: true,
            message: 'PIN registrado',
            data: {
              nome: dbNome,
              telefone: t || dbTel,
              email: email || row.email || '',
              token: await signSessionToken({ type: 'buyer', buyerId: row.id, nome: dbNome, telefone: t || dbTel })
            }
          });
        }
        // Novo comprador
        const newHash = await hashPin(pin, n + ':' + t);
        const inserted = await client.query(
          `INSERT INTO compradores (nome, telefone, email, pin_hash) VALUES ($1, $2, $3, $4) RETURNING id`,
          [n, t, email || null, newHash]
        );
        await client.end();
        return json({
          success: true,
          message: 'Cadastro criado com PIN',
          data: {
            nome: n,
            telefone: t,
            email: email || '',
            token: await signSessionToken({ type: 'buyer', buyerId: inserted.rows?.[0]?.id || null, nome: n, telefone: t })
          }
        });
      }

      // POST /comprador/login  { nome, telefone, pin }
      if (path === 'comprador/login') {
        const { nome, telefone, pin } = body;
        const { nome: n, telefone: t } = normalizeNomeTel(nome, telefone);
        if (!n || !t || !pin) {
          await client.end();
          return json({ success: false, error: 'Dados incompletos' }, 400);
        }
        // Busca por nome (case-insensitive) OU telefone normalizado
        // Telefone é mais confiável em aparelhos novos onde o usuário pode
        // não lembrar o nome exato usado no cadastro
        const tNormalized = (t || '').replace(/\D/g, '');
        const r = await client.query(
          `SELECT id, nome, telefone, email, pin_hash FROM compradores
           WHERE regexp_replace(COALESCE(telefone, ''), '\\D', '', 'g') = $2
           LIMIT 1`,
          [n, tNormalized]
        );
        if (!r.rows.length) {
          await client.end();
          return json({ success: false, error: 'Comprador não encontrado. Use "Criar cadastro".', not_found: true }, 404);
        }
        const row = r.rows[0];
        // Usa o nome/telefone SALVOS no banco como salt (não o digitado)
        const dbNome = row.nome;
        const dbTel = (row.telefone || '').replace(/\D/g, '');
        if (!row.pin_hash) {
          await client.end();
          return json({ success: false, error: 'Este cadastro ainda não possui PIN. Use "Criar cadastro" com o mesmo nome e telefone para ativar o acesso.', no_pin: true }, 409);
        }
        const hash = await hashPin(pin, dbNome + ':' + dbTel);
        if (hash !== row.pin_hash) {
          await client.end();
          return json({ success: false, error: 'PIN incorreto' }, 401);
        }
        await client.end();
        return json({
          success: true,
          data: {
            nome: dbNome,
            telefone: row.telefone,
            email: row.email,
            token: await signSessionToken({ type: 'buyer', buyerId: row.id, nome: dbNome, telefone: dbTel })
          }
        });
      }

      // POST /pagamentos/inicializar — cria registros de pagamento para pedidos pendentes
      if (path === 'pagamentos/inicializar') {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        const r = await client.query(`
          INSERT INTO pagamentos (pedido_id, comprador, valor_compra)
          SELECT p.id, p.usuario, p.total_final
          FROM pedidos p
          WHERE p.status != 'cancelado'
          AND NOT EXISTS (SELECT 1 FROM pagamentos pg WHERE pg.pedido_id = p.id)
        `);
        await client.end();
        return json({ success: true, message: `${r.rowCount} registro(s) de pagamento criado(s)`, created: r.rowCount });
      }

      if (path === 'admin/login') {
        const { senha } = body;
        const isValid = await verifyAdminPassword(client, senha);
        await client.end();
        if (isValid) {
          return json({
            success: true,
            message: 'Login autorizado',
            data: {
              token: await signSessionToken({ type: 'admin' }, ADMIN_SESSION_TTL_SECONDS)
            }
          });
        }
        return json({ success: false, error: 'Senha incorreta' }, 401);
      }
    }

    // ===== PUT ROUTES =====
    if (req.method === 'PUT') {
      const body = await req.json();

      // PUT /pagamentos/:id — atualiza parcelas/obs de um pagamento
      const pgtoMatch = path.match(/^pagamentos\/(\d+)$/);
      if (pgtoMatch) {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        const pgId = parseInt(pgtoMatch[1]);
        const { parc1, parc2, parc3, observacoes } = body;
        const r = await client.query(
          'UPDATE pagamentos SET parc1=$1, parc2=$2, parc3=$3, parc4=NULL, parc5=NULL, observacoes=$4, updated_at=NOW() WHERE id=$5 RETURNING id',
          [parc1 ?? null, parc2 ?? null, parc3 ?? null, observacoes ?? null, pgId]
        );
        await client.end();
        if (!r.rowCount) return json({ success: false, error: 'Pagamento não encontrado' }, 404);
        return json({ success: true, message: `Pagamento ${pgId} atualizado` });
      }

      // PUT /pedidos/:id/status { status: 'aberto_edicao' | 'pendente' | 'confirmado' }
      const statusMatch = path.match(/^pedidos\/(\d+)\/status$/);
      if (statusMatch) {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        const pid = parseInt(statusMatch[1]);
        const { status } = body;
        const validos = ['pendente', 'confirmado', 'cancelado', 'entregue', 'aberto_edicao'];
        if (!validos.includes(status)) {
          await client.end();
          return json({ success: false, error: `Status inválido. Opções: ${validos.join(', ')}` }, 400);
        }
        const r = await client.query(
          'UPDATE pedidos SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
          [status, pid]
        );
        await client.end();
        if (!r.rowCount) return json({ success: false, error: 'Pedido não encontrado' }, 404);
        return json({ success: true, message: `Pedido ${pid} → ${status}` });
      }

      // PUT /pedidos/usuario/:nome/status  (altera status de TODOS os pedidos de um comprador)
      const userStatusMatch = path.match(/^pedidos\/usuario\/(.+)\/status$/);
      if (userStatusMatch) {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        const usuario = decodeURIComponent(userStatusMatch[1]);
        const { status } = body;
        const validos = ['pendente', 'confirmado', 'cancelado', 'entregue', 'aberto_edicao'];
        if (!validos.includes(status)) {
          await client.end();
          return json({ success: false, error: `Status inválido` }, 400);
        }
        const r = await client.query(
          `UPDATE pedidos SET status = $1, updated_at = NOW() WHERE usuario = $2 AND status != 'cancelado' RETURNING id`,
          [status, usuario]
        );
        await client.end();
        return json({ success: true, message: `${r.rowCount} pedido(s) de ${usuario} → ${status}` });
      }

      // PUT /itens/:id/qty  — Admin: alterar quantidade de item existente
      const qtyMatch = path.match(/^itens\/(\d+)\/qty$/);
      if (qtyMatch) {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        const iid = parseInt(qtyMatch[1]);
        const { quantidade } = body;
        const qty = parseInt(quantidade);
        if (!qty || qty < 1) {
          await client.end();
          return json({ success: false, error: 'Quantidade deve ser >= 1' }, 400);
        }
        const item = await client.query(
          'SELECT pedido_id, preco_unitario, preco_com_desconto FROM itens_pedido WHERE id = $1',
          [iid]
        );
        if (!item.rows.length) {
          await client.end();
          return json({ success: false, error: 'Item não encontrado' }, 404);
        }
        const it = item.rows[0];
        const pBruto = parseFloat(it.preco_unitario);
        const pDesc = parseFloat(it.preco_com_desconto);
        await client.query(
          `UPDATE itens_pedido SET quantidade = $1, subtotal_bruto = $2, subtotal_final = $3 WHERE id = $4`,
          [qty, pBruto * qty, pDesc * qty, iid]
        );
        // Recalcula totais do pedido
        const totals = await client.query(
          `SELECT COALESCE(SUM(subtotal_bruto),0)::numeric AS tb, COALESCE(SUM(subtotal_final),0)::numeric AS tf FROM itens_pedido WHERE pedido_id = $1`,
          [it.pedido_id]
        );
        const tb = parseFloat(totals.rows[0].tb);
        const tf = parseFloat(totals.rows[0].tf);
        await client.query(
          'UPDATE pedidos SET total_bruto = $1, total_final = $2, total_desconto = $3, updated_at = NOW() WHERE id = $4',
          [tb, tf, tb - tf, it.pedido_id]
        );
        await client.end();
        return json({ success: true, message: `Quantidade atualizada para ${qty}` });
      }

      // PUT /pedidos/usuario/:nome/merge  — Admin: mescla pedidos somando quantidades
      // Mantém o pedido mais recente; itens do mesmo produto têm quantidades SOMADAS
      const mergeMatch = path.match(/^pedidos\/usuario\/(.+)\/merge$/);
      if (mergeMatch) {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        const usuario = decodeURIComponent(mergeMatch[1]);
        await client.query('BEGIN');
        try {
        // Busca todos os pedidos ativos do usuário
        const pedidos = await client.query(
          `SELECT id FROM pedidos WHERE usuario = $1 AND status != 'cancelado' ORDER BY created_at DESC`,
          [usuario]
        );
        if (pedidos.rows.length <= 1) {
          await client.query('ROLLBACK');
          await client.end();
          return json({ success: true, message: 'Apenas 1 pedido encontrado, nada a mesclar.' });
        }
        const keepId = pedidos.rows[0].id; // mantém o mais recente
        const removeIds = pedidos.rows.slice(1).map(r => r.id);

        // Mescla itens dos pedidos antigos no pedido principal SOMANDO quantidades
        for (const oldId of removeIds) {
          const oldItems = await client.query(
            'SELECT codigo, nome_produto, quantidade, preco_unitario, preco_com_desconto, preco_bruto, preco_desconto, desconto_percentual, categoria FROM itens_pedido WHERE pedido_id = $1',
            [oldId]
          );
          for (const oi of oldItems.rows) {
            const existing = await client.query(
              'SELECT id, quantidade FROM itens_pedido WHERE pedido_id = $1 AND codigo = $2 LIMIT 1',
              [keepId, oi.codigo]
            );
            if (existing.rows.length) {
              // Já existe — SOMA a quantidade do pedido antigo
              const ei = existing.rows[0];
              const newQty = ei.quantidade + oi.quantidade;
              const pBruto = parseFloat(oi.preco_unitario);
              const pDesc = parseFloat(oi.preco_com_desconto);
              await client.query(
                `UPDATE itens_pedido SET quantidade = $1, subtotal_bruto = $2, subtotal_final = $3 WHERE id = $4`,
                [newQty, pBruto * newQty, pDesc * newQty, ei.id]
              );
            } else {
              // Não existe — move item para o pedido principal
              const pBruto = parseFloat(oi.preco_unitario);
              const pDesc = parseFloat(oi.preco_com_desconto);
              await client.query(
                `INSERT INTO itens_pedido (pedido_id, codigo, nome_produto, quantidade, preco_unitario, preco_bruto, preco_com_desconto, preco_desconto, desconto_percentual, subtotal_bruto, subtotal_final, categoria)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                [keepId, oi.codigo, oi.nome_produto, oi.quantidade, pBruto, oi.preco_bruto, pDesc, oi.preco_desconto, oi.desconto_percentual, pBruto * oi.quantidade, pDesc * oi.quantidade, oi.categoria]
              );
            }
          }
          // Remove itens e pedido antigo
          await client.query('DELETE FROM itens_pedido WHERE pedido_id = $1', [oldId]);
          await client.query('DELETE FROM pedidos WHERE id = $1', [oldId]);
        }
        // Recalcula totais do pedido mantido
        const totals = await client.query(
          `SELECT COALESCE(SUM(subtotal_bruto),0)::numeric AS tb, COALESCE(SUM(subtotal_final),0)::numeric AS tf FROM itens_pedido WHERE pedido_id = $1`,
          [keepId]
        );
        const tb = parseFloat(totals.rows[0].tb);
        const tf = parseFloat(totals.rows[0].tf);
        await client.query(
          'UPDATE pedidos SET total_bruto = $1, total_final = $2, total_desconto = $3, status = $4, updated_at = NOW() WHERE id = $5',
          [tb, tf, tb - tf, 'pendente', keepId]
        );
        await client.query('COMMIT');
        await client.end();
        return json({ success: true, message: `${removeIds.length} pedido(s) duplicado(s) removido(s). Pedido ${keepId} mantido.` });
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }

      // PUT /pedidos/:id/itens  — Admin: adicionar item a pedido existente
      // body: { codigo, nome, quantidade, preco_bruto, preco_desconto, categoria }
      const addItemMatch = path.match(/^pedidos\/(\d+)\/itens$/);
      if (addItemMatch) {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        const pid = parseInt(addItemMatch[1]);
        const { codigo, nome, quantidade, preco_bruto, preco_desconto, categoria } = body;
        if (!codigo || !nome || !quantidade || !preco_bruto) {
          await client.end();
          return json({ success: false, error: 'Dados do item incompletos' }, 400);
        }
        const qty = parseInt(quantidade) || 1;
        const pBruto = parseFloat(preco_bruto);
        const pDesc = parseFloat(preco_desconto) || pBruto;
        const subtBruto = pBruto * qty;
        const subtFinal = pDesc * qty;

        // Verifica se já existe esse produto no pedido — se sim, incrementa
        const existingItem = await client.query(
          'SELECT id, quantidade, subtotal_bruto, subtotal_final FROM itens_pedido WHERE pedido_id = $1 AND codigo = $2 LIMIT 1',
          [pid, codigo]
        );
        if (existingItem.rows.length) {
          const ei = existingItem.rows[0];
          const newQty = ei.quantidade + qty;
          await client.query(
            `UPDATE itens_pedido SET quantidade = $1, subtotal_bruto = $2, subtotal_final = $3 WHERE id = $4`,
            [newQty, pBruto * newQty, pDesc * newQty, ei.id]
          );
        } else {
          const descPct = pBruto > 0 ? Math.round((1 - pDesc / pBruto) * 100) : 0;
          await client.query(
            `INSERT INTO itens_pedido (
              pedido_id, codigo, nome_produto, quantidade,
              preco_unitario, preco_bruto, preco_com_desconto, preco_desconto,
              desconto_percentual, subtotal_bruto, subtotal_final, categoria
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [pid, codigo, nome, qty, pBruto, pBruto, pDesc, pDesc, descPct, subtBruto, subtFinal, categoria || '']
          );
        }
        // Recalcula totais do pedido
        const totals = await client.query(
          `SELECT COALESCE(SUM(subtotal_bruto),0)::numeric AS tb, COALESCE(SUM(subtotal_final),0)::numeric AS tf FROM itens_pedido WHERE pedido_id = $1`,
          [pid]
        );
        const tb = parseFloat(totals.rows[0].tb);
        const tf = parseFloat(totals.rows[0].tf);
        await client.query(
          'UPDATE pedidos SET total_bruto = $1, total_final = $2, total_desconto = $3, updated_at = NOW() WHERE id = $4',
          [tb, tf, tb - tf, pid]
        );
        await client.end();
        return json({ success: true, message: `Item ${nome} adicionado ao pedido ${pid}` });
      }
    }

    // ===== DELETE ROUTES =====
    if (req.method === 'DELETE') {
      if (path === 'pedidos') {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        await client.query('DELETE FROM itens_pedido');
        await client.query('DELETE FROM pedidos');
        await client.end();
        return json({ success: true, message: 'Todos os pedidos foram apagados' });
      }
      const pedidoMatch = path.match(/^pedidos\/(\d+)$/);
      if (pedidoMatch) {
        const pid = parseInt(pedidoMatch[1]);
        if (!adminSession) {
          if (!buyerSession) {
            await client.end();
            return unauthorized();
          }
          const owner = await client.query(
            `SELECT p.id
             FROM pedidos p
             LEFT JOIN compradores c ON c.nome = p.usuario
             WHERE p.id = $1
               AND LOWER(p.usuario) = LOWER($2)
               AND regexp_replace(COALESCE(c.telefone,''), '\\D', '', 'g') = $3`,
            [pid, buyerSession.nome, String(buyerSession.telefone || '').replace(/\D/g, '')]
          );
          if (!owner.rows.length) {
            await client.end();
            return unauthorized();
          }
        }
        await client.query('DELETE FROM itens_pedido WHERE pedido_id = $1', [pid]);
        const r = await client.query('DELETE FROM pedidos WHERE id = $1 RETURNING id', [pid]);
        await client.end();
        if (!r.rowCount) return json({ success: false, error: 'Pedido não encontrado' }, 404);
        return json({ success: true, message: `Pedido ${pid} cancelado` });
      }

      // Apaga todos os pedidos de um comprador (por nome de usuário)
      const pedidoUserMatch = path.match(/^pedidos\/usuario\/(.+)$/);
      if (pedidoUserMatch) {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        const usuario = decodeURIComponent(pedidoUserMatch[1]);
        await client.query(
          'DELETE FROM itens_pedido WHERE pedido_id IN (SELECT id FROM pedidos WHERE usuario = $1)',
          [usuario]
        );
        const r = await client.query('DELETE FROM pedidos WHERE usuario = $1 RETURNING id', [usuario]);
        await client.end();
        return json({ success: true, message: `${r.rowCount} pedido(s) de ${usuario} apagados` });
      }

      // Remove um item específico de um pedido
      const itemMatch = path.match(/^itens\/(\d+)$/);
      if (itemMatch) {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        const iid = parseInt(itemMatch[1]);
        const r = await client.query('DELETE FROM itens_pedido WHERE id = $1 RETURNING pedido_id', [iid]);
        if (r.rowCount) {
          const pedidoId = r.rows[0].pedido_id;
          // Se o pedido ficou sem itens, remove o pedido também
          const count = await client.query('SELECT COUNT(*)::int AS c FROM itens_pedido WHERE pedido_id = $1', [pedidoId]);
          if (count.rows[0].c === 0) {
            await client.query('DELETE FROM pedidos WHERE id = $1', [pedidoId]);
          }
        }
        await client.end();
        if (!r.rowCount) return json({ success: false, error: 'Item não encontrado' }, 404);
        return json({ success: true, message: `Item ${iid} removido` });
      }

      // Remove um produto (por código) de TODOS os pedidos — útil quando o
      // fornecedor está em falta e precisamos manter os demais itens dos pedidos.
      const produtoMatch = path.match(/^produtos\/(.+)$/);
      if (produtoMatch) {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        const codigo = decodeURIComponent(produtoMatch[1]);
        const r = await client.query('DELETE FROM itens_pedido WHERE codigo = $1 RETURNING pedido_id', [codigo]);
        // Limpa pedidos que ficaram vazios
        await client.query(`
          DELETE FROM pedidos WHERE id NOT IN (SELECT DISTINCT pedido_id FROM itens_pedido)
        `);
        await client.end();
        return json({ success: true, message: `${r.rowCount} ocorrência(s) do produto ${codigo} removidas` });
      }

      if (path === 'descontos') {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        await client.query('UPDATE descontos SET ativo = FALSE');
        await client.end();
        return json({ success: true, message: 'Descontos desativados' });
      }
    }

    await client.end();
    return json({ success: false, error: 'Rota não encontrada' }, 404);

  } catch (error) {
    console.error('API Error:', error);
    if (client) try { await client.end(); } catch (_) {}
    return json({ success: false, error: 'Erro interno do servidor' }, 500);
  }
}

export const config = { runtime: 'edge' };
