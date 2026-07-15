/**
 * @fileoverview Chaves anonimizadas e janelas fixas de rate limit.
 * @module server/lib/rate-limit
 */

import { hmacSha256Hex } from './pin-crypto.js';

/** Extrai IP do proxy sem persistir o valor em claro. */
export function getRequestIp(req) {
  const forwarded = req?.headers?.get('x-forwarded-for') || '';
  const direct = req?.headers?.get('x-real-ip') || '';
  return String(forwarded.split(',')[0] || direct || 'unknown').trim().slice(0, 128);
}

/** Calcula hash HMAC para bucket de limite ou auditoria. */
export async function hashRateLimitKey(secret, scope, value) {
  return hmacSha256Hex(secret, `${scope}:${String(value || '')}`);
}

/** Arredonda horario para o inicio da janela fixa. */
export function getWindowStart(windowSeconds, now = Date.now()) {
  const windowMs = windowSeconds * 1000;
  return new Date(Math.floor(now / windowMs) * windowMs).toISOString();
}

/** Determina se o bucket esta bloqueado neste instante. */
export function isRateLimitBlocked(bucket, now = Date.now()) {
  if (!bucket?.blocked_until) return false;
  return new Date(bucket.blocked_until).getTime() > now;
}
