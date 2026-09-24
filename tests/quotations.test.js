import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchLatestQuotation, quotationSources } from '../src/quotations.js';

function response(body, options = {}) {
  return { ok: options.ok ?? true, status: options.status ?? 200, async json() { return body; } };
}

test('descarga y valida la cotización BCU de UI', async () => {
  let requested;
  const result = await fetchLatestQuotation('uiUyu', async url => {
    requested = url;
    return response({ data: [{ date: '2026-10-05', value: 6.6537 }], meta: { source: 'BCU', unit: 'UYU/UI' } });
  });
  assert.equal(requested, quotationSources.uiUyu.url);
  assert.deepEqual(result, { value: 6.6537, date: '2026-10-05' });
});

test('descarga y valida la cotización BCU del dólar', async () => {
  const result = await fetchLatestQuotation('usdUyu', async url => {
    assert.equal(url, quotationSources.usdUyu.url);
    return response({ data: [{ date: '2026-09-23', value: 40.049 }], meta: { source: 'BCU', unit: 'UYU/USD' } });
  });
  assert.deepEqual(result, { value: 40.049, date: '2026-09-23' });
});

test('rejects HTTP errors, missing data, wrong series, nonpositive values and invalid dates', async () => {
  await assert.rejects(fetchLatestQuotation('uiUyu', async () => response({}, { ok: false, status: 503 })), /503/);
  await assert.rejects(fetchLatestQuotation('usdUyu', async () => { throw new Error('offline'); }), /No se pudo conectar/);
  for (const body of [
    { data: [], meta: { source: 'BCU', unit: 'UYU/UI' } },
    { data: [{ date: '2026-09-24', value: 6.65 }], meta: { source: 'BROU', unit: 'UYU/UI' } },
    { data: [{ date: '2026-09-24', value: 0 }], meta: { source: 'BCU', unit: 'UYU/UI' } },
    { data: [{ date: '2026-02-30', value: 6.65 }], meta: { source: 'BCU', unit: 'UYU/UI' } },
    { data: [{ date: 'yesterday', value: 6.65 }], meta: { source: 'BCU', unit: 'UYU/UI' } },
  ]) await assert.rejects(fetchLatestQuotation('uiUyu', async () => response(body)));
});

test('rechaza una clave no asociada a una cotización', async () => {
  await assert.rejects(fetchLatestQuotation('savingsUsd', async () => response({})), /No hay una fuente/);
});
