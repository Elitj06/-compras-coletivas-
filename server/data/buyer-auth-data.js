/**
 * @fileoverview Acesso PostgreSQL para autenticacao e recuperacao de PIN.
 * @module server/data/buyer-auth-data
 */

/** Busca compradores por identificador normalizado. */
export async function findBuyersByIdentifier(client, identity) {
  if (identity.kind === 'email') {
    const result = await client.query(
      `SELECT id, nome, telefone, email, pin_hash
       FROM compradores
       WHERE LOWER(BTRIM(COALESCE(email, ''))) = $1
       ORDER BY id ASC LIMIT 5`,
      [identity.value]
    );
    return result.rows;
  }
  if (!identity.candidates.length) return [];
  const result = await client.query(
    `SELECT id, nome, telefone, email, pin_hash
     FROM compradores
     WHERE regexp_replace(COALESCE(telefone, ''), '\\D', '', 'g') = ANY($1::text[])
     ORDER BY id ASC LIMIT 5`,
    [identity.candidates]
  );
  return result.rows;
}

/** Busca conflitos de telefone ou e-mail antes de criar comprador. */
export async function findRegistrationConflicts(client, phoneCandidates, email) {
  const result = await client.query(
    `SELECT id FROM compradores
     WHERE regexp_replace(COALESCE(telefone, ''), '\\D', '', 'g') = ANY($1::text[])
        OR LOWER(BTRIM(COALESCE(email, ''))) = $2
     LIMIT 2`,
    [phoneCandidates, email]
  );
  return result.rows;
}

/** Serializa cadastros concorrentes pelos identificadores canonicos. */
export async function lockRegistrationIdentities(client, lockKeys) {
  for (const key of [...lockKeys].sort()) {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
  }
}

/** Insere comprador novo e retorna os campos publicos. */
export async function insertBuyer(client, buyer) {
  const result = await client.query(
    `INSERT INTO compradores (nome, telefone, email, pin_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, nome, telefone, email`,
    [buyer.nome, buyer.telefone, buyer.email, buyer.pinHash]
  );
  return result.rows[0];
}

/** Bloqueia e retorna comprador por ID para mutacao de PIN. */
export async function getBuyerByIdForUpdate(client, buyerId) {
  const result = await client.query(
    `SELECT id, nome, telefone, email, pin_hash
     FROM compradores WHERE id = $1 FOR UPDATE`,
    [buyerId]
  );
  return result.rows[0] || null;
}

/** Migra ou substitui o hash de PIN do comprador. */
export async function updateBuyerPin(client, buyerId, pinHash) {
  await client.query('UPDATE compradores SET pin_hash = $1 WHERE id = $2', [pinHash, buyerId]);
}

/** Remove todas as sessoes do comprador. */
export async function deleteBuyerSessions(client, buyerId) {
  await client.query('DELETE FROM buyer_sessions WHERE comprador_id = $1', [buyerId]);
}

/** Remove somente a sessao apresentada. */
export async function deleteBuyerSession(client, sessionId, buyerId) {
  const result = await client.query(
    'DELETE FROM buyer_sessions WHERE id = $1 AND comprador_id = $2',
    [sessionId, buyerId]
  );
  return result.rowCount > 0;
}

/** Invalida desafios ativos do mesmo comprador e canal. */
export async function revokeActiveChallenges(client, buyerId, channel) {
  await client.query(
    `UPDATE pin_recovery_challenges SET revoked_at = NOW()
     WHERE comprador_id = $1 AND channel = $2
       AND consumed_at IS NULL AND revoked_at IS NULL`,
    [buyerId, channel]
  );
}

/** Persiste um desafio sem o codigo em claro. */
export async function insertChallenge(client, challenge) {
  await client.query(
    `INSERT INTO pin_recovery_challenges (
       challenge_id, comprador_id, channel, code_hash, expires_at,
       created_by_admin_session_id, verification_method, verification_note
     ) VALUES ($1, $2, $3, $4, NOW() + ($5 || ' seconds')::interval, $6, $7, $8)`,
    [
      challenge.challengeId,
      challenge.buyerId,
      challenge.channel,
      challenge.codeHash,
      challenge.ttlSeconds,
      challenge.adminSessionId || null,
      challenge.verificationMethod || null,
      challenge.verificationNote || null,
    ]
  );
}

