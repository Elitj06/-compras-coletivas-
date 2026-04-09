-- ============================================================
-- PIN de acesso para compradores (4-6 dígitos)
-- ============================================================
SET search_path TO compras_coletivas;

ALTER TABLE compradores
  ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- Índice para busca rápida por nome+telefone (login)
CREATE INDEX IF NOT EXISTS idx_compradores_nome_tel
  ON compradores(nome, telefone);
