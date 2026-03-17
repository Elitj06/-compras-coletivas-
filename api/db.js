import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// Helper: CORS headers
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}

// Init DB tables on first call
async function initDB() {
  await sql`CREATE TABLE IF NOT EXISTS pedidos (
    id SERIAL PRIMARY KEY,
    usuario TEXT NOT NULL,
    codigo TEXT NOT NULL,
    nome_produto TEXT NOT NULL,
    quantidade INTEGER NOT NULL DEFAULT 1,
    preco_bruto NUMERIC(10,2) NOT NULL,
    preco_desconto NUMERIC(10,2) NOT NULL,
    categoria TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS descontos (
    id SERIAL PRIMARY KEY,
    categoria TEXT NOT NULL UNIQUE,
    percentual NUMERIC(5,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS config (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
  )`;
}

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace('/api/db', '').replace(/^\//, '');

  try {
    await initDB();

    // ===== GET ROUTES =====
    if (req.method === 'GET') {
      // Get all orders
      if (path === 'pedidos') {
        const rows = await sql`SELECT * FROM pedidos ORDER BY created_at DESC`;
        return json({ success: true, data: rows });
      }

      // Get orders grouped by user
      if (path === 'pedidos/por-usuario') {
        const rows = await sql`
          SELECT usuario,
                 json_agg(json_build_object(
                   'codigo', codigo,
                   'nome', nome_produto,
                   'quantidade', quantidade,
                   'preco_bruto', preco_bruto,
                   'preco_desconto', preco_desconto,
                   'categoria', categoria
                 )) as itens,
                 SUM(quantidade) as total_itens,
                 SUM(preco_bruto * quantidade) as total_bruto,
                 SUM(preco_desconto * quantidade) as total_desconto
          FROM pedidos
          GROUP BY usuario
          ORDER BY usuario
        `;
        return json({ success: true, data: rows });
      }

      // Get consolidated report (total by product)
      if (path === 'pedidos/consolidado') {
        const rows = await sql`
          SELECT codigo,
                 nome_produto as nome,
                 categoria,
                 SUM(quantidade) as quantidade_total,
                 AVG(preco_bruto) as preco_bruto,
                 AVG(preco_desconto) as preco_desconto,
                 SUM(preco_bruto * quantidade) as total_bruto,
                 SUM(preco_desconto * quantidade) as total_desconto
          FROM pedidos
          GROUP BY codigo, nome_produto, categoria
          ORDER BY nome_produto
        `;
        return json({ success: true, data: rows });
      }

      // Get stats
      if (path === 'stats') {
        const stats = await sql`
          SELECT
            COUNT(DISTINCT usuario) as compradores,
            COUNT(DISTINCT codigo) as produtos_distintos,
            COALESCE(SUM(quantidade), 0) as total_itens,
            COALESCE(SUM(preco_bruto * quantidade), 0) as total_bruto,
            COALESCE(SUM(preco_desconto * quantidade), 0) as total_desconto
          FROM pedidos
        `;
        return json({ success: true, data: stats[0] });
      }

      // Get discounts
      if (path === 'descontos') {
        const rows = await sql`SELECT * FROM descontos ORDER BY categoria`;
        return json({ success: true, data: rows });
      }

      // Health check
      if (path === '' || path === 'health') {
        return json({ success: true, message: 'Compras Coletivas API online', timestamp: new Date().toISOString() });
      }
    }

    // ===== POST ROUTES =====
    if (req.method === 'POST') {
      const body = await req.json();

      // Submit order
      if (path === 'pedidos') {
        const { usuario, itens } = body;
        if (!usuario || !itens || !itens.length) {
          return json({ success: false, error: 'Dados incompletos' }, 400);
        }

        for (const item of itens) {
          await sql`
            INSERT INTO pedidos (usuario, codigo, nome_produto, quantidade, preco_bruto, preco_desconto, categoria)
            VALUES (${usuario}, ${item.codigo}, ${item.nome}, ${item.quantidade}, ${item.preco_bruto}, ${item.preco_desconto}, ${item.categoria || ''})
          `;
        }

        return json({ success: true, message: `Pedido de ${usuario} registrado com ${itens.length} itens` });
      }

      // Set discount
      if (path === 'descontos') {
        const { categoria, percentual } = body;
        if (categoria === undefined || percentual === undefined) {
          return json({ success: false, error: 'Dados incompletos' }, 400);
        }

        await sql`
          INSERT INTO descontos (categoria, percentual, updated_at)
          VALUES (${categoria}, ${percentual}, NOW())
          ON CONFLICT (categoria) DO UPDATE SET percentual = ${percentual}, updated_at = NOW()
        `;

        return json({ success: true, message: `Desconto de ${percentual}% aplicado em ${categoria}` });
      }

      // Admin login
      if (path === 'admin/login') {
        const { senha } = body;
        // Get admin password from config or use default
        const config = await sql`SELECT valor FROM config WHERE chave = 'admin_password'`;
        const adminPwd = config.length > 0 ? config[0].valor : 'admin123';

        if (senha === adminPwd) {
          return json({ success: true, message: 'Login autorizado' });
        }
        return json({ success: false, error: 'Senha incorreta' }, 401);
      }
    }

    // ===== DELETE ROUTES =====
    if (req.method === 'DELETE') {
      // Clear all orders
      if (path === 'pedidos') {
        await sql`DELETE FROM pedidos`;
        return json({ success: true, message: 'Todos os pedidos foram apagados' });
      }

      // Clear discounts
      if (path === 'descontos') {
        await sql`DELETE FROM descontos`;
        return json({ success: true, message: 'Descontos removidos' });
      }
    }

    return json({ success: false, error: 'Rota não encontrada' }, 404);

  } catch (error) {
    console.error('API Error:', error);
    return json({ success: false, error: error.message }, 500);
  }
}

export const config = { runtime: 'edge' };
