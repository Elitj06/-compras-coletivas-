-- Histórico e login unificado: migração aditiva e segura.
SET search_path TO compras_coletivas, public;

-- Vincula pedidos legados sem comprador apenas quando o nome identificar
-- exatamente um cadastro. Casos ambíguos permanecem inalterados para revisão.
WITH vinculos_unicos AS (
  SELECT p.id AS pedido_id, MIN(c.id) AS comprador_id
  FROM pedidos p
  JOIN compradores c ON LOWER(BTRIM(c.nome)) = LOWER(BTRIM(p.usuario))
  WHERE p.comprador_id IS NULL
  GROUP BY p.id
  HAVING COUNT(*) = 1
)
UPDATE pedidos p
SET comprador_id = v.comprador_id,
    updated_at = NOW()
FROM vinculos_unicos v
WHERE p.id = v.pedido_id;

-- Vínculo explícito de conta: há no máximo um comprador associado ao admin.
-- O registro é criado em operação administrativa após conferência da identidade.
CREATE TABLE IF NOT EXISTS admin_buyer_link (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  comprador_id INTEGER NOT NULL UNIQUE REFERENCES compradores(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
REVOKE ALL PRIVILEGES ON TABLE admin_buyer_link FROM PUBLIC;
