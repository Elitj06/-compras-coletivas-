-- Hardening aditivo: preflight fail-closed + hash CSRF por sessão.
SET search_path TO compras_coletivas, public;

DO $$ BEGIN
  IF (SELECT count(*) FROM ciclos_compra WHERE ativo) <> 1 THEN
    RAISE EXCEPTION 'security preflight: exactly one active cycle required';
  END IF;
  IF EXISTS (SELECT 1 FROM pedidos WHERE ciclo_id IS NULL) THEN
    RAISE EXCEPTION 'security preflight: order without cycle';
  END IF;
  IF EXISTS (
    SELECT 1 FROM itens_pedido ip
    LEFT JOIN pedidos p ON p.id = ip.pedido_id
    WHERE p.id IS NULL
  ) THEN
    RAISE EXCEPTION 'security preflight: orphan order item';
  END IF;
  IF EXISTS (
    SELECT 1 FROM produtos
    WHERE ativo
    GROUP BY lower(btrim(codigo))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'security preflight: duplicate active product code';
  END IF;
  IF EXISTS (
    SELECT 1 FROM produtos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    WHERE p.ativo AND (p.categoria_id IS NULL OR c.id IS NULL OR c.slug IS NULL OR btrim(c.slug) = '')
  ) THEN
    RAISE EXCEPTION 'security preflight: active product without resolvable category';
  END IF;
  IF EXISTS (
    SELECT 1 FROM descontos
    WHERE ativo
    GROUP BY COALESCE(categoria_id, 0)
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'security preflight: ambiguous active discount';
  END IF;
  IF EXISTS (SELECT 1 FROM descontos WHERE ativo AND (percentual < 0 OR percentual > 100)) THEN
    RAISE EXCEPTION 'security preflight: invalid discount percentage';
  END IF;
  IF EXISTS (
    SELECT 1 FROM descontos d
    LEFT JOIN categorias c ON c.id = d.categoria_id
    WHERE d.ativo AND (
      (d.categoria_id IS NULL AND d.categoria IS DISTINCT FROM 'todos') OR
      (d.categoria_id IS NOT NULL AND (c.id IS NULL OR d.categoria IS DISTINCT FROM c.slug))
    )
  ) THEN
    RAISE EXCEPTION 'security preflight: discount category mismatch';
  END IF;
END $$;

ALTER TABLE buyer_sessions ADD COLUMN IF NOT EXISTS csrf_token_hash TEXT;
ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS csrf_token_hash TEXT;
-- Sessões antigas não têm CSRF verificável e precisam de novo login.
DELETE FROM buyer_sessions WHERE csrf_token_hash IS NULL;
DELETE FROM admin_sessions WHERE csrf_token_hash IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS produtos_active_code_lookup
  ON produtos (lower(btrim(codigo))) WHERE ativo;

-- Alinha imediatamente os pedidos já existentes com a faixa coletiva vigente.
-- A mesma regra é reaplicada pela API dentro das transações futuras.
WITH ciclo AS (
  SELECT id
  FROM ciclos_compra
  WHERE ativo = TRUE
  LIMIT 1
), total AS (
  SELECT c.id,
    COALESCE(SUM(p.total_bruto) FILTER (WHERE p.status <> 'cancelado'), 0)::numeric AS total_bruto
  FROM ciclo c
  LEFT JOIN pedidos p ON p.ciclo_id = c.id
  GROUP BY c.id
), faixa AS (
  SELECT t.id,
    COALESCE((
      SELECT f.percentual
      FROM faixas_desconto f
      WHERE f.ativo = TRUE
        AND t.total_bruto >= f.valor_minimo
        AND (f.valor_maximo IS NULL OR t.total_bruto < f.valor_maximo)
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
    total_desconto = totais.total_bruto - totais.total_final
FROM totais
WHERE p.id = totais.id;
