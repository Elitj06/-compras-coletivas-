/**
 * @fileoverview Compras Coletivas API — Vida Forte Nutrientes
 *
 * API REST principal (Edge Runtime) para o sistema de compras coletivas.
 * Todas as rotas estão sob `/api/db`.
 *
 * Funcionalidades:
 * - CRUD de pedidos e itens
 * - Autenticação de compradores via PIN (SHA-256 legado e PBKDF2)
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
import {
  namesEquivalent,
  normalizeNomeTel,
  phonesEquivalent,
} from '../server/lib/buyer-identity.js';
import { timingSafeEqual } from '../server/lib/pin-crypto.js';
import {
  handleBuyerAuthPost,
  handleBuyerAuthPut,
} from '../server/routes/buyer-auth-routes.js';
import { appendCookies, constantTimeEqual, cookie, expiredCookie, parseCookies, parseJsonBody } from '../server/lib/http-security.js';
import { priceItems, validateOrderItems } from '../server/services/order-pricing-service.js';
import { consumeAuthRateLimit } from '../server/services/auth-rate-limit-service.js';

// @vercel/postgres createClient with explicit connectionString
// Bypasses POSTGRES_URL_NON_POOLING env var check
// Supabase pooler URL doesn't match Vercel's "-pooler." pattern so we pass it explicitly

const PRODUCTION_ORIGIN = 'https://compras-coletivas-phi.vercel.app';

const BASE_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-Token, X-Session-Scope',
  'Vary': 'Origin',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

function allowedOrigins() {
  const origins = new Set([PRODUCTION_ORIGIN]);
  if (process.env.VERCEL !== '1') {
    for (const origin of (process.env.ALLOWED_DEV_ORIGINS || '').split(',')) {
      if (origin.trim()) origins.add(origin.trim());
    }
  }
  return origins;
}

function isAllowedOrigin(origin) {
  return allowedOrigins().has(origin);
}

function corsHeadersFor(req) {
  const origin = req?.headers?.get('origin') || '';
  const responseHeaders = { ...BASE_HEADERS };
  if (isAllowedOrigin(origin)) {
    responseHeaders['Access-Control-Allow-Origin'] = origin;
    responseHeaders['Access-Control-Allow-Credentials'] = 'true';
  }
  return responseHeaders;
}

function applyCors(req, response) {
  for (const [name, value] of Object.entries(corsHeadersFor(req))) response.headers.set(name, value);
  return response;
}

function publicOriginError(req) {
  const origin = req.headers.get('origin');
  return origin && !isAllowedOrigin(origin)
    ? securityError('ORIGIN_VALIDATION_FAILED', 403, 'Origem não autorizada')
    : null;
}

/**
 * Cria uma Response JSON com headers CORS padrão.
 * @param {object} data - Payload da resposta.
 * @param {number} [status=200] - HTTP status code.
 * @returns {Response}
 */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: BASE_HEADERS });
}

function securityError(code, status, error) { return json({ success: false, code, error }, status); }

function authResponse(result) {
  const responseHeaders = { ...BASE_HEADERS, 'Cache-Control': 'no-store', Pragma: 'no-cache' };
  if (result.status === 204) return new Response(null, { status: 204, headers: responseHeaders });
  return new Response(JSON.stringify(result.body), {
    status: result.status || 200,
    headers: responseHeaders,
  });
}

const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8;
const BUYER_SESSION_TTL_SECONDS = 60 * 60 * 24;
const PASSWORD_PBKDF2_ITERATIONS = 210000;
const SESSION_ENCODER = new TextEncoder();

