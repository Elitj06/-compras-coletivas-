/** @fileoverview Integridade e capacidade de exportação do SheetJS local. */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const assetUrl = new URL('../public/vendor/sheetjs-0.20.3/xlsx.full.min.js', import.meta.url);
const expectedSha384 = '127c98d3f1921d0192c5280cc1a20fcd21126eaa0e2d27b17e748c37600ffb7f429269fddacb700016729ead49cb3753';

test('SheetJS is self-hosted with the pinned SHA-384 and exports a workbook', async () => {
  const [asset, html] = await Promise.all([
    readFile(assetUrl),
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  ]);
  assert.equal(createHash('sha384').update(asset).digest('hex'), expectedSha384);
  assert.match(html, /\/vendor\/sheetjs-0\.20\.3\/xlsx\.full\.min\.js/);
  assert.doesNotMatch(html, /https?:\/\/[^"']*(?:sheetjs|xlsx)/i);

  const context = vm.createContext({ console });
  vm.runInContext(asset.toString('utf8'), context);
  assert.equal(context.XLSX.version, '0.20.3');
  const workbook = context.XLSX.utils.book_new();
  const sheet = context.XLSX.utils.aoa_to_sheet([['Produto', 'Quantidade'], ['Teste', 1]]);
  context.XLSX.utils.book_append_sheet(workbook, sheet, 'Pedidos');
  const output = context.XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  assert.ok(output.length > 1000);
});
