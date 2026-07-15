-- ============================================================
-- Recuperacao de PIN — schema aditivo da release de compatibilidade
-- Seguro para reexecucao. Nao ativa rotas nem altera hashes existentes.
-- ============================================================

DO $schema$
BEGIN
  IF TO_REGNAMESPACE('compras_coletivas') IS NULL THEN
    RAISE EXCEPTION 'Schema compras_coletivas nao encontrado';
  END IF;
END
$schema$;

SET search_path TO compras_coletivas, public;

CREATE TABLE IF NOT EXISTS pin_recovery_challenges (
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
  CHECK (
    channel <> 'admin' OR (
      created_by_admin_session_id IS NOT NULL AND
      NULLIF(BTRIM(verification_method), '') IS NOT NULL AND
      NULLIF(BTRIM(verification_note), '') IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_pin_recovery_challenges_active_buyer
  ON pin_recovery_challenges(comprador_id, channel, created_at DESC)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pin_recovery_challenges_expires_at
  ON pin_recovery_challenges(expires_at);

CREATE TABLE IF NOT EXISTS pin_recovery_rate_limits (
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

CREATE INDEX IF NOT EXISTS idx_pin_recovery_rate_limits_expires_at
  ON pin_recovery_rate_limits(expires_at);

CREATE TABLE IF NOT EXISTS pin_recovery_audit (
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

CREATE INDEX IF NOT EXISTS idx_pin_recovery_audit_created_at
  ON pin_recovery_audit(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pin_recovery_audit_buyer
  ON pin_recovery_audit(comprador_id, created_at DESC);

-- SECTION: Data API fechada. Somente o papel da conexao que executa a
-- migracao recebe DML; anon/authenticated/service_role permanecem sem acesso.
REVOKE ALL PRIVILEGES ON TABLE
  pin_recovery_challenges,
  pin_recovery_rate_limits,
  pin_recovery_audit
FROM PUBLIC;

REVOKE ALL PRIVILEGES ON SEQUENCE
  pin_recovery_challenges_id_seq,
  pin_recovery_rate_limits_id_seq,
  pin_recovery_audit_id_seq
FROM PUBLIC;

DO $security$
DECLARE
  exposed_role TEXT;
BEGIN
  FOREACH exposed_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = exposed_role) THEN
      EXECUTE FORMAT(
        'REVOKE ALL PRIVILEGES ON TABLE pin_recovery_challenges, pin_recovery_rate_limits, pin_recovery_audit FROM %I',
        exposed_role
      );
      EXECUTE FORMAT(
        'REVOKE ALL PRIVILEGES ON SEQUENCE pin_recovery_challenges_id_seq, pin_recovery_rate_limits_id_seq, pin_recovery_audit_id_seq FROM %I',
        exposed_role
      );
    END IF;
  END LOOP;
END
$security$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  pin_recovery_challenges,
  pin_recovery_rate_limits,
  pin_recovery_audit
TO CURRENT_USER;

GRANT USAGE, SELECT ON SEQUENCE
  pin_recovery_challenges_id_seq,
  pin_recovery_rate_limits_id_seq,
  pin_recovery_audit_id_seq
TO CURRENT_USER;
