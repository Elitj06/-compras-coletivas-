import { neon } from '@neondatabase/serverless';

// Supabase — schema isolado compras_coletivas
// O search_path é definido via options na connection string
const DB_URL = (process.env.DATABASE_URL || '').includes('?')
  ? process.env.DATABASE_URL + '&options=--search_path%3Dcompras_coletivas'
  : process.env.DATABASE_URL + '?options=--search_path%3Dcompras_coletivas';
const sql = neon(DB_URL);

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
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
        const result = await sql`SELECT COUNT(*) as tabelas FROM information_schema.tables WHERE table_schema = 'public'`;
        return json({
          success: true,
          message: 'Compras Coletivas API online',
          tabelas: result[0].tabelas,
          timestamp: new Date().toISOString()
        });
      }

      if (path === 'tables') {
        const rows = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
        return json({ success: true, data: rows });
      }

      if (path === 'pedidos') {
        const rows = await sql`
          SELECT ip.*, p.usuario, p.status, p.created_at as pedido_data
          FROM itens_pedido ip
          JOIN pedidos p ON ip.pedido_id = p.id
          WHERE p.status != 'cancelado'
          ORDER BY p.created_at DESC
        `;
        return json({ success: true, data: rows });
      }

      if (path === 'pedidos/por-usuario') {
        const rows = await sql`
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
        `;
        return json({ success: true, data: rows });
      }

      if (path === 'pedidos/consolidado') {
        const rows = await sql`SELECT * FROM vw_relatorio_produtos`;
        return json({ success: true, data: rows });
      }

      if (path === 'stats') {
        const stats = await sql`SELECT * FROM vw_dashboard_stats`;
        return json({ success: true, data: stats[0] });
      }

      if (path === 'descontos') {
        const rows = await sql`SELECT * FROM descontos WHERE ativo = TRUE ORDER BY categoria`;
        return json({ success: true, data: rows });
      }

      if (path === 'faixas-desconto') {
        const rows = await sql`SELECT * FROM faixas_desconto WHERE ativo = TRUE ORDER BY valor_minimo`;
        return json({ success: true, data: rows });
      }

      if (path === 'categorias') {
        const rows = await sql`SELECT * FROM categorias ORDER BY nome`;
        return json({ success: true, data: rows });
      }

      if (path === 'compradores') {
        const rows = await sql`SELECT * FROM vw_relatorio_compradores`;
        return json({ success: true, data: rows });
      }

      if (path === 'exportar-csv') {
        const rows = await sql`
          SELECT p.usuario AS comprador, ip.codigo, ip.nome_produto AS produto,
            ip.quantidade, ip.preco_unitario, ip.desconto_percentual,
            ip.preco_com_desconto, ip.subtotal_bruto, ip.subtotal_final,
            p.created_at AS data_pedido
          FROM itens_pedido ip
          JOIN pedidos p ON ip.pedido_id = p.id
          WHERE p.status != 'cancelado'
          ORDER BY p.usuario, ip.nome_produto
        `;
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

        // Upsert comprador com telefone e email
        if (telefone || email) {
          await sql`
            INSERT INTO compradores (nome, telefone, email)
            VALUES (${usuario}, ${telefone || null}, ${email || null})
            ON CONFLICT DO NOTHING
          `;
          // Atualizar se já existir
          await sql`
            UPDATE compradores
            SET telefone = COALESCE(${telefone || null}, telefone),
                email = COALESCE(${email || null}, email)
            WHERE nome = ${usuario}
          `;
        }

        const pedidoResult = await sql`
          INSERT INTO pedidos (usuario, status) VALUES (${usuario}, 'pendente') RETURNING id
        `;
        const pedidoId = pedidoResult[0].id;

        let totalBruto = 0;
        let totalFinal = 0;

        for (const item of itens) {
          const precoBruto = parseFloat(item.preco_bruto) || 0;
          const precoDesconto = parseFloat(item.preco_desconto) || precoBruto;
          const qty = parseInt(item.quantidade) || 1;
          const subtBruto = precoBruto * qty;
          const subtFinal = precoDesconto * qty;

          await sql`
            INSERT INTO itens_pedido (
              pedido_id, codigo, nome_produto, quantidade,
              preco_unitario, preco_bruto, preco_com_desconto, preco_desconto,
              desconto_percentual, subtotal_bruto, subtotal_final, categoria
            ) VALUES (
              ${pedidoId}, ${item.codigo}, ${item.nome}, ${qty},
              ${precoBruto}, ${precoBruto}, ${precoDesconto}, ${precoDesconto},
              ${item.desconto || 0}, ${subtBruto}, ${subtFinal}, ${item.categoria || ''}
            )
          `;
          totalBruto += subtBruto;
          totalFinal += subtFinal;
        }

        await sql`
          UPDATE pedidos SET 
            total_bruto = ${totalBruto},
            total_final = ${totalFinal},
            total_desconto = ${totalBruto - totalFinal}
          WHERE id = ${pedidoId}
        `;

        return json({
          success: true,
          message: `Pedido de ${usuario} registrado com ${itens.length} itens`,
          pedido_id: pedidoId
        });
      }

      if (path === 'descontos') {
        const { categoria, percentual } = body;
        if (categoria === undefined || percentual === undefined) {
          return json({ success: false, error: 'Dados incompletos' }, 400);
        }
        await sql`SELECT aplicar_desconto(${categoria}, ${percentual})`;
        return json({ success: true, message: `Desconto de ${percentual}% aplicado em ${categoria}` });
      }

      if (path === 'admin/login') {
        const { senha } = body;
        const config = await sql`SELECT valor FROM configuracoes WHERE chave = 'admin_senha'`;
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
        await sql`DELETE FROM itens_pedido`;
        await sql`DELETE FROM pedidos`;
        return json({ success: true, message: 'Todos os pedidos foram apagados' });
      }
      if (path === 'descontos') {
        await sql`UPDATE descontos SET ativo = FALSE`;
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
