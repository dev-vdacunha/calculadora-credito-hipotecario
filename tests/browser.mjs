// Optional integration check: npm install --no-save playwright && npx playwright install chromium
// Then: npm run build && node tests/browser.mjs
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve('dist');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const relative = url.pathname.replace(/^\/calculadora\//, '').replace(/^\//, '') || 'index.html';
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) throw new Error('Invalid path');
    const bytes = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(bytes);
  } catch { res.writeHead(404); res.end('Not found'); }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ['--no-sandbox'] });

try {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/calculadora/`);
  await page.locator('#property-price').waitFor();
  let invalidUiResponse = false;
  await page.route('https://datosuruguay.com/api/v1/indexed-units/ui?limit=1', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ data: [{ date: invalidUiResponse ? 'not-a-date' : '2026-09-24', value: 6.6537 }], meta: { source: 'BCU', unit: 'UYU/UI' } }),
  }));
  await page.route('https://datosuruguay.com/api/v1/exchange-rates/usd?limit=1', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ data: [{ date: '2026-09-23', value: 40.049 }], meta: { source: 'BCU', unit: 'UYU/USD' } }),
  }));

  assert.equal(await page.locator('#property-title').innerText(), 'Ingresar el valor del inmueble');
  assert.equal(await page.locator('#cash-title').innerText(), 'Capital necesario para la hipoteca');
  assert.equal(await page.locator('#installments-title').innerText(), 'Valor mensual de las cuotas');
  assert.match(await page.locator('.savings-line').innerText(), /Según tus ahorros/);
  assert.doesNotMatch(await page.locator('.savings-line').innerText(), /estos gastos/);
  assert.match(await page.locator('.reference-note').innerText(), /Valores basados en honorarios y cargos obligatorios del banco\. Ver configuración/);
  assert.equal(await page.locator('.reference-note a').getAttribute('href'), 'https://dev-vdacunha.github.io/calculadora-credito-hipotecario/#configuracion');
  assert.match(await page.locator('footer').innerText(), /Desarrollado por Víctor da Cunha · 2026/);
  assert.equal(await page.locator('.github-footer-link').getAttribute('href'), 'https://github.com/dev-vdacunha/calculadora-credito-hipotecario');
  assert.equal(await page.evaluate(() => localStorage.length), 0);

  assert.match(await page.locator('#loan-summary').innerText(), /140\.250,00/);
  assert.match(await page.locator('.eligibility').innerText(), /5\.662,54/);
  assert.equal(await page.locator('#maximum-property-price').innerText(), 'USD 141.142,53');
  assert.equal(await page.locator('.term-payment > strong').count(), 5);

  await page.locator('#property-price').fill('195000');
  assert.match(await page.locator('.loan-amount').innerText(), /165\.750,00/);
  assert.match(await page.locator('#loan-summary').innerText(), /161\.491,00/);
  assert.match(await page.locator('#cash-breakdown').innerText(), /33\.509,00/);
  assert.match(await page.locator('.cash-shortfall').innerText(), /47\.783,00/);
  assert.match(await page.locator('.cash-shortfall').innerText(), /12\.783,00/);
  assert.match(await page.locator('#installment-note').innerText(), /165\.750,00/);

  await page.locator('#property-price').fill('120000');
  assert.match(await page.locator('.eligibility').innerText(), /alcanzan/);
  assert.equal(await page.locator('.cash-shortfall').count(), 0);
  const pesos = await page.locator('.term-payment > strong').first().textContent();
  assert.ok(pesos.startsWith('$'));
  await page.getByRole('button', { name: 'Moneda siguiente' }).click();
  assert.equal(await page.locator('#currency-label').innerText(), 'UI');
  assert.ok((await page.locator('.term-payment > strong').allTextContents()).every(v => v.startsWith('UI')));

  await page.locator('#nav-settings').click();
  await page.locator('.setting-row').first().waitFor();
  assert.equal(await page.locator('.setting-row').count(), 12);
  assert.equal(await page.locator('input').count(), 11);
  assert.equal(await page.locator('select').count(), 1);
  assert.equal(await page.locator('code').count(), 0);
  const settingsText = await page.locator('.settings-card').innerText();
  for (const technicalKey of ['uiUyu', 'teaPercent', 'savingsUsd', 'maxLoanUsd', 'financingLimitBasis']) assert.doesNotMatch(settingsText, new RegExp(technicalKey));
  assert.match(settingsText, /Ahorros disponibles/);
  assert.match(settingsText, /Tasa efectiva anual/);
  assert.equal(await page.locator('#config-field-9').inputValue(), '1.414872');
  assert.match(await page.locator('.quotation-source-card').innerText(), /Datos Uruguay/);
  assert.equal(await page.locator('.quotation-source-card a').getAttribute('href'), 'https://datosuruguay.com/api');
  assert.equal(await page.locator('#config-field-6').evaluate(el => getComputedStyle(el).textAlign), 'right');
  assert.equal(await page.locator('#config-field-7').evaluate(el => getComputedStyle(el).textAlign), 'right');
  await page.getByRole('button', { name: 'Actualizar desde Datos Uruguay' }).nth(0).click();
  await page.waitForFunction(() => document.querySelector('[data-quotation-status="uiUyu"]').textContent.includes('24/09/2026'));
  assert.equal(await page.locator('#config-field-6').inputValue(), '6.6537');
  assert.match(await page.locator('[data-quotation-status="uiUyu"]').innerText(), /24\/09\/2026/);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('calculadora-credito-hipotecario.config.v1'))), { uiUyu: 6.6537 });
  await page.getByRole('button', { name: 'Actualizar desde Datos Uruguay' }).nth(1).click();
  await page.waitForFunction(() => document.querySelector('[data-quotation-status="usdUyu"]').textContent.includes('23/09/2026'));
  assert.equal(await page.locator('#config-field-7').inputValue(), '40.049', await page.locator('[data-quotation-status="usdUyu"]').innerText());
  assert.match(await page.locator('[data-quotation-status="usdUyu"]').innerText(), /23\/09\/2026/);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('calculadora-credito-hipotecario.config.v1'))), { uiUyu: 6.6537, usdUyu: 40.049 });
  invalidUiResponse = true;
  await page.getByRole('button', { name: 'Actualizar desde Datos Uruguay' }).nth(0).click();
  await page.waitForFunction(() => document.querySelector('[data-quotation-status="uiUyu"]').textContent.includes('no devolvió una cotización válida'));
  assert.equal(await page.locator('#config-field-6').inputValue(), '6.6537');
  assert.match(await page.locator('[data-quotation-status="uiUyu"]').innerText(), /fecha/i);
  await page.locator('#reset-config').click();
  assert.equal(await page.evaluate(() => localStorage.getItem('calculadora-credito-hipotecario.config.v1')), null);
  invalidUiResponse = false;
  assert.match(await page.locator('.settings-aside').innerText(), /Editá los valores que quieras/);
  assert.match(await page.locator('.bottom-note').innerText(), /Los valores por defecto provienen de simulación de créditos hipotecarios en la web/);

  const savingsInput = page.locator('#config-field-0');
  await savingsInput.fill('42000');
  assert.equal(await savingsInput.getAttribute('aria-invalid'), 'false');
  assert.match(await page.locator('#config-status').innerText(), /Cambios guardados/);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('calculadora-credito-hipotecario.config.v1'))), { savingsUsd: 42000 });
  await page.locator('#nav-calculator').click();
  assert.match(await page.locator('.savings-line').innerText(), /USD 42\.000,00/);
  const changedMaximum = await page.locator('#maximum-property-price').innerText();
  assert.notEqual(changedMaximum, 'USD 141.142,53');
  await page.reload();
  assert.match(await page.locator('.savings-line').innerText(), /USD 42\.000,00/);

  await page.locator('#nav-settings').click();
  await page.locator('#reset-config').click();
  assert.equal(await page.evaluate(() => document.activeElement.id), 'reset-config');
  assert.match(await page.locator('#config-status').innerText(), /restaurados/);
  assert.equal(await page.evaluate(() => localStorage.getItem('calculadora-credito-hipotecario.config.v1')), null);
  await page.locator('#nav-calculator').click();
  assert.match(await page.locator('.savings-line').innerText(), /USD 35\.000,00/);

  await page.locator('#nav-settings').click();
  await page.locator('#config-field-0').fill('-1');
  assert.equal(await page.locator('#config-field-0').getAttribute('aria-invalid'), 'true');
  assert.match(await page.locator('#config-field-0-error').innerText(), /válido/);
  assert.equal(await page.evaluate(() => localStorage.getItem('calculadora-credito-hipotecario.config.v1')), null);

  await mkdir('test-results', { recursive: true });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator('#nav-calculator').click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Calculator overflow ${width}`);
    if (width === 390 || width === 1440) await page.screenshot({ path: `test-results/calculator-${width}.png`, fullPage: true });
    await page.locator('#nav-settings').click();
    await page.locator('.setting-row').first().waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Settings overflow ${width}`);
    if (width === 390) await page.screenshot({ path: 'test-results/settings-390.png', fullPage: true });
  }
  assert.deepEqual(errors, []);
  console.log('Browser checks passed: exact copy, dynamic 85% loan, local overrides, reload/reset/invalid settings, GitHub link, currency cycling and widths 320/390/768/1440.');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
