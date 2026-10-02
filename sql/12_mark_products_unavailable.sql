-- Keep these products visible in the October catalog, but stop new purchases.
-- Existing order lines are intentionally untouched.
-- One-shot; apply in schema compras_coletivas_20260906.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE compras_coletivas_20260906.produtos IN SHARE ROW EXCLUSIVE MODE;
DO $preflight$
DECLARE total_rows integer; active_rows integer; target_active integer;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE ativo)
    INTO total_rows, active_rows
    FROM compras_coletivas_20260906.produtos;
  SELECT COUNT(*) INTO target_active
    FROM compras_coletivas_20260906.produtos
   WHERE ativo AND upper(btrim(codigo)) = ANY (ARRAY['WFT1800BA','EF20','PA600','CLB30AH','ISP240','DR150','WFT1800CH']::text[]);
  IF total_rows <> 247 OR active_rows <> 223 OR target_active <> 7 THEN
    RAISE EXCEPTION 'Preflight divergiu (total %, ativos %, alvo ativo %); rollback sem alteração', total_rows, active_rows, target_active;
  END IF;
END $preflight$;
UPDATE compras_coletivas_20260906.produtos
   SET ativo = FALSE, updated_at = NOW()
 WHERE upper(btrim(codigo)) = ANY (ARRAY['WFT1800BA','EF20','PA600','CLB30AH','ISP240','DR150','WFT1800CH']::text[])
   AND ativo = TRUE;
DO $postflight$
DECLARE total_rows integer; active_rows integer; target_inactive integer; orders_count integer; lines_count integer;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE ativo)
    INTO total_rows, active_rows
    FROM compras_coletivas_20260906.produtos;
  SELECT COUNT(*) INTO target_inactive
    FROM compras_coletivas_20260906.produtos
   WHERE NOT ativo AND upper(btrim(codigo)) = ANY (ARRAY['WFT1800BA','EF20','PA600','CLB30AH','ISP240','DR150','WFT1800CH']::text[]);
  SELECT COUNT(*) INTO orders_count FROM compras_coletivas_20260906.pedidos;
  SELECT COUNT(*) INTO lines_count FROM compras_coletivas_20260906.itens_pedido;
  IF total_rows <> 247 OR active_rows <> 216 OR target_inactive <> 7 OR orders_count <> 31 OR lines_count <> 143 THEN
    RAISE EXCEPTION 'Postflight divergiu (total %, ativos %, alvos inativos %, pedidos %, itens %); rollback', total_rows, active_rows, target_inactive, orders_count, lines_count;
  END IF;
END $postflight$;
COMMIT;
