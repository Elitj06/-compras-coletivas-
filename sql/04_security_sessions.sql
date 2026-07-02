-- ============================================================
-- COMPRAS COLETIVAS — Sessões e hash seguro de admin
-- Execute manualmente no SQL Editor do Supabase antes do deploy.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

SET search_path TO compras_coletivas, public;

ALTER TABLE compradores ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS comprador_id INTEGER REFERENCES compradores(id) ON DELETE CASCADE;

ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_status_check;
ALTER TABLE pedidos
  ADD CONSTRAINT pedidos_status_check
  CHECK (status IN ('pendente', 'confirmado', 'cancelado', 'entregue', 'aberto_edicao'));

CREATE TABLE IF NOT EXISTS admin_sessions (
  id BIGSERIAL PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at
  ON admin_sessions(expires_at);

CREATE TABLE IF NOT EXISTS buyer_sessions (
  id BIGSERIAL PRIMARY KEY,
  comprador_id INTEGER NOT NULL REFERENCES compradores(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buyer_sessions_token_hash
  ON buyer_sessions(token_hash);

CREATE INDEX IF NOT EXISTS idx_buyer_sessions_comprador_id
  ON buyer_sessions(comprador_id);

CREATE INDEX IF NOT EXISTS idx_buyer_sessions_expires_at
  ON buyer_sessions(expires_at);

CREATE TABLE IF NOT EXISTS pagamentos (
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

CREATE INDEX IF NOT EXISTS idx_compradores_nome_lower
  ON compradores(LOWER(nome));

CREATE INDEX IF NOT EXISTS idx_compradores_telefone_digits
  ON compradores((regexp_replace(COALESCE(telefone,''), '\D', '', 'g')));

CREATE OR REPLACE FUNCTION compras_coletivas.pbkdf2_sha256_hex(
  p_password TEXT,
  p_salt BYTEA,
  p_iterations INTEGER
) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  password_bytes BYTEA := convert_to(p_password, 'UTF8');
  u BYTEA;
  result BYTEA;
  i INTEGER;
  j INTEGER;
BEGIN
  IF p_password IS NULL OR p_iterations < 100000 THEN
    RAISE EXCEPTION 'Invalid PBKDF2 input';
  END IF;

  u := hmac(p_salt || decode('00000001', 'hex'), password_bytes, 'sha256');
  result := u;

  FOR i IN 2..p_iterations LOOP
    u := hmac(u, password_bytes, 'sha256');
    FOR j IN 0..31 LOOP
      result := set_byte(result, j, get_byte(result, j) # get_byte(u, j));
    END LOOP;
  END LOOP;

  RETURN encode(result, 'hex');
END;
$$;

DO $$
DECLARE
  iterations CONSTANT INTEGER := 210000;
  salt BYTEA;
  password_value TEXT;
BEGIN
  SELECT valor INTO password_value
  FROM configuracoes
  WHERE chave = 'admin_senha';

  IF password_value IS NOT NULL
     AND password_value NOT LIKE 'pbkdf2:sha256:%' THEN
    salt := gen_random_bytes(16);

    UPDATE configuracoes
    SET valor = 'pbkdf2:sha256:' || iterations || ':' ||
                encode(salt, 'hex') || ':' ||
                compras_coletivas.pbkdf2_sha256_hex(password_value, salt, iterations),
        updated_at = NOW()
    WHERE chave = 'admin_senha';
  END IF;
END $$;

DROP FUNCTION compras_coletivas.pbkdf2_sha256_hex(TEXT, BYTEA, INTEGER);

DELETE FROM admin_sessions WHERE expires_at <= NOW();
DELETE FROM buyer_sessions WHERE expires_at <= NOW();
