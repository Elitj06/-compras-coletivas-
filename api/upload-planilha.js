/**
 * Upload is intentionally disabled pending a separately reviewed parser.
 * It previously accepted an unbounded, hand-parsed multipart body and advertised
 * XLSX despite not parsing it. Keeping it unavailable is safer than pretending.
 */
export default async function handler() {
  return new Response(JSON.stringify({
    success: false,
    code: 'UPLOAD_TEMPORARILY_DISABLED',
    error: 'Importação de catálogo está temporariamente desativada.',
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export const config = { runtime: 'nodejs' };
