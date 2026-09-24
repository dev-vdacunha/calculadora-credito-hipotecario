import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import * as calculator from '../src/calculator.js';
const { calculate, payment, convert, bankBreakdown, validateConfig, maximumPropertyPrice, rateForLoan, originationFee } = calculator;
const { loanPaymentCurve, initialLoanAmount, MIN_LOAN_USD, MAX_LOAN_USD } = calculator;
const close = (actual, expected, tolerance = 0.005) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const basic = { ...config, originationFeeTiers: [{ minLoanUsd: 0, percent: 0, capUsd: null }], fireInsurancePercent: 0, lifeInsuranceAnnualPercent: 0, regulatoryDebitAnnualPercent: 0, complementaryServiceAnnualPercent: 0 };

test('ejemplo original: faltan 1828 pero muestra cuotas sobre el máximo de 140250', () => {
  const r = calculate(165000, basic);
  close(r.notary, 6039); close(r.agency, 6039); close(r.downPayment, 22922);
  close(r.netRequired, 142078); close(r.grossMaximum, 140250); close(r.shortfall, 1828);
  assert.equal(r.status, 'insufficient'); assert.equal(r.installments.length, 5);
  close(r.grossLoan, 140250);
  close(r.installments[0].principalInterest, payment(140250, 3.75, 10));
});
test('desglose exacto de la captura del banco', () => {
  const referenceConfig = { ...config, fireInsurancePercent: 2759 / 195000 * 100 };
  const r = bankBreakdown(195000, 165000, referenceConfig);
  close(r.net, 160741); close(r.downPayment, 34259);
  close(r.cashRequired, 48533); close(r.shortfall, 13533);
});
test('gastos financiados aumentan vale y faltante', () => {
  const r = calculate(165000, config);
  close(r.grossRequired, 145912.75); close(r.shortfall, 5662.75); close(r.netMaximum, 136415.25);
  const larger = calculate(195000, config);
  close(larger.grossRequired, 178533.25); close(larger.shortfall, 12783.25);
  close(larger.grossLoan, 165750); close(larger.netLoan, 161490.75);
  close(larger.requiredDownPayment, 33509.25); close(larger.cashRequired, 47783.25);
  close(larger.fireInsurance, 2759.25);
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
  const c = { ...config, savingsUsd: 165000 * .15 + 12078 + 1500 + 165000 * config.fireInsurancePercent / 100 };
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
  close(cash.downPayment, 23064.6686); close(cash.grossRequired, 96935.3314);
  close(cash.netRequired, cash.grossRequired);
  const gross = calculate(165000, config);
  close(gross.netMaximum, 136415.25); close(gross.grossMaximum, 140250); close(gross.shortfall, 5662.75);
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
  for (const key of ['savingsUsd', 'vatPercent', 'notaryPercent', 'agencyPercent', 'fireInsurancePercent', 'regulatoryDebitAnnualPercent', 'complementaryServiceAnnualPercent', 'lifeInsuranceAnnualPercent']) {
    for (const value of [-1, NaN, Infinity, '3']) assert.throws(() => validateConfig({ ...config, [key]: value }), key);
  }
  assert.throws(() => validateConfig({ ...config, teaTiers: [{ minLoanUsd: 10, annualRatePercent: 4.75 }] }));
  assert.throws(() => validateConfig({ ...config, originationFeeTiers: [{ minLoanUsd: 0, percent: 1 }, { minLoanUsd: 0, percent: 2 }] }));
  for (const key of ['uiUyu', 'usdUyu']) assert.throws(() => validateConfig({ ...config, [key]: 0 }));
  assert.doesNotThrow(() => validateConfig({ ...config, maxFinancingPercent: 0 }));
  assert.throws(() => validateConfig({ ...config, maxFinancingPercent: 101 }));
  assert.throws(() => validateConfig({ ...config, bankCostsPayment: 'other' }));
});
test('cargos mayores que el máximo no permiten financiar compra', () => {
  const r = calculate(10000, { ...config, savingsUsd: 0, fireInsurancePercent: 100 });
  assert.equal(r.netMaximum, 0); assert.equal(r.status, 'insufficient');
});
test('identifica cuando cargos consumen toda la financiación útil', () => {
  const r = calculate(10000, { ...config, savingsUsd: 0, fireInsurancePercent: 100 });
  assert.equal(r.noUsefulFinancing, true);
  close(r.cashRequired, 10732);
});
test('rechaza cotizaciones que desbordan las conversiones', () => {
  assert.throws(() => convert(1000, 'UI', { ...config, uiUyu: Number.MIN_VALUE }));
  assert.throws(() => calculate(120000, { ...config, uiUyu: Number.MIN_VALUE }));
});

