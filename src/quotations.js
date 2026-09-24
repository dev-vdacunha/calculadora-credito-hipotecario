export const quotationSources = Object.freeze({
  uiUyu: { url: 'https://datosuruguay.com/api/v1/indexed-units/ui?limit=1', unit: 'UYU/UI' },
  usdUyu: { url: 'https://datosuruguay.com/api/v1/exchange-rates/usd?limit=1', unit: 'UYU/USD' },
});

function validDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date;
}

export async function fetchLatestQuotation(key, fetchImpl = globalThis.fetch) {
  const source = quotationSources[key];
  if (!source) throw new Error('No hay una fuente de actualización para este valor.');
  if (typeof fetchImpl !== 'function') throw new Error('La consulta web no está disponible en este navegador.');

  let response;
  try {
    response = await fetchImpl(source.url, { headers: { Accept: 'application/json' } });
  } catch {
    throw new Error('No se pudo conectar con Datos Uruguay. Conservamos la cotización actual.');
  }
  if (!response?.ok) throw new Error(`Datos Uruguay respondió con error HTTP ${response?.status ?? 'desconocido'}. Conservamos la cotización actual.`);

  let payload;
  try { payload = await response.json(); } catch {
    throw new Error('Datos Uruguay no devolvió JSON válido. Conservamos la cotización actual.');
  }
  const item = Array.isArray(payload?.data) ? payload.data[0] : null;
  if (payload?.meta?.source !== 'BCU' || payload?.meta?.unit !== source.unit || !Number.isFinite(item?.value) || item.value <= 0 || !validDate(item.date)) {
    throw new Error('Datos Uruguay no devolvió una cotización válida con fecha. Conservamos la cotización actual.');
  }
  return { value: item.value, date: item.date };
}
