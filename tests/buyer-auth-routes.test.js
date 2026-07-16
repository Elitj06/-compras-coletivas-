import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { handleBuyerAuthPost } from '../server/routes/buyer-auth-routes.js';

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
