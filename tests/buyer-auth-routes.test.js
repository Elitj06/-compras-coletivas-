import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { handleBuyerAuthPost } from '../server/routes/buyer-auth-routes.js';
import { loginBuyer } from '../server/services/buyer-auth-service.js';
import { hashPbkdf2Pin } from '../server/lib/pin-crypto.js';

const RATE_LIMIT_SECRET = 'test-rate-limit-secret-with-at-least-32-bytes';

function loginContext(body) {
  return {
    path: 'comprador/login',
    body,
    client: {
      async query(sql) {
        if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
        if (sql.includes('WITH active AS')) {
          return { rows: [{ request_count: 1, blocked_until: null }] };
        }
        if (sql.includes('FROM compradores')) return { rows: [] };
        throw new Error(`Consulta inesperada: ${sql.slice(0, 40)}`);
      },
    },
    req: new Request('https://example.test/api/db/comprador/login', {
      headers: { 'x-forwarded-for': '203.0.113.8' },
    }),
    createBuyerSession: async () => 'unused',
    env: { RATE_LIMIT_HMAC_KEY: RATE_LIMIT_SECRET },
  };
}

describe('buyer auth route error mapping', () => {
  it('returns 400 instead of 500 for invalid login input', async () => {
    const result = await handleBuyerAuthPost(loginContext({ identificador: '', pin: '12' }));

    assert.equal(result.status, 400);
    assert.equal(result.body.code, 'INVALID_LOGIN_INPUT');
  });

  it('returns 401 instead of 500 for an invalid PIN', async () => {
    const result = await handleBuyerAuthPost(loginContext({
      identificador: 'comprador@example.test', pin: '1234',
    }));

    assert.equal(result.status, 401);
    assert.equal(result.body.code, 'INVALID_CREDENTIALS');
  });
});

function directResetContext({ admin = false, body = {} } = {}) {
  const calls = [];
  const buyer = {
    id: 12,
    nome: 'Pessoa Teste',
    telefone: '21999990000',
    email: 'pessoa@example.com',
    pin_hash: 'old-hash',
    order_count: 0,
  };
  return {
    calls,
    context: {
      path: admin ? 'admin/compradores/12/pin-reset' : 'comprador/pin-recovery/simple',
      body,
      adminSession: admin ? { id: 7 } : null,
      req: new Request('https://example.test/api/db/auth', {
        headers: { 'x-forwarded-for': '203.0.113.8' },
      }),
      env: {},
      client: {
        async query(sql) {
          calls.push(sql);
          if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
          if (sql.includes('FROM compradores c')) return { rows: [buyer] };
          if (sql.includes('FROM compradores WHERE id = $1 FOR UPDATE')) return { rows: [buyer] };
          if (sql.startsWith('INSERT INTO pin_recovery_audit')) return { rows: [], rowCount: 1 };
          return { rows: [], rowCount: 1 };
        },
      },
    },
  };
}

describe('simple PIN recovery routes', () => {
  it('resets a buyer PIN directly and invalidates old sessions', async () => {
    const fixture = directResetContext({
      body: { identificador: 'pessoa@example.com', new_pin: '5678' },
    });
    const result = await handleBuyerAuthPost(fixture.context);

    assert.equal(result.status, 200);
    assert.equal(result.body.pin, '5678');
    assert.equal(result.body.buyer.email, 'pessoa@example.com');
    assert.ok(fixture.calls.some((sql) => sql.startsWith('UPDATE compradores')));
    assert.ok(fixture.calls.some((sql) => sql.startsWith('DELETE FROM buyer_sessions')));
  });

  it('lets the admin generate a PIN that works immediately', async () => {
    const fixture = directResetContext({ admin: true });
    const result = await handleBuyerAuthPost(fixture.context);

    assert.equal(result.status, 200);
    assert.match(result.body.pin, /^\d{6}$/);
    assert.equal(result.body.buyer.id, 12);
  });
});

it('finds the correct account when an identifier exists in legacy duplicates', async () => {
  const matchingHash = await hashPbkdf2Pin('5678', { saltHex: '11'.repeat(16) });
  const candidates = [
    { id: 10, nome: 'Pessoa Antiga', telefone: '21999990000', email: 'pessoa@example.com', pin_hash: matchingHash, order_count: 4 },
    { id: 20, nome: 'Pessoa Duplicada', telefone: '21999990000', email: 'outra@example.com', pin_hash: await hashPbkdf2Pin('1234', { saltHex: '22'.repeat(16) }), order_count: 0 },
  ];
  const client = {
    async query(sql) {
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.includes('WITH active AS')) return { rows: [{ request_count: 1, blocked_until: null }] };
      if (sql.includes('FROM compradores c')) return { rows: candidates };
      if (sql.includes('FROM compradores WHERE id = $1 FOR UPDATE')) return { rows: [candidates[0]] };
      return { rows: [], rowCount: 1 };
    },
  };
  const result = await loginBuyer({
    client,
    req: new Request('https://example.test/api', { headers: { 'x-forwarded-for': '203.0.113.9' } }),
    input: { identificador: '21999990000', pin: '5678' },
    createBuyerSession: async () => 'buyer-token',
    env: { RATE_LIMIT_HMAC_KEY: RATE_LIMIT_SECRET },
  });

  assert.equal(result.buyer.id, 10);
  assert.equal(result.token, 'buyer-token');
});
