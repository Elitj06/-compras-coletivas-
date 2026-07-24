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
 * Resolve a faixa usando somente o total final e o percentual já aplicado.
 *
 * Quando o salto de percentual faz o total cair abaixo da própria meta, a
 * faixa recém-liberada é mantida até o total recuar abaixo da faixa anterior.
 * Isso evita alternância 40%/44%/40% a cada atualização, sem usar o bruto para
 * decidir a faixa exibida ou concedida.
 *
 * @param {number} totalFinal - Soma dos pedidos já com desconto.
 * @param {number|null} appliedPercentual - Percentual atualmente aplicado.
 * @param {Array<object>} tiers - Faixas de desconto.
 * @returns {object|null} A faixa que deve permanecer ou ser aplicada.
 */
export function resolveDiscountTier(totalFinal, appliedPercentual, tiers) {
  const total = Math.max(0, Number(totalFinal) || 0);
  const normalized = normalizeDiscountTiers(tiers);
  const selected = selectDiscountTier(total, normalized);
  const applied = appliedPercentual === null || appliedPercentual === undefined
    ? null
    : normalized.find((tier) => tier.percentual === Number(appliedPercentual)) || null;

  if (!applied) return selected;
  if (!selected) {
    const appliedIndex = normalized.findIndex((tier) => tier.id === applied.id);
    const previous = appliedIndex > 0 ? normalized[appliedIndex - 1] : null;
    return previous && total >= previous.valor_minimo ? applied : null;
  }

  const appliedIndex = normalized.findIndex((tier) => tier.id === applied.id);
  const selectedIndex = normalized.findIndex((tier) => tier.id === selected.id);
  if (selectedIndex >= appliedIndex) return selected;

  const previous = appliedIndex > 0 ? normalized[appliedIndex - 1] : null;
  const retentionMinimum = previous?.valor_minimo ?? applied.valor_minimo;
  return total >= retentionMinimum ? applied : selected;
}

/**
 * Monta o contrato usado pela barra de progresso do comprador.
 *
 * **Métricas visuais** (posição na barra) sempre usam `selectDiscountTier`,
 * que reflete onde o total_final realmente está — sem retenção.  Assim a
 * barra nunca indica que R$ 8.000 foi alcançado quando total_final < 8000,
 * mesmo que a retenção mantenha 48% no pricing.
 *
 * **Métricas de pricing** usam `resolveDiscountTier` (com retenção) e são
 * expostas em `percentual_aplicado` / `faixa_aplicada` para consumo pelo
 * auto-healing e pelo frontend (carrinho/admin).
 *
 * @param {number} totalFinal - Soma dos pedidos ativos já com desconto.
 * @param {Array<object>} tiers - Faixas de desconto.
 * @param {number|null} [appliedPercentual] - Percentual efetivamente aplicado,
 * quando o ciclo já possui pedidos precificados.
 * @returns {object}
 */
export function buildDiscountProgress(totalFinal, tiers, appliedPercentual = null) {
  const total = Math.max(0, Number(totalFinal) || 0);
  const normalized = normalizeDiscountTiers(tiers);

  // SECTION: Visual position — pure selection, NO retention.
  const current = selectDiscountTier(total, normalized);

  // SECTION: Pricing position — with retention for auto-healing and display.
  const resolved = resolveDiscountTier(total, appliedPercentual, normalized);

  const currentIndex = current ? normalized.findIndex((tier) => tier.id === current.id) : -1;
  const next = currentIndex >= 0
    ? normalized[currentIndex + 1] || null
    : normalized.find((tier) => tier.valor_minimo > total) || null;
  const start = current?.valor_minimo || 0;
  const end = next?.valor_minimo || start;
  const range = end - start;
  const progress = next && range > 0 ? ((total - start) / range) * 100 : (current ? 100 : 0);
  const maxReached = Boolean(current && !next);

  return {
    total_final: Number(total.toFixed(2)),
    percentual_atual: current?.percentual || 0,
    percentual_aplicado: resolved?.percentual || 0,
    faixa_atual: current,
    faixa_aplicada: resolved,
    proxima_faixa: next,
    valor_faltante: next ? Number(Math.max(0, next.valor_minimo - total).toFixed(2)) : 0,
    progresso_percentual: Number(clampPercent(progress).toFixed(2)),
    maximo_alcancado: maxReached,
    faixas: normalized,
  };
}
