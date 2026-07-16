/** @fileoverview Regressao de feedback visual no login e cadastro. */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');

function loadApp() {
  const elements = new Map();
  const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const context = vm.createContext({
    console,
    document: {
      readyState: 'loading',
      addEventListener: () => {},
      getElementById: (id) => elements.get(id) || null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({ classList: { add: () => {}, remove: () => {} } }),
      body: { appendChild: () => {} },
    },
    localStorage: storage,
    sessionStorage: storage,
    location: { search: '', pathname: '/' },
    history: { replaceState: () => {} },
    URLSearchParams,
    Intl,
    setTimeout,
    clearTimeout,
  });
  vm.runInContext(source, context);
  return { app: vm.runInContext('app', context), elements };
}

test('submissao de autenticacao mostra loading, bloqueia repeticao e restaura o botao', async () => {
  const { app } = loadApp();
  const attributes = new Map();
  const button = {
    disabled: false,
    isConnected: true,
    textContent: 'Cadastrar e entrar',
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: (name) => attributes.delete(name),
  };
  let release;
  const pending = app.runAuthSubmission(button, 'Cadastrando...', () =>
    new Promise((resolve) => { release = resolve; }));

  assert.equal(button.disabled, true);
  assert.equal(button.textContent, 'Cadastrando...');
  assert.equal(attributes.get('aria-busy'), 'true');
  release();
  await pending;
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, 'Cadastrar e entrar');
  assert.equal(attributes.has('aria-busy'), false);
});

test('conflito de cadastro direciona para login/recuperacao com identificador preenchido', async () => {
  const { app, elements } = loadApp();
  elements.set('regName', { value: 'Pessoa Existente' });
  elements.set('regIdentifier', { value: '21999990000' });
  elements.set('regEmail', { value: 'pessoa@example.com' });
  elements.set('regPin', { value: '1234' });
  const calls = { toast: [] };
  app.api = async () => ({
    success: false,
    code: 'IDENTITY_ALREADY_REGISTERED',
    error: 'Cadastro já existe. Entre ou recupere seu PIN.',
  });
  app.showRegistrationModal = (blocking, mode) => { calls.modal = { blocking, mode }; };
  app.toast = (message, kind) => calls.toast.push({ message, kind });

  await app.submitRegistration('signup');

  assert.deepEqual(calls.modal, { blocking: true, mode: 'login' });
  assert.equal(elements.get('regIdentifier').value, '21999990000');
  assert.match(calls.toast[0].message, /já possui cadastro.*Esqueci meu PIN/s);
});

test('excecao de rede no cadastro nunca deixa a acao inerte', async () => {
  const { app, elements } = loadApp();
  elements.set('regName', { value: 'Pessoa Nova' });
  elements.set('regIdentifier', { value: '21999990001' });
  elements.set('regEmail', { value: 'nova@example.com' });
  elements.set('regPin', { value: '1234' });
  const toasts = [];
  app.api = async () => { throw new Error('offline'); };
  app.toast = (message, kind) => toasts.push({ message, kind });

  await app.submitRegistration('signup');

  assert.deepEqual(toasts, [{
    message: 'Não foi possível concluir agora. Verifique sua conexão e tente novamente.',
    kind: 'error',
  }]);
});
