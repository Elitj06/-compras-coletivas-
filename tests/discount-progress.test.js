import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildDiscountProgress,
  selectDiscountTier,
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

  it('usa o total final, não o bruto, para a faixa exibida', () => {
    const progress = buildDiscountProgress(4397, tiers);

    assert.equal(progress.total_final, 4397);
    assert.equal(progress.percentual_atual, 44);
    assert.equal(progress.proxima_faixa.percentual, 48);
    assert.equal(progress.valor_faltante, 3603);
  });
});
