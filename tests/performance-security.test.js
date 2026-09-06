import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const api = fs.readFileSync(new URL('../api/db.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

test('performance and security regressions stay guarded', () => {
  assert.match(api, /GET estritamente somente leitura/);
  assert.match(api, /if \(cicloParam && !adminSession\)/);
  assert.match(api, /Produto indisponível no catálogo/);
  assert.match(api, /POSTGRES_SCHEMA/);
  assert.doesNotMatch(api, /const repairedProgress = await repriceCycleOrders\(client, cycle\.id\)/);
  assert.match(app, /storageKey\(key\)/);
  assert.match(app, /const precoBruto = Number\(produto\?\.preco\)/);
});
