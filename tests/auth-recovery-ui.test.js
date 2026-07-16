/** @fileoverview Regressão do retorno ao login após recuperar o PIN. */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../public/auth-recovery.js', import.meta.url), 'utf8');

function loadRecoveryFlow() {
  const elements = new Map([
    ['authRecoveryModal', { remove: () => elements.delete('authRecoveryModal') }],
    ['recoveryChallenge', { value: 'challenge-id' }],
    ['recoveryCode', { value: '123456' }],
    ['recoveryNewPin', { value: '5678' }],
    ['recoveryConfirmPin', { value: '5678' }],
  ]);
  const calls = { clear: 0, login: 0, toast: [] };
  const app = {
    api: async () => ({ success: true }),
    runAuthSubmission: async (_button, _label, operation) => operation(),
    clearBuyerSession: () => { calls.clear += 1; },
    showRegistrationModal: (blocking, mode) => {
      calls.login += 1;
      calls.loginArgs = { blocking, mode };
      elements.set('registrationModal', { remove: () => elements.delete('registrationModal') });
    },
    toast: (message, kind) => calls.toast.push({ message, kind }),
  };
  const context = {
    app,
    document: {
      getElementById: (id) => elements.get(id) || null,
      querySelector: () => null,
      addEventListener: () => {},
      createElement: () => ({}),
      body: { appendChild: () => {} },
    },
    sessionStorage: { removeItem: () => {} },
    history: { replaceState: () => {} },
    location: { pathname: '/', search: '' },
    URLSearchParams,
    AbortController,
    clearTimeout,
    setTimeout,
  };
  vm.runInNewContext(source, context);
  return { app, calls, elements };
}

test('fecha o modal de recuperação antes de abrir o login', () => {
  assert.match(
    source,
    /returnToLogin\(blocking = false\)\s*\{\s*closeAuthModal\(\);\s*this\.showRegistrationModal\(blocking, "login"\);\s*\}/s,
  );
  assert.match(source, /onclick="app\.returnToLogin\(\$\{blocking\}\)"/);
});

test('a redefinição troca o modal de recuperação pelo login, sem autoautenticar', async () => {
  const { app, calls, elements } = loadRecoveryFlow();

  await app.submitPinRecoveryComplete(true);

  assert.equal(calls.clear, 1);
  assert.deepEqual(calls.loginArgs, { blocking: true, mode: 'login' });
  assert.equal(calls.login, 1);
  assert.equal(elements.has('authRecoveryModal'), false);
  assert.equal(elements.has('registrationModal'), true);
  assert.deepEqual(calls.toast, [{
    message: 'PIN redefinido. Entre agora com seu telefone ou e-mail e o novo PIN.',
    kind: 'success',
  }]);
});

test('falha de rede ao solicitar recuperação mostra uma mensagem acionável', async () => {
  const { app, calls, elements } = loadRecoveryFlow();
  elements.set('recoveryIdentifier', { value: 'ana@example.com' });
  globalThis.fetch = async () => { throw new Error('offline'); };
  try {
    await app.submitPinRecoveryRequest(false);
  } finally {
    delete globalThis.fetch;
  }
  assert.deepEqual(calls.toast, [{
    message: 'Não foi possível solicitar o código. Verifique sua conexão e tente novamente.',
    kind: 'error',
  }]);
});
