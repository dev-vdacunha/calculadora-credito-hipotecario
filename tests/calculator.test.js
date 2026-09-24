import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { calculate, payment, convert, bankBreakdown, validateConfig, maximumPropertyPrice } from '../src/calculator.js';
const close = (actual, expected, tolerance = 0.005) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const basic = { ...config, administrationUsd: 0, fireInsurancePercent: 0, lifeInsuranceAnnualPercent: 0 };

test('ejemplo original: faltan 1828 pero muestra cuotas sobre el máximo de 140250', () => {
  const r = calculate(165000, basic);
  close(r.notary, 6039); close(r.agency, 6039); close(r.downPayment, 22922);
  close(r.netRequired, 142078); close(r.grossMaximum, 140250); close(r.shortfall, 1828);
  assert.equal(r.status, 'insufficient'); assert.equal(r.installments.length, 5);
  close(r.grossLoan, 140250);
  close(r.installments[0].principalInterest, payment(140250, 3.75, 10));
});
test('desglose exacto de la captura del banco', () => {
  const r = bankBreakdown(195000, 165000, config);
  close(r.net, 160741); close(r.downPayment, 34259);
  close(r.cashRequired, 48533); close(r.shortfall, 13533);
});
test('gastos financiados aumentan vale y faltante', () => {
  const r = calculate(165000, config);
  close(r.grossRequired, 145912.538461538); close(r.shortfall, 5662.538461538); close(r.netMaximum, 136415.461538462);
  const larger = calculate(195000, config);
  close(larger.grossRequired, 178533); close(larger.shortfall, 12783);
  close(larger.grossLoan, 165750); close(larger.netLoan, 161491);
  close(larger.requiredDownPayment, 33509); close(larger.cashRequired, 47783);
  close(larger.fireInsurance, 2759);
  assert.equal(larger.installments.length, 5);
  close(larger.installments[2].total, payment(165750, 3.75, 20) + 165750 * .0078 / 12);
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
  const c = { ...config, savingsUsd: 165000 * .15 + 12078 + 1500 + 2759 * 165000 / 195000 };
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
  close(cash.downPayment, 23018.153846154); close(cash.grossRequired, 96981.846153846);
  close(cash.netRequired, cash.grossRequired);
  const gross = calculate(165000, config);
  close(gross.netMaximum, 136415.461538462); close(gross.grossMaximum, 140250); close(gross.shortfall, 5662.538461538);
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
  for (const key of ['savingsUsd', 'teaPercent', 'vatPercent', 'notaryPercent', 'agencyPercent', 'administrationUsd', 'fireInsurancePercent', 'lifeInsuranceAnnualPercent']) {
    for (const value of [-1, NaN, Infinity, '3']) assert.throws(() => validateConfig({ ...config, [key]: value }), key);
  }
  for (const key of ['uiUyu', 'usdUyu']) assert.throws(() => validateConfig({ ...config, [key]: 0 }));
  assert.doesNotThrow(() => validateConfig({ ...config, maxFinancingPercent: 0 }));
  assert.throws(() => validateConfig({ ...config, maxFinancingPercent: 101 }));
  assert.throws(() => validateConfig({ ...config, bankCostsPayment: 'other' }));
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

test('incendio escala con el precio, se descuenta una vez y vida solo integra la cuota', () => {
  const c = { ...config, savingsUsd: 0 };
  const r = calculate(97500, c);
  close(r.fireInsurance, 1379.5);
  close(r.grossLoan - r.netLoan, 2879.5);
  const withoutLife = calculate(97500, { ...c, lifeInsuranceAnnualPercent: 0 });
  close(r.netLoan, withoutLife.netLoan);
  close(r.cashRequired, withoutLife.cashRequired);
  assert.ok(r.installments[0].total > withoutLife.installments[0].total);
});

test('máximo de vivienda incluye honorarios, incendio y administración', () => {
  const max = maximumPropertyPrice(config);
  close(max, 141142.53);
  assert.equal(calculate(max, config).status, 'eligible');
  assert.equal(calculate(max + .01, config).status, 'insufficient');
  assert.ok(calculate(max + .01, config).shortfall >= .01, 'El faltante no debe mostrarse como USD 0,00');
  close(maximumPropertyPrice(basic), 156810.03);
});

test('máximo coherente para todas las formas de pagar sin tope fijo', () => {
  for (const bankCostsPayment of ['financed', 'cash']) {
    for (const savingsUsd of [0, 1000, 35000, 100000]) {
      const c = { ...config, bankCostsPayment, savingsUsd };
      const max = maximumPropertyPrice(c);
      if (max > 0) assert.notEqual(calculate(max, c).status, 'insufficient', JSON.stringify(c));
      assert.equal(calculate(max + .01, c).status, 'insufficient', JSON.stringify(c));
    }
  }
});

test('máximo permite compra al contado cuando no sirve financiar, y financiación total sin gastos', () => {
  close(maximumPropertyPrice({ ...config, administrationUsd: 100000 }), 32612.74);
  assert.equal(maximumPropertyPrice({ ...basic, maxFinancingPercent: 100, notaryPercent: 0, agencyPercent: 0 }), Infinity);
});

test('si simula un préstamo, el efectivo necesario incluye todos sus cargos en efectivo', () => {
  const c = { ...config, savingsUsd: 0, bankCostsPayment: 'cash', administrationUsd: 20000 };
  const r = calculate(10000, c);
  assert.equal(r.installments.length, 5);
  close(r.cashRequired, r.requiredDownPayment + r.feesTotal + r.upfrontBankCosts);
  close(r.shortfall, r.cashRequired);
});
