/**
 * @fileoverview Regras de cadastro, login, troca de PIN e logout.
 * @module server/services/buyer-auth-service
 */

import {
  deleteBuyerSession,
  deleteBuyerSessions,
  findRegistrationConflicts,
  getBuyerByIdForUpdate,
  insertBuyer,
  insertSecurityAudit,
  lockRegistrationIdentities,
  updateBuyerPin,
} from '../data/buyer-auth-data.js';
import {
  getPhoneLookupCandidates,
  normalizeEmail,
  normalizeIdentifier,
  normalizeNomeTel,
} from '../lib/buyer-identity.js';
import {
  hashPbkdf2Pin,
  isLegacyPinHash,
  isPinHashMigrationEnabled,
  isValidPin,
  verifyPinHash,
} from '../lib/pin-crypto.js';
import { consumeAuthRateLimit, getAuditIpHash } from './auth-rate-limit-service.js';
import { findCanonicalBuyerByIdentifier } from './buyer-identity-resolution-service.js';

/** Erro esperado que a camada HTTP pode expor de forma controlada. */
export class BuyerAuthError extends Error {
  constructor(code, status, message) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** Cria comprador novo sem sobrescrever identidade existente. */
export async function registerBuyer({ client, req, input, createBuyerSession, env = process.env }) {
  const { nome, telefone } = normalizeNomeTel(input.nome, input.telefone);
  const email = normalizeEmail(input.email);
  const phoneCandidates = getPhoneLookupCandidates(telefone);
  if (nome.split(/\s+/).length < 2 || !phoneCandidates.length || !isEmail(email)) {
    throw new BuyerAuthError('INVALID_REGISTRATION', 400, 'Nome, telefone e e-mail válidos são obrigatórios');
  }
  if (!isValidPin(input.pin)) {
    throw new BuyerAuthError('INVALID_PIN', 400, 'PIN deve ter de 4 a 6 dígitos numéricos');
  }
  return withTransaction(client, async () => {
    const lockKeys = [
      ...phoneCandidates.map((candidate) => `phone:${candidate}`),
      `email:${email}`,
    ];
    await lockRegistrationIdentities(client, lockKeys);
    const conflicts = await findRegistrationConflicts(client, phoneCandidates, email);
    if (conflicts.length) {
      throw new BuyerAuthError('IDENTITY_ALREADY_REGISTERED', 409, 'Cadastro já existe. Entre ou recupere seu PIN.');
    }
    const buyer = await insertBuyer(client, {
      nome,
      telefone,
      email,
      pinHash: await hashPbkdf2Pin(input.pin),
    });
    const token = await createBuyerSession(client, buyer.id);
    await insertSecurityAudit(client, {
      type: 'buyer_registered', buyerId: buyer.id, ipHash: await getAuditIpHash(req, env),
    });
    return { buyer, token };
  });
}

/** Autentica sem revelar inexistencia, duplicidade ou ausencia de PIN. */
export async function loginBuyer({ client, req, input, createBuyerSession, env = process.env }) {
  const identity = normalizeIdentifier(input.identificador || input.telefone);
  if (!identity.value || !isValidPin(input.pin)) {
    throw new BuyerAuthError('INVALID_LOGIN_INPUT', 400, 'Identificador e PIN válidos são obrigatórios');
  }
  const blocked = await isLoginBlocked(client, req, identity, env);
  if (blocked) {
    await fakePinWork(input.pin);
    throw new BuyerAuthError('LOGIN_RATE_LIMITED', 429, 'Muitas tentativas. Aguarde e tente novamente.');
  }
  return withTransaction(client, async () => {
    const selected = await findCanonicalBuyerByIdentifier(client, identity, {
      expectedName: input.identificador ? null : input.nome,
    });
    if (!selected?.pin_hash) return invalidCredentials(input.pin, true);

    // SECTION: Serializa login e recuperacao sobre o mesmo cadastro canonico.
    const buyer = await getBuyerByIdForUpdate(client, selected.id);
    if (!buyer?.pin_hash) return invalidCredentials(input.pin, true);
    const legacySalt = `${buyer.nome}:${String(buyer.telefone || '').replace(/\D/g, '')}`;
    if (!(await verifyPinHash(input.pin, buyer.pin_hash, legacySalt))) {
      return invalidCredentials(input.pin, isLegacyPinHash(buyer.pin_hash));
    }
    if (isLegacyPinHash(buyer.pin_hash) && isPinHashMigrationEnabled(env)) {
      await updateBuyerPin(client, buyer.id, await hashPbkdf2Pin(input.pin));
    }
    const token = await createBuyerSession(client, buyer.id);
    return { buyer: publicBuyer(buyer), token };
  });
}

/** Troca PIN autenticado e deixa apenas uma nova sessao valida. */
export async function changeBuyerPin({ client, req, input, buyerSession, createBuyerSession, env = process.env }) {
  if (!buyerSession || !isValidPin(input.current_pin) || !isValidPin(input.new_pin)) {
    throw new BuyerAuthError('INVALID_PIN_CHANGE', 400, 'PIN atual e novo PIN são obrigatórios');
  }
  if (input.current_pin === input.new_pin) {
    throw new BuyerAuthError('PIN_REUSE', 400, 'O novo PIN deve ser diferente do atual');
  }
  const limit = await consumeAuthRateLimit(client, req, {
    scope: 'pin_change_buyer', key: String(buyerSession.id), limit: 5,
    windowSeconds: 900, blockSeconds: 1800,
  }, env);
  if (!limit.configured) throw authConfigurationError();
  if (limit.blocked) throw new BuyerAuthError('PIN_CHANGE_RATE_LIMITED', 429, 'Muitas tentativas. Aguarde e tente novamente.');
  const outcome = await withTransaction(client, async () => {
    const buyer = await getBuyerByIdForUpdate(client, buyerSession.id);
    if (!buyer) return { error: invalidPinError() };
    const salt = `${buyer.nome}:${String(buyer.telefone || '').replace(/\D/g, '')}`;
    if (!(await verifyPinHash(input.current_pin, buyer.pin_hash, salt))) {
      await insertSecurityAudit(client, {
        type: 'pin_change_rejected', buyerId: buyer.id, ipHash: await getAuditIpHash(req, env),
      });
      return { error: invalidPinError() };
    }
    await updateBuyerPin(client, buyer.id, await hashPbkdf2Pin(input.new_pin));
    await deleteBuyerSessions(client, buyer.id);
    const token = await createBuyerSession(client, buyer.id);
    await insertSecurityAudit(client, {
      type: 'pin_changed_authenticated', buyerId: buyer.id, ipHash: await getAuditIpHash(req, env),
    });
    return { token };
  });
  if (outcome.error) throw outcome.error;
  return outcome;
}

/** Revoga somente a sessao apresentada. */
export async function logoutBuyer({ client, buyerSession }) {
  if (!buyerSession) throw new BuyerAuthError('UNAUTHORIZED', 401, 'Não autorizado');
  await deleteBuyerSession(client, buyerSession.session_id, buyerSession.id);
}

async function isLoginBlocked(client, req, identity, env) {
  const identifier = await consumeAuthRateLimit(client, req, {
    scope: 'login_identifier', key: `${identity.kind}:${identity.value}`,
    limit: 5, windowSeconds: 900, blockSeconds: 1800,
  }, env);
  const ip = await consumeAuthRateLimit(client, req, {
    scope: 'login_ip', key: 'ip', limit: 25, windowSeconds: 900, blockSeconds: 3600,
  }, env);
  if (!identifier.configured || !ip.configured) throw authConfigurationError();
  return identifier.blocked || ip.blocked;
}

async function invalidCredentials(pin, needsFakeWork) {
  if (needsFakeWork) await fakePinWork(pin);
  throw new BuyerAuthError('INVALID_CREDENTIALS', 401, 'Credenciais inválidas');
}

async function fakePinWork(pin) {
  await hashPbkdf2Pin(isValidPin(pin) ? pin : '000000', { saltHex: '00'.repeat(16) });
}

function publicBuyer(buyer) {
  return { id: buyer.id, nome: buyer.nome, telefone: buyer.telefone, email: buyer.email };
}

function invalidPinError() {
  return new BuyerAuthError('INVALID_CURRENT_PIN', 401, 'PIN atual inválido');
}

function authConfigurationError() {
  return new BuyerAuthError('AUTH_NOT_CONFIGURED', 503, 'Autenticação temporariamente indisponível');
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function withTransaction(client, operation) {
  await client.query('BEGIN');
  try {
    const result = await operation();
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
