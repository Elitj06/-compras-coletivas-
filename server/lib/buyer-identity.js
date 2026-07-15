/**
 * @fileoverview Normalizacao compartilhada de identidade de compradores.
 * @module server/lib/buyer-identity
 */

const NAME_CONNECTORS = new Set(['da', 'de', 'do', 'dos', 'das', 'e']);

/** Normaliza nome e telefone recebidos pela API. */
export function normalizeNomeTel(nome, telefone) {
  return {
    nome: String(nome || '').trim(),
    telefone: normalizePhone(telefone),
  };
}

/** Remove formatacao de telefone sem inferir DDI. */
export function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '').replace(/^00+/, '');
}

/** Normaliza e-mail para comparacao e persistencia. */
export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

/** Retorna variacoes equivalentes com e sem DDI 55. */
export function getPhoneLookupCandidates(telefone) {
  const candidates = new Set();
  collectPhoneCandidates(candidates, telefone);
  return Array.from(candidates);
}

/** Compara telefones aceitando variacoes brasileiras de DDI/prefixo. */
export function phonesEquivalent(left, right) {
  const leftCandidates = new Set(getPhoneLookupCandidates(left));
  return getPhoneLookupCandidates(right).some((candidate) => leftCandidates.has(candidate));
}

/** Compara nomes ignorando acentos, conectores e nomes intermediarios extras. */
export function namesEquivalent(left, right) {
  const leftTokens = comparisonTokens(left);
  const rightTokens = comparisonTokens(right);
  if (!leftTokens.length || !rightTokens.length) return false;
  if (leftTokens.join(' ') === rightTokens.join(' ')) return true;
  if (leftTokens[0] !== rightTokens[0]) return false;
  if (leftTokens.at(-1) !== rightTokens.at(-1)) return false;
  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  const [smaller, larger] = leftSet.size <= rightSet.size
    ? [leftSet, rightSet]
    : [rightSet, leftSet];
  return Array.from(smaller).every((token) => larger.has(token));
}

/** Classifica identificador publico como e-mail ou telefone. */
export function normalizeIdentifier(value) {
  const raw = String(value || '').trim();
  const email = normalizeEmail(raw);
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { kind: 'email', value: email, candidates: [] };
  }
  const candidates = getPhoneLookupCandidates(raw);
  return { kind: 'phone', value: candidates[0] || '', candidates };
}

function comparisonTokens(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9]/g, ''))
    .filter((token) => token && !NAME_CONNECTORS.has(token));
}

function collectPhoneCandidates(candidates, rawValue) {
  const digits = normalizePhone(rawValue);
  if (!digits || candidates.has(digits)) return;
  candidates.add(digits);
  if (digits.startsWith('55') && digits.length >= 12) {
    collectPhoneCandidates(candidates, digits.slice(2));
  }
  if (digits.startsWith('0') && digits.length >= 11) {
    collectPhoneCandidates(candidates, digits.slice(1));
  }
  if (!digits.startsWith('55') && digits.length >= 10 && digits.length <= 11) {
    candidates.add(`55${digits}`);
  }
}
