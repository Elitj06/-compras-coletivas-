/** HTTP cookie, CSRF and JSON boundary helpers. */
const encoder = new TextEncoder();

export function parseCookies(request) {
  return Object.fromEntries((request.headers.get('cookie') || '').split(';').map((part) => {
    const index = part.indexOf('=');
    return index < 0 ? [] : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

export function cookie(name, value, maxAge, httpOnly = true) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; Secure; SameSite=Strict${httpOnly ? '; HttpOnly' : ''}`;
}

export function expiredCookie(name, httpOnly = true) {
  return `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Strict${httpOnly ? '; HttpOnly' : ''}`;
}

export function appendCookies(response, values) {
  for (const value of values) response.headers.append('Set-Cookie', value);
  return response;
}

export function constantTimeEqual(left, right) {
  const a = encoder.encode(String(left || ''));
  const b = encoder.encode(String(right || ''));
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a[index] ^ b[index];
  return diff === 0;
}

export async function parseJsonBody(request, maxBytes = 65536) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > maxBytes) return { error: 'REQUEST_BODY_TOO_LARGE', status: 413 };
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return { error: 'INVALID_JSON', status: 400 };
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) return { error: 'REQUEST_BODY_TOO_LARGE', status: 413 };
    if (!text.trim()) return { value: {} };
    return { value: JSON.parse(text) };
  } catch { return { error: 'INVALID_JSON', status: 400 }; }
}
