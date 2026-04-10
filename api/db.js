import { createClient } from '@vercel/postgres';

// @vercel/postgres createClient with explicit connectionString
// Bypasses POSTGRES_URL_NON_POOLING env var check
// Supabase pooler URL doesn't match Vercel's "-pooler." pattern so we pass it explicitly

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}

let _migrationDone = false;
async function ensureMigrations(client) {
  if (_migrationDone) return;
  try {
    await client.query(`ALTER TABLE compradores ADD COLUMN IF NOT EXISTS pin_hash TEXT`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_compradores_nome_tel ON compradores(nome, telefone)`);
    // Atualiza constraint de status para incluir 'aberto_edicao'
    await client.query(`ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_status_check`);
    await client.query(`ALTER TABLE pedidos ADD CONSTRAINT pedidos_status_check CHECK (status IN ('pendente','confirmado','cancelado','entregue','aberto_edicao'))`);
    _migrationDone = true;
  } catch (e) {
    console.error('Migration error:', e.message);
  }
}

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

// Hash SHA-256 via WebCrypto (disponível no runtime Edge do Vercel)
async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(`${salt}::${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function normalizeNomeTel(nome, telefone) {
  return {
    nome: String(nome || '').trim(),
    telefone: String(telefone || '').replace(/\D/g, ''),
  };
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace('/api/db', '').replace(/^\//, '');

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
        const rows = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'compras_coletivas' ORDER BY table_name");
        await client.end();
        return json({ success: true, data: rows.rows });
      }

      if (path === 'pedidos') {
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
        const rows = await client.query('SELECT * FROM vw_relatorio_produtos');
        await client.end();
        return json({ success: true, data: rows.rows });
      }

      if (path === 'stats') {
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
        const rows = await client.query('SELECT * FROM vw_relatorio_compradores');
        await client.end();
        return json({ success: true, data: rows.rows });
      }

      // Lista todos os compradores (para o admin escolher de quem ver o histórico)
      if (path === 'compradores/lista') {
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
        const usuario = url.searchParams.get('usuario') || '';
        const telefone = (url.searchParams.get('telefone') || '').replace(/\D/g, '');
        if (!usuario) {
          await client.end();
          return json({ success: false, error: 'Usuário não informado' }, 400);
        }
        // Filtra por nome; se telefone informado, exige match (privacidade)
        const params = [usuario];
        let where = `p.usuario = $1`;
        if (telefone) {
          params.push(telefone);
          where += ` AND regexp_replace(COALESCE(c.telefone,''), '\\D', '', 'g') = $2`;
        }
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
          WHERE ${where}
          GROUP BY p.id
          ORDER BY p.created_at DESC
        `, params);
        await client.end();
        return json({ success: true, data: rows.rows });
      }

      if (path === 'exportar-csv') {
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
    }

    // ===== POST ROUTES =====
    if (req.method === 'POST') {
      const body = await req.json();

      if (path === 'pedidos') {
        const { usuario, telefone, email, itens } = body;
        if (!usuario || !itens || !itens.length) {
          await client.end();
          return json({ success: false, error: 'Dados incompletos' }, 400);
        }

        // Upsert comprador com telefone e email
        if (telefone || email) {
          await client.query(
            `INSERT INTO compradores (nome, telefone, email) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [usuario, telefone || null, email || null]
          );
          await client.query(
            `UPDATE compradores SET telefone = COALESCE($1, telefone), email = COALESCE($2, email) WHERE nome = $3`,
            [telefone || null, email || null, usuario]
          );
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

        await client.end();
        return json({
          success: true,
          message: `Pedido de ${usuario} registrado com ${itens.length} itens`,
          pedido_id: pedidoId
        });
      }

      if (path === 'descontos') {
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
        // Garante comprador
        await client.query(
          `INSERT INTO compradores (nome, telefone, email) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [n, t, email || null]
        );
        await client.query(
          `UPDATE compradores SET telefone = COALESCE($1, telefone), email = COALESCE($2, email) WHERE nome = $3`,
          [t, email || null, n]
        );
        // Verifica se já existe pin
        const existing = await client.query(
          `SELECT pin_hash FROM compradores WHERE nome = $1 AND regexp_replace(COALESCE(telefone,''),'\\D','','g') = $2 LIMIT 1`,
          [n, t]
        );
        const row = existing.rows[0];
        if (row && row.pin_hash) {
          if (!pin_atual) {
            await client.end();
            return json({ success: false, error: 'PIN já cadastrado. Faça login ou informe o PIN atual para alterá-lo.', requires_current_pin: true }, 409);
          }
          const atualHash = await hashPin(pin_atual, n + ':' + t);
          if (atualHash !== row.pin_hash) {
            await client.end();
            return json({ success: false, error: 'PIN atual incorreto' }, 401);
          }
        }
        const newHash = await hashPin(pin, n + ':' + t);
        await client.query(
          `UPDATE compradores SET pin_hash = $1 WHERE nome = $2 AND regexp_replace(COALESCE(telefone,''),'\\D','','g') = $3`,
          [newHash, n, t]
        );
        await client.end();
        return json({ success: true, message: 'PIN registrado' });
      }

      // POST /comprador/login  { nome, telefone, pin }
      if (path === 'comprador/login') {
        const { nome, telefone, pin } = body;
        const { nome: n, telefone: t } = normalizeNomeTel(nome, telefone);
        if (!n || !t || !pin) {
          await client.end();
          return json({ success: false, error: 'Dados incompletos' }, 400);
        }
        const r = await client.query(
          `SELECT nome, telefone, email, pin_hash FROM compradores
           WHERE nome = $1 AND regexp_replace(COALESCE(telefone,''),'\\D','','g') = $2 LIMIT 1`,
          [n, t]
        );
        if (!r.rows.length) {
          await client.end();
          return json({ success: false, error: 'Comprador não encontrado', not_found: true }, 404);
        }
        const row = r.rows[0];
        if (!row.pin_hash) {
          await client.end();
          return json({ success: false, error: 'Este comprador ainda não definiu um PIN', no_pin: true }, 403);
        }
        const hash = await hashPin(pin, n + ':' + t);
        if (hash !== row.pin_hash) {
          await client.end();
          return json({ success: false, error: 'PIN incorreto' }, 401);
        }
        await client.end();
        return json({ success: true, data: { nome: row.nome, telefone: row.telefone, email: row.email } });
      }

      if (path === 'admin/login') {
        const { senha } = body;
        const config = await client.query("SELECT valor FROM configuracoes WHERE chave = 'admin_senha'");
        await client.end();
        if (!config.rows.length) {
          return json({ success: false, error: 'Senha de admin não configurada no banco' }, 500);
        }
        const adminPwd = config.rows[0].valor;
        if (senha === adminPwd) {
          return json({ success: true, message: 'Login autorizado' });
        }
        return json({ success: false, error: 'Senha incorreta' }, 401);
      }
    }

    // ===== PUT ROUTES =====
    if (req.method === 'PUT') {
      const body = await req.json();

      // PUT /pedidos/:id/status { status: 'aberto_edicao' | 'pendente' | 'confirmado' }
      const statusMatch = path.match(/^pedidos\/(\d+)\/status$/);
      if (statusMatch) {
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
    }

    // ===== DELETE ROUTES =====
    if (req.method === 'DELETE') {
      if (path === 'pedidos') {
        await client.query('DELETE FROM itens_pedido');
        await client.query('DELETE FROM pedidos');
        await client.end();
        return json({ success: true, message: 'Todos os pedidos foram apagados' });
      }
      const pedidoMatch = path.match(/^pedidos\/(\d+)$/);
      if (pedidoMatch) {
        const pid = parseInt(pedidoMatch[1]);
        await client.query('DELETE FROM itens_pedido WHERE pedido_id = $1', [pid]);
        const r = await client.query('DELETE FROM pedidos WHERE id = $1 RETURNING id', [pid]);
        await client.end();
        if (!r.rowCount) return json({ success: false, error: 'Pedido não encontrado' }, 404);
        return json({ success: true, message: `Pedido ${pid} cancelado` });
      }

      // Apaga todos os pedidos de um comprador (por nome de usuário)
      const pedidoUserMatch = path.match(/^pedidos\/usuario\/(.+)$/);
      if (pedidoUserMatch) {
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
    return json({ success: false, error: error.message }, 500);
  }
}

export const config = { runtime: 'edge' };
