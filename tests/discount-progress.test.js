import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildDiscountProgress,
  selectDiscountTier,
  normalizeDiscountTiers,
} from '../server/services/discount-progress-service.js';

const tiers = [
  { id: 1, nome: 'R$ 1.000 a R$ 2.999', valor_minimo: '1000', valor_maximo: '3000', percentual: '40' },
  { id: 2, nome: 'R$ 3.000 a R$ 7.999', valor_minimo: '3000', valor_maximo: '8000', percentual: '44' },
  { id: 3, nome: 'Acima de R$ 8.000', valor_minimo: '8000', valor_maximo: null, percentual: '48' },
];

describe('desconto progressivo coletivo', () => {
  it('mantém zero antes da primeira faixa e informa quanto falta', () => {
    const progress = buildDiscountProgress(750, tiers);

    assert.equal(progress.percentual_atual, 0);
    assert.equal(progress.proxima_faixa.percentual, 40);
    assert.equal(progress.valor_faltante, 250);
    assert.equal(progress.progresso_percentual, 75);
  });

  it('aplica a faixa alcançada globalmente e calcula a próxima meta', () => {
    const progress = buildDiscountProgress(2000, tiers);

    assert.equal(selectDiscountTier(2000, tiers).percentual, 40);
    assert.equal(progress.percentual_atual, 40);
    assert.equal(progress.proxima_faixa.percentual, 44);
    assert.equal(progress.valor_faltante, 1000);
    assert.equal(progress.progresso_percentual, 50);
  });

  it('mantém a maior faixa quando o teto foi ultrapassado', () => {
    const progress = buildDiscountProgress(9000, tiers);

    assert.equal(progress.percentual_atual, 48);
    assert.equal(progress.proxima_faixa, null);
    assert.equal(progress.maximo_alcancado, true);
    assert.equal(progress.progresso_percentual, 100);
  });

  it('usa o total bruto coletivo para selecionar a faixa', () => {
    const progress = buildDiscountProgress(4397, tiers);

    // NOTE: buildDiscountProgress receives the GROSS total (total_bruto from DB),
    // NOT the post-discount amount. The returned field is named total_final but
    // represents the gross input — see discount-progress-service.js line 64.
    assert.equal(progress.total_final, 4397);
    assert.equal(progress.percentual_atual, 44);
    assert.equal(progress.proxima_faixa.percentual, 48);
    assert.equal(progress.valor_faltante, 3603);
  });
});

// ---------------------------------------------------------------------------
// Edge cases & regression tests (added 2026-07-21)
// These tests guard against the specific bugs fixed in getDiscountProgress
// and repriceCycleOrders: tier selection must be on total_bruto, not
// total_final; and boundary conditions must be exact.
// ---------------------------------------------------------------------------

describe('buildDiscountProgress — edge cases', () => {
  it('retorna estrutura válida com total zero', () => {
    const progress = buildDiscountProgress(0, tiers);

    assert.equal(progress.total_final, 0);
    assert.equal(progress.percentual_atual, 0);
    assert.equal(progress.faixa_atual, null);
    assert.equal(progress.proxima_faixa?.percentual, 40);
    assert.equal(progress.valor_faltante, 1000);
    assert.equal(progress.progresso_percentual, 0);
    assert.equal(progress.maximo_alcancado, false);
  });

  it('retorna estrutura válida com ciclos sem faixas configuradas', () => {
    const progress = buildDiscountProgress(5000, []);

    assert.equal(progress.total_final, 5000);
    assert.equal(progress.percentual_atual, 0);
    assert.equal(progress.faixa_atual, null);
    assert.equal(progress.proxima_faixa, null);
    assert.equal(progress.valor_faltante, 0);
    assert.equal(progress.maximo_alcancado, false);
  });

  it('seleciona a primeira faixa no limite exato (valor_minimo)', () => {
    const progress = buildDiscountProgress(1000, tiers);

    assert.equal(progress.percentual_atual, 40);
    assert.equal(progress.faixa_atual?.id, 1);
    assert.equal(progress.proxima_faixa?.percentual, 44);
  });

  it('seleciona a segunda faixa no limite exato entre faixas', () => {
    const progress = buildDiscountProgress(3000, tiers);

    assert.equal(progress.percentual_atual, 44);
    assert.equal(progress.faixa_atual?.id, 2);
    assert.equal(progress.proxima_faixa?.percentual, 48);
  });

  it('trata valor logo abaixo do limite superior da faixa', () => {
    const progress = buildDiscountProgress(2999.99, tiers);

    assert.equal(progress.percentual_atual, 40);
    assert.equal(progress.faixa_atual?.id, 1);
  });

  it('trata valor exatamente no limite superior da faixa', () => {
    const progress = buildDiscountProgress(3000, tiers);

    assert.equal(progress.percentual_atual, 44);
    assert.equal(progress.faixa_atual?.id, 2);
  });

  it('alcança faixa mais alta sem próxima meta', () => {
    const progress = buildDiscountProgress(8000, tiers);

    assert.equal(progress.percentual_atual, 48);
    assert.equal(progress.faixa_atual?.id, 3);
    assert.equal(progress.proxima_faixa, null);
    assert.equal(progress.maximo_alcancado, true);
    assert.equal(progress.valor_faltante, 0);
  });

  it('trata valor negativo como zero', () => {
    const progress = buildDiscountProgress(-500, tiers);

    assert.equal(progress.total_final, 0);
    assert.equal(progress.percentual_atual, 0);
  });

  it('trata valor NaN como zero', () => {
    const progress = buildDiscountProgress(NaN, tiers);

    assert.equal(progress.total_final, 0);
    assert.equal(progress.percentual_atual, 0);
  });
});

