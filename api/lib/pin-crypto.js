/**
 * @fileoverview Primitivas WebCrypto para PIN e recuperacao de acesso.
 * Compativel com o Vercel Edge Runtime e com o runner de testes do Node.
 * @module api/lib/pin-crypto
 */

export const PIN_PBKDF2_ITERATIONS = 210000;
export const PIN_HASH_MIGRATION_DEFAULT = false;

const ENCODER = new TextEncoder();
const LEGACY_HASH_PATTERN = /^[0-9a-f]{64}$/i;
const PBKDF2_PREFIX = 'pbkdf2:sha256:';
const MIN_PBKDF2_ITERATIONS = 100000;
const MAX_PBKDF2_ITERATIONS = 1000000;

function getCrypto() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error('WebCrypto API indisponivel');
  }
  return globalThis.crypto;
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(value) {
  const hex = String(value || '');
  if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) throw new Error('Hexadecimal invalido');
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function assertValidIterations(iterations) {
  if (
    !Number.isInteger(iterations) ||
    iterations < MIN_PBKDF2_ITERATIONS ||
    iterations > MAX_PBKDF2_ITERATIONS
  ) {
    throw new Error('Quantidade de iteracoes PBKDF2 invalida');
  }
}

function parsePbkdf2Hash(savedHash) {
  const parts = String(savedHash || '').split(':');
  if (parts.length !== 5 || parts[0] !== 'pbkdf2' || parts[1] !== 'sha256') return null;
  const iterations = Number(parts[2]);
  const saltHex = parts[3];
  const hashHex = parts[4];
  if (!Number.isInteger(iterations) || !/^[0-9a-f]{32,128}$/i.test(saltHex)) return null;
  if (!LEGACY_HASH_PATTERN.test(hashHex)) return null;
  try {
    assertValidIterations(iterations);
  } catch {
    return null;
  }
  return { iterations, saltHex, hashHex: hashHex.toLowerCase() };
}

async function derivePbkdf2Hex(pin, saltHex, iterations) {
  assertValidIterations(iterations);
  const cryptoApi = getCrypto();
  const key = await cryptoApi.subtle.importKey(
    'raw',
    ENCODER.encode(String(pin || '')),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await cryptoApi.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(saltHex), iterations },
    key,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

/** Valida o contrato atual de PIN: quatro a seis digitos. */
export function isValidPin(pin) {
  return /^\d{4,6}$/.test(String(pin || ''));
}

/** Gera bytes aleatorios codificados em hexadecimal. */
export function randomHex(byteLength = 32) {
  if (!Number.isInteger(byteLength) || byteLength < 1 || byteLength > 1024) {
    throw new Error('Tamanho aleatorio invalido');
  }
  const bytes = new Uint8Array(byteLength);
  getCrypto().getRandomValues(bytes);
  return bytesToHex(bytes);
}

/** Reproduz exatamente o hash SHA-256 legado salvo em compradores.pin_hash. */
export async function hashLegacyPin(pin, legacySalt) {
  const payload = ENCODER.encode(`${String(legacySalt || '')}::${String(pin || '')}`);
  const digest = await getCrypto().subtle.digest('SHA-256', payload);
  return bytesToHex(new Uint8Array(digest));
}

/** Gera o envelope versionado PBKDF2-SHA256 usado pelos novos hashes. */
export async function hashPbkdf2Pin(
  pin,
  { saltHex = randomHex(16), iterations = PIN_PBKDF2_ITERATIONS } = {}
) {
  if (!isValidPin(pin)) throw new Error('PIN deve ter de 4 a 6 digitos numericos');
  if (!/^[0-9a-f]{32,128}$/i.test(saltHex)) throw new Error('Salt PBKDF2 invalido');
  const normalizedSalt = saltHex.toLowerCase();
  const hashHex = await derivePbkdf2Hex(pin, normalizedSalt, iterations);
  return `${PBKDF2_PREFIX}${iterations}:${normalizedSalt}:${hashHex}`;
}

/** Verifica hashes legados e envelopes PBKDF2 sem alterar o valor persistido. */
export async function verifyPinHash(pin, savedHash, legacySalt) {
  const stored = String(savedHash || '');
  if (stored.startsWith(PBKDF2_PREFIX)) {
    const parsed = parsePbkdf2Hash(stored);
    if (!parsed) return false;
    const candidate = await derivePbkdf2Hex(pin, parsed.saltHex, parsed.iterations);
    return constantTimeEqual(candidate, parsed.hashHex);
  }
  if (!LEGACY_HASH_PATTERN.test(stored)) return false;
  const candidate = await hashLegacyPin(pin, legacySalt);
  return constantTimeEqual(candidate, stored.toLowerCase());
}

/** Identifica hashes SHA-256 legados que podem ser migrados em release futura. */
export function isLegacyPinHash(savedHash) {
  const stored = String(savedHash || '');
  return LEGACY_HASH_PATTERN.test(stored) && !stored.startsWith(PBKDF2_PREFIX);
}

/** A migracao e opt-in; sem configuracao explicita permanece desativada. */
export function isPinHashMigrationEnabled(env = {}) {
  if (PIN_HASH_MIGRATION_DEFAULT) return true;
  return String(env.PIN_HASH_MIGRATION_ENABLED || '').toLowerCase() === 'true';
}

/** Calcula HMAC-SHA256 hexadecimal sem persistir o segredo ou a mensagem. */
export async function hmacSha256Hex(secret, message) {
  if (!String(secret || '')) throw new Error('Segredo HMAC obrigatorio');
  const cryptoApi = getCrypto();
  const key = await cryptoApi.subtle.importKey(
    'raw',
    ENCODER.encode(String(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await cryptoApi.subtle.sign('HMAC', key, ENCODER.encode(String(message || '')));
  return bytesToHex(new Uint8Array(signature));
}

/** Gera codigo numerico uniforme de seis digitos com CSPRNG. */
export function generateRecoveryCode() {
  const cryptoApi = getCrypto();
  const range = 1000000;
  const limit = Math.floor(0x100000000 / range) * range;
  const value = new Uint32Array(1);
  do cryptoApi.getRandomValues(value); while (value[0] >= limit);
  return String(value[0] % range).padStart(6, '0');
}
