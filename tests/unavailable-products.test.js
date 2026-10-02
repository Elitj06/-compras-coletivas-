import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import vm from 'node:vm';

const codes = ['WFT1800BA', 'EF20', 'PA600', 'CLB30AH', 'ISP240', 'DR150', 'WFT1800CH'];
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('os sete produtos continuam no catálogo, marcados como indisponíveis', async () => {
  const source = await read('../public/produtos.js');
  const products = vm.runInNewContext(source + '\nPRODUTOS');
  const selected = products.filter((product) => codes.includes(product.codigo));
  assert.equal(selected.length, codes.length);
  assert.deepEqual([...selected.map((product) => product.codigo)].sort(), [...codes].sort());
  assert.ok(selected.every((product) => product.disponivel === false));
  assert.equal(new Set(products.map((product) => product.codigo)).size, products.length);
});

test('origem persistente contém foto e metadados dos sete produtos', async () => {
  const data = JSON.parse(await read('../data/produtos-indisponiveis.json'));
  assert.deepEqual(data.map((product) => product.codigo).sort(), [...codes].sort());
  for (const product of data) {
    assert.equal(product.disponivel, false);
    assert.ok(product.imagem.startsWith('/images/unavailable-products/'));
    await access(new URL('../public' + product.imagem, import.meta.url));
  }
});

test('cards mostram indisponibilidade e removem controles de quantidade', async () => {
  const source = await read('../public/app.js');
  assert.match(source, /decorateUnavailableProducts\(grid\)/);
  assert.match(source, /product-unavailable-badge/);
  assert.match(source, /Indisponível/);
  assert.match(source, /querySelector\("\.qty-control"\)\?\.remove\(\)/);
  assert.match(await read('../public/styles.css'), /product-unavailable-strike/);
});
