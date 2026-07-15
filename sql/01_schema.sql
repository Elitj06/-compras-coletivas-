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
DROP TABLE IF EXISTS pin_recovery_audit CASCADE;
DROP TABLE IF EXISTS pin_recovery_rate_limits CASCADE;
DROP TABLE IF EXISTS pin_recovery_challenges CASCADE;
DROP TABLE IF EXISTS buyer_sessions CASCADE;
DROP TABLE IF EXISTS admin_sessions CASCADE;
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
    pin_hash TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_compradores_nome ON compradores(nome);
CREATE INDEX idx_compradores_nome_lower ON compradores(LOWER(nome));
CREATE INDEX idx_compradores_telefone_digits ON compradores((regexp_replace(COALESCE(telefone,''), '\D', '', 'g')));

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
    status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'cancelado', 'entregue', 'aberto_edicao')),
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pedidos_comprador ON pedidos(comprador_id);
CREATE INDEX idx_pedidos_status ON pedidos(status);
CREATE INDEX idx_pedidos_usuario ON pedidos(usuario);

-- ============================================================
-- SESSÕES
-- ============================================================
CREATE TABLE admin_sessions (
    id BIGSERIAL PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_admin_sessions_expires_at ON admin_sessions(expires_at);

CREATE TABLE buyer_sessions (
    id BIGSERIAL PRIMARY KEY,
    comprador_id INTEGER NOT NULL REFERENCES compradores(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_buyer_sessions_token_hash ON buyer_sessions(token_hash);
CREATE INDEX idx_buyer_sessions_comprador_id ON buyer_sessions(comprador_id);
CREATE INDEX idx_buyer_sessions_expires_at ON buyer_sessions(expires_at);

-- ============================================================
-- RECUPERACAO DE PIN (inativa ate a release funcional)
-- ============================================================
CREATE TABLE pin_recovery_challenges (
    id BIGSERIAL PRIMARY KEY,
    challenge_id TEXT NOT NULL UNIQUE CHECK (char_length(challenge_id) BETWEEN 32 AND 200),
    comprador_id INTEGER NOT NULL REFERENCES compradores(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'admin')),
    code_hash CHAR(64) NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$'),
    attempt_count SMALLINT NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
    expires_at TIMESTAMPTZ NOT NULL,
    delivered_at TIMESTAMPTZ,
    consumed_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_by_admin_session_id BIGINT REFERENCES admin_sessions(id) ON DELETE SET NULL,
    verification_method VARCHAR(80),
    verification_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (expires_at > created_at),
    CHECK (channel <> 'admin' OR (
        created_by_admin_session_id IS NOT NULL AND
        NULLIF(BTRIM(verification_method), '') IS NOT NULL AND
        NULLIF(BTRIM(verification_note), '') IS NOT NULL
    ))
);

CREATE INDEX idx_pin_recovery_challenges_active_buyer
    ON pin_recovery_challenges(comprador_id, channel, created_at DESC)
    WHERE consumed_at IS NULL AND revoked_at IS NULL;
CREATE INDEX idx_pin_recovery_challenges_expires_at ON pin_recovery_challenges(expires_at);

CREATE TABLE pin_recovery_rate_limits (
    id BIGSERIAL PRIMARY KEY,
    scope VARCHAR(40) NOT NULL CHECK (char_length(scope) BETWEEN 1 AND 40),
    bucket_hash CHAR(64) NOT NULL CHECK (bucket_hash ~ '^[0-9a-f]{64}$'),
    window_started_at TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
    blocked_until TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (scope, bucket_hash, window_started_at),
    CHECK (expires_at > window_started_at)
);

CREATE INDEX idx_pin_recovery_rate_limits_expires_at ON pin_recovery_rate_limits(expires_at);

CREATE TABLE pin_recovery_audit (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(60) NOT NULL CHECK (char_length(event_type) BETWEEN 1 AND 60),
    comprador_id INTEGER REFERENCES compradores(id) ON DELETE SET NULL,
    challenge_id TEXT REFERENCES pin_recovery_challenges(challenge_id) ON DELETE SET NULL,
    channel VARCHAR(20) CHECK (channel IN ('email', 'admin')),
    actor_admin_session_id BIGINT REFERENCES admin_sessions(id) ON DELETE SET NULL,
    ip_hash CHAR(64) CHECK (ip_hash IS NULL OR ip_hash ~ '^[0-9a-f]{64}$'),
    details JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(details) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pin_recovery_audit_created_at ON pin_recovery_audit(created_at DESC);
CREATE INDEX idx_pin_recovery_audit_buyer ON pin_recovery_audit(comprador_id, created_at DESC);

REVOKE ALL PRIVILEGES ON TABLE pin_recovery_challenges, pin_recovery_rate_limits, pin_recovery_audit FROM PUBLIC;
REVOKE ALL PRIVILEGES ON SEQUENCE pin_recovery_challenges_id_seq, pin_recovery_rate_limits_id_seq, pin_recovery_audit_id_seq FROM PUBLIC;
DO $security$
DECLARE exposed_role TEXT;
BEGIN
    FOREACH exposed_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = exposed_role) THEN
            EXECUTE FORMAT('REVOKE ALL PRIVILEGES ON TABLE pin_recovery_challenges, pin_recovery_rate_limits, pin_recovery_audit FROM %I', exposed_role);
            EXECUTE FORMAT('REVOKE ALL PRIVILEGES ON SEQUENCE pin_recovery_challenges_id_seq, pin_recovery_rate_limits_id_seq, pin_recovery_audit_id_seq FROM %I', exposed_role);
        END IF;
    END LOOP;
END
$security$;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pin_recovery_challenges, pin_recovery_rate_limits, pin_recovery_audit TO CURRENT_USER;
GRANT USAGE, SELECT ON SEQUENCE pin_recovery_challenges_id_seq, pin_recovery_rate_limits_id_seq, pin_recovery_audit_id_seq TO CURRENT_USER;

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
-- PAGAMENTOS
-- ============================================================
CREATE TABLE pagamentos (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER UNIQUE REFERENCES pedidos(id) ON DELETE CASCADE,
    comprador TEXT NOT NULL,
    valor_compra DECIMAL(10,2) NOT NULL DEFAULT 0,
    parc1 DECIMAL(10,2),
    parc2 DECIMAL(10,2),
    parc3 DECIMAL(10,2),
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

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
