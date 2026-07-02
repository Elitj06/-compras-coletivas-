/**
 * @fileoverview API de Upload de Planilha — Compras Coletivas
 *
 * Processa upload de planilha Excel/CSV com catálogo de produtos
 * e atualiza a tabela `produtos` no banco.
 *
 * Runtime: Node.js (não Edge — precisa de parsing de multipart)
 * Autenticação: senha admin via query param `key` ou header `X-Admin-Key`
 *
 * @module api/upload-planilha
 */

// ============================================================
// API: Upload de Planilha Excel
// Processa planilha da empresa e atualiza produtos
// ============================================================

import { neon } from '@neondatabase/serverless';

// Supabase — schema isolado compras_coletivas
const DB_URL = (process.env.DATABASE_URL || '').includes('?')
  ? process.env.DATABASE_URL + '&options=--search_path%3Dcompras_coletivas'
  : process.env.DATABASE_URL + '?options=--search_path%3Dcompras_coletivas';
const sql = neon(DB_URL);

const ALLOWED_ORIGINS = new Set([
  'https://compras-coletivas-phi.vercel.app',
  'http://localhost:3000',
]);

const BASE_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Vary': 'Origin',
};

let headers = { ...BASE_HEADERS };

function corsHeadersFor(req) {
  const origin = req?.headers?.get('origin') || '';
  const responseHeaders = { ...BASE_HEADERS };
  if (ALLOWED_ORIGINS.has(origin)) {
    responseHeaders['Access-Control-Allow-Origin'] = origin;
  }
  return responseHeaders;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function getBearerToken(req) {
  const authHeader = req.headers.get('authorization') || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
}

async function requireAdmin(req) {
  const token = getBearerToken(req);
  if (!token) return false;
  const tokenHash = await sha256Hex(`session:${token}`);
  const sessions = await sql`
    SELECT id FROM admin_sessions
    WHERE token_hash = ${tokenHash}
      AND expires_at > NOW()
    LIMIT 1
  `;
  return sessions.length > 0;
}

/**
 * Parse simples de multipart/form-data para extrair campos de upload.
 * @param {string} body - Body da requisição em texto.
 * @param {string} boundary - Boundary do multipart (do Content-Type header).
 * @returns {Object<string, string>} Campos extraídos (nome → valor).
 */
function parseMultipart(body, boundary) {
  const parts = body.split('--' + boundary);
  const result = {};
  
  for (const part of parts) {
    if (part.includes('Content-Disposition')) {
      const nameMatch = part.match(/name="([^"]+)"/);
      if (nameMatch) {
        const name = nameMatch[1];
        const dataStart = part.indexOf('\r\n\r\n');
        if (dataStart > 0) {
          let data = part.substring(dataStart + 4).replace(/\r\n$/, '');
          result[name] = data;
        }
      }
    }
  }
  return result;
}

/**
 * Handler de upload de planilha.
 *
 * Aceita:
 * - `multipart/form-data` com campo `planilha` ou `file`
 * - `application/json` com campo `data` (base64 encoded)
 *
 * Formatos suportados:
 * - JSON: array de `{ codigo, nome, preco, categoria, embalagem }`
 * - CSV: linhas `codigo;nome;preco;categoria;embalagem`
 *
 * @param {Request} req - Requisição HTTP.
 * @returns {Promise<Response>} JSON com resumo da importação.
 */
export default async function handler(req) {
  headers = corsHeadersFor(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return json({ success: false, error: 'Método não permitido' }, 405);
  }

  try {
    if (!(await requireAdmin(req))) {
      return json({ success: false, error: 'Não autorizado' }, 401);
    }

    // Parse do body
    const contentType = req.headers.get('Content-Type') || '';
    let fileData = null;
    
    if (contentType.includes('multipart/form-data')) {
      const boundary = contentType.split('boundary=')[1];
      if (!boundary) {
        return json({ success: false, error: 'Boundary não encontrado' }, 400);
      }
      
      const rawBody = await req.text();
      const parsed = parseMultipart(rawBody, boundary);
      fileData = parsed.planilha || parsed.file;
    } else {
      // Base64 direto
      const body = await req.json();
      fileData = body.planilha || body.file || body.data;
    }

    if (!fileData) {
      return json({ success: false, error: 'Nenhum arquivo enviado' }, 400);
    }

    // Detectar formato
    const isExcel = fileData.includes('UEsDBBQAAAAIA'); // PK header (ZIP/XLSX)
    
    // Para Vercel Edge, vamos aceitar JSON estruturado por enquanto
    // Em produção real, usaríamos uma função Node.js com xlsx
    
    // Simular processamento (quando tiver xlsx real, substituir)
    let produtos = [];
    
    // Se for JSON direto
    if (!isExcel) {
      try {
        const decoded = atob(fileData);
        produtos = JSON.parse(decoded);
      } catch (e) {
        // Tentar como CSV
        const lines = fileData.split('\n');
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(';');
          if (cols.length >= 3) {
            produtos.push({
              codigo: cols[0]?.trim(),
              nome: cols[1]?.trim(),
              preco: parseFloat(cols[2]?.replace(',', '.')) || 0,
              categoria: cols[3]?.trim() || 'outros',
              embalagem: parseInt(cols[4]) || 1
            });
          }
        }
      }
    }

    if (!produtos.length) {
      return json({ 
        success: false, 
        error: 'Nenhum produto encontrado na planilha',
        hint: 'Envie JSON ou CSV com: codigo;nome;preco;categoria;embalagem'
      }, 400);
    }

    // Atualizar produtos no banco
    let atualizados = 0;
    let inseridos = 0;
    
    // Criar tabela de categorias se não existir
    for (const p of produtos) {
      if (p.categoria) {
        await sql`
          INSERT INTO categorias (slug, nome)
          VALUES (${p.categoria}, ${p.categoria})
          ON CONFLICT (slug) DO NOTHING
        `;
      }
    }

    // Inserir/atualizar produtos
    for (const p of produtos) {
      if (!p.codigo || !p.nome || !p.preco) continue;
      
      // Buscar categoria_id
      const cat = await sql`
        SELECT id FROM categorias WHERE slug = ${p.categoria || 'outros'}
      `;
      const catId = cat[0]?.id || null;
      
      const existing = await sql`
        SELECT id FROM produtos WHERE codigo = ${p.codigo}
      `;
      
      if (existing.length > 0) {
        await sql`
          UPDATE produtos SET
            nome = ${p.nome},
            preco = ${p.preco},
            embalagem = ${p.embalagem || 1},
            categoria_id = ${catId},
            updated_at = NOW()
          WHERE codigo = ${p.codigo}
        `;
        atualizados++;
      } else {
        await sql`
          INSERT INTO produtos (codigo, nome, preco, embalagem, categoria_id, ativo)
          VALUES (${p.codigo}, ${p.nome}, ${p.preco}, ${p.embalagem || 1}, ${catId}, TRUE)
        `;
        inseridos++;
      }
    }

    // Registrar log
    await sql`
      INSERT INTO configuracoes (chave, valor)
      VALUES ('ultima_importacao', ${new Date().toISOString()})
      ON CONFLICT (chave) DO UPDATE SET valor = ${new Date().toISOString()}
    `;

    return json({
      success: true,
      message: `Importação concluída!`,
      resumo: {
        total: produtos.length,
        atualizados,
        inseridos,
        ignorados: produtos.length - atualizados - inseridos
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    return json({ success: false, error: 'Erro interno. Tente novamente.' }, 500);
  }
}

export const config = { runtime: 'nodejs' };
