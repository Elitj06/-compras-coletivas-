-- ============================================================
-- COMPRAS COLETIVAS — Schema Completo (Neon PostgreSQL)
-- Plataforma de Compras em Grupo — Vitafor + VitaPower
-- Execute este arquivo no SQL Editor do Neon
-- ============================================================

-- Limpar tabelas de exemplo do Neon
DROP TABLE IF EXISTS playing_with_neon CASCADE;

-- Limpar tabelas existentes (caso rode novamente)
DROP TABLE IF EXISTS itens_pedido CASCADE;
DROP TABLE IF EXISTS pedidos CASCADE;
DROP TABLE IF EXISTS descontos CASCADE;
DROP TABLE IF EXISTS produtos CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;
DROP TABLE IF EXISTS compradores CASCADE;
DROP TABLE IF EXISTS configuracoes CASCADE;
DROP TABLE IF EXISTS config CASCADE;

-- ============================================================
-- CATEGORIAS
-- ============================================================
CREATE TABLE categorias (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(50) UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- PRODUTOS (Vitafor + VitaPower)
-- ============================================================
CREATE TABLE produtos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL,
    nome VARCHAR(200) NOT NULL,
    preco DECIMAL(10,2) NOT NULL,
    embalagem INTEGER DEFAULT 1,
    categoria_id INTEGER REFERENCES categorias(id),
    imagem VARCHAR(500),
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_produtos_categoria ON produtos(categoria_id);
CREATE INDEX idx_produtos_codigo ON produtos(codigo);

-- ============================================================
-- COMPRADORES
-- ============================================================
CREATE TABLE compradores (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(200) NOT NULL,
    email VARCHAR(200),
    telefone VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_compradores_nome ON compradores(nome);

-- ============================================================
-- DESCONTOS (por categoria ou global)
-- ============================================================
CREATE TABLE descontos (
    id SERIAL PRIMARY KEY,
    categoria_id INTEGER REFERENCES categorias(id),
    categoria VARCHAR(100),
    percentual DECIMAL(5,2) NOT NULL CHECK (percentual >= 0 AND percentual <= 100),
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- PEDIDOS
-- ============================================================
CREATE TABLE pedidos (
    id SERIAL PRIMARY KEY,
    comprador_id INTEGER REFERENCES compradores(id) ON DELETE CASCADE,
    usuario TEXT,
    total_bruto DECIMAL(10,2) DEFAULT 0,
    total_desconto DECIMAL(10,2) DEFAULT 0,
    total_final DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'cancelado', 'entregue')),
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pedidos_comprador ON pedidos(comprador_id);
CREATE INDEX idx_pedidos_status ON pedidos(status);
CREATE INDEX idx_pedidos_usuario ON pedidos(usuario);

-- ============================================================
-- ITENS DO PEDIDO
-- ============================================================
CREATE TABLE itens_pedido (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER REFERENCES pedidos(id) ON DELETE CASCADE,
    produto_id INTEGER REFERENCES produtos(id),
    codigo TEXT,
    nome_produto TEXT,
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    preco_unitario DECIMAL(10,2) NOT NULL,
    preco_bruto DECIMAL(10,2),
    desconto_percentual DECIMAL(5,2) DEFAULT 0,
    preco_com_desconto DECIMAL(10,2) NOT NULL,
    preco_desconto DECIMAL(10,2),
    subtotal_bruto DECIMAL(10,2) NOT NULL,
    subtotal_final DECIMAL(10,2) NOT NULL,
    categoria TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_itens_pedido ON itens_pedido(pedido_id);
CREATE INDEX idx_itens_produto ON itens_pedido(produto_id);

-- ============================================================
-- CONFIGURAÇÕES GERAIS
-- ============================================================
CREATE TABLE configuracoes (
    chave VARCHAR(100) PRIMARY KEY,
    valor TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Inserir configurações padrão
INSERT INTO configuracoes (chave, valor) VALUES
    ('nome_app', 'Compras Coletivas — Vitafor & VitaPower'),
    ('admin_senha', 'admin123'),
    ('prazo_pedido', '2026-04-30'),
    ('mensagem_boas_vindas', 'Bem-vindo às Compras Coletivas!');

-- ============================================================
-- VIEWS — DASHBOARD
-- ============================================================

-- View: Estatísticas gerais
CREATE OR REPLACE VIEW vw_dashboard_stats AS
SELECT 
    (SELECT COUNT(DISTINCT usuario) FROM pedidos WHERE status != 'cancelado') AS total_compradores,
    (SELECT COUNT(DISTINCT COALESCE(codigo, nome_produto)) FROM itens_pedido) AS produtos_distintos,
    (SELECT COALESCE(SUM(quantidade), 0) FROM itens_pedido ip JOIN pedidos p ON ip.pedido_id = p.id WHERE p.status != 'cancelado') AS unidades_totais,
    (SELECT COALESCE(SUM(total_bruto), 0) FROM pedidos WHERE status != 'cancelado') AS valor_bruto_geral,
    (SELECT COALESCE(SUM(total_desconto), 0) FROM pedidos WHERE status != 'cancelado') AS economia_geral,
    (SELECT COALESCE(SUM(total_final), 0) FROM pedidos WHERE status != 'cancelado') AS valor_final_geral;

-- View: Relatório consolidado de produtos
CREATE OR REPLACE VIEW vw_relatorio_produtos AS
SELECT 
    COALESCE(ip.codigo, '') AS codigo,
    COALESCE(ip.nome_produto, '') AS nome,
    COALESCE(ip.categoria, '') AS categoria,
    ROUND(AVG(ip.preco_unitario), 2) AS preco_unitario,
    ROUND(AVG(ip.desconto_percentual), 2) AS desconto_percentual,
    ROUND(AVG(ip.preco_com_desconto), 2) AS preco_com_desconto,
    SUM(ip.quantidade) AS quantidade_total,
    SUM(ip.subtotal_bruto) AS total_bruto,
    SUM(ip.subtotal_final) AS total_final
FROM itens_pedido ip
JOIN pedidos p ON ip.pedido_id = p.id
WHERE p.status != 'cancelado'
GROUP BY ip.codigo, ip.nome_produto, ip.categoria
ORDER BY ip.nome_produto;

-- View: Relatório por comprador/usuário
CREATE OR REPLACE VIEW vw_relatorio_compradores AS
SELECT 
    p.usuario AS comprador,
    COUNT(DISTINCT p.id) AS total_pedidos,
    COALESCE(SUM(p.total_bruto), 0) AS valor_bruto_total,
    COALESCE(SUM(p.total_desconto), 0) AS economia_total,
    COALESCE(SUM(p.total_final), 0) AS valor_final_total
FROM pedidos p
WHERE p.status != 'cancelado' AND p.usuario IS NOT NULL
GROUP BY p.usuario
ORDER BY p.usuario;

-- ============================================================
-- FUNÇÕES
-- ============================================================

-- Função: Aplicar desconto
CREATE OR REPLACE FUNCTION aplicar_desconto(
    p_categoria TEXT,
    p_percentual DECIMAL
) RETURNS VOID AS $$
BEGIN
    DELETE FROM descontos WHERE categoria = p_categoria;
    IF p_percentual > 0 THEN
        INSERT INTO descontos (categoria, percentual, ativo)
        VALUES (p_categoria, p_percentual, TRUE);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Função: Recalcular totais do pedido
CREATE OR REPLACE FUNCTION recalcular_pedido(p_pedido_id INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE pedidos SET
        total_bruto = (SELECT COALESCE(SUM(subtotal_bruto), 0) FROM itens_pedido WHERE pedido_id = p_pedido_id),
        total_final = (SELECT COALESCE(SUM(subtotal_final), 0) FROM itens_pedido WHERE pedido_id = p_pedido_id),
        total_desconto = (SELECT COALESCE(SUM(subtotal_bruto), 0) FROM itens_pedido WHERE pedido_id = p_pedido_id) -
                         (SELECT COALESCE(SUM(subtotal_final), 0) FROM itens_pedido WHERE pedido_id = p_pedido_id),
        updated_at = NOW()
    WHERE id = p_pedido_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ✅ PRONTO! Schema criado com sucesso.
-- Tabelas: categorias, produtos, compradores, descontos, pedidos, itens_pedido, configuracoes
-- Views: vw_dashboard_stats, vw_relatorio_produtos, vw_relatorio_compradores
-- Funções: aplicar_desconto(), recalcular_pedido()
-- ============================================================
