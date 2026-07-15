import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';

import { verifyPinHash } from '../server/lib/pin-crypto.js';
import {
  changeBuyerPin,
  loginBuyer,
  logoutBuyer,
  registerBuyer,
} from '../server/services/buyer-auth-service.js';
import {
  completePinRecovery,
  createAdminRecovery,
} from '../server/services/buyer-recovery-service.js';
import { requestPinRecovery } from '../server/services/buyer-email-recovery-service.js';
import {
  baseSchema,
  buyerState,
  createBuyerSession,
  makeRequest,
  openTestClient,
  seedBuyer,
} from './helpers/buyer-auth-test-db.js';

const DATABASE_URL = process.env.TEST_DATABASE_URL;
const suite = DATABASE_URL ? describe : describe.skip;
const ENV = {
  PIN_RECOVERY_ENABLED: 'true',
  PIN_HASH_MIGRATION_ENABLED: 'true',
  RECOVERY_HMAC_KEY: 'test-recovery-key-with-at-least-32-bytes',
  RATE_LIMIT_HMAC_KEY: 'test-rate-key-with-at-least-32-bytes',
  SMTP_USER: 'compras@example.com',
  SMTP_APP_PASSWORD: 'test-app-password',
  RECOVERY_FROM_EMAIL: 'Compras <compras@example.com>',
  APP_BASE_URL: 'https://example.com',
};