/** Marca entrega bem-sucedida do codigo. */
export async function markChallengeDelivered(client, challengeId) {
  await client.query(
    'UPDATE pin_recovery_challenges SET delivered_at = NOW() WHERE challenge_id = $1',
    [challengeId]
  );
}

/** Revoga desafio que nao deve mais ser aceito. */
export async function revokeChallenge(client, challengeId) {
  await client.query(
    `UPDATE pin_recovery_challenges SET revoked_at = COALESCE(revoked_at, NOW())
     WHERE challenge_id = $1`,
    [challengeId]
  );
}

/** Bloqueia desafio e retorna comprador associado. */
export async function getChallengeForUpdate(client, challengeId) {
  const result = await client.query(
    `SELECT prc.*, c.nome, c.telefone, c.email, c.pin_hash
     FROM pin_recovery_challenges prc
     JOIN compradores c ON c.id = prc.comprador_id
     WHERE prc.challenge_id = $1 FOR UPDATE OF prc, c`,
    [challengeId]
  );
  return result.rows[0] || null;
}

/** Registra tentativa invalida e revoga na quinta falha. */
export async function registerInvalidChallengeAttempt(client, challengeId) {
  await client.query(
    `UPDATE pin_recovery_challenges
     SET attempt_count = LEAST(attempt_count + 1, 5),
         revoked_at = CASE WHEN attempt_count + 1 >= 5 THEN NOW() ELSE revoked_at END
     WHERE challenge_id = $1`,
    [challengeId]
  );
}

/** Consome desafio uma unica vez. */
export async function consumeChallenge(client, challengeId) {
  await client.query(
    'UPDATE pin_recovery_challenges SET consumed_at = NOW() WHERE challenge_id = $1',
    [challengeId]
  );
}

/** Persiste evento de seguranca sem PII ou segredo. */
export async function insertSecurityAudit(client, event) {
  await client.query(
    `INSERT INTO pin_recovery_audit (
       event_type, comprador_id, challenge_id, channel,
       actor_admin_session_id, ip_hash, details
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::text::jsonb)`,
    [
      event.type,
      event.buyerId || null,
      event.challengeId || null,
      event.channel || null,
      event.adminSessionId || null,
      event.ipHash || null,
      JSON.stringify(event.details || {}),
    ]
  );
}

/** Incrementa um bucket persistente e retorna estado do limite. */
export async function incrementRateLimit(client, bucket) {
  const result = await client.query(
    `WITH active AS (
       SELECT MAX(blocked_until) AS blocked_until
       FROM pin_recovery_rate_limits
       WHERE scope = $1 AND bucket_hash = $2 AND blocked_until > NOW()
     ), upserted AS (
       INSERT INTO pin_recovery_rate_limits (
         scope, bucket_hash, window_started_at, request_count, expires_at
       ) VALUES (
         $1, $2, $3::timestamptz, 1,
         $3::timestamptz + ($4::text || ' seconds')::interval
       )
       ON CONFLICT (scope, bucket_hash, window_started_at)
       DO UPDATE SET
         request_count = pin_recovery_rate_limits.request_count + 1,
         blocked_until = CASE
           WHEN pin_recovery_rate_limits.request_count + 1 > $5::int
           THEN GREATEST(
             COALESCE(pin_recovery_rate_limits.blocked_until, NOW()),
             NOW() + ($6::text || ' seconds')::interval
           ) ELSE pin_recovery_rate_limits.blocked_until END,
         updated_at = NOW()
       RETURNING request_count, blocked_until
     )
     SELECT u.request_count, GREATEST(u.blocked_until, a.blocked_until) AS blocked_until
     FROM upserted u CROSS JOIN active a`,
    [
      bucket.scope,
      bucket.bucketHash,
      bucket.windowStart,
      bucket.windowSeconds,
      bucket.limit,
      bucket.blockSeconds,
    ]
  );
  return result.rows[0];
}
