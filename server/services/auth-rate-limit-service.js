/**
 * @fileoverview Orquestracao de rate limit persistente para autenticacao.
 * @module server/services/auth-rate-limit-service
 */

import { incrementRateLimit } from '../data/buyer-auth-data.js';
import {
  getRequestIp,
  getWindowStart,
  hashRateLimitKey,
  isRateLimitBlocked,
} from '../lib/rate-limit.js';

/** Consome um bucket e informa se a chamada deve ser bloqueada. */
export async function consumeAuthRateLimit(client, req, rule, env) {
  const secret = env.RATE_LIMIT_HMAC_KEY;
  if (!secret) return { blocked: false, configured: false };
  const rawKey = rule.key === 'ip' ? getRequestIp(req) : rule.key;
  const bucketHash = await hashRateLimitKey(secret, rule.scope, rawKey);
  const bucket = await incrementRateLimit(client, {
    scope: rule.scope,
    bucketHash,
    windowStart: getWindowStart(rule.windowSeconds),
    windowSeconds: rule.windowSeconds,
    limit: rule.limit,
    blockSeconds: rule.blockSeconds,
  });
  return { blocked: isRateLimitBlocked(bucket), configured: true, bucketHash };
}

/** Produz hash de IP para auditoria sanitizada. */
export async function getAuditIpHash(req, env) {
  if (!env.RATE_LIMIT_HMAC_KEY) return null;
  return hashRateLimitKey(env.RATE_LIMIT_HMAC_KEY, 'audit_ip', getRequestIp(req));
}
