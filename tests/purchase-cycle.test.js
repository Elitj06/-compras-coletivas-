import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const api = readFileSync(new URL('../api/db.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const docs = readFileSync(new URL('../docs/API.md', import.meta.url), 'utf8');

test('POST /ciclos-compra abre um ciclo preservando o anterior, sem encerrá-lo', () => {
  const route = api.slice(api.indexOf('// POST /ciclos-compra'), api.indexOf("if (path === 'admin/logout')"));
  assert.ok(route.includes("if (path === 'ciclos-compra')"));
  assert.ok(route.includes("pg_advisory_xact_lock(hashtext('compras-coletivas:start-cycle'))"));
  assert.match(route, /America\/Sao_Paulo/);
  assert.ok(route.includes("UPDATE ciclos_compra SET ativo = FALSE, updated_at = NOW() WHERE id = $1"));
  assert.doesNotMatch(route, /status = 'encerrado'/);
  assert.doesNotMatch(route, /fim_em = \$1/);
  assert.ok(route.includes("INSERT INTO ciclos_compra (nome, inicio_em, status, ativo) VALUES ($1, $2::date, 'aberto', TRUE)"));
  assert.doesNotMatch(route, /UPDATE pedidos SET ciclo_id/);
  assert.ok(route.includes('pedidos_transferidos: 0'));
  assert.ok(route.includes('repriceCycleOrders(client, nextCycle.id)'));
  assert.ok(route.includes("await client.query('COMMIT')"));
  assert.ok(route.includes("await client.query('ROLLBACK')"));
  assert.match(route, /CYCLE_ALREADY_STARTED_TODAY/);
});

test('novos pedidos entram no ciclo ativo após o lock compartilhado', () => {
  const orderStart = api.indexOf("pg_advisory_xact_lock(hashtext('compras-coletivas:start-cycle'))", api.indexOf("if (req.method === 'POST')", api.indexOf('POST /ciclos-compra')));
  const activeCycleRead = api.indexOf('const cycle = await getActiveCycle(client)', orderStart);
  const orderInsert = api.indexOf('INSERT INTO pedidos (comprador_id, usuario, status, ciclo_id)', activeCycleRead);
  assert.ok(orderStart >= 0, 'POST /pedidos deve adquirir o lock do ciclo');
  assert.ok(activeCycleRead > orderStart, 'o ciclo ativo deve ser lido depois do lock');
  assert.ok(orderInsert > activeCycleRead, 'o pedido deve ser persistido após resolver o ciclo ativo');
  assert.match(api.slice(orderInsert, orderInsert + 250), /cycle\.id/);
});

test('Admin só oferece início de ciclo na visão ativa e avisa que os pedidos antigos ficam preservados', () => {
  assert.match(app, /!isHistoricalCycle[^\n]*app.startNewCycle/);
  assert.match(app, /async startNewCycle()/);
  assert.match(app, /Pedidos já existentes permanecem no ciclo anterior/);
  assert.match(app, /dados e pagamentos preservados/);
  assert.ok(app.includes("this.api('ciclos-compra', 'POST', {})"));
  assert.doesNotMatch(app, /recoverYesterdayOrders/);
  assert.doesNotMatch(app, /recuperar-ontem/);
});

test('API documenta autorização, data local e proteção contra repetição', () => {
  assert.ok(docs.includes('POST /ciclos-compra'));
  assert.ok(docs.includes('America/Sao_Paulo'));
  assert.match(docs, /CYCLE_ALREADY_STARTED_TODAY/);
});
