import assert from 'node:assert/strict';
import { test } from 'node:test';
import { incrementRateLimit } from '../server/data/buyer-auth-data.js';

test('tentativas durante bloqueio retornam expiracao existente sem incrementar/renovar bucket', async () => {
  const blockedUntil = '2026-10-02T18:00:00.000Z';
  let sql = '';
  const client = {
    async query(statement, params) {
      sql = statement;
      assert.deepEqual(params, ['admin_login_ip', 'hashed-bucket', '2026-10-02T17:45:00.000Z', 900, 5, 1800]);
      return { rows: [{ request_count: 0, blocked_until: blockedUntil }] };
    },
  };

  const result = await incrementRateLimit(client, {
    scope: 'admin_login_ip',
    bucketHash: 'hashed-bucket',
    windowStart: '2026-10-02T17:45:00.000Z',
    windowSeconds: 900,
    limit: 5,
    blockSeconds: 1800,
  });

  assert.match(sql, /FROM active\s+WHERE active\.blocked_until IS NULL/);
  assert.match(sql, /FROM active a LEFT JOIN upserted u ON TRUE/);
  assert.match(sql, /request_count = CASE[\s\S]*blocked_until > NOW\(\)[\s\S]*END,/);
  assert.match(sql, /blocked_until = CASE[\s\S]*THEN pin_recovery_rate_limits\.blocked_until[\s\S]*WHEN pin_recovery_rate_limits\.request_count \+ 1/);
  assert.equal(result.request_count, 0);
  assert.equal(result.blocked_until, blockedUntil);
});
