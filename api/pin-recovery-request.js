/**
 * @fileoverview Node-only SMTP boundary for the public PIN recovery request.
 * @module api/pin-recovery-request
 */

import { createClient } from '@vercel/postgres';
import { waitUntil } from '@vercel/functions';
import { randomBytes } from 'node:crypto';
import {
  deliverPreparedPinRecovery,
  preparePinRecovery,
} from '../server/services/buyer-email-recovery-service.js';

const MAX_BODY_BYTES = 8 * 1024;
const RESPONSE_FLOOR_MS = 450;

/** Handles the only SMTP-dependent operation outside the Edge API bundle. */
export function createPinRecoveryHandler(dependencies = {}) {
  const getClientImpl = dependencies.getClientImpl || getClient;
  const prepareImpl = dependencies.prepareImpl || preparePinRecovery;
  const deliverImpl = dependencies.deliverImpl || deliverPreparedPinRecovery;
  const waitUntilImpl = dependencies.waitUntilImpl || waitUntil;
  const responseFloorMs = dependencies.responseFloorMs ?? RESPONSE_FLOOR_MS;
  return async function handler(req, res) {
    const startedAt = Date.now();
    setHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Método não permitido' });
    let client;
    try {
      const input = await readJson(req);
      client = await getClientImpl();
      const webRequest = toWebRequest(req);
      const prepared = await prepareImpl({ client, req: webRequest, input, env: process.env });
      waitUntilImpl(runPreparedDelivery({
        client, req: webRequest, prepared, deliverImpl, env: process.env,
      }));
      client = null;
      await waitForResponseFloor(startedAt, responseFloorMs);
      return res.status(202).json(prepared.response);
    } catch {
      if (client) waitUntilImpl(closeClient(client));
      await waitForResponseFloor(startedAt, responseFloorMs);
      return res.status(202).json(neutral());
    }
  };
}

const handler = createPinRecoveryHandler();
export default handler;

/** Executa entrega e fechamento fora do caminho da resposta pública. */
export async function runPreparedDelivery({ client, req, prepared, deliverImpl, env }) {
  try {
    if (prepared.delivery) await deliverImpl({ client, req, prepared, env });
  } catch {
    // A fronteira de entrega registra/revoga quando o banco esta disponivel; nunca logar PII.
  } finally {
    await closeClient(client);
  }
}

async function closeClient(client) {
  try { await client?.end(); } catch { /* conexao ja encerrada */ }
}

async function waitForResponseFloor(startedAt, floorMs) {
  const remaining = Math.max(0, floorMs - (Date.now() - startedAt));
  if (remaining) await new Promise((resolve) => setTimeout(resolve, remaining));
}

function setHeaders(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

async function getClient() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Database not configured');
  const client = createClient({ connectionString });
  await client.connect();
  const schema = process.env.POSTGRES_SCHEMA || 'compras_coletivas';
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
    throw new Error('Invalid POSTGRES_SCHEMA');
  }
  await client.query(`SET search_path TO "${schema}"`);
  return client;
}

function toWebRequest(req) {
  const host = String(req.headers.host || 'localhost');
  const forwarded = String(req.headers['x-forwarded-proto'] || 'https');
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) headers.set(name, value.join(','));
    else if (value !== undefined) headers.set(name, value);
  }
  return new Request(`${forwarded}://${host}${req.url}`, { headers });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_BYTES) reject(new Error('Body too large'));
      else body += chunk;
    });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}

function neutral() {
  return {
    success: true,
    message: 'Se os dados estiverem aptos, você receberá as instruções em instantes.',
    challenge_id: randomBytes(32).toString('hex'),
  };
}

export const config = { runtime: 'nodejs' };
