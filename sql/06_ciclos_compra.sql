-- Ciclos de compra: migração aditiva; não exclui pedidos, itens ou pagamentos.
SET search_path TO compras_coletivas, public;

CREATE TABLE IF NOT EXISTS ciclos_compra (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE,
  inicio_em DATE NOT NULL,
  fim_em DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'encerrado')),
  ativo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (fim_em IS NULL OR fim_em >= inicio_em)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ciclos_compra_um_ativo ON ciclos_compra (ativo) WHERE ativo;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS ciclo_id INTEGER REFERENCES ciclos_compra(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_pedidos_ciclo_id ON pedidos(ciclo_id);

INSERT INTO ciclos_compra (nome, inicio_em, fim_em, status, ativo) VALUES
  ('Abril/2026', DATE '2026-04-01', DATE '2026-06-30', 'encerrado', FALSE),
  ('Julho/2026', DATE '2026-07-01', NULL, 'aberto', TRUE)
ON CONFLICT (nome) DO UPDATE SET inicio_em = EXCLUDED.inicio_em, fim_em = EXCLUDED.fim_em, status = EXCLUDED.status, updated_at = NOW();
UPDATE ciclos_compra SET ativo = FALSE WHERE ativo AND nome <> 'Julho/2026';
UPDATE ciclos_compra SET ativo = TRUE, status = 'aberto', updated_at = NOW() WHERE nome = 'Julho/2026';
UPDATE pedidos p SET ciclo_id = c.id FROM ciclos_compra c
WHERE p.ciclo_id IS NULL
  AND c.nome = CASE WHEN p.created_at < TIMESTAMP '2026-07-01' THEN 'Abril/2026' ELSE 'Julho/2026' END;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pedidos WHERE ciclo_id IS NULL) THEN RAISE EXCEPTION 'Existem pedidos sem ciclo'; END IF;
END $$;
ALTER TABLE pedidos ALTER COLUMN ciclo_id SET NOT NULL;

-- Views legadas passam a representar sempre o ciclo ativo.
CREATE OR REPLACE VIEW vw_dashboard_stats AS
SELECT
  (SELECT COUNT(DISTINCT usuario) FROM pedidos WHERE status != 'cancelado' AND ciclo_id = (SELECT id FROM ciclos_compra WHERE ativo)) AS total_compradores,
  (SELECT COUNT(DISTINCT COALESCE(ip.codigo, ip.nome_produto)) FROM itens_pedido ip JOIN pedidos p ON p.id = ip.pedido_id WHERE p.status != 'cancelado' AND p.ciclo_id = (SELECT id FROM ciclos_compra WHERE ativo)) AS produtos_distintos,
  (SELECT COALESCE(SUM(ip.quantidade),0) FROM itens_pedido ip JOIN pedidos p ON p.id = ip.pedido_id WHERE p.status != 'cancelado' AND p.ciclo_id = (SELECT id FROM ciclos_compra WHERE ativo)) AS unidades_totais,
  (SELECT COALESCE(SUM(total_bruto),0) FROM pedidos WHERE status != 'cancelado' AND ciclo_id = (SELECT id FROM ciclos_compra WHERE ativo)) AS valor_bruto_geral,
  (SELECT COALESCE(SUM(total_desconto),0) FROM pedidos WHERE status != 'cancelado' AND ciclo_id = (SELECT id FROM ciclos_compra WHERE ativo)) AS economia_geral,
  (SELECT COALESCE(SUM(total_final),0) FROM pedidos WHERE status != 'cancelado' AND ciclo_id = (SELECT id FROM ciclos_compra WHERE ativo)) AS valor_final_geral;
CREATE OR REPLACE VIEW vw_relatorio_produtos AS
SELECT COALESCE(ip.codigo,'') AS codigo, COALESCE(ip.nome_produto,'') AS nome, COALESCE(ip.categoria,'') AS categoria,
  ROUND(AVG(ip.preco_unitario),2) AS preco_unitario, ROUND(AVG(ip.desconto_percentual),2) AS desconto_percentual,
  ROUND(AVG(ip.preco_com_desconto),2) AS preco_com_desconto, SUM(ip.quantidade) AS quantidade_total,
  SUM(ip.subtotal_bruto) AS total_bruto, SUM(ip.subtotal_final) AS total_final
FROM itens_pedido ip JOIN pedidos p ON p.id = ip.pedido_id
WHERE p.status != 'cancelado' AND p.ciclo_id = (SELECT id FROM ciclos_compra WHERE ativo)
GROUP BY ip.codigo, ip.nome_produto, ip.categoria ORDER BY ip.nome_produto;
