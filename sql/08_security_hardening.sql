-- Security hardening, additive and intentionally fail-closed.
SET search_path TO compras_coletivas, public;
DO $$ BEGIN
  IF (SELECT count(*) FROM ciclos_compra WHERE ativo) <> 1 THEN RAISE EXCEPTION 'security preflight: exactly one active cycle required'; END IF;
  IF EXISTS (SELECT 1 FROM pedidos WHERE ciclo_id IS NULL) THEN RAISE EXCEPTION 'security preflight: order without cycle'; END IF;
  IF EXISTS (SELECT 1 FROM itens_pedido ip LEFT JOIN pedidos p ON p.id = ip.pedido_id WHERE p.id IS NULL) THEN RAISE EXCEPTION 'security preflight: orphan order item'; END IF;
  IF EXISTS (SELECT 1 FROM produtos WHERE ativo GROUP BY lower(btrim(codigo)) HAVING count(*) > 1) THEN RAISE EXCEPTION 'security preflight: duplicate active product code'; END IF;
  IF EXISTS (SELECT 1 FROM produtos p LEFT JOIN categorias c ON c.id = p.categoria_id WHERE p.ativo AND (p.categoria_id IS NULL OR c.id IS NULL OR c.slug IS NULL OR btrim(c.slug) = '')) THEN RAISE EXCEPTION 'security preflight: active product without resolvable category'; END IF;
  IF EXISTS (SELECT 1 FROM descontos WHERE ativo GROUP BY COALESCE(categoria_id, 0) HAVING count(*) > 1) THEN RAISE EXCEPTION 'security preflight: ambiguous active discount'; END IF;
  IF EXISTS (SELECT 1 FROM descontos WHERE ativo AND (percentual < 0 OR percentual > 100)) THEN RAISE EXCEPTION 'security preflight: invalid discount percentage'; END IF;
  IF EXISTS (
    SELECT 1 FROM descontos d LEFT JOIN categorias c ON c.id = d.categoria_id
    WHERE d.ativo AND (
      (d.categoria_id IS NULL AND d.categoria IS DISTINCT FROM 'todos') OR
      (d.categoria_id IS NOT NULL AND (c.id IS NULL OR d.categoria IS DISTINCT FROM c.slug))
    )
  ) THEN RAISE EXCEPTION 'security preflight: discount category mismatch'; END IF;
END $$;
ALTER TABLE buyer_sessions ADD COLUMN IF NOT EXISTS csrf_token_hash TEXT;
ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS csrf_token_hash TEXT;
-- Existing sessions cannot satisfy the new CSRF contract and must reauthenticate.
-- Reapplying this additive migration must preserve sessions issued by the new flow.
DELETE FROM buyer_sessions WHERE csrf_token_hash IS NULL;
DELETE FROM admin_sessions WHERE csrf_token_hash IS NULL;
CREATE INDEX IF NOT EXISTS produtos_active_code_lookup ON produtos (lower(btrim(codigo))) WHERE ativo;
CREATE UNIQUE INDEX IF NOT EXISTS descontos_one_active_policy ON descontos ((COALESCE(categoria_id, 0))) WHERE ativo;
