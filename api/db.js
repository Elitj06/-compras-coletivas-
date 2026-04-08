import { sql } from '@vercel/postgres';

// @vercel/postgres sql tag — reads POSTGRES_URL from env automatically
// Works with pooled connections (Supabase PgBouncer)
// Schema compras_coletivas set per-query since each sql call is independent

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}

// Helper to run a query with the correct schema
function q(strings, ...values) {
  // Prepend SET search_path to each query using a CTE or just schema-qualify
  // Since sql` tag makes independent HTTP calls, we use SET + query in one call
  // by wrapping in a DO block or using schema-qualified names
  // Simplest: just prepend SET and run as two queries won't work (separate connections)
  // So we use a transaction approach: SET + SELECT in one sql call via semicolon
  return sql`SET search_path TO compras_coletivas; `.then(() => sql(strings, ...values));
}

// Actually, sql from @vercel/postgres uses neon() under the hood (HTTP-based)
// SET search_path doesn't persist between calls. 
// Solution: wrap each query block in a function that sets schema first.
// Better: use the options parameter in POSTGRES_URL or schema-qualify all tables.

// CLEANEST APPROACH: Wrap queries to always set search_path in same "connection"
// Since neon/sql is stateless HTTP, we need to combine SET + query in one statement.
// We'll use a helper that concatenates SET + query.

