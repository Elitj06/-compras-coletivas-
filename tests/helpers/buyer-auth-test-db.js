import postgres from 'postgres';

import { hashPbkdf2Pin } from '../../server/lib/pin-crypto.js';

/** Abre cliente de teste isolado no schema de autenticacao. */
export async function openTestClient(databaseUrl) {
  const sql = postgres(databaseUrl, { max: 1 });
  const adapter = {
    async query(text, parameters = []) {
      const rows = await sql.unsafe(text, parameters);
      return { rows: Array.from(rows), rowCount: rows.count ?? rows.length };
    },
    async end() {
      await sql.end({ timeout: 1 });
    },
  };
  await adapter.query('SET search_path TO compras_coletivas, public');
  return adapter;
}

/** Cria comprador com hash PBKDF2 para fixtures de integracao. */
export async function seedBuyer(db, nome, telefone, email, pin) {
  const result = await db.query(
    `INSERT INTO compradores (nome, telefone, email, pin_hash)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [nome, telefone, email, await hashPbkdf2Pin(pin)]
  );
  return result.rows[0];
}

/** Cria sessao descartavel e retorna token e ID. */
export async function createBuyerSession(db, buyerId) {
  const token = `token-${crypto.randomUUID()}`;
  const result = await db.query(
    `INSERT INTO buyer_sessions (comprador_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '1 hour') RETURNING id`,
    [buyerId, `hash-${crypto.randomUUID()}`]
  );
  return { token, sessionId: result.rows[0].id };
}

/** Le estado de PIN, sessoes e consumo do desafio. */
export async function buyerState(db, buyerId, challengeId = null) {
  const result = await db.query(
    `SELECT c.pin_hash,
      (SELECT COUNT(*)::int FROM buyer_sessions bs WHERE bs.comprador_id = c.id) AS session_count,
      (SELECT consumed_at FROM pin_recovery_challenges WHERE challenge_id = $2) AS consumed_at
     FROM compradores c WHERE c.id = $1`,
    [buyerId, challengeId]
  );
  return result.rows[0];
}

/** Produz Request com IP previsivel para rate limits de teste. */
export function makeRequest(suffix) {
  return new Request('https://example.test/api', {
    headers: { 'x-forwarded-for': `203.0.113.${suffix}` },
  });
}

/** Schema minimo anterior a migracao para o banco descartavel. */
export function baseSchema() {
  return `SET search_path TO compras_coletivas, public;
    CREATE TABLE compradores (
      id SERIAL PRIMARY KEY, nome TEXT NOT NULL, telefone TEXT, email TEXT, pin_hash TEXT
    );
    CREATE TABLE admin_sessions (
      id BIGSERIAL PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE buyer_sessions (
      id BIGSERIAL PRIMARY KEY, comprador_id INTEGER NOT NULL REFERENCES compradores(id),
      token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL
    );`;
}
