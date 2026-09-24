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
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(bytes);
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
  assert.match(await page.locator('#loan-summary').innerText(), /140\.250,00/);
  assert.match(await page.locator('.eligibility').innerText(), /5\.662,54/);
  assert.equal(await page.locator('#maximum-property-price').innerText(), 'USD 141.142,53');
  await page.locator('#property-price').fill('195000');
  assert.match(await page.locator('.loan-amount').innerText(), /165\.000,00/);
  assert.match(await page.locator('#loan-summary').innerText(), /160\.741,00/);
  assert.match(await page.locator('#cash-breakdown').innerText(), /34\.259,00/);
  assert.match(await page.locator('.cash-shortfall').innerText(), /48\.533,00/);
  assert.match(await page.locator('.cash-shortfall').innerText(), /13\.533,00/);
  assert.equal(await page.locator('.term-payment > strong').count(), 5);
  assert.ok((await page.locator('.term-payment > strong').allTextContents()).every(v => v.startsWith('$')));
  assert.match(await page.locator('#installment-note').innerText(), /165\.000,00/);
  await page.locator('#property-price').fill('120000');
  assert.equal(await page.locator('.term-row').count(), 5);
  assert.match(await page.locator('.eligibility').innerText(), /alcanzan/);
  assert.equal(await page.locator('.cash-shortfall').count(), 0);
  const pesos = await page.locator('.term-payment > strong').first().textContent();
  assert.ok(pesos.startsWith('$'));
  await page.getByRole('button', { name: 'Moneda siguiente' }).click();
  assert.equal(await page.locator('#currency-label').innerText(), 'UI');
  assert.ok((await page.locator('.term-payment > strong').allTextContents()).every(v => v.startsWith('UI')));
  await page.getByRole('button', { name: 'Moneda siguiente' }).click();
  assert.equal(await page.locator('#currency-label').innerText(), 'USD');
  await page.getByRole('button', { name: 'Moneda siguiente' }).click();
  assert.equal(await page.locator('.term-payment > strong').first().textContent(), pesos);
  await page.getByRole('button', { name: 'Moneda anterior' }).click();
  assert.equal(await page.locator('#currency-label').innerText(), 'USD');
  await page.locator('#property-price').fill('');
  assert.match(await page.locator('#cash-breakdown').innerText(), /Ingresá un precio/);
  await page.locator('#property-price').fill('-1');
  assert.equal(await page.locator('#property-price').getAttribute('aria-invalid'), 'true');
  await page.locator('#property-price').fill('20000');
  assert.match(await page.locator('#loan-summary').innerText(), /sin préstamo/);
  assert.match(await page.locator('#cash-breakdown').innerText(), /13\.536,00/);
  await page.locator('#property-price').fill('120000');
  await mkdir('test-results', { recursive: true });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Calculator overflow ${width}`);
    if (width === 390 || width === 1440) await page.screenshot({ path: `test-results/calculator-${width}.png`, fullPage: true });
    await page.locator('#nav-settings').click();
    await page.locator('.setting-row').first().waitFor();
    assert.equal(await page.locator('.setting-row').count(), 14);
    assert.match(await page.locator('.settings-card').innerText(), /0,78 %/);
    assert.match(await page.locator('.settings-card').innerText(), /1,4149 %/);
    assert.equal(await page.locator('input').count(), 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Settings overflow ${width}`);
    if (width === 390) await page.screenshot({ path: 'test-results/settings-390.png', fullPage: true });
    await page.locator('#nav-calculator').click();
    await page.locator('#property-price').waitFor();
    assert.equal(await page.locator('#property-price').inputValue(), '120000');
    assert.equal(await page.locator('#currency-label').innerText(), 'USD');
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.locator('#property-price').fill('1000000000000');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Large amount overflow');
  await page.locator('#property-price').fill('120000');
  // Keyboard focus and activation of currency controls.
  await page.locator('#currency-next').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#currency-label').innerText(), 'UYU');
  assert.equal(await page.evaluate(() => localStorage.length), 0);
  await page.reload();
  assert.equal(await page.locator('#property-price').inputValue(), '165000');
  assert.deepEqual(errors, []);
  console.log('Browser checks passed: bank figures, 5 terms, currency cycling, invalid/empty/cash states, config navigation, keyboard, no storage, subpath, widths 320/390/768/1440.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