async function withSchema(queryFn) {
  // @vercel/postgres sql tag uses neon HTTP client - each call is independent
  // We need to use createPool() for stateful connections where SET persists
  const { createPool } = await import('@vercel/postgres');
  const pool = createPool();
  const client = await pool.connect();
  try {
    await client.query('SET search_path TO compras_coletivas');
    return await queryFn(client);
  } finally {
    client.release();
  }
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace('/api/db', '').replace(/^\//, '');

  try {

    // ===== GET ROUTES =====
    if (req.method === 'GET') {

      if (path === '' || path === 'health') {
        const result = await withSchema(async (client) => {
          const res = await client.query("SELECT COUNT(*) as tabelas FROM information_schema.tables WHERE table_schema = 'compras_coletivas'");
          return res.rows[0];
        });
        return json({
          success: true,
          message: 'Compras Coletivas API online',
          tabelas: result.tabelas,
          timestamp: new Date().toISOString()
        });
      }

      if (path === 'tables') {
        const rows = await withSchema(async (client) => {
          const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'compras_coletivas' ORDER BY table_name");
          return res.rows;
        });
        return json({ success: true, data: rows });
      }

      if (path === 'pedidos') {
        const rows = await withSchema(async (client) => {
          const res = await client.query(`
            SELECT ip.*, p.usuario, p.status, p.created_at as pedido_data
            FROM itens_pedido ip
            JOIN pedidos p ON ip.pedido_id = p.id
            WHERE p.status != 'cancelado'
            ORDER BY p.created_at DESC
          `);
          return res.rows;
        });
        return json({ success: true, data: rows });
      }

      if (path === 'pedidos/por-usuario') {
        const rows = await withSchema(async (client) => {
          const res = await client.query(`
            SELECT 
              p.usuario,
              MAX(c.telefone) as telefone,
              MAX(c.email) as email,
              json_agg(json_build_object(
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
          return res.rows;
        });
        return json({ success: true, data: rows });
      }

      if (path === 'pedidos/consolidado') {
        const rows = await withSchema(async (client) => {
          const res = await client.query('SELECT * FROM vw_relatorio_produtos');
          return res.rows;
        });
        return json({ success: true, data: rows });
      }

      if (path === 'stats') {
        const stats = await withSchema(async (client) => {
          const res = await client.query('SELECT * FROM vw_dashboard_stats');
          return res.rows[0];
        });
        return json({ success: true, data: stats });
      }

      if (path === 'descontos') {
        const rows = await withSchema(async (client) => {
          const res = await client.query('SELECT * FROM descontos WHERE ativo = TRUE ORDER BY categoria');
          return res.rows;
        });
        return json({ success: true, data: rows });
      }

      if (path === 'faixas-desconto') {
        const rows = await withSchema(async (client) => {
          const res = await client.query('SELECT * FROM faixas_desconto WHERE ativo = TRUE ORDER BY valor_minimo');
          return res.rows;
        });
        return json({ success: true, data: rows });
      }

      if (path === 'categorias') {
        const rows = await withSchema(async (client) => {
          const res = await client.query('SELECT * FROM categorias ORDER BY nome');
          return res.rows;
        });
        return json({ success: true, data: rows });
      }

      if (path === 'compradores') {
        const rows = await withSchema(async (client) => {
          const res = await client.query('SELECT * FROM vw_relatorio_compradores');
          return res.rows;
        });
        return json({ success: true, data: rows });
      }

      if (path === 'exportar-csv') {
        const rows = await withSchema(async (client) => {
          const res = await client.query(`
            SELECT p.usuario AS comprador, ip.codigo, ip.nome_produto AS produto,
              ip.quantidade, ip.preco_unitario, ip.desconto_percentual,
              ip.preco_com_desconto, ip.subtotal_bruto, ip.subtotal_final,
              p.created_at AS data_pedido
            FROM itens_pedido ip
            JOIN pedidos p ON ip.pedido_id = p.id
            WHERE p.status != 'cancelado'
            ORDER BY p.usuario, ip.nome_produto
          `);
          return res.rows;
        });
        let csv = 'Comprador;Código;Produto;Qtd;Preço Unit.;Desconto %;Preço c/ Desc.;Total Bruto;Total Final;Data\n';
        for (const r of rows) {
          const data = new Date(r.data_pedido).toLocaleDateString('pt-BR');
          csv += `${r.comprador};${r.codigo};${r.produto};${r.quantidade};${String(r.preco_unitario).replace('.', ',')};${r.desconto_percentual}%;${String(r.preco_com_desconto).replace('.', ',')};${String(r.subtotal_bruto).replace('.', ',')};${String(r.subtotal_final).replace('.', ',')};${data}\n`;
        }
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
          return json({ success: false, error: 'Dados incompletos' }, 400);
        }

        const result = await withSchema(async (client) => {
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

          return { pedidoId, totalItens: itens.length };
        });

        return json({
          success: true,
          message: `Pedido de ${usuario} registrado com ${result.totalItens} itens`,
          pedido_id: result.pedidoId
        });
      }

      if (path === 'descontos') {
        const { categoria, percentual } = body;
        if (categoria === undefined || percentual === undefined) {
          return json({ success: false, error: 'Dados incompletos' }, 400);
        }
        await withSchema(async (client) => {
          await client.query('SELECT aplicar_desconto($1, $2)', [categoria, percentual]);
        });
        return json({ success: true, message: `Desconto de ${percentual}% aplicado em ${categoria}` });
      }

      if (path === 'admin/login') {
        const { senha } = body;
        const config = await withSchema(async (client) => {
          const res = await client.query("SELECT valor FROM configuracoes WHERE chave = 'admin_senha'");
          return res.rows;
        });
        if (!config.length) {
          return json({ success: false, error: 'Senha de admin não configurada no banco' }, 500);
        }
        const adminPwd = config[0].valor;
        if (senha === adminPwd) {
          return json({ success: true, message: 'Login autorizado' });
        }
        return json({ success: false, error: 'Senha incorreta' }, 401);
      }
    }

    // ===== DELETE ROUTES =====
    if (req.method === 'DELETE') {
      if (path === 'pedidos') {
        await withSchema(async (client) => {
          await client.query('DELETE FROM itens_pedido');
          await client.query('DELETE FROM pedidos');
        });
        return json({ success: true, message: 'Todos os pedidos foram apagados' });
      }
      if (path === 'descontos') {
        await withSchema(async (client) => {
          await client.query('UPDATE descontos SET ativo = FALSE');
        });
        return json({ success: true, message: 'Descontos desativados' });
      }
    }

    return json({ success: false, error: 'Rota não encontrada' }, 404);

  } catch (error) {
    console.error('API Error:', error);
    return json({ success: false, error: error.message }, 500);
  }
}

export const config = { runtime: 'edge' };
