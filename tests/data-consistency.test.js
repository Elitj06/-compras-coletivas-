/**
 * @fileoverview Tests for frontend data consistency behaviors.
 *
 * Tests the logic behind:
 * - Fix 2: switchTab triggers fresh data load
 * - Fix 3: stale lastOrder from server is purged when server says it's gone
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

// SECTION: Tab switch data routing logic (mirrors switchTab)

function shouldReloadOnTabSwitch(tab, isAdminLoggedIn) {
  if (tab === 'meu-pedido') return { reload: true, target: 'renderInvoice' };
  if (tab === 'historico') return { reload: true, target: 'renderHistorico' };
  if (tab === 'admin' && isAdminLoggedIn) return { reload: true, target: 'loadDiscountProgress+renderAdmin' };
  return { reload: false };
}

// SECTION: Stale lastOrder detection (mirrors renderInvoice logic)

function shouldPurgeLastOrder(loaded, lastOrder) {
  // If server returned no order but we have a server-sourced lastOrder, purge it
  return !loaded && lastOrder?._fromServer === true;
}

// SECTION: Tests

test('switchTab data reload routing', async (t) => {
  await t.test('meu-pedido triggers reload', () => {
    const result = shouldReloadOnTabSwitch('meu-pedido', false);
    assert.equal(result.reload, true);
    assert.equal(result.target, 'renderInvoice');
  });

  await t.test('historico triggers reload', () => {
    const result = shouldReloadOnTabSwitch('historico', false);
    assert.equal(result.reload, true);
    assert.equal(result.target, 'renderHistorico');
  });

  await t.test('admin triggers reload when logged in', () => {
    const result = shouldReloadOnTabSwitch('admin', true);
    assert.equal(result.reload, true);
  });

  await t.test('admin does NOT trigger reload when not logged in', () => {
    const result = shouldReloadOnTabSwitch('admin', false);
    assert.equal(result.reload, false);
  });

  await t.test('produtos does not trigger reload', () => {
    const result = shouldReloadOnTabSwitch('produtos', true);
    assert.equal(result.reload, false);
  });
});

test('stale lastOrder purge logic', async (t) => {
  await t.test('purges server-sourced lastOrder when server has no order', () => {
    const shouldPurge = shouldPurgeLastOrder(false, { _fromServer: true, id: 42 });
    assert.equal(shouldPurge, true);
  });

  await t.test('does NOT purge locally-sourced lastOrder when server has no order', () => {
    // A locally cached order (not from server) might predate login; keep it
    const shouldPurge = shouldPurgeLastOrder(false, { _fromServer: false, id: 42 });
    assert.equal(shouldPurge, false);
  });

  await t.test('does NOT purge when server successfully loaded', () => {
    const shouldPurge = shouldPurgeLastOrder(true, { _fromServer: true, id: 42 });
    assert.equal(shouldPurge, false);
  });

  await t.test('does NOT purge when there is no lastOrder', () => {
    const shouldPurge = shouldPurgeLastOrder(false, null);
    assert.equal(shouldPurge, false);
  });
});
