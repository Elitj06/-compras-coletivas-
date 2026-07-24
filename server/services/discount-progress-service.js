/**
 * @fileoverview Regras puras para o desconto progressivo da compra coletiva.
 * @module server/services/discount-progress-service
 */

/** Limita um valor percentual ao intervalo aceito pela barra. */
function clampPercent(value) {
  return Math.min(100, Math.max(0, Number(value) || 0));
}

/** Ordena e normaliza faixas vindas do PostgreSQL. */
export function normalizeDiscountTiers(tiers) {
  return (Array.isArray(tiers) ? tiers : [])
    .map((tier) => ({
      id: tier.id,
      nome: String(tier.nome || '').trim(),
      valor_minimo: Number(tier.valor_minimo) || 0,
      valor_maximo: tier.valor_maximo === null || tier.valor_maximo === undefined
        ? null
        : Number(tier.valor_maximo),
      percentual: Number(tier.percentual) || 0,
    }))
    .filter((tier) => tier.valor_minimo >= 0 && tier.percentual >= 0 && tier.percentual <= 100)
    .sort((left, right) => left.valor_minimo - right.valor_minimo);
}

/**
 * Seleciona a faixa vigente para um total final coletivo.
 * A maior faixa cujo mínimo foi alcançado vence; o limite superior só encerra
 * a faixa visual, pois a próxima faixa é sempre a próxima meta mínima.
 * @param {number} totalFinal - Soma dos pedidos ativos já com desconto.
 * @param {Array<object>} tiers - Faixas de desconto.
 * @returns {object|null}
 */
export function selectDiscountTier(totalFinal, tiers) {
  const total = Math.max(0, Number(totalFinal) || 0);
  const normalized = normalizeDiscountTiers(tiers);
  let selected = null;
  for (const tier of normalized) {
    if (total < tier.valor_minimo) break;
    if (tier.valor_maximo === null || total < tier.valor_maximo) selected = tier;
  }
  return selected;
}

/**
 * Encontra a faixa de desconto estável (ponto fixo) para um total bruto coletivo.
 *
 * O sistema usa total_final (pós-desconto) para selecionar a faixa, o que cria
 * uma dependência circular: desconto → total_final → faixa → desconto.
 * Esta função quebra a circularidade testando cada faixa da maior para a menor:
 * a primeira faixa cujo desconto, quando aplicado, produz um total_final ainda
 * dentro do próprio valor_minimo é o ponto estável.
 *
 * @param {number} totalBrutoColetivo - Soma dos preços brutos de todos os pedidos ativos.
 * @param {Array<object>} tiers - Faixas de desconto normalizadas.
 * @returns {object|null} A faixa estável, ou null se nenhuma se aplica.
 */
export function resolveStableDiscountTier(totalBrutoColetivo, tiers) {
  const total = Math.max(0, Number(totalBrutoColetivo) || 0);
  const normalized = normalizeDiscountTiers(tiers);
  // Test from highest tier to lowest — the first self-consistent tier wins.
  for (let i = normalized.length - 1; i >= 0; i--) {
    const tier = normalized[i];
    const projectedFinal = total * (1 - tier.percentual / 100);
    if (projectedFinal >= tier.valor_minimo) return tier;
  }
  return null;
}

/**
 * Monta o contrato usado pela barra de progresso do comprador.
 * @param {number} totalFinal - Soma dos pedidos ativos já com desconto.
 * @param {Array<object>} tiers - Faixas de desconto.
 * @returns {object}
 */
export function buildDiscountProgress(totalFinal, tiers) {
  const total = Math.max(0, Number(totalFinal) || 0);
  const normalized = normalizeDiscountTiers(tiers);
  const current = selectDiscountTier(total, normalized);
  const next = normalized.find((tier) => tier.valor_minimo > total) || null;
  const start = current?.valor_minimo || 0;
  const end = next?.valor_minimo || start;
  const range = end - start;
  const progress = next && range > 0 ? ((total - start) / range) * 100 : (current ? 100 : 0);
  const maxReached = Boolean(current && !next);

  return {
    total_final: Number(total.toFixed(2)),
    percentual_atual: current?.percentual || 0,
    faixa_atual: current,
    proxima_faixa: next,
    valor_faltante: next ? Number(Math.max(0, next.valor_minimo - total).toFixed(2)) : 0,
    progresso_percentual: Number(clampPercent(progress).toFixed(2)),
    maximo_alcancado: maxReached,
    faixas: normalized,
  };
}
