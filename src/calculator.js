export const TERMS = Object.freeze([10, 15, 20, 25, 30]);

export function validateConfig(c) {
  const nonnegative = ['savingsUsd', 'teaPercent', 'vatPercent', 'notaryPercent', 'agencyPercent', 'administrationUsd', 'fireInsurancePercent', 'lifeInsuranceAnnualPercent'];
  for (const key of [...nonnegative, 'maxFinancingPercent', 'uiUyu', 'usdUyu']) {
    if (typeof c[key] !== 'number' || !Number.isFinite(c[key]) || c[key] < 0) throw new Error(`Configuración inválida: ${key} debe ser un número finito no negativo.`);
  }
  if (c.maxFinancingPercent > 100) throw new Error('La financiación debe estar entre 0% y 100%.');
  if (c.uiUyu <= 0 || c.usdUyu <= 0) throw new Error('Las cotizaciones deben ser mayores que cero.');
  if (!['financed', 'cash'].includes(c.bankCostsPayment)) throw new Error('bankCostsPayment debe ser financed o cash.');
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
  const costs = c.administrationUsd + price * c.fireInsurancePercent / 100;
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
  // El 85% siempre limita el vale bruto; los cargos financiados consumen parte
  // de ese vale y por eso reducen el líquido que llega a la compra.
  const upfront = c.administrationUsd;
  const share = (100 - c.maxFinancingPercent) / 100 + honorarios + incendio;
  const byPercent = share === 0 ? (c.savingsUsd >= upfront ? Infinity : 0) : (c.savingsUsd - upfront) / share;
  const maximum = Math.max(cashMaximum, Math.max(0, byPercent));
  // No redondear hacia arriba y recomendar un precio que exceda los ahorros.
  return Math.floor(maximum * 100) / 100;
}

export function calculate(price, c) {
  validateConfig(c);
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || price > 1e12) throw new Error('Ingresá un precio mayor que cero y de hasta USD 1.000.000.000.000.');
  const { notary, agency } = fees(price, c);
  const feesTotal = notary + agency;
  const cashPurchase = c.savingsUsd >= price + feesTotal;
  const fireInsurance = cashPurchase ? 0 : price * c.fireInsurancePercent / 100;
  const bankCosts = cashPurchase ? 0 : c.administrationUsd + fireInsurance;
  const upfrontBankCosts = c.bankCostsPayment === 'cash' ? bankCosts : 0;
  const financedCosts = c.bankCostsPayment === 'financed' ? bankCosts : 0;
  const available = c.savingsUsd - feesTotal - upfrontBankCosts;
  const downPayment = Math.max(0, Math.min(price, available));
  const netRequired = price - downPayment;
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
  const lifeInsurance = grossLoan * c.lifeInsuranceAnnualPercent / 100 / 12;
  const installments = grossLoan > 0 ? TERMS.map(years => {
    const principalInterest = payment(grossLoan, c.teaPercent, years);
    return { years, principalInterest, lifeInsurance, total: principalInterest + lifeInsurance };
  }) : [];
  for (const entry of installments) { convert(entry.total, 'UYU', c); convert(entry.total, 'UI', c); }
  const result = { noUsefulFinancing, price, notary, agency, feesTotal, fireInsurance, bankCosts, upfrontBankCosts, financedCosts, available, downPayment, requiredDownPayment, netRequired, netLoan, grossRequired, grossLoan, grossMaximum, netMaximum, cashRequired, shortfall, status, installments, feesShortfall: Math.max(0, feesTotal + upfrontBankCosts - c.savingsUsd), remainingSavings: Math.max(0, c.savingsUsd - price - feesTotal) };
  if (Object.values(result).some(v => typeof v === 'number' && !Number.isFinite(v)) || installments.some(i => !Number.isFinite(i.total))) throw new Error('Los valores configurados son demasiado grandes para calcular.');
  return result;
}
