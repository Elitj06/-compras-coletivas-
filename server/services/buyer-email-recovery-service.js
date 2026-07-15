/**
 * @fileoverview Solicitação de recuperação por e-mail, exclusiva do runtime Node.
 * @module server/services/buyer-email-recovery-service
 */

import {
  findBuyersByIdentifier, getBuyerByIdForUpdate, insertChallenge, insertSecurityAudit,
  markChallengeDelivered, revokeActiveChallenges, revokeChallenge,
} from '../data/buyer-auth-data.js';
import { normalizeIdentifier } from '../lib/buyer-identity.js';
import { generateRecoveryCode, hmacSha256Hex, randomHex } from '../lib/pin-crypto.js';
import { sendRecoveryEmail } from '../lib/recovery-email.js';
import { consumeAuthRateLimit, getAuditIpHash } from './auth-rate-limit-service.js';

const EMAIL_TTL_SECONDS = 600;
const NEUTRAL_MESSAGE = 'Se os dados estiverem aptos, você receberá as instruções em instantes.';

/** Solicita código sem revelar existência, duplicidade ou falha de entrega. */
export async function requestPinRecovery({ client, req, input, env = process.env, sendMailImpl }) {
  const fakeChallengeId = randomHex(32);
  if (!isEnabled(env) || !hasSecrets(env)) return neutral(fakeChallengeId);
  const identity = normalizeIdentifier(input.identificador);
  if (!identity.value || await isBlocked(client, req, identity, env)) return neutral(fakeChallengeId);
  const buyers = await findBuyersByIdentifier(client, identity);
  if (buyers.length !== 1 || !(await hasUniqueEmail(client, buyers[0]))) return neutral(fakeChallengeId);
  const buyer = buyers[0];
  const challengeId = randomHex(32);
  const code = generateRecoveryCode();
  await createChallenge(client, req, buyer.id, challengeId, await codeHash(env, challengeId, code), env);
  const delivery = await sendRecoveryEmail({ to: buyer.email, code, challengeId, env, sendMailImpl });
  await finishDelivery(client, req, buyer.id, challengeId, delivery, env);
  return neutral(delivery.delivered ? challengeId : fakeChallengeId);
}

async function createChallenge(client, req, buyerId, challengeId, hash, env) {
  await transaction(client, async () => {
    if (!await getBuyerByIdForUpdate(client, buyerId)) throw new Error('Buyer disappeared');
    await revokeActiveChallenges(client, buyerId, 'email');
    await insertChallenge(client, { challengeId, buyerId, channel: 'email', codeHash: hash, ttlSeconds: EMAIL_TTL_SECONDS });
    await audit(client, req, env, { type: 'pin_recovery_requested', buyerId, challengeId, channel: 'email' });
  });
}

async function finishDelivery(client, req, buyerId, challengeId, delivery, env) {
  await transaction(client, async () => {
    if (delivery.delivered) await markChallengeDelivered(client, challengeId);
    else await revokeChallenge(client, challengeId);
    await audit(client, req, env, {
      type: delivery.delivered ? 'pin_recovery_delivered' : 'pin_recovery_delivery_failed',
      buyerId, challengeId, channel: 'email', details: { reason: delivery.reason || 'delivered' },
    });
  });
}

async function hasUniqueEmail(client, buyer) {
  const identity = normalizeIdentifier(buyer.email);
  if (identity.kind !== 'email') return false;
  const matches = await findBuyersByIdentifier(client, identity);
  return matches.length === 1 && matches[0].id === buyer.id;
}

async function isBlocked(client, req, identity, env) {
  const rules = [
    ['recovery_request_identifier', `${identity.kind}:${identity.value}`, 3, 3600, 3600],
    ['recovery_request_identifier_day', `${identity.kind}:${identity.value}`, 5, 86400, 86400],
    ['recovery_request_ip', 'ip', 10, 3600, 3600], ['recovery_request_ip_day', 'ip', 30, 86400, 86400],
  ];
  const results = await Promise.all(rules.map(([scope, key, limit, windowSeconds, blockSeconds]) =>
    consumeAuthRateLimit(client, req, { scope, key, limit, windowSeconds, blockSeconds }, env)));
  return results.some((result) => result.blocked);
}

async function audit(client, req, env, event) {
  await insertSecurityAudit(client, { ...event, ipHash: await getAuditIpHash(req, env) });
}

async function codeHash(env, challengeId, code) { return hmacSha256Hex(env.RECOVERY_HMAC_KEY, `${challengeId}:${code}`); }
function isEnabled(env) { return String(env.PIN_RECOVERY_ENABLED || '').toLowerCase() === 'true'; }
function hasSecrets(env) { return [env.RECOVERY_HMAC_KEY, env.RATE_LIMIT_HMAC_KEY].every((secret) => new TextEncoder().encode(String(secret || '')).length >= 32); }
function neutral(challengeId) { return { success: true, message: NEUTRAL_MESSAGE, challenge_id: challengeId }; }
async function transaction(client, operation) { await client.query('BEGIN'); try { const result = await operation(); await client.query('COMMIT'); return result; } catch (error) { await client.query('ROLLBACK'); throw error; } }
