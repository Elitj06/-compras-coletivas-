/**
 * @fileoverview O app precisa ser instalável (PWA), funcionar com cache do app
 * shell e carregar o catálogo com imagens otimizadas.
 */

import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

const manifest = JSON.parse(await read('../public/manifest.webmanifest'));
const html = await read('../public/index.html');
const sw = await read('../public/sw.js');
const pwa = await read('../public/pwa.js');
const app = await read('../public/app.js');
const css = await read('../public/styles.css');
const vercel = JSON.parse(await read('../vercel.json'));

test('manifest declara identidade, tema e modo standalone', () => {
  assert.equal(manifest.name, 'Compras Coletivas · Vida Forte');
  assert.equal(manifest.short_name, 'Compras Coletivas');
  assert.equal(manifest.start_url, '/?source=pwa');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#0e8a5f');
  assert.equal(manifest.background_color, '#f6f8f7');
  assert.equal(manifest.lang, 'pt-BR');
});

test('manifest oferece ícones 192, 512 e maskable existentes em disco', async () => {
  const sizes = manifest.icons.map((icon) => icon.sizes);
  assert.ok(sizes.includes('192x192'));
  assert.ok(sizes.includes('512x512'));
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'));

  for (const icon of manifest.icons) {
    const file = new URL(`../public${icon.src}`, import.meta.url);
    const info = await stat(file);
    assert.ok(info.size > 0, `${icon.src} não pode estar vazio`);
    const buffer = await readFile(file);
    assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${icon.src} deve ser PNG`);
  }
});

test('HTML liga manifest, ícones, tema e script da PWA', () => {
  assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest"\s*\/?>/);
  assert.match(html, /<link rel="apple-touch-icon"[^>]*href="\/icons\/apple-touch-icon\.png"/);
  assert.match(html, /<link rel="icon"[^>]*href="\/icons\/favicon-32\.png"/);
  assert.match(html, /<meta name="theme-color" content="#0e8a5f"/);
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /id="installAppBtn"/);
  assert.match(html, /<script src="pwa\.js" defer><\/script>/);
});

test('service worker precacheia o app shell e ignora a API autenticada', () => {
  for (const asset of ['/index.html', '/styles.css', '/app.js', '/produtos.js', '/manifest.webmanifest']) {
    assert.ok(sw.includes(`"${asset}"`), `precache deve incluir ${asset}`);
  }
  assert.match(sw, /pathname\.startsWith\("\/api\/"\)/);
  assert.match(sw, /VERSION\s*=/);
  assert.match(sw, /skipWaiting/);
});

test('pwa.js registra o service worker e trata instalação', () => {
  assert.match(pwa, /serviceWorker\.register\("\/sw\.js"/);
  assert.match(pwa, /beforeinstallprompt/);
  assert.match(pwa, /addEventListener\("appinstalled"/);
  assert.match(pwa, /navigator\.onLine/);
});

test('vercel aplica cabeçalhos de cache e tipo corretos', () => {
  const findHeader = (source) =>
    vercel.headers.find((entry) => entry.source === source)?.headers || [];
  const swHeaders = findHeader('/sw.js');
  assert.ok(swHeaders.some((header) => /max-age=0/.test(header.value)), 'sw.js deve revalidar');
  const manifestHeaders = findHeader('/manifest.webmanifest');
  assert.ok(
    manifestHeaders.some((header) => header.value === 'application/manifest+json'),
    'manifest deve ter content-type próprio'
  );
});

test('catálogo usa miniatura do CDN e carrega imagem de forma assíncrona', () => {
  assert.match(app, /function thumbUrl\(/);
  assert.match(app, /vteximg\.com\.br/);
  assert.match(app, /searchParams\.set\("width"/);
  assert.match(app, /decoding="async"/);
  assert.match(app, /requestedTab/);
});

test('SW não cacheia navegação cross-origin nem /api', () => {
  assert.match(sw, /if \(!sameOrigin\) return;/);
  assert.match(sw, /url\.pathname === "\/api" \|\| url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(sw, /APP_SHELL_ASSETS/);
  assert.match(sw, /networkFirstStatic/);
});

test('atualização fica em waiting e aparece no próximo acesso', () => {
  assert.doesNotMatch(sw, /await self\.skipWaiting\(\)/);
  assert.match(sw, /event\.waitUntil\(self\.skipWaiting\(\)\)/);
  assert.match(pwa, /registration\.waiting/);
  assert.match(pwa, /registration\.update\(\)/);
  assert.match(pwa, /trackWorker/);
});

test('offline preserva credenciais e 401 limpa a sessão', () => {
  assert.match(app, /buyerSession\?\.status === 401/);
  assert.match(app, /localStorage\.setItem\("userRegistered", "true"\)/);
  assert.match(app, /navigator\.onLine === false/);
});

test('atributo hidden do HTML vence os displays de autor', () => {
  assert.match(css, /\[hidden\] \{ display: none !important; \}/);
});

test('JS/CSS do shell revalidam para não servir versão antiga', () => {
  const appHeaders = vercel.headers.find((entry) => entry.source === '/app.js')?.headers || [];
  assert.ok(appHeaders.some((header) => header.value.includes('max-age=0')));
});