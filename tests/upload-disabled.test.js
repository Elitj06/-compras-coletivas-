import test from 'node:test';
import assert from 'node:assert/strict';
import upload from '../api/upload-planilha.js';
test('unsafe catalog upload is explicitly disabled', async () => {
  const response = await upload(new Request('https://example.test/api/upload-planilha', { method: 'POST' }));
  assert.equal(response.status, 503); assert.equal((await response.json()).code, 'UPLOAD_TEMPORARILY_DISABLED');
});