describe('selectDiscountTier — regressão de seleção', () => {
  it('retorna null para total abaixo de todas as faixas', () => {
    const tier = selectDiscountTier(500, tiers);
    assert.equal(tier, null);
  });

  it('retorna null para array vazio de faixas', () => {
    const tier = selectDiscountTier(10000, []);
    assert.equal(tier, null);
  });

  it('seleciona corretamente sob a faixa mais alta sem maximo', () => {
    const tier = selectDiscountTier(15000, tiers);
    assert.equal(tier.id, 3);
    assert.equal(tier.percentual, 48);
  });
});

describe('normalizeDiscountTiers — robustez de entrada', () => {
  it('ordena faixas por valor_minimo mesmo se vierem fora de ordem', () => {
    const reversed = [...tiers].reverse();
    const normalized = normalizeDiscountTiers(reversed);

    assert.equal(normalized[0].valor_minimo, 1000);
    assert.equal(normalized[1].valor_minimo, 3000);
    assert.equal(normalized[2].valor_minimo, 8000);
  });

  it('filtra faixas com percentual inválido (>100 ou <0)', () => {
    const bad = [
      ...tiers,
      { id: 99, nome: 'Bug', valor_minimo: 10000, valor_maximo: null, percentual: 150 },
    ];
    const normalized = normalizeDiscountTiers(bad);

    assert.equal(normalized.length, 3);
    assert.ok(!normalized.find((t) => t.id === 99));
  });

  it('converte strings numéricas para number', () => {
    const normalized = normalizeDiscountTiers(tiers);

    assert.equal(typeof normalized[0].valor_minimo, 'number');
    assert.equal(typeof normalized[0].percentual, 'number');
    assert.equal(normalized[0].valor_maximo, 3000); // not '3000'
  });

  it('trata input não-array retornando []', () => {
    assert.deepEqual(normalizeDiscountTiers(null), []);
    assert.deepEqual(normalizeDiscountTiers(undefined), []);
    assert.deepEqual(normalizeDiscountTiers('not an array'), []);
  });

  it('preserva valor_maximo null (faixa aberta)', () => {
    const normalized = normalizeDiscountTiers(tiers);

    assert.equal(normalized[2].valor_maximo, null);
  });
});

// ---------------------------------------------------------------------------
// Regression: discount tier must use total_bruto, not total_final.
// This test documents the fix for the circular-dependency bug where using
// total_final (post-discount) could cause the tier to drop after applying
// the discount, leading to oscillating prices.
// ---------------------------------------------------------------------------

describe('regressão: faixa baseada em total_bruto', () => {
  it('não reduz a faixa quando o desconto é aplicado', () => {
    // Cenário: total bruto coletivo = R$ 3.100 → faixa de 44%
    // Se usássemos total_final após 44% de desconto: 3100 * 0.56 = R$ 1.736
    // R$ 1.736 cairia para a faixa de 40% — comportamento incorreto!
    const totalBruto = 3100;
    const progress = buildDiscountProgress(totalBruto, tiers);

    assert.equal(progress.percentual_atual, 44,
      'Tier deve ser 44% baseado no total bruto de R$ 3.100');

    // Documenta o que aconteceria se usássemos total_final:
    const totalFinalAposDesconto = totalBruto * (1 - 44 / 100);
    const progressIfFinal = buildDiscountProgress(totalFinalAposDesconto, tiers);
    assert.equal(progressIfFinal.percentual_atual, 40,
      'Bug documentado: usar total_final causaria queda para 40%');
  });

  it('faixa se mantém estável quando pedidos são removidos', () => {
    // Cenário: 3 pedidos de R$ 1.100 cada = R$ 3.300 bruto → 44%
    // Remover 1 pedido: R$ 2.200 bruto → volta para 40% (correto)
    const antes = buildDiscountProgress(3300, tiers);
    const depois = buildDiscountProgress(2200, tiers);

    assert.equal(antes.percentual_atual, 44);
    assert.equal(depois.percentual_atual, 40,
      'Após remover pedido, faixa deve recuar para 40%');
  });
});
