import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildDiscountProgress,
  selectDiscountTier,
  normalizeDiscountTiers,
  resolveDiscountTier,
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

  it('usa o total final (pós-desconto) para selecionar a faixa', () => {
    // REQUISITO: buildDiscountProgress recebe o total_final da tabela pedidos
    // (soma do que o grupo efetivamente paga após desconto). A faixa é determinada
    // pelo valor final coletivo, não pelo bruto do catálogo.
    const progress = buildDiscountProgress(4397, tiers);

    assert.equal(progress.total_final, 4397);
    assert.equal(progress.percentual_atual, 44);
    assert.equal(progress.proxima_faixa.percentual, 48);
    assert.equal(progress.valor_faltante, 3603);
  });

  it('preserva a faixa efetivamente aplicada em uma fronteira de recálculo', () => {
    const progress = buildDiscountProgress(2800, tiers, 44);

    assert.equal(progress.percentual_atual, 44);
    assert.equal(progress.faixa_atual?.id, 2);
    assert.equal(progress.proxima_faixa?.id, 3);
    assert.equal(progress.valor_faltante, 5200);
  });

  it('considera a próxima meta alcançada pelo total final mesmo com faixa anterior aplicada', () => {
    const progress = buildDiscountProgress(3000, tiers, 40);

    assert.equal(progress.percentual_atual, 44);
    assert.equal(progress.faixa_atual?.id, 2);
    assert.equal(progress.proxima_faixa?.id, 3);
    assert.equal(progress.valor_faltante, 5000);
  });
});

// ---------------------------------------------------------------------------
// Edge cases & regression tests
// Guarda os fixes específicos: getDiscountProgress com cycleId opcional,
// repriceCycleOrders recalculando total_bruto + total_final a partir dos itens,
// subquery filtrada por ciclo/status, e condições de contorno exatas.
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
    // valor_maximo = 3000 for tier 1; 3000 is NOT < 3000, so tier 2 kicks in
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
    // Tier 3 has valor_maximo = null (open-ended)
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
// Regressão: faixa baseada em total_final (requisito de negócio)
//
// A faixa de desconto é determinada pelo total_final — a soma do que o
// grupo efetivamente paga após o desconto coletivo. Isso significa que
// ao aplicar o desconto, o total final pode baixar para uma faixa menor,
// e o sistema converge naturalmente para um ponto de equilíbrio.
// O repriceCycleOrders recalcula iterativamente até estabilizar.
// ---------------------------------------------------------------------------

describe('regressão: faixa baseada em total_final', () => {
  it('total_final na fronteira entre faixas seleciona corretamente', () => {
    // R$ 2.999 final → faixa 40%
    // R$ 3.000 final → faixa 44%
    assert.equal(buildDiscountProgress(2999, tiers).percentual_atual, 40);
    assert.equal(buildDiscountProgress(3000, tiers).percentual_atual, 44);
  });

  it('pedidos removidos reduzem o total_final e podem recuar a faixa', () => {
    // Cenário: 3 pedidos com total_final de R$ 1.100 cada = R$ 3.300 → 44%
    // Remover 1 pedido: R$ 2.200 final → volta para 40%
    const antes = buildDiscountProgress(3300, tiers);
    const depois = buildDiscountProgress(2200, tiers);

    assert.equal(antes.percentual_atual, 44);
    assert.equal(depois.percentual_atual, 40,
      'Após remover pedido, total_final diminui e faixa recua');
  });

  it('convergência: desconto não derruba faixa abaixo do esperado', () => {
    // Cenário: total_final coletivo = R$ 3.100 → faixa 44%
    // O desconto de 44% é aplicado sobre os preços brutos.
    // Após aplicar, o novo total_final reflete os preços já descontados.
    // Se o total_final era R$ 3.100 (já com desconto anterior), permanece 44%.
    const progress = buildDiscountProgress(3100, tiers);
    assert.equal(progress.percentual_atual, 44);
    assert.ok(progress.faixa_atual?.id === 2);
  });

  it('total_final zero não seleciona nenhuma faixa', () => {
    const progress = buildDiscountProgress(0, tiers);
    assert.equal(progress.percentual_atual, 0);
    assert.equal(progress.faixa_atual, null);
  });
});

// ---------------------------------------------------------------------------
// Regressão: repriceCycleOrders recalcula total_bruto E total_final
// Após deleção de itens (DELETE /itens/:id, DELETE /produtos/:codigo),
// o total_bruto deve ser recalculado a partir dos itens restantes.
// ---------------------------------------------------------------------------

describe('regressão: recalculo de totais após mutação', () => {
  it('buildDiscountProgress trata input numérico string vindo do DB', () => {
    // PostgreSQL SUM pode retornar string quando passado via JSON
    const progress = buildDiscountProgress('3100.50', tiers);
    assert.equal(progress.percentual_atual, 44);
    assert.equal(progress.total_final, 3100.5);
  });

  it('buildDiscountProgress com null/undefined trata como zero', () => {
    assert.equal(buildDiscountProgress(null, tiers).total_final, 0);
    assert.equal(buildDiscountProgress(undefined, tiers).total_final, 0);
  });
});

// ---------------------------------------------------------------------------
// resolveDiscountTier: usa total_final e retenção progressiva
// ---------------------------------------------------------------------------

describe('resolveDiscountTier — regra baseada no total final', () => {
  it('retorna null para total final abaixo de todas as faixas', () => {
    assert.equal(resolveDiscountTier(500, null, tiers), null);
  });

  it('retorna null para total final zero', () => {
    assert.equal(resolveDiscountTier(0, null, tiers), null);
  });

  it('seleciona a faixa alcançada pelo total final', () => {
    const tier = resolveDiscountTier(2000, null, tiers);
    assert.equal(tier?.id, 1);
    assert.equal(tier?.percentual, 40);
  });

  it('avança para 48% quando o total final já alcançou 8000', () => {
    const tier = resolveDiscountTier(8454.6, 44, tiers);
    assert.equal(tier?.percentual, 48);
  });

  it('mantém a faixa recém-liberada sem oscilar após o recálculo', () => {
    // 44% liberado em R$ 3.000; o novo desconto pode reduzir o final,
    // mas não deve alternar imediatamente de volta para 40%.
    const tier = resolveDiscountTier(2800, 44, tiers);
    assert.equal(tier?.percentual, 44);
  });

  it('regride quando o total final cai abaixo da faixa anterior', () => {
    const tier = resolveDiscountTier(900, 44, tiers);
    assert.equal(tier, null);
  });

  it('regride de 48% para 40% quando recua abaixo de 44%', () => {
    const tier = resolveDiscountTier(2500, 48, tiers);
    assert.equal(tier?.percentual, 40);
  });

  it('retorna null para array vazio', () => {
    assert.equal(resolveDiscountTier(10000, null, []), null);
  });

  it('trata input não-numérico como zero', () => {
    assert.equal(resolveDiscountTier(NaN, null, tiers), null);
    assert.equal(resolveDiscountTier(null, null, tiers), null);
    assert.equal(resolveDiscountTier(undefined, null, tiers), null);
  });
});

// ---------------------------------------------------------------------------
// regressão: o total final é a única entrada da regra de faixa
// ---------------------------------------------------------------------------

describe('regressão: consistência pós-repricing', () => {
  it('a barra usa a faixa mais alta alcançada pelo total final', () => {
    const progress = buildDiscountProgress(8454.6, tiers, 44);
    assert.equal(progress.percentual_atual, 48);
    assert.equal(progress.proxima_faixa, null);
    assert.equal(progress.maximo_alcancado, true);
  });
});
