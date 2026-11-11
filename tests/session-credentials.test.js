/**
 * @fileoverview Regressões de sessão e credenciais:
 * - sessão expirada não apaga carrinho/último pedido;
 * - chave local estável por comprador;
 * - migração da chave antiga por telefone;
 * - troca de PIN não chama símbolo inexistente;
 * - troca de PIN renova o cookie de sessão no servidor;
 * - edição de identidade de PIN legado exige rehash.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const appSource = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const recoverySource = await readFile(new URL('../public/auth-recovery.js', import.meta.url), 'utf8');
const apiSource = await readFile(new URL('../api/db.js', import.meta.url), 'utf8');

const PRODUTOS = [
  { codigo: 'A', nome: 'Produto A', preco: 100, embalagem: 1, imagem: '' },
];

function createStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

function loadApp(storage) {
  const context = {
    PRODUTOS,
    VARIANTES: [],
    console,
    Intl,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    localStorage: storage,
    document: {
      readyState: 'loading',
      addEventListener: () => {},
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({
        style: {},
        classList: { add: () => {}, remove: () => {}, toggle: () => {} },
        setAttribute: () => {},
        addEventListener: () => {},
        appendChild: () => {},
      }),
      body: {
        classList: { add: () => {}, remove: () => {} },
        appendChild: () => {},
      },
      documentElement: { setAttribute: () => {} },
      hidden: false,
    },
  };
  vm.runInNewContext(`${appSource}\nthis.__app = app;`, context);
  const app = context.__app;
  app.updateCartBar = () => {};
  app.renderHeaderUser = () => {};
  app.renderHistorico = () => {};
  app.closeCartDrawer = () => {};
  app.toast = () => {};
  app.showRegistrationModal = () => {};
  return app;
}

const keyFor = (identity, key) =>
  `cc:${encodeURIComponent(String(identity).trim().toLowerCase())}:${key}`;

test('storageKey usa o id estável do comprador', () => {
  const app = loadApp(createStorage());
  app.state.user = { id: 42, name: 'Ana', phone: '11999999999', email: 'ana@example.com' };
  assert.equal(app.storageKey('cart'), keyFor('id:42', 'cart'));
});

test('login migra carrinho antigo por telefone para a chave por id', () => {
  const storage = createStorage({
    [keyFor('11999999999', 'cart')]: JSON.stringify({ A: 2 }),
    [keyFor('11999999999', 'lastOrder')]: JSON.stringify({ id: 9 }),
    [keyFor('11999999999', 'discountPct')]: '48',
  });
  const app = loadApp(storage);
  app.state.user = { id: null, name: 'Ana', phone: '11999999999', email: '' };
  app._saveUserSession('Ana', '11999999999', '', '', {
    id: 42, announce: false, refreshHistory: false,
  });

  assert.equal(storage.getItem(keyFor('id:42', 'cart')), JSON.stringify({ A: 2 }));
  assert.equal(storage.getItem(keyFor('id:42', 'lastOrder')), JSON.stringify({ id: 9 }));
  assert.equal(storage.getItem(keyFor('id:42', 'discountPct')), '48');
  assert.equal(storage.getItem(keyFor('11999999999', 'cart')), null);
});

test('sessão expirada preserva carrinho, último pedido e identidade', () => {
  const storage = createStorage({
    userRegistered: 'true',
    registeredId: '42',
    registeredName: 'Ana',
    registeredPhone: '11999999999',
    [keyFor('id:42', 'cart')]: JSON.stringify({ A: 2 }),
    [keyFor('id:42', 'lastOrder')]: JSON.stringify({ id: 9 }),
  });
  const app = loadApp(storage);
  app.checkRegistration();
  app.state.cart = { A: 2 };
  app.state.lastOrder = { id: 9 };

  app.clearBuyerSession(false, { preserveLocal: true });

  assert.equal(app.state.cart.A, 2);
  assert.equal(JSON.stringify(app.state.lastOrder), JSON.stringify({ id: 9 }));
  assert.equal(app.state.isRegistered, false);
  assert.equal(app.state.sessionExpired, true);
  assert.equal(app.state.user.id, 42);
  assert.equal(storage.getItem('userRegistered'), null);
  assert.equal(storage.getItem('registeredId'), '42');
  assert.equal(storage.getItem(keyFor('id:42', 'cart')), JSON.stringify({ A: 2 }));
});

test('logout explícito limpa os dados locais do comprador', () => {
  const storage = createStorage({
    userRegistered: 'true',
    registeredId: '42',
    registeredName: 'Ana',
    [keyFor('id:42', 'cart')]: JSON.stringify({ A: 2 }),
    [keyFor('id:42', 'lastOrder')]: JSON.stringify({ id: 9 }),
  });
  const app = loadApp(storage);
  app.checkRegistration();
  app.state.cart = { A: 2 };

  app.clearBuyerSession(false);

  assert.equal(Object.keys(app.state.cart).length, 0);
  assert.equal(app.state.user.id, null);
  assert.equal(storage.getItem('registeredId'), null);
  assert.equal(storage.getItem(keyFor('id:42', 'cart')), null);
});

test('checkRegistration carrega identidade mesmo com a sessão expirada', () => {
  const storage = createStorage({
    userRegistered: 'false',
    registeredId: '42',
    registeredName: 'Ana',
    registeredPhone: '11999999999',
  });
  const app = loadApp(storage);
  app.checkRegistration();
  assert.equal(app.state.isRegistered, false);
  assert.equal(app.state.user.id, 42);
  assert.equal(app.state.user.name, 'Ana');
  assert.equal(app.storageKey('cart'), keyFor('id:42', 'cart'));
});

test('401 de sessão expirada preserva o local em vez de apagar', () => {
  assert.match(appSource, /clearBuyerSession\(false, \{ preserveLocal: true \}\)/);
  assert.doesNotMatch(appSource, /path includes\("historico"\)[\s\S]{0,80}clearBuyerSession\(false\);/);
});

test('troca de PIN não depende de token persistido inexistente', () => {
  assert.doesNotMatch(recoverySource, /writePersistedToken/);
  assert.doesNotMatch(recoverySource, /BUYER_TOKEN_KEY/);
});

test('troca de PIN renova o cookie de sessão no servidor', () => {
  assert.match(apiSource, /issueSessionCookies\(client, 'buyer', token, csrf, BUYER_SESSION_TTL_SECONDS\)/);
  assert.match(apiSource, /delete authResult\.body\.token/);
});

test('edição de nome/telefone protege hash de PIN legado', () => {
  assert.match(apiSource, /async function legacyPinIdentityGuard/);
  assert.match(apiSource, /PIN_REHASH_REQUIRED/);
  assert.match(apiSource, /pin_hash = COALESCE\(\$4, pin_hash\)/);
  assert.match(apiSource, /FOR UPDATE/);
  assert.match(apiSource, /profile_pin_buyer/);
  assert.match(apiSource, /PIN_REHASH_RATE_LIMITED/);
  const guardCalls = apiSource.match(/legacyPinIdentityGuard\(/g) || [];
  assert.ok(guardCalls.length >= 3, 'esperado definição + rotas de comprador e admin');
});

test('login sem id não herda o id nem o carrinho da conta anterior', () => {
  const storage = createStorage({
    userRegistered: 'true',
    registeredId: '1',
    registeredName: 'Conta A',
    [keyFor('id:1', 'cart')]: JSON.stringify({ A: 5 }),
  });
  const app = loadApp(storage);
  app.checkRegistration();
  app.state.cart = { A: 5 };
  app._saveUserSession('Conta B', '11888888888', '', '', {
    id: null, announce: false, refreshHistory: false,
  });
  assert.equal(app.state.user.id, null);
  assert.equal(Object.keys(app.state.cart).length, 0);
});
