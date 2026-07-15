import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PIN_HASH_MIGRATION_DEFAULT,
  generateRecoveryCode,
  hashLegacyPin,
  hashPbkdf2Pin,
  hmacSha256Hex,
  isLegacyPinHash,
  isPinHashMigrationEnabled,
  isValidPin,
  randomHex,
  verifyPinHash,
} from '../server/lib/pin-crypto.js';

describe('PIN crypto compatibility', () => {
  const legacySalt = 'Joao Silva:21998887766';

  it('reproduces and verifies a legacy SHA-256 hash', async () => {
    const hash = await hashLegacyPin('1234', legacySalt);
    assert.equal(hash, 'fb4d17675b80cb9cc0c3fd805bbeab8c5094f96fb7fe873f88751750b74637f2');
    assert.equal(await verifyPinHash('1234', hash, legacySalt), true);
    assert.equal(await verifyPinHash('9999', hash, legacySalt), false);
    assert.equal(await verifyPinHash('1234', hash, `${legacySalt}0`), false);
    assert.equal(isLegacyPinHash(hash), true);
  });

  it('creates and verifies a deterministic PBKDF2 fixture', async () => {
    const hash = await hashPbkdf2Pin('5678', {
      saltHex: '00112233445566778899aabbccddeeff',
      iterations: 100000,
    });
    assert.equal(
      hash,
      'pbkdf2:sha256:100000:00112233445566778899aabbccddeeff:' +
        '92898678cd28807b81443c2dcd981b98aa0b19b5eac2abb0adabe8d0eee2571c'
    );
    assert.equal(await verifyPinHash('5678', hash, 'ignored'), true);
    assert.equal(await verifyPinHash('5679', hash, 'ignored'), false);
    assert.equal(isLegacyPinHash(hash), false);
  });

  it('uses 210 thousand iterations and a random salt by default', async () => {
    const hash = await hashPbkdf2Pin('2468');
    assert.match(hash, /^pbkdf2:sha256:210000:[0-9a-f]{32}:[0-9a-f]{64}$/);
    assert.equal(await verifyPinHash('2468', hash, legacySalt), true);
  });

  it('rejects malformed or excessive-cost hashes', async () => {
    const invalid = [
      '',
      'not-a-hash',
      'pbkdf2:sha512:210000:00112233445566778899aabbccddeeff:' + 'a'.repeat(64),
      'pbkdf2:sha256:99999999:00112233445566778899aabbccddeeff:' + 'a'.repeat(64),
      'pbkdf2:sha256:210000:short:' + 'a'.repeat(64),
    ];
    for (const hash of invalid) {
      assert.equal(await verifyPinHash('1234', hash, legacySalt), false);
    }
  });

  it('keeps migration disabled unless explicitly enabled', () => {
    assert.equal(PIN_HASH_MIGRATION_DEFAULT, false);
    assert.equal(isPinHashMigrationEnabled(), false);
    assert.equal(isPinHashMigrationEnabled({ PIN_HASH_MIGRATION_ENABLED: 'false' }), false);
    assert.equal(isPinHashMigrationEnabled({ PIN_HASH_MIGRATION_ENABLED: 'true' }), true);
  });
});

describe('recovery primitives', () => {
  it('validates the four-to-six-digit PIN contract', () => {
    for (const pin of ['0000', '12345', '999999']) assert.equal(isValidPin(pin), true);
    for (const pin of ['', '123', '1234567', '12a4', 123]) assert.equal(isValidPin(pin), false);
  });

  it('creates random opaque values and six-digit codes', () => {
    const first = randomHex(32);
    const second = randomHex(32);
    assert.match(first, /^[0-9a-f]{64}$/);
    assert.notEqual(first, second);
    for (let index = 0; index < 100; index += 1) {
      assert.match(generateRecoveryCode(), /^\d{6}$/);
    }
  });

  it('produces a stable HMAC-SHA256 fixture', async () => {
    assert.equal(
      await hmacSha256Hex('recovery-secret', 'challenge-id:123456'),
      'cf1f31568dba6bb7eacd3fa88ccee0c93abdcf76689d224450cc1757b19f168f'
    );
    await assert.rejects(() => hmacSha256Hex('', 'message'), /Segredo HMAC obrigatorio/);
  });
});
