/**
 * @fileoverview Resolucao conservadora de cadastros semanticamente duplicados.
 * @module server/services/buyer-identity-resolution-service
 */

import { findBuyersByIdentifier } from '../data/buyer-auth-data.js';
import { namesEquivalent, normalizeEmail, normalizeIdentifier } from '../lib/buyer-identity.js';

/**
 * Seleciona o cadastro canonico sem mesclar dados ou ampliar credenciais.
 * Duplicatas so sao resolvidas quando compartilham nome e e-mail e apenas uma possui pedidos.
 */
export function resolveCanonicalBuyer(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const reference = candidates[0];
  const email = normalizeEmail(reference.email);
  if (!email) return null;
  const sameIdentity = candidates.every((candidate) =>
    normalizeEmail(candidate.email) === email
      && namesEquivalent(reference.nome, candidate.nome));
  if (!sameIdentity) return null;

  const withHistory = candidates.filter((candidate) => Number(candidate.order_count) > 0);
  return withHistory.length === 1 ? withHistory[0] : null;
}

/** Busca e resolve o cadastro canonico de um identificador publico. */
export async function findCanonicalBuyerByIdentifier(client, identity, options = {}) {
  const candidates = await findBuyersByIdentifier(client, identity);
  const filtered = options.expectedName
    ? candidates.filter((candidate) => namesEquivalent(options.expectedName, candidate.nome))
    : candidates;
  const initial = resolveCanonicalBuyer(filtered);
  if (!initial) return null;

  const emailIdentity = normalizeIdentifier(initial.email);
  if (emailIdentity.kind !== 'email') return initial;
  if (identity.kind === 'email' && identity.value === emailIdentity.value) return initial;
  return findCanonicalBuyerByEmail(client, initial.email);
}

/** Confirma a unicidade ou a canonicidade conservadora do e-mail do comprador. */
export async function findCanonicalBuyerByEmail(client, email) {
  const identity = normalizeIdentifier(email);
  if (identity.kind !== 'email') return null;
  return resolveCanonicalBuyer(await findBuyersByIdentifier(client, identity));
}
