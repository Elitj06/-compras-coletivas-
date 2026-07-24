import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const source = await readFile(new URL('../api/db.js', import.meta.url), 'utf8');

test('criação de pedido devolve o percentual efetivamente aplicado', () => {
  assert.match(
    source,
    /desconto_percentual:\s*progress\.percentual_aplicado\s*\?\?\s*progress\.percentual_atual/,
    'a resposta do pedido não pode usar a métrica visual como pricing efetivo',
  );
});
