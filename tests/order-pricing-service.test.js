import test from 'node:test';
import assert from 'node:assert/strict';
import { priceItems, validateOrderItems } from '../server/services/order-pricing-service.js';

test('order pricing ignores browser prices and rounds cents from catalog', () => {
  const priced = priceItems([{ codigo: 'A', nome: 'A', preco: '10.01', categoria: 'x', desconto: 10 }], [{ codigo: 'A', quantidade: 2, preco_bruto: 0 }]);
  assert.equal(priced.totalBruto, 2002); assert.equal(priced.totalFinal, 1802);
});
test('order input applies strict item constraints', () => {
  assert.equal(validateOrderItems([{ codigo: 'A', quantidade: '2' }]).code, 'INVALID_ORDER_ITEM_QUANTITY');
  assert.equal(validateOrderItems([{ codigo: 'A', quantidade: 1 }, { codigo: ' a ', quantidade: 1 }]).code, 'INVALID_ORDER_ITEM_CODE');
});
