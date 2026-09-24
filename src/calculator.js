export const TERMS = Object.freeze([10, 15, 20, 25, 30]);
export const MIN_LOAN_USD = 20000;
export const MAX_LOAN_USD = 750000;
export const LOAN_STEP_USD = 100;

function validTierList(tiers, kind) {
  if (!Array.isArray(tiers) || tiers.length === 0) return false;
  let previous = -Infinity;
  for (const tier of tiers) {
    if (!tier || typeof tier !== 'object' || !Number.isFinite(tier.minLoanUsd) || tier.minLoanUsd < 0 || tier.minLoanUsd <= previous) return false;
    if (kind === 'tea' && (!Number.isFinite(tier.annualRatePercent) || tier.annualRatePercent < 0)) return false;
    if (kind === 'fee' && (!Number.isFinite(tier.percent) || tier.percent < 0 || (tier.capUsd !== null && (!Number.isFinite(tier.capUsd) || tier.capUsd < 0)))) return false;
    previous = tier.minLoanUsd;
  }
  return tiers[0].minLoanUsd === 0;
}

export function validateTeaTiers(tiers) {
  if (!validTierList(tiers, 'tea')) throw new Error('Los tramos de TEA deben comenzar en 0 y tener mínimos ascendentes y únicos.');
}

export function validateOriginationFeeTiers(tiers) {
  if (!validTierList(tiers, 'fee')) throw new Error('Los tramos de gastos deben comenzar en 0 y tener mínimos ascendentes y únicos.');
}

export function validateConfig(c) {
  const nonnegative = ['savingsUsd', 'vatPercent', 'notaryPercent', 'agencyPercent', 'fireInsurancePercent', 'regulatoryDebitAnnualPercent', 'complementaryServiceAnnualPercent', 'lifeInsuranceAnnualPercent'];
  for (const key of [...nonnegative, 'maxFinancingPercent', 'uiUyu', 'usdUyu']) {
    if (typeof c[key] !== 'number' || !Number.isFinite(c[key]) || c[key] < 0) throw new Error(`Configuración inválida: ${key} debe ser un número finito no negativo.`);
  }
  if (c.maxFinancingPercent > 100) throw new Error('La financiación debe estar entre 0% y 100%.');
  if (c.uiUyu <= 0 || c.usdUyu <= 0) throw new Error('Las cotizaciones deben ser mayores que cero.');
  if (!['financed', 'cash'].includes(c.bankCostsPayment)) throw new Error('bankCostsPayment debe ser financed o cash.');
  validateTeaTiers(c.teaTiers);
  validateOriginationFeeTiers(c.originationFeeTiers);
}

export function rateForLoan(grossLoan, c) {
  validateTeaTiers(c.teaTiers);
  const tier = [...c.teaTiers].reverse().find(item => item.minLoanUsd <= grossLoan);
  return tier?.annualRatePercent ?? c.teaTiers[0].annualRatePercent;
}

export function originationFee(principalBeforeFee, c) {
  validateOriginationFeeTiers(c.originationFeeTiers);
  const tier = [...c.originationFeeTiers].reverse().find(item => item.minLoanUsd <= principalBeforeFee) ?? c.originationFeeTiers[0];
  const raw = principalBeforeFee * tier.percent / 100;
  return tier.capUsd === null ? raw : Math.min(raw, tier.capUsd);
}

export function payment(principal, teaPercent, years) {
  const rate = Math.expm1(Math.log1p(teaPercent / 100) / 12);
  return rate === 0 ? principal / (years * 12) : principal * rate / -Math.expm1(-years * 12 * Math.log1p(rate));
}

function validatePrice(price) {
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || price > 1e12) throw new Error('Ingresá un precio mayor que cero y de hasta USD 1.000.000.000.000.');
}

function simulationMaximum(price) {
  return Math.min(price, MAX_LOAN_USD);
}

function standardMaximum(price, c) {
  return Math.min(price * c.maxFinancingPercent / 100, MAX_LOAN_USD);
}

function validateSelectedLoan(price, amount) {
  const max = simulationMaximum(price);
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < MIN_LOAN_USD || amount > max) {
    throw new Error(`El monto debe respetar el mínimo de USD ${MIN_LOAN_USD.toLocaleString('es-UY')} y el máximo simulable de USD ${max.toLocaleString('es-UY')}.`);
  }
}

