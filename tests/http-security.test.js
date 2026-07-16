import test from 'node:test';
import assert from 'node:assert/strict';
import { appendCookies, constantTimeEqual, cookie, parseJsonBody } from '../server/lib/http-security.js';
import { isCanonicalIp } from '../api/db.js';

test('cookie serializer produces independent host cookies', () => {
  const response = appendCookies(new Response('ok'), [cookie('__Host-cc-buyer', 'session', 60), cookie('__Host-cc-buyer-csrf', 'csrf', 60, false)]);
  const values = response.headers.getSetCookie();
  assert.equal(values.length, 2); assert.match(values[0], /HttpOnly/); assert.doesNotMatch(values[1], /HttpOnly/);
});
test('JSON parser returns stable invalid JSON contract', async () => {
  const parsed = await parseJsonBody(new Request('https://example.test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }));
  assert.equal(parsed.error, 'INVALID_JSON'); assert.equal(constantTimeEqual('a', 'a'), true);
});

test('trusted rate-limit IP parser rejects incomplete and forged IPv6 values', () => {
  assert.equal(isCanonicalIp('203.0.113.8'), true);
  assert.equal(isCanonicalIp('2001:db8::1'), true);
  assert.equal(isCanonicalIp('1:2:3'), false);
  assert.equal(isCanonicalIp('203.0.113.8, 198.51.100.1'), false);
});