async function sha256Hex(text) {
  const buffer = await crypto.subtle.digest('SHA-256', SESSION_ENCODER.encode(text));
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex) {
  const clean = String(hex || '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function randomHex(bytes = 32) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return bytesToHex(data);
}

async function hashToken(token) {
  return sha256Hex(`session:${token}`);
}

async function createAdminSession(client) {
  const token = randomHex(32);
  await client.query(
    `INSERT INTO admin_sessions (token_hash, expires_at)
     VALUES ($1, NOW() + ($2 || ' seconds')::interval)`,
    [await hashToken(token), ADMIN_SESSION_TTL_SECONDS]
  );
  return token;
}

async function createBuyerSession(client, compradorId) {
  const token = randomHex(32);
  await client.query(
    `INSERT INTO buyer_sessions (comprador_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + ($3 || ' seconds')::interval)`,
    [compradorId, await hashToken(token), BUYER_SESSION_TTL_SECONDS]
  );
  return token;
}

/** Retorna a conta de comprador explicitamente vinculada ao administrador. */
async function getAdminBuyer(client) {
  const buyer = await client.query(
    `SELECT c.id, c.nome, c.telefone, c.email
     FROM admin_buyer_link link
     JOIN compradores c ON c.id = link.comprador_id
     WHERE link.singleton = TRUE
     LIMIT 1`
  );
  return buyer.rows[0] || null;
}

async function requireAdmin(req, client) {
  const token = parseCookies(req)['__Host-cc-admin'];
  if (!token) return null;
  const session = await client.query(
    `SELECT id, csrf_token_hash FROM admin_sessions
     WHERE token_hash = $1 AND expires_at > NOW()
     LIMIT 1`,
    [await hashToken(token)]
  );
  if (!session.rows.length) return null;
  return session.rows[0];
}

async function requireBuyer(req, client) {
  const token = parseCookies(req)['__Host-cc-buyer'];
  if (!token) return null;
  const session = await client.query(
    `SELECT c.id, c.nome, c.telefone, c.email, bs.id AS session_id, bs.csrf_token_hash
     FROM buyer_sessions bs
     JOIN compradores c ON c.id = bs.comprador_id
     WHERE bs.token_hash = $1 AND bs.expires_at > NOW()
     LIMIT 1`,
    [await hashToken(token)]
  );
  return session.rows[0] || null;
}

async function csrfValid(req, session, scope) {
  if (!session) return false;
  const origin = req.headers.get('origin');
  const fetchSite = req.headers.get('sec-fetch-site');
  if (origin && !isAllowedOrigin(origin)) return false;
  if (fetchSite && !['same-origin', 'none'].includes(fetchSite)) return false;
  const csrf = parseCookies(req)[`__Host-cc-${scope}-csrf`];
  return constantTimeEqual(csrf, req.headers.get('x-csrf-token')) && constantTimeEqual(await hashToken(`csrf:${csrf}`), session.csrf_token_hash);
}

async function mutationCsrfError(req, path, adminSession, buyerSession) {
  const publicPaths = new Set(['comprador/registro', 'comprador/login', 'admin/login', 'comprador/pin-recovery/complete']);
  if (publicPaths.has(path)) return publicOriginError(req);
  const buyerPaths = path === 'comprador/logout' || path === 'comprador/pin' || (req.method === 'POST' && path === 'pedidos');
  const requestedScope = req.headers.get('x-session-scope');
  if (/^pedidos\/\d+$/.test(path) && !requestedScope) return securityError('AUTH_SCOPE_REQUIRED', 400, 'Escopo da sessão obrigatório');
  if (/^pedidos\/\d+$/.test(path) && !['buyer', 'admin'].includes(requestedScope)) return securityError('AUTH_SCOPE_REQUIRED', 400, 'Escopo da sessão inválido');
  const scope = /^pedidos\/\d+$/.test(path) ? requestedScope : (buyerPaths ? 'buyer' : 'admin');
  const session = scope === 'buyer' ? buyerSession : adminSession;
  if (!session) return unauthorized();
  if (!(await csrfValid(req, session, scope))) return securityError('CSRF_VALIDATION_FAILED', 403, 'Validação CSRF inválida');
  return null;
}

async function issueSessionCookies(client, scope, token, csrf, ttl) {
  const table = scope === 'admin' ? 'admin_sessions' : 'buyer_sessions';
  await client.query(`UPDATE ${table} SET csrf_token_hash = $1 WHERE token_hash = $2`, [await hashToken(`csrf:${csrf}`), await hashToken(token)]);
  return [cookie(`__Host-cc-${scope}`, token, ttl, true), cookie(`__Host-cc-${scope}-csrf`, csrf, ttl, false)];
}

async function getActiveCycle(client) {
  const result = await client.query(
    `SELECT id, nome, inicio_em, fim_em, status FROM ciclos_compra WHERE ativo = TRUE LIMIT 1`
  );
  return result.rows[0] || null;
}

/** Resolve o ciclo administrativo solicitado; sem parâmetro usa o ciclo ativo. */
async function getRequestedAdminCycle(client, url) {
  const requested = url.searchParams.get('ciclo_id');
  if (!requested) return getActiveCycle(client);
  const cycleId = Number(requested);
  if (!Number.isSafeInteger(cycleId) || cycleId < 1) return null;
  const result = await client.query(
    'SELECT id, nome, inicio_em, fim_em, status, ativo FROM ciclos_compra WHERE id = $1 LIMIT 1',
    [cycleId]
  );
  return result.rows[0] || null;
}

async function hashAdminPassword(password, saltHex = randomHex(16)) {
  const key = await crypto.subtle.importKey(
    'raw',
    SESSION_ENCODER.encode(String(password || '')),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: hexToBytes(saltHex),
      iterations: PASSWORD_PBKDF2_ITERATIONS,
    },
    key,
    256
  );
  return `pbkdf2:sha256:${PASSWORD_PBKDF2_ITERATIONS}:${saltHex}:${bytesToHex(new Uint8Array(bits))}`;
}

async function verifyPbkdf2Password(password, savedValue) {
  const [, algorithm, iterationsRaw, saltHex, hashHex] = String(savedValue || '').split(':');
  if (algorithm !== 'sha256' || !iterationsRaw || !saltHex || !hashHex) return false;
  const iterations = Number(iterationsRaw);
  if (!Number.isInteger(iterations) || iterations < 100000) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    SESSION_ENCODER.encode(String(password || '')),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(saltHex), iterations },
    key,
    256
  );
  return timingSafeEqual(hashHex, bytesToHex(new Uint8Array(bits)));
}

async function verifyAdminPassword(client, password) {
  const config = await client.query("SELECT valor FROM configuracoes WHERE chave = 'admin_senha'");
  if (!config.rows.length) return false;
  const savedValue = String(config.rows[0].valor || '');
  if (savedValue.startsWith('pbkdf2:sha256:')) {
    return verifyPbkdf2Password(password, savedValue);
  }
  if (password !== savedValue) return false;
  await client.query(
    "UPDATE configuracoes SET valor = $1, updated_at = NOW() WHERE chave = 'admin_senha'",
    [await hashAdminPassword(password)]
  );
  return true;
}

function trustedAdminRateRequest(req) {
  const secret = process.env.RATE_LIMIT_HMAC_KEY || '';
  if (secret.length < 32) return null;
  const production = process.env.VERCEL === '1';
  const value = production ? (req.headers.get('x-vercel-forwarded-for') || '') : (req.headers.get('x-test-client-ip') || process.env.DEV_TRUSTED_CLIENT_IP || '');
  if (!isCanonicalIp(value)) return null;
  return new Request(req.url, { headers: { 'x-forwarded-for': value } });
}