/** Cuotas estimadas a 15 años para cada valor seleccionable del control. */
export function loanPaymentCurve(price, c) {
  validateConfig(c);
  validatePrice(price);
  const maximum = simulationMaximum(price);
  const standardCap = standardMaximum(price, c);
  if (maximum < MIN_LOAN_USD) return { points: [], minimum: null, simulationMaximum: maximum, standardMaximum: standardCap };

  const amounts = new Set();
  for (let amount = MIN_LOAN_USD; amount <= maximum; amount += LOAN_STEP_USD) amounts.add(amount);
  if (standardCap >= MIN_LOAN_USD && standardCap <= maximum) amounts.add(standardCap);
  amounts.add(maximum);

  const points = [...amounts].sort((a, b) => a - b).map(grossLoanUsd => {
    const teaPercent = rateForLoan(grossLoanUsd, c);
    const principalInterest = payment(grossLoanUsd, teaPercent, 15);
    const lifeInsurance = grossLoanUsd * c.lifeInsuranceAnnualPercent / 100 / 12;
    return { grossLoanUsd, teaPercent, monthlyPaymentUsd: principalInterest + lifeInsurance };
  });
  const minimum = points.reduce((best, point) => point.monthlyPaymentUsd < best.monthlyPaymentUsd ? point : best, points[0]);
  return { points, minimum, simulationMaximum: maximum, standardMaximum: standardCap };
}

/** Monto inicial según ahorros, limitado al tope estándar salvo que este quede bajo el mínimo publicado. */
export function initialLoanAmount(price, c) {
  const result = calculate(price, c);
  if (result.status === 'cash') return 0;
  if (result.simulationMaximum < MIN_LOAN_USD) return null;
  const needed = Math.ceil(result.grossRequired / LOAN_STEP_USD) * LOAN_STEP_USD;
  const standardCap = result.standardMaximum;
  if (standardCap < MIN_LOAN_USD) return MIN_LOAN_USD;
  return Math.min(standardCap, Math.max(MIN_LOAN_USD, needed));
}

export function convert(usd, currency, c) {
  const rates = { USD: 1, UYU: c.usdUyu, UI: c.usdUyu / c.uiUyu };
  if (!(currency in rates)) throw new Error('Moneda no válida.');
  const value = usd * rates[currency];
  if (!Number.isFinite(value)) throw new Error('Las cotizaciones configuradas no permiten una conversión válida.');
  return value;
}

function fees(price, c) {
  return { notary: price * c.notaryPercent / 100 * (1 + c.vatPercent / 100), agency: price * c.agencyPercent / 100 * (1 + c.vatPercent / 100) };
}

/** Desglosa un vale ofrecido por el banco, sin sustituirlo por el máximo teórico. */
export function bankBreakdown(price, gross, c) {
  const { notary, agency } = fees(price, c);
  const fireInsurance = price * c.fireInsurancePercent / 100;
  const costs = fireInsurance + originationFee(Math.max(0, gross - fireInsurance), c);
  const net = gross - (c.bankCostsPayment === 'financed' ? costs : 0);
  const downPayment = price - net;
  const cashRequired = downPayment + notary + agency + (c.bankCostsPayment === 'cash' ? costs : 0);
  return { net, downPayment, cashRequired, shortfall: Math.max(0, cashRequired - c.savingsUsd) };
}

/** Máximo por efectivo y límites del préstamo; no evalúa ingresos ni aprobación bancaria. */
export function maximumPropertyPrice(c) {
  validateConfig(c);
  const honorarios = (c.notaryPercent + c.agencyPercent) / 100 * (1 + c.vatPercent / 100);
  const cashMaximum = c.savingsUsd / (1 + honorarios);
  // El porcentaje configurado limita el vale bruto; los cargos financiados consumen parte
  // de ese vale y por eso reducen el líquido que llega a la compra.
  const baseline = Math.max(cashMaximum, 1);
  const affordability = price => {
    try { return calculate(price, c).shortfall <= 0; } catch { return false; }
  };
  let high = Math.max(baseline * 2, 1000000);
  for (let i = 0; i < 32 && affordability(high); i += 1) high *= 2;
  if (affordability(high)) return Infinity;
  let low = 0;
  for (let i = 0; i < 80; i += 1) {
    const mid = (low + high) / 2;
    if (affordability(mid)) low = mid;
    else high = mid;
  }
  return Math.floor(low * 100) / 100;
}

