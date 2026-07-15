import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getPhoneLookupCandidates,
  namesEquivalent,
  normalizeEmail,
  normalizeIdentifier,
  phonesEquivalent,
} from '../server/lib/buyer-identity.js';

describe('buyer identity normalization', () => {
  it('normalizes email and classifies identifiers', () => {
    assert.equal(normalizeEmail('  Pessoa@EXAMPLE.com '), 'pessoa@example.com');
    assert.deepEqual(normalizeIdentifier(' Pessoa@EXAMPLE.com '), {
      kind: 'email', value: 'pessoa@example.com', candidates: [],
    });
  });

  it('accepts Brazilian phones with or without country code', () => {
    const candidates = getPhoneLookupCandidates('+55 (21) 98605-3944');
    assert.ok(candidates.includes('5521986053944'));
    assert.ok(candidates.includes('21986053944'));
    assert.equal(phonesEquivalent('21986053944', '+55 21 98605-3944'), true);
  });

  it('keeps the approved tolerant name comparison', () => {
    assert.equal(namesEquivalent('Eliandro Tjader', 'Eliandro dos Reis Tjader'), true);
    assert.equal(namesEquivalent('Eliandro Tjader', 'Eduardo Tjader'), false);
  });
});
