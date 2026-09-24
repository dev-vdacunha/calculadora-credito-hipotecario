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
  await page.route('https://datosuruguay.com/api/v1/exchange-rates/usd/quote', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ data: { currency: 'usd', bank: 'BROU', buy: 39.45, sell: 40.85, average: 40.15, as_of: '2026-09-23T23:11:02Z' }, meta: { source: 'BROU', unit: 'UYU/USD' } }),
  }));

  assert.equal(await page.title(), 'Calculadora de crédito hipotecario');
  assert.equal(await page.locator('.brand-name').innerText(), 'Calculadora de crédito hipotecario');
  assert.equal(await page.locator('#property-title').innerText(), 'Ingresar el valor del inmueble');
  assert.equal(await page.locator('#cash-title').innerText(), 'Capital necesario para la hipoteca');
  assert.equal(await page.locator('#installments-title').innerText(), 'Valor mensual de las cuotas');
  assert.match(await page.locator('.savings-line').innerText(), /Según tus ahorros/);
  assert.doesNotMatch(await page.locator('.savings-line').innerText(), /estos gastos/);
  assert.match(await page.locator('.reference-note').innerText(), /La simulación incluye honorarios y cargos según la configuración elegida\. Ver configuración/);
  assert.equal(await page.locator('.reference-note a').getAttribute('href'), '#configuracion');
  assert.match(await page.locator('footer').innerText(), /Desarrollado por Víctor da Cunha · 2026/);
  assert.equal(await page.locator('.github-footer-link').getAttribute('href'), 'https://github.com/dev-vdacunha/calculadora-credito-hipotecario');
  assert.equal(await page.evaluate(() => localStorage.length), 0);

  assert.match(await page.locator('#loan-summary').innerText(), /140\.250,00/);
  assert.match(await page.locator('.eligibility').innerText(), /5\.662,75/);
  assert.equal(await page.locator('#maximum-property-price').innerText(), 'USD 141.141,77');
  assert.equal(await page.locator('.term-payment > strong').count(), 5);
  assert.match(await page.locator('.term-payment').first().innerText(), /Otros débitos, primer mes/);

  // Exact amounts commit on Enter/blur, preserve focus and reject invalid drafts.
  const exact = page.getByLabel('Monto del préstamo (USD)', { exact: true });
  assert.equal(await exact.count(), 1, 'Exact loan amount control is available');
  await exact.fill('100050.25');
  assert.match(await page.locator('.loan-amount').innerText(), /140\.250,00/);
  await exact.press('Enter');
  assert.match(await page.locator('.loan-amount').innerText(), /100\.050,25/);
  assert.equal(await exact.evaluate(el => el === document.activeElement), true);
  const markerX = Number(await page.locator('#loan-chart-selection').getAttribute('cx'));
  assert.ok(markerX > 540 && markerX < 560, 'Off-step amount is positioned on the chart');
  for (const invalid of ['', '19999', '165000.01', '100050.251']) {
    await exact.fill(invalid);
    await exact.press('Enter');
    assert.equal(await exact.getAttribute('aria-invalid'), 'true');
    assert.match(await page.locator('.loan-amount').innerText(), /100\.050,25/);
  }
  await exact.fill('99999.99');
  await exact.press('Tab');
  assert.match(await page.locator('#loan-summary .pill').innerText(), /4,75%/);
  assert.equal(await exact.getAttribute('aria-invalid'), 'false');
  const slider = page.locator('#loan-amount-control');
  await slider.focus();
  await slider.press('End');
  assert.equal(Number(await exact.inputValue()), 165000);
  await slider.press('Home');
  assert.equal(Number(await exact.inputValue()), 20000);
  await slider.press('ArrowRight');
  assert.equal(Number(await exact.inputValue()), 20100);
  for (const [draft, key, expected] of [['164999.99', 'End', 165000], ['20000.01', 'Home', 20000], ['99999.99', 'ArrowRight', 100000], ['100000.01', 'ArrowLeft', 100000]]) {
    await exact.fill(draft);
    await exact.press('Enter');
    await slider.focus();
    await slider.press(key);
    assert.equal(Number(await exact.inputValue()), expected, `${key} from ${draft}`);
  }

  assert.equal(await slider.evaluate(el => el === document.activeElement), true);

  await page.locator('#property-price').fill('120000');
  assert.match(await page.locator('.loan-amount').innerText(), /97\.000,00/);
  assert.match(await page.locator('#loan-summary').innerText(), /USD 102\.000,00/);
  assert.match(await page.locator('#loan-slider-status').innerText(), /4,75% TEA/);
  const parseUsd = text => Number(text.match(/cuota a 15 años: USD ([\d.]+,[\d]{2})/i)[1].replaceAll('.', '').replace(',', '.'));
  const minimumNeededQuota = parseUsd(await page.locator('#loan-slider-status').innerText());
  await page.locator('#loan-amount-control').evaluate(element => {
    element.value = '800';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.match(await page.locator('.loan-amount').innerText(), /100\.000,00/);
  assert.match(await page.locator('#loan-summary .pill').innerText(), /3,75%/);
  const lowerTierQuota = parseUsd(await page.locator('#loan-slider-status').innerText());
  assert.ok(lowerTierQuota < minimumNeededQuota);
  await page.locator('#loan-amount-control').evaluate(element => {
    element.value = '900';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.match(await page.locator('.eligibility').innerText(), /Supera el máximo estándar del 85%/);
  assert.match(await page.locator('.eligibility').innerText(), /hasta 95% para ciertos perfiles/);
  await page.locator('#loan-amount-control').evaluate(element => {
    element.value = String(element.max);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.match(await page.locator('.eligibility').innerText(), /supera ese porcentaje y es solo ilustrativo/);
  assert.match(await page.locator('#loan-slider-status').innerText(), /cuota a 15 años/);

  await page.locator('#property-price').fill('195000');
  assert.match(await page.locator('.loan-amount').innerText(), /165\.750,00/);
  assert.match(await page.locator('#loan-summary').innerText(), /161\.490,75/);
  assert.match(await page.locator('#cash-breakdown').innerText(), /33\.509,25/);
  assert.match(await page.locator('.cash-shortfall').innerText(), /47\.783,25/);
  assert.match(await page.locator('.cash-shortfall').innerText(), /12\.783,25/);
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
  assert.equal(await page.locator('.setting-row').count(), 14);
  assert.equal(await page.locator('.settings-section').count(), 4);
  assert.deepEqual(await page.locator('.settings-section > h2').allTextContents(), ['Financiamiento', 'Honorarios y cotizaciones', 'Cargos bancarios', 'Seguros']);
  assert.equal(await page.locator('.tier-editor').count(), 2);
  assert.equal(await page.locator('.tier-editor').nth(0).locator('tbody tr').count(), 2);
  assert.equal(await page.locator('.tier-editor').nth(1).locator('tbody tr').count(), 2);
  assert.ok(await page.locator('input').count() >= 21);
  assert.equal(await page.locator('select').count(), 1);
  assert.equal(await page.locator('code').count(), 0);
  const settingsText = await page.locator('.settings-card').innerText();
  for (const technicalKey of ['uiUyu', 'teaPercent', 'savingsUsd', 'maxLoanUsd', 'financingLimitBasis']) assert.doesNotMatch(settingsText, new RegExp(technicalKey));
  assert.match(settingsText, /Ahorros disponibles/);
  assert.match(settingsText, /Tasas por monto solicitado/);
  assert.equal(await page.locator('#config-field-9').inputValue(), '1.415');
  assert.match(await page.locator('#config-field-8-description').innerText(), /montos menores a USD 30\.000.*1,5% con tope de USD 1\.500/);
  assert.match(await page.locator('#config-field-8-description').innerText(), /no publica una tarifa general para compra.*USD 850/);
  assert.doesNotMatch(await page.locator('.settings-card').innerText(), /primera captura|la captura indica/i);
  assert.match(await page.locator('.quotation-source-card').innerText(), /datos\s*Uruguay/);
  assert.equal(await page.locator('.quotation-source-card .datauruguay-brand-link').getAttribute('href'), 'https://datosuruguay.com/api');
  assert.equal(await page.locator('.quotation-source-links a').count(), 2);
  assert.equal(await page.locator('.datauruguay-brand').count(), 3);
  assert.match(await page.locator('.setting-row').nth(7).innerText(), /venta BROU/i);
  assert.equal(await page.locator('#config-field-6').evaluate(el => getComputedStyle(el).textAlign), 'right');
  assert.equal(await page.locator('#config-field-7').evaluate(el => getComputedStyle(el).textAlign), 'right');
  await page.locator('.tier-editor').nth(0).getByRole('button', { name: 'Agregar tramo' }).click();
  assert.equal(await page.locator('.tier-editor').nth(0).locator('tbody tr').count(), 3);
  const addedRate = page.locator('.tier-editor').nth(0).locator('tbody tr').nth(2).locator('.tier-field');
  await addedRate.nth(0).fill('300000');
  await addedRate.nth(1).fill('3.25');
  assert.match(await page.locator('#config-status').innerText(), /Cambios guardados/);
  assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('calculadora-credito-hipotecario.config.v1')).teaTiers)).length, 3);
  await page.locator('.tier-editor').nth(0).getByRole('button', { name: 'Eliminar tramo 3' }).click();
  assert.equal(await page.locator('.tier-editor').nth(0).locator('tbody tr').count(), 2);
  await page.locator('.tier-editor').nth(1).getByRole('button', { name: 'Agregar tramo' }).click();
  assert.equal(await page.locator('.tier-editor').nth(1).locator('tbody tr').count(), 3);
  await page.locator('.tier-editor').nth(1).getByRole('button', { name: 'Eliminar tramo 3' }).click();
  assert.equal(await page.locator('.tier-editor').nth(1).locator('tbody tr').count(), 2);
  await page.locator('[data-update-quotation="uiUyu"]').click();
  await page.waitForFunction(() => document.querySelector('[data-quotation-status="uiUyu"]').textContent.includes('24/09/2026'));
  assert.equal(await page.locator('#config-field-6').inputValue(), '6.6537');
  assert.match(await page.locator('[data-quotation-status="uiUyu"]').innerText(), /24\/09\/2026/);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('calculadora-credito-hipotecario.config.v1'))), { uiUyu: 6.6537 });
  await page.locator('[data-update-quotation="usdUyu"]').click();
  await page.waitForFunction(() => document.querySelector('[data-quotation-status="usdUyu"]').textContent.includes('23/09/2026'));
  assert.equal(await page.locator('#config-field-7').inputValue(), '40.85', await page.locator('[data-quotation-status="usdUyu"]').innerText());
  assert.match(await page.locator('[data-quotation-status="usdUyu"]').innerText(), /23\/09\/2026.*23:11 UTC/);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('calculadora-credito-hipotecario.config.v1'))), { uiUyu: 6.6537, usdUyu: 40.85 });
  assert.equal(await page.locator('.datauruguay-brand').count(), 5);
  invalidUiResponse = true;
  await page.locator('[data-update-quotation="uiUyu"]').click();
  await page.waitForFunction(() => document.querySelector('[data-quotation-status="uiUyu"]').textContent.includes('no devolvió una cotización válida'));
  assert.equal(await page.locator('#config-field-6').inputValue(), '6.6537');
  assert.match(await page.locator('[data-quotation-status="uiUyu"]').innerText(), /fecha/i);
  await page.locator('#reset-config').click();
  assert.equal(await page.evaluate(() => localStorage.getItem('calculadora-credito-hipotecario.config.v1')), null);
  assert.equal(await page.locator('.tier-editor').nth(0).locator('tbody tr').count(), 2);
  invalidUiResponse = false;
  assert.match(await page.locator('.settings-aside').innerText(), /Editá los valores que quieras/);
  assert.match(await page.locator('.bottom-note').innerText(), /Los resultados son orientativos/);

  const savingsInput = page.locator('#config-field-0');
  await savingsInput.fill('42000');
  assert.equal(await savingsInput.getAttribute('aria-invalid'), 'false');
  assert.match(await page.locator('#config-status').innerText(), /Cambios guardados/);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('calculadora-credito-hipotecario.config.v1'))), { savingsUsd: 42000 });
  await page.locator('#nav-calculator').click();
  assert.match(await page.locator('.savings-line').innerText(), /USD 42\.000,00/);
  const changedMaximum = await page.locator('#maximum-property-price').innerText();
  assert.notEqual(changedMaximum, 'USD 141.141,77');
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
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator('#nav-calculator').click();
    await page.locator('#property-price').waitFor();
    assert.equal(await page.locator('.calculator-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), width < 900 ? 1 : 2);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Calculator overflow ${width}`);
    await page.screenshot({ path: `test-results/calculator-${width}.png`, fullPage: true });
    await page.locator('#nav-settings').click();
    await page.locator('.setting-row').first().waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Settings overflow ${width}`);
    await page.screenshot({ path: `test-results/settings-${width}.png`, fullPage: true });
  }
  // Real pointer dragging, graph separation and keyboard operation at phone width.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#nav-calculator').click();
  await slider.waitFor();
  await slider.scrollIntoViewIfNeeded();
  const track = await slider.boundingBox();
  const graph = await page.locator('.loan-chart-wrap').boundingBox();
  assert.ok(track.height >= 44 && graph.y + graph.height <= track.y);
  await slider.focus();
  await slider.press('Home');
  const scrollBefore = await page.evaluate(() => scrollY);
  await page.mouse.move(track.x + 14, track.y + track.height / 2);
  await page.mouse.down();
  await page.mouse.move(track.x + track.width * .7, track.y + track.height / 2, { steps: 12 });
  await page.mouse.up();
  assert.ok(Number(await exact.inputValue()) > 100000);
  assert.ok(Math.abs(await page.evaluate(() => scrollY) - scrollBefore) < 2, 'Drag preserves scroll');
  await page.locator('#loan-control-panel').screenshot({ path: 'test-results/loan-control-mobile.png' });
  const markerBounds = await page.locator('#loan-chart-selection').boundingBox();
  assert.ok(Math.abs(markerBounds.width - 12) < .2 && Math.abs(markerBounds.height - 12) < .2, `Selection marker remains a 12px circle including its border: ${JSON.stringify(markerBounds)}`);

  await page.locator('#property-price').fill('1000000000000');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Large amounts fit');
  await page.locator('#property-price').fill('10000');
  assert.equal(await exact.count(), 0);
  assert.match(await page.locator('#loan-summary').innerText(), /Tus ahorros cubren la compra/);

  // A mobile context exercises Chromium touch input, not a synthetic input event.
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const touchPage = await mobile.newPage();
  await touchPage.goto(page.url().split('#')[0]);
  const touchSlider = touchPage.locator('#loan-amount-control');
  await touchSlider.scrollIntoViewIfNeeded();
  const touchTrack = await touchSlider.boundingBox();
  await touchPage.touchscreen.tap(touchTrack.x + 15, touchTrack.y + 24);
  assert.ok(Number(await touchPage.locator('#loan-amount-exact').inputValue()) < 30000);
  const cdp = await mobile.newCDPSession(touchPage);
  const point = { x: touchTrack.x + 15, y: touchTrack.y + 24 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  for (let step = 1; step <= 10; step++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x + (touchTrack.width - 30) * step / 10, y: point.y }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.ok(Number(await touchPage.locator('#loan-amount-exact').inputValue()) > 150000);
  await touchPage.locator('#nav-settings').click();
  await touchPage.locator('#config-field-0').fill('0');
  await touchPage.locator('#nav-calculator').click();
  await touchPage.locator('#property-price').fill('20000');
  await touchPage.locator('#loan-amount-exact').fill('20000');
  await touchPage.locator('#loan-amount-exact').press('Enter');
  await touchSlider.focus();
  await touchSlider.press('End');
  assert.equal(Number(await touchPage.locator('#loan-amount-exact').inputValue()), 20000);
  assert.equal(await touchPage.locator('#loan-chart-selection').getAttribute('cx'), '0.00');
  await touchPage.locator('#property-price').fill('19999');
  assert.equal(await touchSlider.count(), 0);
  assert.match(await touchPage.locator('#loan-summary').innerText(), /No hay un monto válido/);
  await mobile.close();
  assert.deepEqual(errors, []);
  console.log('Browser checks passed: exact copy, dynamic 85% loan, local overrides, reload/reset/invalid settings, GitHub link, currency cycling and exact amounts, mouse/touch dragging and widths 320/390/768/1024/1440.');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
