/**
 * @fileoverview Recuperacao publica e administrativa de PIN.
 * @module server/services/buyer-recovery-service
 */

import {
  consumeChallenge,
  deleteBuyerSessions,
  findBuyersByIdentifier,
  getBuyerByIdForUpdate,
  getChallengeForUpdate,
  insertChallenge,
  insertSecurityAudit,
  markChallengeDelivered,
  registerInvalidChallengeAttempt,
  revokeActiveChallenges,
  revokeChallenge,
  updateBuyerPin,
} from '../data/buyer-auth-data.js';
import {
  generateRecoveryCode,
  hashPbkdf2Pin,
  hmacSha256Hex,
  isValidPin,
  randomHex,
  timingSafeEqual,
} from '../lib/pin-crypto.js';
import { BuyerAuthError } from './buyer-auth-service.js';
import { consumeAuthRateLimit, getAuditIpHash } from './auth-rate-limit-service.js';

const ADMIN_TTL_SECONDS = 1800;

/** Consome codigo uma unica vez, troca PIN e revoga sessoes. */
export async function completePinRecovery({ client, req, input, env = process.env }) {
  if (!recoveryEnabled(env) || !hasRecoverySecrets(env)) throw invalidRecovery();
  if (!/^[0-9a-f]{64}$/i.test(String(input.challenge_id || '')) ||
      !/^\d{6}$/.test(String(input.code || '')) || !isValidPin(input.new_pin)) {
    throw invalidRecovery();
  }
  const limit = await consumeAuthRateLimit(client, req, {
    scope: 'recovery_complete_ip', key: 'ip', limit: 10,
    windowSeconds: 900, blockSeconds: 1800,
  }, env);
  if (limit.blocked) throw invalidRecovery();
  const outcome = await withTransaction(client, async () => {
    const challenge = await getChallengeForUpdate(client, input.challenge_id);
    if (!isUsableChallenge(challenge)) return { error: invalidRecovery() };
    const candidate = await recoveryCodeHash(env, input.challenge_id, input.code);
    if (!timingSafeEqual(candidate, challenge.code_hash)) {
      await registerInvalidChallengeAttempt(client, input.challenge_id);
      await audit(client, req, env, {
        type: 'pin_recovery_code_rejected', buyerId: challenge.comprador_id,
        challengeId: input.challenge_id, channel: challenge.channel,
      });
      return { error: invalidRecovery() };
    }
    await updateBuyerPin(client, challenge.comprador_id, await hashPbkdf2Pin(input.new_pin));
    await deleteBuyerSessions(client, challenge.comprador_id);
    await consumeChallenge(client, input.challenge_id);
    await audit(client, req, env, {
      type: 'pin_recovery_completed', buyerId: challenge.comprador_id,
      challengeId: input.challenge_id, channel: challenge.channel,
    });
    return { success: true, sessions_revoked: true };
  });
  if (outcome.error) throw outcome.error;
  return outcome;
}

/** Gera codigo temporario apos validacao humana registrada pelo admin. */
export async function createAdminRecovery({ client, req, buyerId, input, adminSession, env = process.env }) {
  if (!adminSession) throw new BuyerAuthError('UNAUTHORIZED', 401, 'Não autorizado');
  if (!recoveryEnabled(env) || !hasRecoverySecrets(env)) {
    throw new BuyerAuthError('RECOVERY_NOT_CONFIGURED', 503, 'Recuperação ainda não está configurada');
  }
  const verificationMethod = String(input.verification_method || '').trim();
  const verificationNote = String(input.verification_note || '').trim();
  if (!verificationMethod || verificationMethod.length > 80 || verificationNote.length < 10 || verificationNote.length > 500) {
    throw new BuyerAuthError('INVALID_ADMIN_VERIFICATION', 400, 'Registre método e nota de validação');
  }
  if (await isAdminRecoveryBlocked(client, req, buyerId, adminSession.id, env)) {
    throw new BuyerAuthError('ADMIN_RECOVERY_RATE_LIMITED', 429, 'Limite de códigos atingido');
  }
  const challengeId = randomHex(32);
  const code = generateRecoveryCode();
  await withTransaction(client, async () => {
    const buyer = await getBuyerByIdForUpdate(client, buyerId);
    if (!buyer) throw new BuyerAuthError('BUYER_NOT_FOUND', 404, 'Comprador não encontrado');
    await revokeActiveChallenges(client, buyerId, 'admin');
    await insertChallenge(client, {
      challengeId, buyerId, channel: 'admin', ttlSeconds: ADMIN_TTL_SECONDS,
      codeHash: await recoveryCodeHash(env, challengeId, code),
      adminSessionId: adminSession.id, verificationMethod, verificationNote,
    });
    await markChallengeDelivered(client, challengeId);
    await audit(client, req, env, {
      type: 'pin_recovery_admin_created', buyerId, challengeId, channel: 'admin',
      adminSessionId: adminSession.id,
    });
  });
  return {
    challenge_id: challengeId,
    code,
    expires_at: new Date(Date.now() + ADMIN_TTL_SECONDS * 1000).toISOString(),
  };
}


async function isAdminRecoveryBlocked(client, req, buyerId, adminId, env) {
  const buyer = await consumeAuthRateLimit(client, req, {
    scope: 'admin_recovery_buyer', key: String(buyerId), limit: 3,
    windowSeconds: 86400, blockSeconds: 86400,
  }, env);
  const admin = await consumeAuthRateLimit(client, req, {
    scope: 'admin_recovery_admin', key: String(adminId), limit: 20,
    windowSeconds: 86400, blockSeconds: 86400,
  }, env);
  return buyer.blocked || admin.blocked;
}

async function audit(client, req, env, event) {
  await insertSecurityAudit(client, { ...event, ipHash: await getAuditIpHash(req, env) });
}

function isUsableChallenge(challenge) {
  return Boolean(challenge && challenge.delivered_at &&
    !challenge.consumed_at && !challenge.revoked_at &&
    Number(challenge.attempt_count) < 5 && new Date(challenge.expires_at).getTime() > Date.now());
}

function recoveryCodeHash(env, challengeId, code) {
  return hmacSha256Hex(env.RECOVERY_HMAC_KEY, `${challengeId}:${code}`);
}

function recoveryEnabled(env) {
  return String(env.PIN_RECOVERY_ENABLED || '').toLowerCase() === 'true';
}

function hasRecoverySecrets(env) {
  return [env.RECOVERY_HMAC_KEY, env.RATE_LIMIT_HMAC_KEY]
    .every((secret) => new TextEncoder().encode(String(secret || '')).length >= 32);
}

function neutral(challengeId) {
  return { success: true, message: NEUTRAL_MESSAGE, challenge_id: challengeId };
}

function invalidRecovery() {
  return new BuyerAuthError('INVALID_OR_EXPIRED_RECOVERY', 400, 'Código inválido ou expirado');
}

async function withTransaction(client, operation) {
  await client.query('BEGIN');
  try {
    const result = await operation();
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