test('incendio escala con el precio, se descuenta una vez y vida solo integra la cuota', () => {
  const c = { ...config, savingsUsd: 0, originationFeeTiers: [{ minLoanUsd: 0, percent: 0, capUsd: null }] };
  const r = calculate(97500, c);
  close(r.fireInsurance, 1379.625);
  close(r.grossLoan - r.netLoan, 1379.625);
  const withoutLife = calculate(97500, { ...c, lifeInsuranceAnnualPercent: 0 });
  close(r.netLoan, withoutLife.netLoan);
  close(r.cashRequired, withoutLife.cashRequired);
  assert.ok(r.installments[0].total > withoutLife.installments[0].total);
});

test('máximo de vivienda incluye honorarios, incendio y administración', () => {
  const max = maximumPropertyPrice(config);
  close(max, 141141.77);
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

test('máximo permite compra al contado y respeta el tope absoluto del préstamo', () => {
  assert.equal(maximumPropertyPrice({ ...config, savingsUsd: 0 }), 0);
  assert.equal(maximumPropertyPrice({ ...basic, maxFinancingPercent: 100, notaryPercent: 0, agencyPercent: 0 }), 785000);
});

test('si simula un préstamo, el efectivo necesario incluye todos sus cargos en efectivo', () => {
  const c = { ...config, savingsUsd: 0, bankCostsPayment: 'cash', originationFeeTiers: [{ minLoanUsd: 0, percent: 200, capUsd: null }] };
  const r = calculate(10000, c);
  assert.equal(r.installments.length, 5);
  close(r.cashRequired, r.requiredDownPayment + r.feesTotal + r.upfrontBankCosts);
  close(r.shortfall, r.cashRequired);
});

test('selecciona TEA por vale bruto en los bordes de cada tramo', () => {
  assert.equal(rateForLoan(99999, config), 4.75);
  assert.equal(rateForLoan(100000, config), 3.75);
  const lower = calculate(99999, { ...config, savingsUsd: 0 });
  const higher = calculate(120000, { ...config, savingsUsd: 0 });
  assert.equal(lower.teaPercent, 4.75);
  assert.equal(higher.teaPercent, 3.75);
});

test('calcula gastos de otorgamiento por tramo y tope', () => {
  close(originationFee(29999.99, config), 749.99975);
  close(originationFee(30000, config), 450);
  close(originationFee(100000, config), 1500);
  close(originationFee(200000, config), 1500);
});

test('separa débitos regulatorios y complementarios del primer mes', () => {
  const result = calculate(195000, config);
  const installment = result.installments.find(item => item.years === 20);
  const monthlyRate = Math.expm1(Math.log1p(3.75 / 100) / 12);
  const balanceAfterFirst = result.grossLoan - (installment.principalInterest - result.grossLoan * monthlyRate);
  close(installment.accountDebits, balanceAfterFirst * (0.1 + 0.345) / 100 / 12);
  close(installment.accountDebitRateAnnual, 0.445);
  close(installment.total, installment.principalInterest + installment.lifeInsurance);
});

test('acepta un vale bruto elegido y separa el máximo estándar del máximo de simulación', () => {
  const needed = calculate(120000, config);
  const chosen = calculate(120000, config, 100000);
  assert.equal(chosen.grossLoan, 100000);
  assert.equal(chosen.standardMaximum, 102000);
  assert.equal(chosen.grossMaximum, 102000);
  assert.equal(chosen.simulationMaximum, 120000);
  assert.equal(chosen.teaPercent, 3.75);
  assert.equal(needed.teaPercent, 4.75);
  assert.ok(chosen.installments.find(item => item.years === 15).total < needed.installments.find(item => item.years === 15).total);
  close(chosen.cashRequired, chosen.feesTotal + chosen.upfrontBankCosts + chosen.requiredDownPayment);
});

test('simula sobre el 85% hasta el precio de la vivienda y avisa sin cortar los cálculos', () => {
  const chosen = calculate(120000, config, 110000);
  assert.equal(chosen.grossLoan, 110000);
  assert.equal(chosen.overFinancingLimit, true);
  assert.equal(chosen.status, 'eligible');
  assert.ok(chosen.installments.length > 0);
  const standard = calculate(120000, config, 100000);
  assert.equal(standard.overFinancingLimit, false);
});

test('el vale elegido descuenta los gastos financiados o los suma al efectivo requerido', () => {
  const financed = calculate(120000, config, 100000);
  const cash = calculate(120000, { ...config, bankCostsPayment: 'cash' }, 100000);
  assert.ok(financed.netLoan < cash.netLoan);
  assert.ok(financed.financedCosts > 0);
  assert.equal(cash.financedCosts, 0);
  assert.ok(cash.upfrontBankCosts > 0);
  close(financed.cashRequired, financed.feesTotal + financed.requiredDownPayment);
  close(cash.cashRequired, cash.feesTotal + cash.upfrontBankCosts + cash.requiredDownPayment);
});

test('limita escenarios a los montos publicados para vivienda principal', () => {
  assert.equal(MIN_LOAN_USD, 20000);
  assert.equal(MAX_LOAN_USD, 750000);
  assert.throws(() => calculate(120000, config, 19900), /mínimo|rango/i);
  assert.throws(() => calculate(120000, config, 120100), /máximo|rango/i);
  const capped = calculate(900000, config, 750000);
  assert.equal(capped.grossMaximum, 750000);
  assert.equal(capped.simulationMaximum, 750000);
  assert.throws(() => calculate(900000, config, 750100), /máximo|rango/i);
  assert.deepEqual(loanPaymentCurve(19999, config).points, []);
});

test('la curva mensual usa pasos de USD 100, conserva el extremo y aplica los tramos de TEA', () => {
  const curve = loanPaymentCurve(120050, config);
  assert.equal(curve.points[0].grossLoanUsd, 20000);
  assert.equal(curve.points.at(-1).grossLoanUsd, 120050);
  const beforeTier = curve.points.find(point => point.grossLoanUsd === 99900);
  const atTier = curve.points.find(point => point.grossLoanUsd === 100000);
  assert.equal(beforeTier.teaPercent, 4.75);
  assert.equal(atTier.teaPercent, 3.75);
  assert.ok(atTier.monthlyPaymentUsd < beforeTier.monthlyPaymentUsd);
  assert.equal(curve.minimum.grossLoanUsd, 20000);
  assert.equal(curve.points.at(-2).grossLoanUsd, 120000);
  assert.equal(curve.points.at(-1).grossLoanUsd - curve.points.at(-2).grossLoanUsd, 50);
});

test('el monto inicial cubre la necesidad según ahorros y respeta el tope estándar', () => {
  const calculated = calculate(120000, config);
  const initial = initialLoanAmount(120000, config);
  assert.equal(initial, 97000);
  assert.ok(initial >= calculated.grossRequired);
  assert.ok(initial <= calculated.grossMaximum);
  assert.equal(initialLoanAmount(20000, config), 0);
  assert.equal(initialLoanAmount(19999, { ...config, savingsUsd: 0 }), null);
});

test('el default de seguro de incendio es 1,415%', () => {
  assert.equal(config.fireInsurancePercent, 1.415);
  close(calculate(120000, config).fireInsurance, 1698);
});
