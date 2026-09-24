import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { calculate, payment, convert, bankBreakdown, validateConfig } from '../src/calculator.js';
const close = (actual, expected, tolerance = 0.005) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const basic = { ...config, administrationUsd: 0, fireInsuranceUsd: 0, lifeInsuranceAnnualPercent: 0 };

test('ejemplo original: 165000 requiere 142078 y bloquea cuotas por 1828', () => {
  const r = calculate(165000, basic);
  close(r.notary, 6039); close(r.agency, 6039); close(r.downPayment, 22922);
  close(r.netRequired, 142078); close(r.grossMaximum, 140250); close(r.shortfall, 1828);
  assert.equal(r.status, 'insufficient'); assert.equal(r.installments.length, 0);
});
test('desglose exacto de la captura del banco', () => {
  const r = bankBreakdown(195000, 165000, config);
  close(r.net, 160741); close(r.downPayment, 34259);
  close(r.cashRequired, 48533); close(r.shortfall, 13533);
});
test('gastos financiados aumentan vale y faltante', () => {
  const r = calculate(165000, config);
  close(r.grossRequired, 146337); close(r.shortfall, 6087); close(r.netMaximum, 135991);
  const larger = calculate(195000, config);
  close(larger.grossRequired, 178533); close(larger.shortfall, 12783);
});
test('compra viable tiene los cinco plazos y seguro de vida separado', () => {
  const r = calculate(120000, config);
  assert.equal(r.status, 'eligible');
  assert.deepEqual(r.installments.map(i => i.years), [10, 15, 20, 25, 30]);
  assert.ok(r.installments[0].total > r.installments[4].total);
  for (const i of r.installments) {
    close(i.lifeInsurance, r.grossRequired * 0.0078 / 12);
    close(i.total, i.principalInterest + i.lifeInsurance);
  }
});
test('umbral de entrega exacto se admite', () => {
  const c = { ...config, savingsUsd: 165000 * .15 + 12078 + 4259 };
  assert.equal(calculate(165000, c).status, 'eligible');
  assert.equal(calculate(165000, { ...c, savingsUsd: c.savingsUsd - .01 }).status, 'insufficient');
});
test('honorarios mayores a ahorros no generan entrega negativa', () => {
  const r = calculate(165000, { ...config, savingsUsd: 1000 });
  assert.equal(r.downPayment, 0); assert.equal(r.status, 'insufficient');
  close(r.feesShortfall, 11078);
});
test('compra al contado no cobra cargos bancarios', () => {
  const r = calculate(20000, config);
  assert.equal(r.status, 'cash'); assert.equal(r.grossRequired, 0);
  assert.equal(r.bankCosts, 0); assert.equal(r.installments.length, 0);
  close(r.cashRequired, 21464); close(r.remainingSavings, 13536);
});
test('gastos pagados en efectivo y límite sobre líquido', () => {
  const cash = calculate(120000, { ...config, bankCostsPayment: 'cash' });
  close(cash.downPayment, 21957); close(cash.grossRequired, 98043);
  close(cash.netRequired, cash.grossRequired);
  const net = calculate(165000, { ...config, financingLimitBasis: 'net' });
  close(net.netMaximum, 140250); close(net.grossMaximum, 144509); close(net.shortfall, 1828);
});
test('tasas cero y mensual efectiva, con valor independiente conocido', () => {
  close(payment(120000, 0, 10), 1000);
  close(payment(100000, 3.75, 20), 589.61745359586);
});
test('conversiones entre USD, UYU y UI', () => {
  close(convert(1000, 'USD', config), 1000);
  close(convert(1000, 'UYU', config), 41052);
  close(convert(1000, 'UI', config) * config.uiUyu, 41052);
});
test('valida precio y todos los parámetros numéricos', () => {
  for (const price of [0, -1, NaN, Infinity, '', '165000']) assert.throws(() => calculate(price, config));
  for (const key of ['savingsUsd', 'teaPercent', 'vatPercent', 'notaryPercent', 'agencyPercent', 'administrationUsd', 'fireInsuranceUsd', 'lifeInsuranceAnnualPercent']) {
    for (const value of [-1, NaN, Infinity, '3']) assert.throws(() => validateConfig({ ...config, [key]: value }), key);
  }
  for (const key of ['uiUyu', 'usdUyu', 'maxFinancingPercent']) assert.throws(() => validateConfig({ ...config, [key]: 0 }));
  assert.throws(() => validateConfig({ ...config, maxFinancingPercent: 101 }));
  assert.throws(() => validateConfig({ ...config, bankCostsPayment: 'other' }));
  assert.throws(() => validateConfig({ ...config, financingLimitBasis: 'other' }));
});
test('tope menor que cargos no permite financiar compra', () => {
  const r = calculate(10000, { ...config, savingsUsd: 0, administrationUsd: 20000 });
  assert.equal(r.netMaximum, 0); assert.equal(r.status, 'insufficient');
});
test('identifica cuando cargos consumen toda la financiación útil', () => {
  const r = calculate(10000, { ...config, savingsUsd: 0, administrationUsd: 20000 });
  assert.equal(r.noUsefulFinancing, true);
  close(r.cashRequired, 10732);
});
test('rechaza cotizaciones que desbordan las conversiones', () => {
  assert.throws(() => convert(1000, 'UI', { ...config, uiUyu: Number.MIN_VALUE }));
  assert.throws(() => calculate(120000, { ...config, uiUyu: Number.MIN_VALUE }));
});
