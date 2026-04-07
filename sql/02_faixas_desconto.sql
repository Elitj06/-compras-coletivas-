-- ============================================================
-- COMPRAS COLETIVAS — Schema v5.2
-- Adiciona: faixas de desconto progressivo
-- ============================================================

-- Faixas de desconto por valor total do pedido
CREATE TABLE IF NOT EXISTS faixas_desconto (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100),
    valor_minimo DECIMAL(10,2) NOT NULL,
    valor_maximo DECIMAL(10,2),
    percentual DECIMAL(5,2) NOT NULL CHECK (percentual >= 0 AND percentual <= 100),
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faixas_valor ON faixas_desconto(valor_minimo, valor_maximo);

-- Inserir faixas padrão
INSERT INTO faixas_desconto (nome, valor_minimo, valor_maximo, percentual) VALUES
    ('Até R$ 3.000', 0, 3000, 0),
    ('R$ 3.000 - R$ 5.000', 3000, 5000, 42),
    ('R$ 5.000 - R$ 8.000', 5000, 8000, 43),
    ('Acima de R$ 8.000', 8000, NULL, 44)
ON CONFLICT DO NOTHING;

-- Função para calcular desconto por valor total
CREATE OR REPLACE FUNCTION calcular_desconto_progressivo(p_total DECIMAL)
RETURNS DECIMAL AS $$
DECLARE
    v_percentual DECIMAL;
BEGIN
    SELECT percentual INTO v_percentual
    FROM faixas_desconto
    WHERE ativo = TRUE
      AND p_total >= valor_minimo
      AND (valor_maximo IS NULL OR p_total < valor_maximo)
    ORDER BY valor_minimo DESC
    LIMIT 1;
    
    RETURN COALESCE(v_percentual, 0);
END;
$$ LANGUAGE plpgsql;

-- View atualizada com desconto progressivo
CREATE OR REPLACE VIEW vw_dashboard_stats AS
SELECT 
    (SELECT COUNT(DISTINCT usuario) FROM pedidos WHERE status != 'cancelado') AS total_compradores,
    (SELECT COUNT(DISTINCT COALESCE(codigo, nome_produto)) FROM itens_pedido) AS produtos_distintos,
    (SELECT COALESCE(SUM(quantidade), 0) FROM itens_pedido ip JOIN pedidos p ON ip.pedido_id = p.id WHERE p.status != 'cancelado') AS unidades_totais,
    (SELECT COALESCE(SUM(total_bruto), 0) FROM pedidos WHERE status != 'cancelado') AS valor_bruto_geral,
    (SELECT COALESCE(SUM(total_desconto), 0) FROM pedidos WHERE status != 'cancelado') AS economia_geral,
    (SELECT COALESCE(SUM(total_final), 0) FROM pedidos WHERE status != 'cancelado') AS valor_final_geral;
