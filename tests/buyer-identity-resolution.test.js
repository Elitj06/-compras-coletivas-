import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveCanonicalBuyer } from '../server/services/buyer-identity-resolution-service.js';

describe('canonical buyer identity resolution', () => {
  it('selects the only equivalent record with linked orders', () => {
    const historical = buyer(10, 'Pessoa da Silva', 'pessoa@example.com', 1);
    const duplicate = buyer(20, 'Pessoa Silva', 'PESSOA@example.com', 0);

    assert.equal(resolveCanonicalBuyer([duplicate, historical]), historical);
  });

  it('fails closed when names differ or both records have history', () => {
    assert.equal(resolveCanonicalBuyer([
      buyer(10, 'Pessoa Silva', 'shared@example.com', 1),
      buyer(20, 'Outra Pessoa', 'shared@example.com', 0),
    ]), null);
    assert.equal(resolveCanonicalBuyer([
      buyer(10, 'Pessoa Silva', 'shared@example.com', 1),
      buyer(20, 'Pessoa da Silva', 'shared@example.com', 2),
    ]), null);
  });

  it('does not resolve duplicates without a shared non-empty email', () => {
    assert.equal(resolveCanonicalBuyer([
      buyer(10, 'Pessoa Silva', '', 1),
      buyer(20, 'Pessoa Silva', '', 0),
    ]), null);
  });
});

function buyer(id, nome, email, orderCount) {
  return { id, nome, email, order_count: orderCount };
}
