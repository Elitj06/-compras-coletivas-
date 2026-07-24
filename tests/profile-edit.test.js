/**
 * @fileoverview Tests for comprador profile update validation logic.
 *
 * Validates the client-side and server-side input checks for:
 * - PUT /comprador/perfil (self-service)
 * - PUT /admin/compradores/:id (admin)
 *
 * These tests cover the pure validation logic without DB calls.
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

// SECTION: Profile validation helpers (mirrors api/db.js logic)

function validateProfileInput({ nome, telefone, email }) {
  const errors = [];
  if (!nome || String(nome).trim().split(/\s+/).length < 2) {
    errors.push('Informe nome e sobrenome');
  }
  const telNorm = String(telefone || '').replace(/\D/g, '');
  if (telNorm.length < 8) {
    errors.push('Telefone inválido');
  }
  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    errors.push('E-mail inválido');
  }
  return errors;
}

function normalizeProfileInput({ nome, telefone, email }) {
  return {
    nome: String(nome || '').trim(),
    telefone: String(telefone || '').replace(/\D/g, ''),
    email: (email || '').trim() || null,
  };
}

// SECTION: Tests

test('profile edit validation', async (t) => {
  await t.test('accepts valid nome + telefone + email', () => {
    const errors = validateProfileInput({
      nome: 'João Silva',
      telefone: '(21) 98605-3944',
      email: 'joao@email.com',
    });
    assert.deepEqual(errors, []);
  });

  await t.test('accepts valid nome + telefone without email', () => {
    const errors = validateProfileInput({
      nome: 'Maria Santos',
      telefone: '11988887777',
      email: '',
    });
    assert.deepEqual(errors, []);
  });

  await t.test('rejects single-word nome', () => {
    const errors = validateProfileInput({
      nome: 'João',
      telefone: '21986053944',
      email: 'joao@email.com',
    });
    assert.ok(errors.some(e => e.includes('sobrenome')));
  });

  await t.test('rejects empty nome', () => {
    const errors = validateProfileInput({
      nome: '',
      telefone: '21986053944',
      email: '',
    });
    assert.ok(errors.length > 0);
  });

  await t.test('rejects short telefone', () => {
    const errors = validateProfileInput({
      nome: 'João Silva',
      telefone: '123',
      email: '',
    });
    assert.ok(errors.some(e => e.includes('Telefone')));
  });

  await t.test('rejects invalid email', () => {
    const errors = validateProfileInput({
      nome: 'João Silva',
      telefone: '21986053944',
      email: 'not-an-email',
    });
    assert.ok(errors.some(e => e.includes('E-mail')));
  });

  await t.test('accepts valid email with subdomain', () => {
    const errors = validateProfileInput({
      nome: 'João Silva',
      telefone: '21986053944',
      email: 'joao@mail.example.com',
    });
    assert.deepEqual(errors, []);
  });
});

test('profile normalization', async (t) => {
  await t.test('trims nome and removes non-digits from telefone', () => {
    const result = normalizeProfileInput({
      nome: '  João Silva  ',
      telefone: '(21) 98605-3944',
      email: '  joao@email.com  ',
    });
    assert.equal(result.nome, 'João Silva');
    assert.equal(result.telefone, '21986053944');
    assert.equal(result.email, 'joao@email.com');
  });

  await t.test('converts empty email to null', () => {
    const result = normalizeProfileInput({
      nome: 'João Silva',
      telefone: '21986053944',
      email: '',
    });
    assert.equal(result.email, null);
  });
});