suite('buyer auth integration', () => {
  let client;

  before(async () => {
    client = await openTestClient(DATABASE_URL);
    await client.query('DROP SCHEMA IF EXISTS compras_coletivas CASCADE');
    await client.query('CREATE SCHEMA compras_coletivas');
    await client.query(baseSchema());
    await client.query(fs.readFileSync('sql/05_pin_recovery.sql', 'utf8'));
    await client.query(fs.readFileSync('sql/05_pin_recovery.sql', 'utf8'));
  });

  beforeEach(async () => {
    await client.query(`TRUNCATE pin_recovery_audit, pin_recovery_rate_limits,
      pin_recovery_challenges, buyer_sessions, admin_sessions, compradores
      RESTART IDENTITY CASCADE`);
  });

  after(async () => {
    if (client) await client.end();
  });

  it('keeps public request neutral and completes a delivered code once', async () => {
    const buyer = await seedBuyer(client, 'Ana Única', '21999990001', 'ana@example.com', '1234');
    await createBuyerSession(client, buyer.id);
    const sent = [];
    const sendMailImpl = async (message) => {
      sent.push(message);
      return { accepted: [message.to], rejected: [] };
    };
    const request = await requestPinRecovery({
      client, req: makeRequest('1'), input: { identificador: 'ana@example.com' }, env: ENV, sendMailImpl,
    });
    const absent = await requestPinRecovery({
      client, req: makeRequest('2'), input: { identificador: 'ausente@example.com' }, env: ENV, sendMailImpl,
    });
    assert.deepEqual(Object.keys(request), Object.keys(absent));
    assert.equal(request.message, absent.message);
    assert.equal(sent.length, 1);
    const code = sent[0].text.match(/Codigo: (\d{6})/)[1];
    const completed = await completePinRecovery({
      client,
      req: makeRequest('3'),
      input: { challenge_id: request.challenge_id, code, new_pin: '5678' },
      env: ENV,
    });
    assert.equal(completed.sessions_revoked, true);
    const state = await buyerState(client, buyer.id, request.challenge_id);
    assert.equal(state.session_count, 0);
    assert.ok(state.consumed_at);
    assert.equal(await verifyPinHash('5678', state.pin_hash, ''), true);
    await assert.rejects(() => completePinRecovery({
      client, req: makeRequest('4'),
      input: { challenge_id: request.challenge_id, code, new_pin: '6789' }, env: ENV,
    }), /Código inválido ou expirado/);
  });

  it('does not send when the delivery email is ambiguous', async () => {
    await seedBuyer(client, 'Pessoa Um', '21999990011', 'compartilhado@example.com', '1234');
    await seedBuyer(client, 'Pessoa Dois', '21999990012', 'compartilhado@example.com', '1234');
    let sends = 0;
    const result = await requestPinRecovery({
      client,
      req: makeRequest('5'),
      input: { identificador: '21999990011' },
      env: ENV,
      sendMailImpl: async () => { sends += 1; return { accepted: [], rejected: [] }; },
    });
    assert.equal(result.success, true);
    assert.equal(sends, 0);
  });

  it('invalidates an earlier email challenge when a new code is delivered', async () => {
    await seedBuyer(client, 'Reenvio Seguro', '21999990014', 'reenvio@example.com', '1234');
    const deliveries = [];
    const sendMailImpl = async (message) => {
      deliveries.push(message);
      return { accepted: [message.to], rejected: [] };
    };
    const first = await requestPinRecovery({
      client, req: makeRequest('14'), input: { identificador: 'reenvio@example.com' }, env: ENV, sendMailImpl,
    });
    const second = await requestPinRecovery({
      client, req: makeRequest('15'), input: { identificador: 'reenvio@example.com' }, env: ENV, sendMailImpl,
    });
    const firstCode = deliveries[0].text.match(/Codigo: (\d{6})/)[1];
    const secondCode = deliveries[1].text.match(/Codigo: (\d{6})/)[1];
    await assert.rejects(() => completePinRecovery({
      client, req: makeRequest('16'),
      input: { challenge_id: first.challenge_id, code: firstCode, new_pin: '5678' }, env: ENV,
    }), /Código inválido ou expirado/);
    assert.equal((await completePinRecovery({
      client, req: makeRequest('17'),
      input: { challenge_id: second.challenge_id, code: secondCode, new_pin: '5678' }, env: ENV,
    })).success, true);
  });

  it('revokes a challenge when email delivery fails', async () => {
    const buyer = await seedBuyer(client, 'Falha Segura', '21999990015', 'falha@example.com', '1234');
    const result = await requestPinRecovery({
      client,
      req: makeRequest('18'),
      input: { identificador: 'falha@example.com' },
      env: ENV,
      sendMailImpl: async () => { throw new Error('delivery failed'); },
    });
    assert.equal(result.success, true);
    const state = await client.query(
      `SELECT COUNT(*) FILTER (WHERE revoked_at IS NULL)::int AS active,
              COUNT(*) FILTER (WHERE revoked_at IS NOT NULL)::int AS revoked
       FROM pin_recovery_challenges WHERE comprador_id = $1`,
      [buyer.id]
    );
    assert.deepEqual(state.rows[0], { active: 0, revoked: 1 });
  });

  it('fails closed and audits when the email provider is not configured', async () => {
    const buyer = await seedBuyer(client, 'Sem Provedor', '21999990017', 'sem-provedor@example.com', '1234');
    await requestPinRecovery({
      client,
      req: makeRequest('27'),
      input: { identificador: 'sem-provedor@example.com' },
      env: { ...ENV, SMTP_APP_PASSWORD: '', RECOVERY_FROM_EMAIL: '' },
    });
    const result = await client.query(
      `SELECT c.revoked_at, a.details
       FROM pin_recovery_challenges c
       JOIN pin_recovery_audit a ON a.challenge_id = c.challenge_id
       WHERE c.comprador_id = $1 AND a.event_type = 'pin_recovery_delivery_failed'`,
      [buyer.id]
    );
    assert.ok(result.rows[0].revoked_at);
    assert.equal(result.rows[0].details.reason, 'not_configured');
  });

  it('blocks after five wrong codes and rejects expired challenges', async () => {
    await seedBuyer(client, 'Limite Seguro', '21999990016', 'limite@example.com', '1234');
    const deliveries = [];
    const sendMailImpl = async (message) => {
      deliveries.push(message);
      return { accepted: [message.to], rejected: [] };
    };
    const limited = await requestPinRecovery({
      client, req: makeRequest('19'), input: { identificador: 'limite@example.com' }, env: ENV, sendMailImpl,
    });
    const deliveredCode = deliveries[0].text.match(/Codigo: (\d{6})/)[1];
    const wrongCode = String((Number(deliveredCode) + 1) % 1000000).padStart(6, '0');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await assert.rejects(() => completePinRecovery({
        client, req: makeRequest(String(20 + attempt)),
        input: { challenge_id: limited.challenge_id, code: wrongCode, new_pin: '5678' }, env: ENV,
      }), /Código inválido ou expirado/);
    }
    const limitedState = await client.query(
      'SELECT attempt_count, revoked_at FROM pin_recovery_challenges WHERE challenge_id = $1',
      [limited.challenge_id]
    );
    assert.equal(Number(limitedState.rows[0].attempt_count), 5);
    assert.ok(limitedState.rows[0].revoked_at);

    const expired = await requestPinRecovery({
      client, req: makeRequest('25'), input: { identificador: 'limite@example.com' }, env: ENV, sendMailImpl,
    });
    await client.query(
      `UPDATE pin_recovery_challenges
       SET created_at = NOW() - INTERVAL '2 seconds', expires_at = NOW() - INTERVAL '1 second'
       WHERE challenge_id = $1`,
      [expired.challenge_id]
    );
    const expiredCode = deliveries.at(-1).text.match(/Codigo: (\d{6})/)[1];
    await assert.rejects(() => completePinRecovery({
      client, req: makeRequest('26'),
      input: { challenge_id: expired.challenge_id, code: expiredCode, new_pin: '5678' }, env: ENV,
    }), /Código inválido ou expirado/);
  });

  it('allows exactly one concurrent recovery completion', async () => {
    const buyer = await seedBuyer(client, 'Corrida Segura', '21999990013', 'corrida@example.com', '1234');
    let email;
    const request = await requestPinRecovery({
      client,
      req: makeRequest('11'),
      input: { identificador: 'corrida@example.com' },
      env: ENV,
      sendMailImpl: async (message) => {
        email = message;
        return { accepted: [message.to], rejected: [] };
      },
    });
    const code = email.text.match(/Codigo: (\d{6})/)[1];
    const firstClient = await openTestClient(DATABASE_URL);
    const secondClient = await openTestClient(DATABASE_URL);
    try {
      const attempts = await Promise.allSettled([
        completePinRecovery({
          client: firstClient, req: makeRequest('12'),
          input: { challenge_id: request.challenge_id, code, new_pin: '6789' }, env: ENV,
        }),
        completePinRecovery({
          client: secondClient, req: makeRequest('13'),
          input: { challenge_id: request.challenge_id, code, new_pin: '6789' }, env: ENV,
        }),
      ]);
      assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 1);
      assert.equal(attempts.filter((attempt) => attempt.status === 'rejected').length, 1);
      assert.ok((await buyerState(client, buyer.id, request.challenge_id)).consumed_at);
    } finally {
      await firstClient.end();
      await secondClient.end();
    }
  });

  it('creates an audited admin code and rotates sessions on authenticated change', async () => {
    const buyer = await seedBuyer(client, 'Bruno Seguro', '21999990021', 'bruno@example.com', '2345');
    const first = await createBuyerSession(client, buyer.id);
    await createBuyerSession(client, buyer.id);
    const admin = await client.query(
      `INSERT INTO admin_sessions (token_hash, expires_at)
       VALUES ('admin-hash', NOW() + INTERVAL '1 hour') RETURNING id`
    );
    const manual = await createAdminRecovery({
      client, req: makeRequest('6'), buyerId: buyer.id,
      input: { verification_method: 'WhatsApp', verification_note: 'Confirmou pedido e telefone cadastrados' },
      adminSession: { id: admin.rows[0].id }, env: ENV,
    });
    assert.match(manual.code, /^\d{6}$/);
    const changed = await changeBuyerPin({
      client, req: makeRequest('7'), input: { current_pin: '2345', new_pin: '3456' },
      buyerSession: { id: buyer.id, session_id: first.sessionId },
      createBuyerSession, env: ENV,
    });
    assert.ok(changed.token);
    const sessions = await client.query('SELECT id FROM buyer_sessions WHERE comprador_id = $1', [buyer.id]);
    assert.equal(sessions.rowCount, 1);
    await logoutBuyer({
      client, buyerSession: { id: buyer.id, session_id: sessions.rows[0].id },
    });
    const afterLogout = await client.query('SELECT id FROM buyer_sessions WHERE comprador_id = $1', [buyer.id]);
    assert.equal(afterLogout.rowCount, 0);
  });

  it('creates PBKDF2-only registrations and rejects identity conflicts', async () => {
    const registered = await registerBuyer({
      client, req: makeRequest('8'),
      input: { nome: 'Carla Nova', telefone: '21999990031', email: 'carla@example.com', pin: '4567' },
      createBuyerSession, env: ENV,
    });
    assert.match((await buyerState(client, registered.buyer.id)).pin_hash, /^pbkdf2:sha256:/);
    await assert.rejects(() => registerBuyer({
      client, req: makeRequest('9'),
      input: { nome: 'Outra Carla', telefone: '+55 21 99999-0031', email: 'outra@example.com', pin: '4567' },
      createBuyerSession, env: ENV,
    }), /Cadastro já existe/);
    const login = await loginBuyer({
      client, req: makeRequest('10'), input: { identificador: 'carla@example.com', pin: '4567' },
      createBuyerSession, env: ENV,
    });
    assert.equal(login.buyer.id, registered.buyer.id);
  });
});
