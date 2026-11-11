import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAllowedOrigins } from '../server/lib/allowed-origins.js';

test('preserves existing production and development origins', () => {
  const allowed = buildAllowedOrigins('');
  assert.equal(allowed.has('https://compras-coletivas-phi.vercel.app'), true);
  assert.equal(allowed.has('http://localhost:3000'), true);
  assert.equal(allowed.has('https://attacker.example'), false);
});

test('allows only explicit valid HTTPS origins from the server configuration', () => {
  const allowed = buildAllowedOrigins('https://compras-preview.example, https://new.example:8443');
  assert.equal(allowed.has('https://compras-preview.example'), true);
  assert.equal(allowed.has('https://new.example:8443'), true);
  assert.equal(allowed.has('https://sub.compras-preview.example'), false);
  assert.equal(allowed.has('http://compras-preview.example'), false);
});

test('rejects wildcard, HTTP, credentials, paths, query strings and malformed entries', () => {
  for (const invalid of ['*', 'https://*.example.com', 'http://example.com', 'https://user@example.com',
    'https://example.com/path', 'https://example.com/?x=1', 'https://example.com/#hash', 'not-a-url']) {
    assert.throws(() => buildAllowedOrigins(invalid), /origem/i, invalid);
  }
});
