export const quotationSources = Object.freeze({
  uiUyu: {
    url: 'https://datosuruguay.com/api/v1/indexed-units/ui?limit=1',
    unit: 'UYU/UI',
    provider: 'BCU',
    shape: 'series',
    attributionUrl: 'https://datosuruguay.com/ui?utm_source=api&utm_medium=attribution&utm_campaign=backlinks',
  },
  usdUyu: {
    url: 'https://datosuruguay.com/api/v1/exchange-rates/usd/quote',
    unit: 'UYU/USD',
    provider: 'BROU',
    shape: 'quote',
    rateType: 'sell',
    attributionUrl: 'https://datosuruguay.com/dolar?utm_source=api&utm_medium=attribution&utm_campaign=backlinks',
  },
});

function validDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date;
}

function validTimestamp(timestamp) {
  return typeof timestamp === 'string' && !Number.isNaN(Date.parse(timestamp));
}

function invalidQuotation() {
  return new Error('La fuente no devolvió una cotización válida con fecha. Conservamos el valor actual.');
}

export async function fetchLatestQuotation(key, fetchImpl = globalThis.fetch) {
  const source = quotationSources[key];
  if (!source) throw new Error('No hay una fuente de actualización para este valor.');
  if (typeof fetchImpl !== 'function') throw new Error('La consulta web no está disponible en este navegador.');

  let response;
  try {
    response = await fetchImpl(source.url, { headers: { Accept: 'application/json' } });
  } catch {
    throw new Error('No se pudo conectar con la fuente de cotizaciones. Conservamos el valor actual.');
  }
  if (!response?.ok) throw new Error(`La fuente de cotizaciones respondió con error HTTP ${response?.status ?? 'desconocido'}. Conservamos el valor actual.`);

  let payload;
  try { payload = await response.json(); } catch {
    throw new Error('La fuente de cotizaciones no devolvió JSON válido. Conservamos el valor actual.');
  }
  if (payload?.meta?.source !== source.provider || payload?.meta?.unit !== source.unit) throw invalidQuotation();

  if (source.shape === 'quote') {
    const quote = payload.data;
    if (quote?.currency !== 'usd' || quote?.bank !== 'BROU' || !Number.isFinite(quote[source.rateType]) || quote[source.rateType] <= 0 || !validTimestamp(quote.as_of)) throw invalidQuotation();
    return { value: quote[source.rateType], date: quote.as_of, attributionUrl: source.attributionUrl };
  }

  const item = Array.isArray(payload?.data) ? payload.data[0] : null;
  if (!Number.isFinite(item?.value) || item.value <= 0 || !validDate(item.date)) throw invalidQuotation();
  return { value: item.value, date: item.date, attributionUrl: source.attributionUrl };
}