export function isCanonicalIp(value) {
  if (typeof value !== 'string' || !value || value.includes(',') || value.trim() !== value) return false;
  const v4 = value.split('.');
  if (v4.length === 4) return v4.every((part) => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255);
  if (!/^[0-9a-f:]+$/i.test(value) || value.includes(':::')) return false;
  const compressed = value.indexOf('::');
  if (compressed !== -1 && compressed !== value.lastIndexOf('::')) return false;
  const groups = value.split(':').filter(Boolean);
  if (groups.some((group) => !/^[0-9a-f]{1,4}$/i.test(group))) return false;
  return compressed === -1 ? groups.length === 8 : groups.length < 8;
}

async function consumeAdminLoginLimit(client, req) {
  const trusted = trustedAdminRateRequest(req);
  if (!trusted) return { configured: false };
  await client.query('BEGIN');
  try {
    const ip = await consumeAuthRateLimit(client, trusted, { scope: 'admin_login_ip', key: 'ip', limit: 5, windowSeconds: 900, blockSeconds: 1800 }, process.env);
    const global = await consumeAuthRateLimit(client, trusted, { scope: 'admin_login_global', key: 'global', limit: 60, windowSeconds: 60, blockSeconds: 60 }, process.env);
    await client.query('COMMIT');
    const until = [ip.blockedUntil, global.blockedUntil].filter(Boolean).map((value) => new Date(value).getTime()).reduce((max, value) => Math.max(max, value), 0);
    return { configured: ip.configured && global.configured, blocked: ip.blocked || global.blocked, retryAfter: until ? Math.max(1, Math.ceil((until - Date.now()) / 1000)) : 0 };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}

function unauthorized(message = 'Não autorizado') {
  return json({ success: false, error: message }, 401);
}

function parsePositiveInteger(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
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
  return client;
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
  return applyCors(req, await dispatch(req));
}

async function dispatch(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: BASE_HEADERS });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace('/api/db', '').replace(/^\//, '');
  let adminSession = null;
  let buyerSession = null;

  let client;
  try {
    client = await getClient();
    adminSession = await requireAdmin(req, client);
    buyerSession = await requireBuyer(req, client);

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

      if (path === 'ciclos-compra') {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        const rows = await client.query(
          'SELECT id, nome, inicio_em, fim_em, status, ativo FROM ciclos_compra ORDER BY inicio_em DESC'
        );
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
            AND p.ciclo_id = (SELECT id FROM ciclos_compra WHERE ativo = TRUE)
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
        const cycle = await getRequestedAdminCycle(client, url);
        if (!cycle) {
          await client.end();
          return json({ success: false, error: 'Ciclo de compra não encontrado' }, 404);
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
            AND p.ciclo_id = $1
          GROUP BY p.usuario
          ORDER BY p.usuario
        `, [cycle.id]);
        await client.end();
        return json({ success: true, data: rows.rows });
      }

      if (path === 'pedidos/consolidado') {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        const cycle = await getRequestedAdminCycle(client, url);
        if (!cycle) {
          await client.end();
          return json({ success: false, error: 'Ciclo de compra não encontrado' }, 404);
        }
        const rows = await client.query(`
          SELECT COALESCE(ip.codigo,'') AS codigo, COALESCE(ip.nome_produto,'') AS nome,
            COALESCE(ip.categoria,'') AS categoria, ROUND(AVG(ip.preco_unitario),2) AS preco_unitario,
            ROUND(AVG(ip.desconto_percentual),2) AS desconto_percentual,
            ROUND(AVG(ip.preco_com_desconto),2) AS preco_com_desconto,
            SUM(ip.quantidade) AS quantidade_total, SUM(ip.subtotal_bruto) AS total_bruto,
            SUM(ip.subtotal_final) AS total_final
          FROM itens_pedido ip JOIN pedidos p ON p.id = ip.pedido_id
          WHERE p.status != 'cancelado' AND p.ciclo_id = $1
          GROUP BY ip.codigo, ip.nome_produto, ip.categoria ORDER BY ip.nome_produto
        `, [cycle.id]);
        await client.end();
        return json({ success: true, data: rows.rows });
      }

      if (path === 'stats') {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        const cycle = await getRequestedAdminCycle(client, url);
        if (!cycle) {
          await client.end();
          return json({ success: false, error: 'Ciclo de compra não encontrado' }, 404);
        }
        const stats = await client.query(`
          SELECT
            (SELECT COUNT(DISTINCT usuario) FROM pedidos WHERE status != 'cancelado' AND ciclo_id = $1) AS total_compradores,
            (SELECT COUNT(DISTINCT COALESCE(ip.codigo, ip.nome_produto)) FROM itens_pedido ip JOIN pedidos p ON p.id = ip.pedido_id WHERE p.status != 'cancelado' AND p.ciclo_id = $1) AS produtos_distintos,
            (SELECT COALESCE(SUM(ip.quantidade), 0) FROM itens_pedido ip JOIN pedidos p ON p.id = ip.pedido_id WHERE p.status != 'cancelado' AND p.ciclo_id = $1) AS unidades_totais,
            (SELECT COALESCE(SUM(total_bruto), 0) FROM pedidos WHERE status != 'cancelado' AND ciclo_id = $1) AS valor_bruto_geral,
            (SELECT COALESCE(SUM(total_desconto), 0) FROM pedidos WHERE status != 'cancelado' AND ciclo_id = $1) AS economia_geral
        `, [cycle.id]);
        await client.end();
        return json({ success: true, data: stats.rows[0] });
      }

      if (path === 'descontos') {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
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
          SELECT c.id, c.nome, c.telefone, c.email,
            (c.pin_hash IS NOT NULL) AS has_pin,
            (SELECT COUNT(*) FROM pedidos p WHERE p.usuario = c.nome AND p.status != 'cancelado') AS total_pedidos
          FROM compradores c
          ORDER BY c.nome
        `);
        await client.end();
        return json({ success: true, data: rows.rows });
      }

      // Histórico de pedidos de um comprador autenticado.
      if (path === 'pedidos/historico') {
        const usuario = url.searchParams.get('usuario') || '';
        const telefone = (url.searchParams.get('telefone') || '').replace(/\D/g, '');
        const isAdminLookup = adminSession && usuario && telefone;
        if (!buyerSession && !isAdminLookup) {
          await client.end();
          return unauthorized();
        }
        const params = isAdminLookup ? [usuario, telefone] : [buyerSession.id];
        const where = isAdminLookup
          ? `LOWER(p.usuario) = LOWER($1) AND regexp_replace(COALESCE(c.telefone,''), '\\D', '', 'g') = $2`
          : `p.comprador_id = $1`;
        const rows = await client.query(`
          SELECT p.id, p.created_at, p.status, p.total_bruto, p.total_final, p.total_desconto,
            cc.nome AS ciclo_nome, cc.ativo AS ciclo_ativo,
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
          LEFT JOIN compradores c ON c.id = p.comprador_id OR (p.comprador_id IS NULL AND c.nome = p.usuario)
          JOIN ciclos_compra cc ON cc.id = p.ciclo_id
          WHERE ${where} AND p.status != 'cancelado'
          GROUP BY p.id, cc.nome, cc.ativo
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
        const cycle = await getRequestedAdminCycle(client, url);
        if (!cycle) {
          await client.end();
          return json({ success: false, error: 'Ciclo de compra não encontrado' }, 404);
        }
        const rows = await client.query(`
          SELECT p.id, p.pedido_id, p.comprador, p.valor_compra,
            p.parc1, p.parc2, p.parc3, p.observacoes, p.created_at, p.updated_at,
            COALESCE(p.parc1,0) + COALESCE(p.parc2,0) + COALESCE(p.parc3,0) as total_pago,
            p.valor_compra - (COALESCE(p.parc1,0) + COALESCE(p.parc2,0) + COALESCE(p.parc3,0)) as total_devido
          FROM pagamentos p JOIN pedidos pe ON pe.id = p.pedido_id
          WHERE pe.ciclo_id = $1
          ORDER BY p.comprador
        `, [cycle.id]);
        await client.end();
        return json({ success: true, data: rows.rows });
      }

      // GET /pagamentos/resumo — totais gerais (máx 3 parcelas)
      if (path === 'pagamentos/resumo') {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        const cycle = await getRequestedAdminCycle(client, url);
        if (!cycle) {
          await client.end();
          return json({ success: false, error: 'Ciclo de compra não encontrado' }, 404);
        }
        const rows = await client.query(`
          SELECT COUNT(*) as total_compradores, SUM(valor_compra) as total_compras, 
            SUM(COALESCE(parc1,0)+COALESCE(parc2,0)+COALESCE(parc3,0)) as total_recebido,
            SUM(valor_compra) - SUM(COALESCE(parc1,0)+COALESCE(parc2,0)+COALESCE(parc3,0)) as total_pendente
          FROM pagamentos pg JOIN pedidos p ON p.id = pg.pedido_id
          WHERE p.ciclo_id = $1
        `, [cycle.id]);
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
          WHERE p.status != 'cancelado' AND p.ciclo_id = COALESCE($1::int, (SELECT id FROM ciclos_compra WHERE ativo = TRUE))
          ORDER BY p.usuario, ip.nome_produto
        `, [Number(url.searchParams.get('ciclo_id')) || null]);
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
            ...BASE_HEADERS,
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename=relatorio_compras_coletivas.csv',
          }
        });
      }

      if (path === 'admin/session') {
        await client.end();
        if (!adminSession) return unauthorized();
        return json({ success: true, data: { active: true } });
      }

      if (path === 'comprador/session') {
        await client.end();
        if (!buyerSession) return unauthorized();
        return json({
          success: true,
          data: {
            id: buyerSession.id,
            nome: buyerSession.nome,
            telefone: buyerSession.telefone,
            email: buyerSession.email,
          },
        });
      }
    }

    // ===== POST ROUTES =====
    if (req.method === 'POST') {
      const parsed = await parseJsonBody(req);
      if (parsed.error) { await client.end(); return securityError(parsed.error, parsed.status, parsed.error === 'INVALID_JSON' ? 'JSON inválido' : 'Corpo excede o limite permitido'); }
      const body = parsed.value;

      if (path === 'comprador/logout' && !buyerSession) {
        const response = new Response(null, { status: 204, headers: BASE_HEADERS });
        appendCookies(response, [expiredCookie('__Host-cc-buyer'), expiredCookie('__Host-cc-buyer-csrf', false)]);
        await client.end();
        return response;
      }

      if (path === 'admin/logout' && !adminSession) {
        const response = new Response(null, { status: 204, headers: BASE_HEADERS });
        appendCookies(response, [expiredCookie('__Host-cc-admin'), expiredCookie('__Host-cc-admin-csrf', false)]);
        await client.end();
        return response;
      }

      const csrfError = await mutationCsrfError(req, path, adminSession, buyerSession);
      if (csrfError) { await client.end(); return csrfError; }

      if (path === 'comprador/logout' && !(await csrfValid(req, buyerSession, 'buyer'))) { await client.end(); return securityError('CSRF_VALIDATION_FAILED', 403, 'Validação CSRF inválida'); }

      if (path === 'admin/logout') {
        await client.query('DELETE FROM admin_sessions WHERE id = $1', [adminSession.id]);
        const response = new Response(null, { status: 204, headers: BASE_HEADERS });
        appendCookies(response, [expiredCookie('__Host-cc-admin'), expiredCookie('__Host-cc-admin-csrf', false)]);
        await client.end();
        return response;
      }

      const authResult = await handleBuyerAuthPost({
        path,
        req,
        body,
        client,
        adminSession,
        buyerSession,
        createBuyerSession,
        env: process.env,
      });
      if (authResult) {
        const token = authResult.body?.token || authResult.body?.data?.token;
        if (authResult.body) { delete authResult.body.token; if (authResult.body.data) delete authResult.body.data.token; }
        const response = authResponse(authResult);
        if (token) {
          const csrf = randomHex(32);
          appendCookies(response, await issueSessionCookies(client, 'buyer', token, csrf, BUYER_SESSION_TTL_SECONDS));
          if (response.status !== 204) {
            delete authResult.body.token; delete authResult.body?.data?.token;
          }
        }
        if (path === 'comprador/logout' || path === 'comprador/pin-recovery/complete') appendCookies(response, [expiredCookie('__Host-cc-buyer'), expiredCookie('__Host-cc-buyer-csrf', false)]);
        await client.end();
        return response;
      }

      if (path === 'pedidos') {
        if (!buyerSession) {
          await client.end();
          return unauthorized('Faça login novamente para enviar seu pedido');
        }
        if (!(await csrfValid(req, buyerSession, 'buyer'))) {
          await client.end(); return securityError('CSRF_VALIDATION_FAILED', 403, 'Validação CSRF inválida');
        }
        const { itens, replace_pedido_id } = body;
        const itemError = validateOrderItems(itens);
        if (itemError) {
          await client.end();
          return securityError(itemError.code, itemError.status, 'Itens do pedido inválidos');
        }

        await client.query('BEGIN');
        try {
          const replacePedidoId = replace_pedido_id === null || replace_pedido_id === undefined
            ? null
            : parsePositiveInteger(replace_pedido_id);
          if (replace_pedido_id !== null && replace_pedido_id !== undefined && !replacePedidoId) {
            await client.query('ROLLBACK');
            await client.end();
            return securityError('INVALID_ORDER_REPLACEMENT_ID', 400, 'Pedido de substituição inválido');
          }
          if (replacePedidoId) {
            const editable = await client.query(
              `SELECT id FROM pedidos
              WHERE id = $1 AND comprador_id = $2 AND status = 'aberto_edicao' FOR UPDATE
               LIMIT 1`,
              [replacePedidoId, buyerSession.id]
            );
            if (!editable.rows.length) {
              await client.query('ROLLBACK');
              await client.end();
              return securityError('ORDER_REPLACEMENT_CONFLICT', 409, 'Pedido em edição não está mais disponível');
            }
          }

          // Proteção contra envios duplicados: verifica se já existe pedido
          const dup = await client.query(
            `SELECT id
             FROM pedidos
             WHERE (comprador_id = $1 OR (comprador_id IS NULL AND usuario = $2))
               AND status IN ('pendente','aberto_edicao')
               AND created_at > NOW() - INTERVAL '60 seconds'
               AND ($3::int IS NULL OR id <> $3)
             LIMIT 1`,
            [buyerSession.id, buyerSession.nome, replacePedidoId]
          );
          if (dup.rows.length) {
            await client.query('ROLLBACK');
            await client.end();
            return json({ success: false, duplicate: true, error: 'Pedido recente já existe. Aguarde ou edite o pedido existente.' }, 409);
          }

          const cycle = await getActiveCycle(client);
          if (!cycle) {
            await client.query('ROLLBACK');
            await client.end();
            return json({ success: false, error: 'Não há ciclo de compras aberto no momento' }, 409);
          }
          await client.query("SELECT pg_advisory_xact_lock(hashtext('compras_coletivas:pricing-policy:v1'))");
          const codes = itens.map((item) => String(item.codigo).trim());
          const catalog = await client.query(
            `SELECT p.codigo, p.nome, p.preco, c.slug AS categoria,
              COALESCE(ds.percentual, dg.percentual, 0) AS desconto
             FROM produtos p JOIN categorias c ON c.id = p.categoria_id
             LEFT JOIN descontos ds ON ds.ativo = TRUE AND ds.categoria_id = c.id
             LEFT JOIN descontos dg ON dg.ativo = TRUE AND dg.categoria = 'todos' AND dg.categoria_id IS NULL
             WHERE p.ativo = TRUE AND lower(btrim(p.codigo)) = ANY($1::text[])`,
            [codes.map((code) => code.toLowerCase())]
          );
          if (catalog.rows.length !== codes.length) { await client.query('ROLLBACK'); await client.end(); return securityError('CATALOG_ITEM_UNAVAILABLE', 409, 'Produto indisponível'); }
          let pricing;
          try { pricing = priceItems(catalog.rows, itens); } catch (error) { await client.query('ROLLBACK'); await client.end(); return securityError(error.code || 'CATALOG_ITEM_UNAVAILABLE', error.status || 409, 'Catálogo indisponível'); }
          if (replacePedidoId) {
            await client.query('DELETE FROM itens_pedido WHERE pedido_id = $1', [replacePedidoId]);
            await client.query('DELETE FROM pedidos WHERE id = $1', [replacePedidoId]);
          }
          const pedidoResult = await client.query(
            'INSERT INTO pedidos (comprador_id, usuario, status, ciclo_id) VALUES ($1, $2, $3, $4) RETURNING id',
            [buyerSession.id, buyerSession.nome, 'pendente', cycle.id]
          );
          const pedidoId = pedidoResult.rows[0].id;

          for (const item of pricing.items) {
            const precoBruto = item.bruto / 100; const precoDesconto = item.final / 100;
            const subtBruto = precoBruto * item.quantidade; const subtFinal = precoDesconto * item.quantidade;

            await client.query(
              `INSERT INTO itens_pedido (
                pedido_id, codigo, nome_produto, quantidade,
                preco_unitario, preco_bruto, preco_com_desconto, preco_desconto,
                desconto_percentual, subtotal_bruto, subtotal_final, categoria
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
              [pedidoId, item.codigo, item.nome, item.quantidade, precoBruto, precoBruto, precoDesconto, precoDesconto, item.desconto, subtBruto, subtFinal, item.categoria]
            );
          }

          await client.query(
            'UPDATE pedidos SET total_bruto = $1, total_final = $2, total_desconto = $3 WHERE id = $4',
            [pricing.totalBruto / 100, pricing.totalFinal / 100, (pricing.totalBruto - pricing.totalFinal) / 100, pedidoId]
          );
          await client.query('COMMIT');

          await client.end();
          return json({
            success: true,
            message: `Pedido de ${buyerSession.nome} registrado com ${itens.length} itens`, pedido_id: pedidoId,
            totais: { bruto: pricing.totalBruto / 100, final: pricing.totalFinal / 100, desconto: (pricing.totalBruto - pricing.totalFinal) / 100 }
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
        const normalized = String(categoria).trim(); const percent = Number(percentual);
        if (!normalized || !Number.isFinite(percent) || percent < 0 || percent > 100) { await client.end(); return securityError('INVALID_DISCOUNT_POLICY', 400, 'Política de desconto inválida'); }
        await client.query('BEGIN');
        try {
          await client.query("SELECT pg_advisory_xact_lock(hashtext('compras_coletivas:pricing-policy:v1'))");
          const category = normalized === 'todos' ? null : await client.query('SELECT id, slug FROM categorias WHERE slug = $1 LIMIT 2', [normalized]);
          if (category && category.rows.length !== 1) { await client.query('ROLLBACK'); await client.end(); return securityError('PRICING_POLICY_AMBIGUOUS', 409, 'Categoria ambígua'); }
          const categoryId = category ? category.rows[0].id : null;
          await client.query('UPDATE descontos SET ativo = FALSE WHERE ativo = TRUE AND COALESCE(categoria_id, 0) = COALESCE($1, 0)', [categoryId]);
          await client.query('INSERT INTO descontos (categoria_id, categoria, percentual, ativo) VALUES ($1, $2, $3, TRUE)', [categoryId, normalized, percent]);
          await client.query('COMMIT'); await client.end();
          return json({ success: true, message: `Desconto de ${percent}% aplicado em ${normalized}` });
        } catch (error) { await client.query('ROLLBACK'); throw error; }
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
          AND p.ciclo_id = (SELECT id FROM ciclos_compra WHERE ativo = TRUE)
          AND NOT EXISTS (SELECT 1 FROM pagamentos pg WHERE pg.pedido_id = p.id)
        `);
        await client.end();
        return json({ success: true, message: `${r.rowCount} registro(s) de pagamento criado(s)`, created: r.rowCount });
      }

      if (path === 'admin/login') {
        const { senha } = body;
        const limit = await consumeAdminLoginLimit(client, req);
        if (!limit.configured) { await client.end(); return securityError('AUTH_RATE_LIMIT_UNAVAILABLE', 503, 'Autenticação temporariamente indisponível'); }
        if (limit.blocked) { await client.end(); const response = securityError('ADMIN_LOGIN_RATE_LIMITED', 429, 'Credenciais inválidas'); response.headers.set('Retry-After', String(limit.retryAfter)); return response; }
        const isValid = await verifyAdminPassword(client, senha);
        if (isValid) {
          const token = await createAdminSession(client); const csrf = randomHex(32);
          const buyer = await getAdminBuyer(client);
          const buyerToken = buyer ? await createBuyerSession(client, buyer.id) : null;
          const response = json({
            success: true,
            message: 'Login autorizado',
            comprador: buyer || null,
            data: { comprador: buyer || null }
          });
          appendCookies(response, await issueSessionCookies(client, 'admin', token, csrf, ADMIN_SESSION_TTL_SECONDS));
          if (buyerToken) appendCookies(response, await issueSessionCookies(client, 'buyer', buyerToken, randomHex(32), BUYER_SESSION_TTL_SECONDS));
          await client.end();
          return response;
        }
        await client.end();
        return json({ success: false, error: 'Senha incorreta' }, 401);
      }
    }

    // ===== PUT ROUTES =====
    if (req.method === 'PUT') {
      const parsed = await parseJsonBody(req);
      if (parsed.error) { await client.end(); return securityError(parsed.error, parsed.status, 'JSON inválido'); }
      const body = parsed.value;

      const csrfError = await mutationCsrfError(req, path, adminSession, buyerSession);
      if (csrfError) { await client.end(); return csrfError; }

      if (path === 'comprador/pin' && !(await csrfValid(req, buyerSession, 'buyer'))) { await client.end(); return securityError('CSRF_VALIDATION_FAILED', 403, 'Validação CSRF inválida'); }

      const authResult = await handleBuyerAuthPut({
        path,
        req,
        body,
        client,
        buyerSession,
        createBuyerSession,
        env: process.env,
      });
      if (authResult) {
        const token = authResult.body?.token || authResult.body?.data?.token;
        if (authResult.body) { delete authResult.body.token; if (authResult.body.data) delete authResult.body.data.token; }
        const response = authResponse(authResult);
        if (token) appendCookies(response, await issueSessionCookies(client, 'buyer', token, randomHex(32), BUYER_SESSION_TTL_SECONDS));
        await client.end();
        return response;
      }

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
          'UPDATE pagamentos SET parc1=$1, parc2=$2, parc3=$3, observacoes=$4, updated_at=NOW() WHERE id=$5 RETURNING id',
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
          'UPDATE pedidos SET status = $1, updated_at = NOW() WHERE id = $2 AND ciclo_id = (SELECT id FROM ciclos_compra WHERE ativo = TRUE) RETURNING id',
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
          `UPDATE pedidos SET status = $1, updated_at = NOW() WHERE usuario = $2 AND status != 'cancelado' AND ciclo_id = (SELECT id FROM ciclos_compra WHERE ativo = TRUE) RETURNING id`,
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
        await client.query('BEGIN');
        try {
          await client.query("SELECT pg_advisory_xact_lock(hashtext('compras_coletivas:pricing-policy:v1'))");
          const item = await client.query(
            `SELECT ip.pedido_id, ip.preco_unitario, ip.preco_com_desconto
             FROM itens_pedido ip JOIN pedidos p ON p.id = ip.pedido_id
             WHERE ip.id = $1 AND p.ciclo_id = (SELECT id FROM ciclos_compra WHERE ativo = TRUE)`,
            [iid]
          );
          if (!item.rows.length) {
            await client.query('ROLLBACK');
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
          await client.query('COMMIT');
          await client.end();
          return json({ success: true, message: `Quantidade atualizada para ${qty}` });
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
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
          `SELECT id FROM pedidos WHERE usuario = $1 AND status != 'cancelado'
           AND ciclo_id = (SELECT id FROM ciclos_compra WHERE ativo = TRUE) ORDER BY created_at DESC`,
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
        const pid = parsePositiveInteger(addItemMatch[1]);
        const { codigo, quantidade } = body;
        if (!codigo || !Number.isSafeInteger(quantidade) || quantidade < 1 || quantidade > 99) {
          await client.end();
          return securityError('INVALID_ORDER_ITEM_QUANTITY', 400, 'Dados do item inválidos');
        }
        const qty = quantidade;

        await client.query('BEGIN');
        try {
          await client.query("SELECT pg_advisory_xact_lock(hashtext('compras_coletivas:pricing-policy:v1'))");
          const target = await client.query(
            'SELECT id FROM pedidos WHERE id = $1 AND ciclo_id = (SELECT id FROM ciclos_compra WHERE ativo = TRUE) FOR UPDATE',
            [pid]
          );
          if (!target.rows.length) { await client.query('ROLLBACK'); await client.end(); return json({ success: false, error: 'Pedido não está no ciclo ativo' }, 409); }
          const product = await client.query(
            `SELECT p.codigo, p.nome, p.preco, c.slug AS categoria, COALESCE(ds.percentual, dg.percentual, 0) AS desconto
             FROM produtos p JOIN categorias c ON c.id = p.categoria_id
             LEFT JOIN descontos ds ON ds.ativo AND ds.categoria_id = c.id
             LEFT JOIN descontos dg ON dg.ativo AND dg.categoria = 'todos' AND dg.categoria_id IS NULL
             WHERE p.ativo AND lower(btrim(p.codigo)) = lower(btrim($1))`, [codigo]);
          if (product.rows.length !== 1) { await client.query('ROLLBACK'); await client.end(); return securityError('CATALOG_ITEM_UNAVAILABLE', 409, 'Produto indisponível'); }
          const canonical = priceItems(product.rows, [{ codigo, quantidade: qty }]).items[0];
          const nome = canonical.nome; const categoria = canonical.categoria;
          const pBruto = canonical.bruto / 100; const pDesc = canonical.final / 100;
          // Verifica se já existe esse produto no pedido — se sim, incrementa
          const existingItem = await client.query(
            'SELECT id, quantidade, preco_unitario, preco_com_desconto FROM itens_pedido WHERE pedido_id = $1 AND codigo = $2 LIMIT 1',
            [pid, codigo]
          );
          if (existingItem.rows.length) {
            const ei = existingItem.rows[0];
            const newQty = ei.quantidade + qty;
            if (newQty > 99) { await client.query('ROLLBACK'); await client.end(); return securityError('INVALID_ORDER_ITEM_QUANTITY', 400, 'Quantidade máxima por item excedida'); }
            const snapshotBruto = Number(ei.preco_unitario);
            const snapshotFinal = Number(ei.preco_com_desconto);
            await client.query(
              `UPDATE itens_pedido SET quantidade = $1, subtotal_bruto = $2, subtotal_final = $3 WHERE id = $4`,
              [newQty, snapshotBruto * newQty, snapshotFinal * newQty, ei.id]
            );
          } else {
            const descPct = pBruto > 0 ? Math.round((1 - pDesc / pBruto) * 100) : 0;
            const subtBruto = pBruto * qty;
            const subtFinal = pDesc * qty;
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
          await client.query('COMMIT');
          await client.end();
          return json({ success: true, message: `Item ${nome} adicionado ao pedido ${pid}` });
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }
    }

    // ===== DELETE ROUTES =====
    if (req.method === 'DELETE') {
      const csrfError = await mutationCsrfError(req, path, adminSession, buyerSession);
      if (csrfError) { await client.end(); return csrfError; }
      if (path === 'pedidos') {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        await client.query('BEGIN');
        try {
          await client.query('DELETE FROM itens_pedido WHERE pedido_id IN (SELECT id FROM pedidos WHERE ciclo_id = (SELECT id FROM ciclos_compra WHERE ativo = TRUE))');
          await client.query('DELETE FROM pedidos WHERE ciclo_id = (SELECT id FROM ciclos_compra WHERE ativo = TRUE)');
          await client.query('COMMIT');
          await client.end();
          return json({ success: true, message: 'Todos os pedidos foram apagados' });
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }
      const pedidoMatch = path.match(/^pedidos\/(\d+)$/);
      if (pedidoMatch) {
        const pid = parseInt(pedidoMatch[1]);
        const deleteScope = req.headers.get('x-session-scope');
        if (deleteScope === 'buyer') {
          if (!buyerSession) {
            await client.end();
            return unauthorized();
          }
          const owner = await client.query(
            `SELECT p.id
             FROM pedidos p
             WHERE p.id = $1
               AND p.comprador_id = $2`,
            [pid, buyerSession.id]
          );
          if (!owner.rows.length) {
            await client.end();
            return unauthorized();
          }
        } else if (deleteScope !== 'admin' || !adminSession) { await client.end(); return unauthorized(); }
        await client.query('BEGIN');
        try {
          await client.query('DELETE FROM itens_pedido WHERE pedido_id = $1 AND EXISTS (SELECT 1 FROM pedidos WHERE id = $1 AND ciclo_id = (SELECT id FROM ciclos_compra WHERE ativo = TRUE))', [pid]);
          const r = await client.query('DELETE FROM pedidos WHERE id = $1 AND ciclo_id = (SELECT id FROM ciclos_compra WHERE ativo = TRUE) RETURNING id', [pid]);
          await client.query('COMMIT');
          await client.end();
          if (!r.rowCount) return json({ success: false, error: 'Pedido não encontrado' }, 404);
          return json({ success: true, message: `Pedido ${pid} cancelado` });
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }

      // Apaga todos os pedidos de um comprador (por nome de usuário)
      const pedidoUserMatch = path.match(/^pedidos\/usuario\/(.+)$/);
      if (pedidoUserMatch) {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        const usuario = decodeURIComponent(pedidoUserMatch[1]);
        await client.query('BEGIN');
        try {
          await client.query(
            'DELETE FROM itens_pedido WHERE pedido_id IN (SELECT id FROM pedidos WHERE usuario = $1 AND ciclo_id = (SELECT id FROM ciclos_compra WHERE ativo = TRUE))',
            [usuario]
          );
          const r = await client.query('DELETE FROM pedidos WHERE usuario = $1 AND ciclo_id = (SELECT id FROM ciclos_compra WHERE ativo = TRUE) RETURNING id', [usuario]);
          await client.query('COMMIT');
          await client.end();
          return json({ success: true, message: `${r.rowCount} pedido(s) de ${usuario} apagados` });
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }

      // Remove um item específico de um pedido
      const itemMatch = path.match(/^itens\/(\d+)$/);
      if (itemMatch) {
        if (!adminSession) {
          await client.end();
          return unauthorized();
        }
        const iid = parseInt(itemMatch[1]);
        await client.query('BEGIN');
        try {
          const r = await client.query(`DELETE FROM itens_pedido ip USING pedidos p
            WHERE ip.id = $1 AND p.id = ip.pedido_id
              AND p.ciclo_id = (SELECT id FROM ciclos_compra WHERE ativo = TRUE)
            RETURNING ip.pedido_id`, [iid]);
          if (r.rowCount) {
            const pedidoId = r.rows[0].pedido_id;
            const count = await client.query('SELECT COUNT(*)::int AS c FROM itens_pedido WHERE pedido_id = $1', [pedidoId]);
            if (count.rows[0].c === 0) {
              await client.query('DELETE FROM pedidos WHERE id = $1', [pedidoId]);
            }
          }
          await client.query('COMMIT');
          await client.end();
          if (!r.rowCount) return json({ success: false, error: 'Item não encontrado' }, 404);
          return json({ success: true, message: `Item ${iid} removido` });
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
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
        await client.query('BEGIN');
        try {
          const r = await client.query(`DELETE FROM itens_pedido ip USING pedidos p
            WHERE ip.codigo = $1 AND p.id = ip.pedido_id
              AND p.ciclo_id = (SELECT id FROM ciclos_compra WHERE ativo = TRUE)
            RETURNING ip.pedido_id`, [codigo]);
          await client.query(`
            DELETE FROM pedidos WHERE id NOT IN (SELECT DISTINCT pedido_id FROM itens_pedido)
              AND ciclo_id = (SELECT id FROM ciclos_compra WHERE ativo = TRUE)
          `);
          await client.query('COMMIT');
          await client.end();
          return json({ success: true, message: `${r.rowCount} ocorrência(s) do produto ${codigo} removidas` });
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
        await client.query('BEGIN');
        try { await client.query("SELECT pg_advisory_xact_lock(hashtext('compras_coletivas:pricing-policy:v1'))"); await client.query('UPDATE descontos SET ativo = FALSE'); await client.query('COMMIT'); await client.end(); return json({ success: true, message: 'Descontos desativados' }); }
        catch (error) { await client.query('ROLLBACK'); throw error; }
      }
    }

    await client.end();
    return json({ success: false, error: 'Rota não encontrada' }, 404);

  } catch (error) {
    console.error('API Error:', error);
    if (client) try { await client.end(); } catch (_) {}
    return json({ success: false, error: 'Erro interno. Tente novamente.' }, 500);
  }
}

export const config = { runtime: 'edge' };
