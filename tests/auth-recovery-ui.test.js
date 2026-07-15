/** @fileoverview Regressão do retorno ao login após recuperar o PIN. */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../public/auth-recovery.js', import.meta.url), 'utf8');

test('fecha o modal de recuperação antes de abrir o login', () => {
  assert.match(
    source,
    /returnToLogin\(blocking = false\)\s*\{\s*closeAuthModal\(\);\s*this\.showRegistrationModal\(blocking, "login"\);\s*\}/s,
  );
  assert.match(source, /onclick="app\.returnToLogin\(\$\{blocking\}\)"/);
});

test('a redefinição retorna ao login sem autenticar automaticamente', () => {
  const completion = source.match(/async submitPinRecoveryComplete[\s\S]*?\n  \},\n\n  renderAuthSecurityAction/);
  assert.ok(completion, 'rotina de conclusão deve existir');
  assert.match(completion[0], /this\.clearBuyerSession\(false\);\s*this\.returnToLogin\(blocking\);/s);
  assert.doesNotMatch(completion[0], /_saveUserSession\(/);
});
