/**
 * @fileoverview O comprador precisa conferir, a qualquer momento, o carrinho
 * e o desconto coletivo aplicado a cada produto.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const appSource = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const htmlSource = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const cssSource = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');

const PRODUTOS = [
  { codigo: 'A', nome: 'Produto A', preco: 100, embalagem: 1, imagem: '' },
  { codigo: 'B', nome: 'Produto B', preco: 50, embalagem: 1, imagem: '' },
];

function loadApp() {
  const elements = new Map();
  const context = {
    PRODUTOS,
    VARIANTES: [],
    console,
    Intl,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    document: {
      readyState: 'loading',
      addEventListener: () => {},
      getElementById: (id) => elements.get(id) || null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({
        style: {},
        classList: { add: () => {}, remove: () => {}, toggle: () => {} },
        setAttribute: () => {},
        addEventListener: () => {},
        appendChild: () => {},
      }),
      body: {
        classList: { add: () => {}, remove: () => {} },
        appendChild: () => {},
      },
      documentElement: { setAttribute: () => {} },
      hidden: false,
    },
  };
  vm.runInNewContext(`${appSource}\nthis.__app = app;`, context);
  return context.__app;
}

test('aplica o desconto em vigor por unidade com arredondamento de centavos', () => {
  const app = loadApp();
  app.state.discountPct = 48;
  assert.equal(app.applyDiscountTo(100), 52);
  assert.equal(app.applyDiscountTo(167), 86.84);

  app.state.cart = { A: 2, B: 1 };
  const totals = app.calcTotals();
  assert.equal(totals.bruto, 250);
  assert.equal(totals.total, 130);
  assert.equal(totals.economia, 120);
  assert.equal(totals.pct, 48);
});

test('o preço do card mostra valor final, valor cheio e percentual', () => {
  const app = loadApp();
  app.state.discountPct = 48;
  const html = app.renderPriceHtml(100);
  assert.match(html, /R\$ 52,00/);
  assert.match(html, /price-original/);
  assert.match(html, /R\$ 100,00/);
  assert.match(html, /-48%/);
});

test('sem desconto em vigor o card mantém apenas o preço cheio', () => {
  const app = loadApp();
  app.state.discountPct = 0;
  const html = app.renderPriceHtml(100);
  assert.match(html, /R\$ 100,00/);
  assert.doesNotMatch(html, /price-original/);
  assert.doesNotMatch(html, /discount-tag/);
});

test('cards e carrinho usam o mesmo preço com desconto', () => {
  assert.match(appSource, /data-price-code="\$\{p\.codigo\}"/);
  assert.match(appSource, /this\.renderPriceHtml\(p\.preco\)/);
  assert.match(appSource, /updateCatalogPrices\(\)/);
  assert.match(appSource, /Un\.: \$\{fmt\.brl\(produto\.preco\)\} →/);
  assert.match(appSource, /Total com desconto/);
});

test('a fatura mostra unidade com desconto e o percentual aplicado', () => {
  assert.match(appSource, /invoice-discount-note/);
  assert.match(appSource, /→ \$\{fmt\.brl\(unitD\)\} com \$\{pct\}% off/);
});

test('o carrinho rápido fica disponível pela barra fixa', () => {
  assert.match(htmlSource, /id="cartDrawerWrap"/);
  assert.match(htmlSource, /id="cartTotalLabel"/);
  assert.match(htmlSource, /onclick="app\.openCartDrawer\(\)"/);
  assert.match(htmlSource, /Abrir carrinho e conferir descontos/);
  assert.match(appSource, /openCartDrawer\(\)/);
  assert.match(appSource, /renderCartDrawer\(\)/);
  assert.match(appSource, /Close|closeCartDrawer\(\)/);
});

test('o drawer é fechável por Escape, overlay e mantém foco controlado', () => {
  assert.match(appSource, /event\.key === "Escape"/);
  assert.match(appSource, /app\.closeCartDrawer\(\)/);
  assert.match(appSource, /trapCartDrawerFocus/);
  assert.match(appSource, /aria-modal="true"/);
});

test('o polling do desconto atualiza cards e o drawer aberto', () => {
  assert.match(appSource, /this\.updateCatalogPrices\(\);\s*this\.updateCartBar\(\);/s);
  assert.match(appSource, /if \(this\.isCartDrawerOpen\(\)\) this\.renderCartDrawer\(\);/);
});

test('o drawer tem estilos de desktop e de bottom sheet mobile', () => {
  assert.match(cssSource, /\.cart-drawer-wrap/);
  assert.match(cssSource, /\.cart-drawer\s*\{/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*?\.cart-drawer\s*\{[\s\S]*?transform: translateY\(100%\)/);
  assert.match(cssSource, /body\.cart-drawer-open\s*\{\s*overflow: hidden;/);
});
