/**
 * @fileoverview Node-only SMTP boundary for the public PIN recovery request.
 * @module api/pin-recovery-request
 */

import { createClient } from '@vercel/postgres';
import { randomBytes } from 'node:crypto';
import { requestPinRecovery } from '../server/services/buyer-email-recovery-service.js';

const MAX_BODY_BYTES = 8 * 1024;

/** Handles the only SMTP-dependent operation outside the Edge API bundle. */
export default async function handler(req, res) {
  setHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Método não permitido' });
  let client;
  try {
    const input = await readJson(req);
    client = await getClient();
    const result = await requestPinRecovery({ client, req: toWebRequest(req), input, env: process.env });
    await client.end();
    return res.status(202).json(result);
  } catch (error) {
    if (client) try { await client.end(); } catch { /* connection already closed */ }
    return res.status(202).json(neutral());
  }
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
  await client.query('SET search_path TO compras_coletivas');
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
