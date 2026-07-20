/**
 * @fileoverview Helpers for same-origin cookie sessions and JSON boundaries.
 * @module server/lib/http-security
 */

const encoder = new TextEncoder();

/** Parse a Cookie header without throwing on malformed entries. */
export function parseCookies(request) {
  return Object.fromEntries(
    (request.headers.get('cookie') || '')
      .split(';')
      .map((part) => {
        const index = part.indexOf('=');
        return index < 0
          ? []
          : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
      })
      .filter(([key]) => key),
  );
}

/** Serialize a strict, host-only cookie. */
export function cookie(name, value, maxAge, httpOnly = true) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; Secure; SameSite=Strict${httpOnly ? '; HttpOnly' : ''}`;
}

/** Serialize an expired cookie with the same scope as the live cookie. */
export function expiredCookie(name, httpOnly = true) {
  return `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Strict${httpOnly ? '; HttpOnly' : ''}`;
}

/** Append multiple Set-Cookie headers without collapsing them into one line. */
export function appendCookies(response, values) {
  for (const value of values) response.headers.append('Set-Cookie', value);
  return response;
}

/** Compare CSRF values without an early return for equal-length inputs. */
export function constantTimeEqual(left, right) {
  const a = encoder.encode(String(left || ''));
  const b = encoder.encode(String(right || ''));
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

/** Parse bounded JSON request bodies before route-specific logic. */
export async function parseJsonBody(request, maxBytes = 65536) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > maxBytes) return { error: 'REQUEST_BODY_TOO_LARGE', status: 413 };
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return { error: 'INVALID_JSON', status: 400 };
  try {
    const text = await request.text();
    if (encoder.encode(text).byteLength > maxBytes) return { error: 'REQUEST_BODY_TOO_LARGE', status: 413 };
    return { value: text.trim() ? JSON.parse(text) : {} };
  } catch {
    return { error: 'INVALID_JSON', status: 400 };
  }
}
