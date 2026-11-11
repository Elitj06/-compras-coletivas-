/** Build an explicit, fail-closed origin allowlist for the Compras API. */
export function buildAllowedOrigins(extraOrigins = '') {
  const allowed = new Set([
    'https://compras-coletivas-phi.vercel.app',
    'http://localhost:3000',
  ]);

  for (const entry of extraOrigins.split(',')) {
    const candidate = entry.trim();
    if (!candidate) continue;
    let url;
    try {
      url = new URL(candidate);
    } catch {
      throw new Error('Configuração de origem inválida');
    }
    if (url.protocol !== 'https:' || url.origin !== candidate || url.username || url.password || url.hostname.includes('*')) {
      throw new Error('Configuração de origem inválida');
    }
    allowed.add(candidate);
  }
  return allowed;
}
