import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');

function loadApp(progressElement) {
  const context = vm.createContext({
    console,
    document: {
      readyState: 'loading',
      addEventListener: () => {},
      getElementById: (id) => id === 'discountProgress' ? progressElement : null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({ classList: { add: () => {}, remove: () => {} } }),
      body: { appendChild: () => {} },
    },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { search: '', pathname: '/' },
    history: { replaceState: () => {} },
    URLSearchParams,
    Intl,
    setTimeout,
    clearTimeout,
  });
  vm.runInContext(source, context);
  return vm.runInContext('app', context);
}

test('barra do comprador mostra percentual atual e próxima meta', () => {
  const element = { hidden: true, innerHTML: '' };
  const app = loadApp(element);
  app.state.discountProgress = {
    total_bruto: 2000,
    percentual_atual: 40,
    progresso_percentual: 50,
    valor_faltante: 1000,
    maximo_alcancado: false,
    faixa_atual: { nome: 'R$ 1.000 a R$ 2.999', percentual: 40 },
    proxima_faixa: { percentual: 44, valor_minimo: 3000 },
    faixas: [
      { percentual: 40, valor_minimo: 1000 },
      { percentual: 44, valor_minimo: 3000 },
    ],
  };

  app.renderDiscountProgress();

  assert.equal(element.hidden, false);
  assert.match(element.innerHTML, /40% de desconto coletivo ativo/);
  assert.match(element.innerHTML, /Próxima faixa: 44%/);
  assert.match(element.innerHTML, /Faltam/);
  assert.match(element.innerHTML, /width:50%/);
});