export function calculate(price, c, selectedGrossLoanUsd = undefined) {
  validateConfig(c);
  validatePrice(price);
  const { notary, agency } = fees(price, c);
  const feesTotal = notary + agency;
  const cashPurchase = c.savingsUsd >= price + feesTotal;
  const fireInsurance = cashPurchase ? 0 : price * c.fireInsurancePercent / 100;
  let available = c.savingsUsd - feesTotal;
  let downPayment = Math.max(0, Math.min(price, available));
  let netRequired = price - downPayment;
  let origination = cashPurchase ? 0 : originationFee(netRequired + (c.bankCostsPayment === 'financed' ? fireInsurance : 0), c);
  let bankCosts = cashPurchase ? 0 : origination + fireInsurance;
  let upfrontBankCosts = c.bankCostsPayment === 'cash' ? bankCosts : 0;
  let financedCosts = c.bankCostsPayment === 'financed' ? bankCosts : 0;
  available = c.savingsUsd - feesTotal - upfrontBankCosts;
  downPayment = Math.max(0, Math.min(price, available));
  netRequired = price - downPayment;
  if (!cashPurchase && c.bankCostsPayment === 'cash') {
    origination = originationFee(netRequired, c);
    bankCosts = origination + fireInsurance;
    upfrontBankCosts = bankCosts;
    financedCosts = 0;
    available = c.savingsUsd - feesTotal - upfrontBankCosts;
    downPayment = Math.max(0, Math.min(price, available));
    netRequired = price - downPayment;
  }
  const grossRequired = cashPurchase ? 0 : netRequired + financedCosts;
  const grossMaximum = standardMaximum(price, c);
  const simulationMax = simulationMaximum(price);
  const maximumOriginationFee = cashPurchase ? 0 : originationFee(Math.max(0, grossMaximum - (c.bankCostsPayment === 'financed' ? fireInsurance : 0)), c);
  const maximumFinancedCosts = c.bankCostsPayment === 'financed' && !cashPurchase ? maximumOriginationFee + fireInsurance : 0;
  const netMaximum = Math.max(0, grossMaximum - maximumFinancedCosts);
  // If installments are shown, the cash requirement must fund that loan scenario.
  // Only switch to an all-cash requirement when borrowing contributes no funds.
  const hasSelectedLoan = selectedGrossLoanUsd !== undefined && selectedGrossLoanUsd !== null && !cashPurchase;
  if (hasSelectedLoan) validateSelectedLoan(price, selectedGrossLoanUsd);
  let grossLoan = cashPurchase || netMaximum === 0 ? 0 : Math.min(grossRequired, grossMaximum);
  let netLoan = Math.max(0, grossLoan - financedCosts);
  let requiredDownPayment = Math.max(0, price - netLoan);
  if (hasSelectedLoan) {
    grossLoan = selectedGrossLoanUsd;
    origination = originationFee(Math.max(0, grossLoan - (c.bankCostsPayment === 'financed' ? fireInsurance : 0)), c);
    bankCosts = origination + fireInsurance;
    upfrontBankCosts = c.bankCostsPayment === 'cash' ? bankCosts : 0;
    financedCosts = c.bankCostsPayment === 'financed' ? bankCosts : 0;
    available = c.savingsUsd - feesTotal - upfrontBankCosts;
    netLoan = Math.max(0, grossLoan - financedCosts);
    requiredDownPayment = Math.max(0, price - netLoan);
    downPayment = Math.max(0, Math.min(requiredDownPayment, available));
    netRequired = price - downPayment;
  }
  const cashRequired = cashPurchase || (!hasSelectedLoan && netMaximum === 0)
    ? price + feesTotal
    : hasSelectedLoan
      ? feesTotal + upfrontBankCosts + requiredDownPayment
      : feesTotal + upfrontBankCosts + price - netMaximum;
  const rawShortfall = Math.max(0, cashRequired - c.savingsUsd);
  const shortfall = rawShortfall < 1e-7 ? 0 : Math.ceil((rawShortfall - 1e-7) * 100) / 100;
  const status = cashPurchase ? 'cash' : shortfall > 0 ? 'insufficient' : 'eligible';
  const noUsefulFinancing = !cashPurchase && (hasSelectedLoan ? netLoan === 0 : netMaximum === 0);
  const overFinancingLimit = !cashPurchase && grossLoan > grossMaximum + 1e-7;
  const teaPercent = rateForLoan(grossLoan, c);
  const lifeInsurance = grossLoan * c.lifeInsuranceAnnualPercent / 100 / 12;
  const installments = grossLoan > 0 ? TERMS.map(years => {
    const principalInterest = payment(grossLoan, teaPercent, years);
    const monthlyRate = Math.expm1(Math.log1p(teaPercent / 100) / 12);
    const interest = grossLoan * monthlyRate;
    const balanceAfterFirst = Math.max(0, grossLoan - Math.max(0, principalInterest - interest));
    const accountDebitRateAnnual = c.regulatoryDebitAnnualPercent + c.complementaryServiceAnnualPercent;
    const accountDebits = balanceAfterFirst * accountDebitRateAnnual / 100 / 12;
    return { years, principalInterest, lifeInsurance, accountDebits, accountDebitRateAnnual, total: principalInterest + lifeInsurance };
  }) : [];
  for (const entry of installments) { convert(entry.total, 'UYU', c); convert(entry.total, 'UI', c); }
  const result = { noUsefulFinancing, overFinancingLimit, price, teaPercent, notary, agency, feesTotal, originationFee: origination, fireInsurance, bankCosts, upfrontBankCosts, financedCosts, available, downPayment, requiredDownPayment, netRequired, netLoan, grossRequired, grossLoan, standardMaximum: grossMaximum, grossMaximum, simulationMaximum: simulationMax, netMaximum, cashRequired, shortfall, status, installments, feesShortfall: Math.max(0, feesTotal + upfrontBankCosts - c.savingsUsd), remainingSavings: Math.max(0, c.savingsUsd - (hasSelectedLoan ? cashRequired : price + feesTotal)) };
  if (Object.values(result).some(v => typeof v === 'number' && !Number.isFinite(v)) || installments.some(i => !Number.isFinite(i.total))) throw new Error('Los valores configurados son demasiado grandes para calcular.');
  return result;
}
