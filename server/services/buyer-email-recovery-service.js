/**
 * @fileoverview Solicitação de recuperação por e-mail, exclusiva do runtime Node.
 * @module server/services/buyer-email-recovery-service
 */

import {
  getBuyerByIdForUpdate, insertChallenge, insertSecurityAudit,
  markChallengeDelivered, revokeActiveChallenges, revokeChallenge,
} from '../data/buyer-auth-data.js';
import { normalizeIdentifier } from '../lib/buyer-identity.js';
import { generateRecoveryCode, hmacSha256Hex, randomHex } from '../lib/pin-crypto.js';
import { sendRecoveryEmail } from '../lib/recovery-email.js';
import { consumeAuthRateLimit, getAuditIpHash } from './auth-rate-limit-service.js';
import {
  findCanonicalBuyerByEmail,
  findCanonicalBuyerByIdentifier,
} from './buyer-identity-resolution-service.js';

const EMAIL_TTL_SECONDS = 600;
const NEUTRAL_MESSAGE = 'Se os dados estiverem aptos, você receberá as instruções em instantes.';

/** Prepara desafio sem aguardar o provedor e sem revelar elegibilidade. */
export async function preparePinRecovery({ client, req, input, env = process.env }) {
  const fakeChallengeId = randomHex(32);
  const identity = normalizeIdentifier(input.identificador);
  if (!identity.value || await isBlocked(client, req, identity, env)) return unavailable(fakeChallengeId);
  if (!isEnabled(env) || !hasSecrets(env)) {
    await audit(client, req, env, {
      type: 'pin_recovery_unavailable',
      details: { reason: !isEnabled(env) ? 'disabled' : 'missing_security_config' },
    });
    return unavailable(fakeChallengeId);
  }
  const buyer = await findCanonicalBuyerByIdentifier(client, identity);
  if (!buyer || !(await hasUniqueEmail(client, buyer))) return unavailable(fakeChallengeId);
  const challengeId = randomHex(32);
  const code = generateRecoveryCode();
  await createChallenge(client, req, buyer.id, challengeId, await codeHash(env, challengeId, code), env);
  return {
    response: neutral(challengeId),
    fakeChallengeId,
    delivery: { buyerId: buyer.id, challengeId, to: buyer.email, code },
  };
}

/** Entrega um desafio preparado e registra sucesso ou revogacao. */
export async function deliverPreparedPinRecovery({
  client, req, prepared, env = process.env, sendMailImpl,
}) {
  if (!prepared?.delivery) return { delivered: false, reason: 'not_eligible' };
  const { buyerId, challengeId, to, code } = prepared.delivery;
  const delivery = await sendRecoveryEmail({ to, code, challengeId, env, sendMailImpl });
  await finishDelivery(client, req, buyerId, challengeId, delivery, env);
  return delivery;
}

/** Wrapper síncrono para testes e consumidores fora do handler público. */
export async function requestPinRecovery({ client, req, input, env = process.env, sendMailImpl }) {
  const prepared = await preparePinRecovery({ client, req, input, env });
  if (!prepared.delivery) return prepared.response;
  const delivery = await deliverPreparedPinRecovery({
    client, req, prepared, env, sendMailImpl,
  });
  return neutral(delivery.delivered
    ? prepared.delivery.challengeId
    : prepared.fakeChallengeId);
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
  const canonical = await findCanonicalBuyerByEmail(client, buyer.email);
  return canonical?.id === buyer.id;
}

async function isBlocked(client, req, identity, env) {
  const rules = [
    ['recovery_request_identifier', `${identity.kind}:${identity.value}`, 3, 3600, 3600],
    ['recovery_request_identifier_day', `${identity.kind}:${identity.value}`, 5, 86400, 86400],
    ['recovery_request_ip', 'ip', 10, 3600, 3600], ['recovery_request_ip_day', 'ip', 30, 86400, 86400],
  ];
  const results = await Promise.all(rules.map(([scope, key, limit, windowSeconds, blockSeconds]) =>
    consumeAuthRateLimit(client, req, { scope, key, limit, windowSeconds, blockSeconds }, env)));
  return results.some((result) => !result.configured || result.blocked);
}

async function audit(client, req, env, event) {
  await insertSecurityAudit(client, { ...event, ipHash: await getAuditIpHash(req, env) });
}

async function codeHash(env, challengeId, code) { return hmacSha256Hex(env.RECOVERY_HMAC_KEY, `${challengeId}:${code}`); }
function isEnabled(env) { return String(env.PIN_RECOVERY_ENABLED || '').toLowerCase() === 'true'; }
function hasSecrets(env) { return [env.RECOVERY_HMAC_KEY, env.RATE_LIMIT_HMAC_KEY].every((secret) => new TextEncoder().encode(String(secret || '')).length >= 32); }
function neutral(challengeId) { return { success: true, message: NEUTRAL_MESSAGE, challenge_id: challengeId }; }
function unavailable(fakeChallengeId) { return { response: neutral(fakeChallengeId), fakeChallengeId, delivery: null }; }
async function transaction(client, operation) { await client.query('BEGIN'); try { const result = await operation(); await client.query('COMMIT'); return result; } catch (error) { await client.query('ROLLBACK'); throw error; } }
