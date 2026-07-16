/** @fileoverview Contrato assíncrono do handler público de recuperação. */

import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { test } from 'node:test';

import { createPinRecoveryHandler } from '../api/pin-recovery-request.js';

test('handler returns before SMTP delivery and closes the client in background', async () => {
  const backgrounds = [];
  const client = { ended: 0, end: async () => { client.ended += 1; } };
  let releaseDelivery;
  let deliveryFinished = false;
  const handler = createPinRecoveryHandler({
    getClientImpl: async () => client,
    prepareImpl: async () => prepared('real-challenge', true),
    deliverImpl: async () => {
      await new Promise((resolve) => { releaseDelivery = resolve; });
      deliveryFinished = true;
    },
    waitUntilImpl: (promise) => backgrounds.push(promise),
    responseFloorMs: 5,
  });
  const response = fakeResponse();

  await handler(fakeRequest('buyer@example.com'), response);

  assert.equal(response.statusCode, 202);
  assert.equal(response.body.challenge_id, 'real-challenge');
  assert.equal(deliveryFinished, false);
  assert.equal(client.ended, 0);
  releaseDelivery();
  await backgrounds[0];
  assert.equal(deliveryFinished, true);
  assert.equal(client.ended, 1);
});

test('eligible and absent requests share the response envelope and minimum latency', async () => {
  const elapsed = [];
  const bodies = [];
  for (const eligible of [true, false]) {
    const backgrounds = [];
    const handler = createPinRecoveryHandler({
      getClientImpl: async () => ({ end: async () => {} }),
      prepareImpl: async () => prepared(eligible ? 'real-id' : 'fake-id', eligible),
      deliverImpl: async () => {},
      waitUntilImpl: (promise) => backgrounds.push(promise),
      responseFloorMs: 20,
    });
    const response = fakeResponse();
    const startedAt = Date.now();
    await handler(fakeRequest(eligible ? 'eligible@example.com' : 'absent@example.com'), response);
    elapsed.push(Date.now() - startedAt);
    bodies.push(response.body);
    await Promise.all(backgrounds);
  }

  assert.equal(elapsed.every((duration) => duration >= 15), true);
  assert.deepEqual(Object.keys(bodies[0]), Object.keys(bodies[1]));
  assert.equal(bodies[0].message, bodies[1].message);
  assert.equal(bodies[0].success, bodies[1].success);
});

test('background closes the database even when delivery fails', async () => {
  const backgrounds = [];
  const client = { ended: false, end: async () => { client.ended = true; } };
  const handler = createPinRecoveryHandler({
    getClientImpl: async () => client,
    prepareImpl: async () => prepared('challenge', true),
    deliverImpl: async () => { throw new Error('delivery boundary failed'); },
    waitUntilImpl: (promise) => backgrounds.push(promise),
    responseFloorMs: 0,
  });

  await handler(fakeRequest('buyer@example.com'), fakeResponse());
  await backgrounds[0];

  assert.equal(client.ended, true);
});

function prepared(challengeId, eligible) {
  return {
    response: {
      success: true,
      message: 'Se os dados estiverem aptos, você receberá as instruções em instantes.',
      challenge_id: challengeId,
    },
    fakeChallengeId: eligible ? 'unused-fake' : challengeId,
    delivery: eligible
      ? { buyerId: 1, challengeId, to: 'redacted@example.com', code: '123456' }
      : null,
  };
}

function fakeRequest(identifier) {
  const request = Readable.from([JSON.stringify({ identificador: identifier })]);
  request.method = 'POST';
  request.url = '/api/pin-recovery-request';
  request.headers = {
    host: 'example.test',
    'x-forwarded-proto': 'https',
    'x-forwarded-for': '203.0.113.50',
  };
  return request;
}

function fakeResponse() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { this.ended = true; return this; },
  };
}
