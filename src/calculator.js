export const TERMS = Object.freeze([10, 15, 20, 25, 30]);

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
  const incendio = c.fireInsurancePercent / 100;
  const cashMaximum = c.savingsUsd / (1 + honorarios);
  const noCashConstraint = c.maxFinancingPercent === 100 && honorarios === 0 && incendio === 0 && c.bankCostsPayment === 'financed' && originationFee(1, c) === 0;
  if (noCashConstraint) return Infinity;
  // El 85% siempre limita el vale bruto; los cargos financiados consumen parte
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

export function calculate(price, c) {
  validateConfig(c);
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || price > 1e12) throw new Error('Ingresá un precio mayor que cero y de hasta USD 1.000.000.000.000.');
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
  const limit = price * c.maxFinancingPercent / 100;
  const grossMaximum = limit;
  const netMaximum = Math.max(0, grossMaximum - financedCosts);
  // If installments are shown, the cash requirement must fund that loan scenario.
  // Only switch to an all-cash requirement when borrowing contributes no funds.
  const cashRequired = cashPurchase || netMaximum === 0 ? price + feesTotal : feesTotal + upfrontBankCosts + price - netMaximum;
  const rawShortfall = Math.max(0, cashRequired - c.savingsUsd);
  const shortfall = rawShortfall < 1e-7 ? 0 : Math.ceil((rawShortfall - 1e-7) * 100) / 100;
  const status = cashPurchase ? 'cash' : shortfall > 0 ? 'insufficient' : 'eligible';
  const noUsefulFinancing = !cashPurchase && netMaximum === 0;
  const grossLoan = cashPurchase || noUsefulFinancing ? 0 : Math.min(grossRequired, grossMaximum);
  const netLoan = Math.max(0, grossLoan - financedCosts);
  const requiredDownPayment = price - netLoan;
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
  const result = { noUsefulFinancing, price, teaPercent, notary, agency, feesTotal, originationFee: origination, fireInsurance, bankCosts, upfrontBankCosts, financedCosts, available, downPayment, requiredDownPayment, netRequired, netLoan, grossRequired, grossLoan, grossMaximum, netMaximum, cashRequired, shortfall, status, installments, feesShortfall: Math.max(0, feesTotal + upfrontBankCosts - c.savingsUsd), remainingSavings: Math.max(0, c.savingsUsd - price - feesTotal) };
  if (Object.values(result).some(v => typeof v === 'number' && !Number.isFinite(v)) || installments.some(i => !Number.isFinite(i.total))) throw new Error('Los valores configurados son demasiado grandes para calcular.');
  return result;
}
