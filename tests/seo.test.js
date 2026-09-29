import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const site = 'https://dev-vdacunha.github.io/calculadora-credito-hipotecario/';
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('the initial HTML exposes the canonical URL and a useful summary', () => {
  assert.match(html, new RegExp(`<link rel="canonical" href="${site}"`));
  assert.match(html, /<div id="app">\s*<main[\s\S]*?<h1>Calculadora de crédito hipotecario<\/h1>/);
  assert.match(html, /Calculá cuánto efectivo necesitás y estimá tus cuotas en Uruguay/);
});

test('social metadata uses one absolute image and URL', () => {
  assert.match(html, /<meta property="og:type" content="website"/);
  assert.match(html, new RegExp(`<meta property="og:url" content="${site}"`));
  assert.match(html, new RegExp(`<meta property="og:image" content="${site}social-card.png"`));
  assert.match(html, /<meta name="twitter:card" content="summary_large_image"/);
  assert.match(html, new RegExp(`<meta name="twitter:image" content="${site}social-card.png"`));
});

test('the social image is a 1200 by 630 PNG', async () => {
  const image = await readFile(new URL('../public/social-card.png', import.meta.url));
  assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(image.readUInt32BE(16), 1200);
  assert.equal(image.readUInt32BE(20), 630);
});

test('the sitemap lists the canonical page only', async () => {
  const sitemap = await readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
  assert.equal((sitemap.match(/<loc>/g) || []).length, 1);
  assert.match(sitemap, new RegExp(`<loc>${site}</loc>`));
});
