import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const api = readFileSync(new URL('../api/db.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const docs = readFileSync(new URL('../docs/API.md', import.meta.url), 'utf8');

test('POST /ciclos-compra inicia o ciclo e transfere os pedidos feitos hoje', () => {
  const route = api.slice(api.indexOf('// POST /ciclos-compra'), api.indexOf("if (path === 'admin/logout')"));
  assert.ok(route.includes("if (path === 'ciclos-compra')"));
  assert.ok(route.includes("pg_advisory_xact_lock(hashtext('compras-coletivas:start-cycle'))"));
  assert.match(route, /America\/Sao_Paulo/);
  assert.ok(route.includes("UPDATE ciclos_compra SET ativo = FALSE, status = 'encerrado'"));
  assert.ok(route.includes("INSERT INTO ciclos_compra (nome, inicio_em, status, ativo) VALUES ($1, $2::date, 'aberto', TRUE)"));
  assert.match(route, /UPDATE pedidos SET ciclo_id = \$1/);
  assert.match(route, /created_at >= .*created_at < /);
  assert.ok(route.includes('repriceCycleOrders(client, nextCycle.id)'));
  assert.ok(route.includes("await client.query('COMMIT')"));
  assert.ok(route.includes("await client.query('ROLLBACK')"));
  assert.match(route, /CYCLE_ALREADY_STARTED_TODAY/);
});

test('recuperação move só pedidos ativos de ontem, em BRT, para o ciclo atual', () => {
  const route = api.slice(api.indexOf("if (path === 'ciclos-compra/recuperar-ontem')"), api.indexOf("if (path === 'admin/logout')"));
  assert.ok(route.includes("pg_advisory_xact_lock(hashtext('compras-coletivas:start-cycle'))"));
  assert.ok(route.includes("pg_advisory_xact_lock(hashtext('compras_coletivas:discount-progress:v1'))"));
  assert.ok(route.includes('America/Sao_Paulo'));
  assert.ok(route.includes("p.status = 'pendente'"));
  assert.ok(route.includes("p.created_at AT TIME ZONE 'UTC'"));
  assert.ok(route.includes('clock_timestamp()'));
  assert.ok(route.includes('CYCLE_HAS_FINALIZED_ORDERS'));
  assert.ok(route.includes('pg.id IS NOT NULL'));
  assert.ok(route.includes('p.ciclo_id IS DISTINCT FROM $2'));
  assert.ok(route.includes('movedOrders.rowCount ? await repriceCycleOrders(client, current.id) : null'));
  assert.ok(route.includes("await client.query('COMMIT')"));
  assert.ok(route.includes("await client.query('ROLLBACK')"));
  assert.ok(route.includes('ACTIVE_CYCLE_NOT_FOUND'));
});

test('pedido e abertura do ciclo compartilham lock para resolver concorrência', () => {
  const orderStart = api.indexOf("pg_advisory_xact_lock(hashtext('compras-coletivas:start-cycle'))", api.indexOf("if (req.method === 'POST')", api.indexOf('POST /ciclos-compra')));
  const activeCycleRead = api.indexOf('const cycle = await getActiveCycle(client)', orderStart);
  assert.ok(orderStart >= 0, 'POST /pedidos deve adquirir o lock do ciclo');
  assert.ok(activeCycleRead > orderStart, 'o ciclo ativo deve ser lido depois do lock');
});

test('Admin só oferece início de ciclo na visão ativa e confirma a transferência', () => {
  assert.match(app, /!isHistoricalCycle[^\n]*app.startNewCycle/);
  assert.match(app, /async startNewCycle()/);
  assert.match(app, /Todos os pedidos feitos hoje serão movidos/);
  assert.ok(app.includes("this.api('ciclos-compra', 'POST', {})"));
  assert.match(app, /pedidos_transferidos/);
});

test('Admin confirma recuperação de ontem e atualiza a visão do painel', () => {
  assert.match(app, /Recuperar pedidos de ontem/);
  assert.ok(app.includes('async recoverYesterdayOrders()'));
  assert.match(app, /Pedidos antigos não serão alterados/);
  assert.ok(app.includes("this.api('ciclos-compra/recuperar-ontem', 'POST', {})"));
  assert.match(app, /pedidos_transferidos/);
});

test('API documenta autorização, data local e proteção contra repetição', () => {
  assert.ok(docs.includes('POST /ciclos-compra'));
  assert.ok(docs.includes('America/Sao_Paulo'));
  assert.match(docs, /CYCLE_ALREADY_STARTED_TODAY/);
});
