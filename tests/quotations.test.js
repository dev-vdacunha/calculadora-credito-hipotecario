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
  assert.deepEqual(result, { value: 6.6537, date: '2026-10-05', attributionUrl: quotationSources.uiUyu.attributionUrl });
});

test('descarga y valida la cotización de venta BROU del dólar', async () => {
  let requested;
  const result = await fetchLatestQuotation('usdUyu', async url => {
    requested = url;
    return response({
      data: { currency: 'usd', bank: 'BROU', buy: 39.45, sell: 40.85, average: 40.15, as_of: '2026-09-23T23:11:02Z' },
      meta: { source: 'BROU', unit: 'UYU/USD', attribution: { url: 'https://datosuruguay.com/dolar?utm_source=api' } },
    });
  });
  assert.equal(requested, 'https://datosuruguay.com/api/v1/exchange-rates/usd/quote');
  assert.equal(quotationSources.usdUyu.rateType, 'sell');
  assert.deepEqual(result, { value: 40.85, date: '2026-09-23T23:11:02Z', attributionUrl: quotationSources.usdUyu.attributionUrl });
});

test('la cotización del dólar usa la venta BROU aunque difiera de compra y promedio', async () => {
  const result = await fetchLatestQuotation('usdUyu', async () => response({
    data: { currency: 'usd', bank: 'BROU', buy: 38.9, sell: 41.2, average: 40.05, as_of: '2026-09-24T14:30:00Z' },
    meta: { source: 'BROU', unit: 'UYU/USD', attribution: { url: 'https://datosuruguay.com/dolar' } },
  }));
  assert.equal(result.value, 41.2);
});

test('rejects HTTP errors, missing data, wrong series, nonpositive values and invalid dates', async () => {
  await assert.rejects(fetchLatestQuotation('uiUyu', async () => response({}, { ok: false, status: 503 })), /503/);
  await assert.rejects(fetchLatestQuotation('usdUyu', async () => { throw new Error('offline'); }), /No se pudo conectar/);
  for (const [key, body] of [
    ['uiUyu', { data: [], meta: { source: 'BCU', unit: 'UYU/UI' } }],
    ['uiUyu', { data: [{ date: '2026-09-24', value: 6.65 }], meta: { source: 'BROU', unit: 'UYU/UI' } }],
    ['uiUyu', { data: [{ date: '2026-09-24', value: 0 }], meta: { source: 'BCU', unit: 'UYU/UI' } }],
    ['uiUyu', { data: [{ date: '2026-02-30', value: 6.65 }], meta: { source: 'BCU', unit: 'UYU/UI' } }],
    ['uiUyu', { data: [{ date: 'yesterday', value: 6.65 }], meta: { source: 'BCU', unit: 'UYU/UI' } }],
    ['usdUyu', { data: { currency: 'usd', bank: 'BROU', buy: 39.45, average: 40.15, as_of: '2026-09-23T23:11:02Z' }, meta: { source: 'BROU', unit: 'UYU/USD', attribution: { url: 'https://datosuruguay.com/dolar' } } }],
    ['usdUyu', { data: { currency: 'usd', bank: 'BROU', buy: 39.45, sell: 0, as_of: '2026-09-23T23:11:02Z' }, meta: { source: 'BROU', unit: 'UYU/USD' } }],
    ['usdUyu', { data: { currency: 'usd', bank: 'BROU', buy: 39.45, sell: 40.85, as_of: 'not-a-timestamp' }, meta: { source: 'BROU', unit: 'UYU/USD' } }],
  ]) await assert.rejects(fetchLatestQuotation(key, async () => response(body)));
});

test('rechaza una clave no asociada a una cotización', async () => {
  await assert.rejects(fetchLatestQuotation('savingsUsd', async () => response({})), /No hay una fuente/);
});
