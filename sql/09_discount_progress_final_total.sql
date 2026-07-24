-- Compras Coletivas — progresso por total final
--
-- Reaplica a faixa do ciclo ativo usando o total já com desconto.
-- Esta migração é aditiva e não remove pedidos, itens ou pagamentos.
SET search_path TO compras_coletivas, public;
BEGIN;

WITH ciclo AS (
  SELECT id
  FROM ciclos_compra
  WHERE ativo = TRUE
  LIMIT 1
), total AS (
  SELECT c.id,
    COALESCE(SUM(p.total_final) FILTER (WHERE p.status <> 'cancelado'), 0)::numeric AS total_final
  FROM ciclo c
  LEFT JOIN pedidos p ON p.ciclo_id = c.id
  GROUP BY c.id
), faixa AS (
  SELECT t.id,
    COALESCE((
      SELECT f.percentual
      FROM faixas_desconto f
      WHERE f.ativo = TRUE
        AND t.total_final >= f.valor_minimo
        AND (f.valor_maximo IS NULL OR t.total_final < f.valor_maximo)
      ORDER BY f.valor_minimo DESC
      LIMIT 1
    ), 0)::numeric AS percentual
  FROM total t
)
UPDATE itens_pedido ip
SET preco_com_desconto = ROUND(COALESCE(ip.preco_bruto, ip.preco_unitario) * (1 - faixa.percentual / 100), 2),
    preco_desconto = ROUND(COALESCE(ip.preco_bruto, ip.preco_unitario) * (1 - faixa.percentual / 100), 2),
    desconto_percentual = faixa.percentual,
    subtotal_final = ROUND(COALESCE(ip.preco_bruto, ip.preco_unitario) * (1 - faixa.percentual / 100) * ip.quantidade, 2)
FROM pedidos p
JOIN faixa ON faixa.id = p.ciclo_id
WHERE p.id = ip.pedido_id
  AND p.status <> 'cancelado';

WITH totais AS (
  SELECT p.id,
    COALESCE(SUM(ip.subtotal_bruto), 0)::numeric AS total_bruto,
    COALESCE(SUM(ip.subtotal_final), 0)::numeric AS total_final
  FROM pedidos p
  LEFT JOIN itens_pedido ip ON ip.pedido_id = p.id
  WHERE p.ciclo_id = (SELECT id FROM ciclos_compra WHERE ativo = TRUE LIMIT 1)
    AND p.status <> 'cancelado'
  GROUP BY p.id
)
UPDATE pedidos p
SET total_bruto = totais.total_bruto,
    total_final = totais.total_final,
    total_desconto = totais.total_bruto - totais.total_final,
    updated_at = NOW()
FROM totais
WHERE p.id = totais.id;

COMMIT;
