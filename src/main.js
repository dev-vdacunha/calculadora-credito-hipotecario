import './style.css';
import { config, configFields } from './config.js';
import { calculate, convert, TERMS, validateConfig, maximumPropertyPrice, loanPaymentCurve, initialLoanAmount, MIN_LOAN_USD, MAX_LOAN_USD, LOAN_STEP_USD } from './calculator.js';
import { readUserConfig, updateUserConfig, resetUserConfig } from './user-config.js';
import { fetchLatestQuotation, quotationSources } from './quotations.js';

const icons = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  arrow: '<path d="m9 5 7 7-7 7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  github: '<path fill="currentColor" stroke="none" d="M12 2.2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.61-3.37-1.18-3.37-1.18-.46-1.17-1.12-1.48-1.12-1.48-.91-.63.07-.62.07-.62 1.01.07 1.54 1.04 1.54 1.04.9 1.54 2.36 1.1 2.94.84.09-.66.35-1.1.64-1.35-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02A9.57 9.57 0 0 1 12 7.17c.85 0 1.71.11 2.51.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.33 4.68-4.56 4.93.36.31.68.92.68 1.86v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2.2Z"/>',
};

const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const number = (n, decimals = 0) => new Intl.NumberFormat('es-UY', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
const usd = n => `USD ${number(n, 2)}`;
const escape = text => String(text).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
const dataUruguayLogo = () => `<span class="datauruguay-brand"><svg class="datauruguay-mark" viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="8" fill="#1599d3"/><text x="16" y="21" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="12" font-weight="700">du</text></svg><span class="datauruguay-wordmark"><span>datos</span><span>Uruguay</span></span></span>`;

let priceText = '165000';
let currencyIndex = 0;
let selectedLoanAmount = null;
const currencies = ['UYU', 'UI', 'USD'];
let userConfig = readUserConfig(config, configFields);
let effectiveConfig = userConfig.config;
let configurationError = '';
let curvePrice = null;
let curveConfig = null;
let cachedLoanCurve = null;

try { validateConfig(effectiveConfig); } catch (error) { configurationError = error.message; }

const app = document.querySelector('#app');
app.innerHTML = `
  <header class="site-header"><div class="header-inner">
    <a class="brand" href="#calculadora" aria-label="Calculadora de crédito hipotecario, inicio"><span class="brand-mark">${icon('home')}</span><span class="brand-name">Calculadora de crédito hipotecario</span></a>
    <nav aria-label="Navegación principal"><a id="nav-calculator" href="#calculadora">Calculadora</a><a id="nav-settings" href="#configuracion">${icon('settings')}<span>Configuración</span></a></nav>
  </div></header>
  <main id="main" tabindex="-1"></main>
  <footer class="site-footer"><a class="github-footer-link" href="https://github.com/dev-vdacunha/calculadora-credito-hipotecario" target="_blank" rel="noopener noreferrer" aria-label="Ver el código fuente en GitHub">${icon('github')}<span>github.com/dev-vdacunha/calculadora-credito-hipotecario</span></a><span>Desarrollado por Víctor da Cunha · 2026</span></footer>`;
const main = document.querySelector('#main');

function row(label, value, detail = '', cls = '') {
  return `<div class="money-row ${cls}"><div><span>${label}</span>${detail ? `<small>${detail}</small>` : ''}</div><strong>${value}</strong></div>`;
}

function renderCalculator() {
  main.innerHTML = `
    <section class="intro"><p class="eyebrow">TU PRÓXIMO PASO, CON NÚMEROS CLAROS</p><h1>Tu casa empieza <br>por hacer cuentas<span>.</span></h1><p>Descubrí cuánto necesitás hoy y cuánto pagarías cada mes.</p></section>
    <div class="calculator-grid">
      <div class="left-column">
        <section class="card property-card" aria-labelledby="property-title">
          <div class="section-top"><span class="step">01</span><h2 id="property-title">Ingresar el valor del inmueble</h2></div>
          <label class="input-label" for="property-price">Precio del inmueble</label>
          <div class="price-field"><span>USD</span><input id="property-price" type="number" inputmode="decimal" min="0.01" max="1000000000000" step="any" placeholder="Ej. 165000" aria-describedby="price-help price-error" value="${escape(priceText)}" /></div>
          <p id="price-help" class="field-help">Ingresá el precio de venta en dólares.</p><p id="price-error" class="input-error" role="alert"></p>
          <div class="savings-line"><span class="small-icon">${icon('check')}</span><div class="savings-overview"><span>Partís de <strong>${usd(effectiveConfig.savingsUsd)}</strong> ahorrados</span><span class="savings-limit">Vivienda máxima estimada<strong id="maximum-property-price">—</strong><small>Según tus ahorros</small></span></div><a href="#configuracion" aria-label="Ver configuración de ahorros">${icon('arrow')}</a></div>
        </section>
        <section class="card breakdown-card" aria-labelledby="cash-title"><div class="section-top"><span class="step">02</span><h2 id="cash-title">Capital necesario para la hipoteca</h2></div><div id="cash-breakdown"></div></section>
        <div class="reference-note">${icon('info')}<p>La simulación incluye honorarios y cargos según la configuración elegida. <a href="#configuracion">Ver configuración</a></p></div>
      </div>
      <div class="right-column">
        <section id="loan-summary" class="loan-card" aria-label="Resumen del préstamo" aria-live="polite"><div id="loan-summary-result"></div><div id="loan-control-panel"></div></section>
        <section class="card installments-card" aria-labelledby="installments-title">
          <div class="section-top"><span class="step">03</span><h2 id="installments-title">Valor mensual de las cuotas</h2></div>
          <div class="installments-toolbar"><p>Primera cuota mensual estimada</p><div class="currency-switch" role="group" aria-label="Moneda de las cuotas"><button id="currency-prev" type="button" aria-label="Moneda anterior">${icon('arrow', 'reversed')}</button><span id="currency-label" aria-live="polite">UYU</span><button id="currency-next" type="button" aria-label="Moneda siguiente">${icon('arrow')}</button></div></div>
          <div id="installments"></div><p id="installment-note" class="footnote"></p>
        </section>
      </div>
    </div>
    <section class="bottom-note">${icon('info')}<p>El préstamo se calcula en UI. Las equivalencias usan las cotizaciones configuradas, que pueden cambiar con el tiempo. La simulación no implica aprobación bancaria.</p></section>`;
  document.querySelector('#property-price').addEventListener('input', event => { priceText = event.target.value; selectedLoanAmount = null; updateResults(); });
  document.querySelector('#currency-prev').addEventListener('click', () => changeCurrency(-1));
  document.querySelector('#currency-next').addEventListener('click', () => changeCurrency(1));
  updateResults();
}

function changeCurrency(direction) {
  currencyIndex = (currencyIndex + direction + currencies.length) % currencies.length;
  updateResults(true);
}

function updateResults(preserveLoanControl = false) {
  const input = document.querySelector('#property-price');
  const errorEl = document.querySelector('#price-error');
  let result;
  let error = configurationError;
  if (!error && priceText !== '') {
    try {
      const price = Number(priceText);
      const automatic = calculate(price, effectiveConfig);
      if (selectedLoanAmount === null && automatic.status !== 'cash' && automatic.simulationMaximum >= MIN_LOAN_USD) {
        selectedLoanAmount = initialLoanAmount(price, effectiveConfig);
      }
      result = selectedLoanAmount > 0 ? calculate(price, effectiveConfig, selectedLoanAmount) : automatic;
    } catch (e) { error = e.message; }
  }
  if (input) input.setAttribute('aria-invalid', String(Boolean(error)));
  if (errorEl) errorEl.textContent = error;
  const currency = currencies[currencyIndex];
  const currencyLabel = document.querySelector('#currency-label');
  if (currencyLabel) currencyLabel.textContent = currency;
  const maximumLabel = document.querySelector('#maximum-property-price');
  if (maximumLabel) {
    try {
      const maximum = maximumPropertyPrice(effectiveConfig);
      maximumLabel.textContent = maximum === Infinity ? 'Sin límite por efectivo' : usd(maximum);
    } catch { maximumLabel.textContent = '—'; }
  }
  if (!result) {
    document.querySelector('#cash-breakdown').innerHTML = '<p class="empty-state">Ingresá un precio válido para ver cómo se distribuyen tus ahorros.</p>';
    document.querySelector('#loan-summary-result').innerHTML = `<p class="eyebrow">TU PRÉSTAMO</p><h2>Hagamos las cuentas.</h2><p>${error ? 'Revisá los valores para continuar.' : 'Empezá por el precio del inmueble.'}</p>`;
    document.querySelector('#loan-control-panel').innerHTML = '';
    renderInstallments(null);
    return;
  }
  const r = result;
  const cash = r.status === 'cash';
  const noLoanRange = !cash && r.simulationMaximum < MIN_LOAN_USD;
  if (noLoanRange) {
    document.querySelector('#cash-breakdown').innerHTML = `<p class="empty-state">La cartilla fija un préstamo mínimo de ${usd(MIN_LOAN_USD)}. Para este valor de inmueble no hay un monto válido para simular.</p>`;
    document.querySelector('#loan-summary-result').innerHTML = `<div class="loan-heading"><p class="eyebrow">PRÉSTAMO A SIMULAR</p></div><h2>No hay un monto válido</h2><p>El mínimo publicado es ${usd(MIN_LOAN_USD)} y no puede superar el precio de la vivienda.</p>`;
    document.querySelector('#loan-control-panel').innerHTML = '';
    renderInstallments(null, true);
    return;
  }
  document.querySelector('#cash-breakdown').innerHTML =
    row('Escribana', usd(r.notary), `${number(effectiveConfig.notaryPercent, 2)}% + IVA`) +
    row('Inmobiliaria', usd(r.agency), `${number(effectiveConfig.agencyPercent, 2)}% + IVA`) +
    row('Total de honorarios', usd(r.feesTotal), 'Se pagan con tus ahorros', 'subtotal') +
    (r.upfrontBankCosts ? row('Gastos de otorgamiento en efectivo', usd(r.originationFee)) + row('Incendio en efectivo', usd(r.fireInsurance), `${number(effectiveConfig.fireInsurancePercent, 3)}% del inmueble`) : '') +
    row(r.status === 'cash' ? 'Destinás a la compra' : 'Disponible para la entrega', usd(r.downPayment), r.status === 'cash' ? 'Cubrís el precio completo sin préstamo' : 'Tus ahorros menos gastos en efectivo', 'highlight-row') +
    (r.feesShortfall > 0 ? `<p class="inline-warning">Te faltan ${usd(r.feesShortfall)} para cubrir los gastos en efectivo, antes de la entrega.</p>` : '') +
    (r.status !== 'cash' && !r.noUsefulFinancing ? row('Entrega al banco', usd(r.requiredDownPayment), 'Precio del inmueble menos el líquido del préstamo') : '') +
    row(r.status === 'cash' || r.noUsefulFinancing ? 'Efectivo total para comprar' : 'Efectivo necesario para este monto', usd(r.cashRequired), r.shortfall > 0 ? `Te faltan ${usd(r.shortfall)} sobre tus ahorros` : r.status === 'cash' || r.noUsefulFinancing ? 'Precio + honorarios, sin préstamo' : 'Honorarios, entrega y cargos en efectivo', `total-row${r.shortfall > 0 ? ' cash-shortfall' : ''}`) +
    (r.status === 'cash' ? row('Ahorros que te quedan', usd(r.remainingSavings)) : '');

  const insufficient = r.status === 'insufficient';
  const overLimit = r.overFinancingLimit;
  const eligibilityTitle = insufficient ? `Te faltan ${usd(r.shortfall)} de efectivo` : overLimit ? `Supera el máximo estándar del ${number(effectiveConfig.maxFinancingPercent)}%` : cash ? 'Tus ahorros cubren la compra' : 'Tus ahorros alcanzan para la entrega';
  const eligibilityDescription = insufficient
    ? `${r.noUsefulFinancing ? 'Los cargos consumen el préstamo y el faltante corresponde a comprar al contado.' : 'Con este monto necesitás aportar más efectivo del que tenés disponible.'}${overLimit ? ` ${financingWarning(r)}` : ''}`
    : overLimit ? financingWarning(r) : cash ? 'No necesitás financiar ni pagar cargos de préstamo.' : 'Podés comparar los cinco plazos de financiación.';
  const loanRange = r.simulationMaximum >= MIN_LOAN_USD ? getLoanCurve(r.price) : { points: [] };
  document.querySelector('#loan-summary-result').innerHTML = `
    <div class="loan-heading"><p class="eyebrow">${cash ? 'TU COMPRA' : 'PRÉSTAMO A SIMULAR'}</p><span class="pill">${number(r.teaPercent, 2)}% TEA</span></div>
    <div class="loan-amount"><span>USD</span> ${number(r.grossLoan, 2)}</div>
    <p class="loan-caption">${cash ? 'Podés comprar sin préstamo.' : r.noUsefulFinancing ? 'El préstamo no aporta líquido para esta compra.' : 'Monto bruto del vale · base de las cuotas'}</p>
    ${cash ? '' : `<div class="loan-details">${row('Líquido para la compra', usd(r.netLoan))}${r.financedCosts && !r.noUsefulFinancing ? row('Gastos de otorgamiento incluidos', usd(r.originationFee)) + row('Incendio incluido en el vale', usd(r.fireInsurance), `${number(effectiveConfig.fireInsurancePercent, 3)}% del inmueble`) : ''}${row('Máximo estándar del vale', usd(r.standardMaximum), `${number(effectiveConfig.maxFinancingPercent)}% del precio · máximo USD ${number(MAX_LOAN_USD)}`)}${insufficient ? row('Préstamo necesario según tus ahorros', usd(r.grossRequired), 'Con el monto elegido no alcanza el efectivo disponible') : ''}</div>`}
    <div class="eligibility ${insufficient || overLimit ? 'warning' : 'success'}">${icon(insufficient || overLimit ? 'info' : 'check')}<div><strong>${eligibilityTitle}</strong><p>${eligibilityDescription}</p></div></div>`;
  if (!preserveLoanControl) renderLoanControl(r, loanRange);
  else updateLoanControlPosition(r, loanRange);
  renderInstallments(r);
}

function getLoanCurve(price) {
  if (curvePrice !== price || curveConfig !== effectiveConfig || !cachedLoanCurve) {
    curvePrice = price;
    curveConfig = effectiveConfig;
    cachedLoanCurve = loanPaymentCurve(price, effectiveConfig);
  }
  return cachedLoanCurve;
}

function financingWarning(r) {
  const cap95 = r.price * 0.95;
  if (r.grossLoan > cap95) return 'La cartilla contempla hasta 95% para algunos perfiles, sujeto a condiciones y tasación. Este escenario supera ese porcentaje y es solo ilustrativo; no se evalúa elegibilidad.';
  return 'La cartilla publica hasta 95% para ciertos perfiles (25–45 años, profesional universitario e inmueble de hasta USD 200.000), sujeto a condiciones y tasación. La simulación no evalúa elegibilidad.';
}

function renderLoanControl(r, curve) {
  const panel = document.querySelector('#loan-control-panel');
  if (!panel || r.status === 'cash') { if (panel) panel.innerHTML = ''; return; }
  if (!curve.points.length) {
    panel.innerHTML = `<p class="loan-range-empty">No hay un rango de préstamo disponible. El mínimo publicado es ${usd(MIN_LOAN_USD)}.</p>`;
    return;
  }

  const selectedIndex = Math.max(0, curve.points.findIndex(point => point.grossLoanUsd === r.grossLoan));
  const standardIndex = curve.points.findIndex(point => point.grossLoanUsd >= curve.standardMaximum);
  const minimumIndex = curve.points.findIndex(point => point.grossLoanUsd === curve.minimum.grossLoanUsd);
  const standardPosition = curve.points.length <= 1 || standardIndex < 0 ? 0 : standardIndex / (curve.points.length - 1) * 100;
  const xFor = index => curve.points.length <= 1 ? 0 : index / (curve.points.length - 1) * 1000;
  const yValues = curve.points.map(point => point.monthlyPaymentUsd);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const yFor = value => yMax === yMin ? 32 : 58 - ((value - yMin) / (yMax - yMin)) * 50;
  const path = curve.points.map((point, index) => `${index ? 'L' : 'M'}${xFor(index).toFixed(2)} ${yFor(point.monthlyPaymentUsd).toFixed(2)}`).join(' ');
  const boundary = standardIndex >= 0 ? `<rect class="loan-chart-over-limit" x="${xFor(standardIndex).toFixed(2)}" y="0" width="${(1000 - xFor(standardIndex)).toFixed(2)}" height="64"/><line class="loan-chart-limit" x1="${xFor(standardIndex).toFixed(2)}" x2="${xFor(standardIndex).toFixed(2)}" y1="0" y2="64"/>` : '';
  const tierMarkers = effectiveConfig.teaTiers.slice(1).map(tier => {
    const index = curve.points.findIndex(point => point.grossLoanUsd >= tier.minLoanUsd);
    if (index < 0) return '';
    const x = xFor(index);
    return `<line class="loan-chart-tier" x1="${x.toFixed(2)}" x2="${x.toFixed(2)}" y1="8" y2="58"/><circle class="loan-chart-tier-dot" cx="${x.toFixed(2)}" cy="${yFor(curve.points[index].monthlyPaymentUsd).toFixed(2)}" r="3"/>`;
  }).join('');
  const minPoint = curve.minimum;
  const minPointIndex = minimumIndex < 0 ? 0 : minimumIndex;
  const teaRanges = effectiveConfig.teaTiers.map(tier => `${number(tier.annualRatePercent, 2)}% desde ${usd(tier.minLoanUsd)}`).join(' · ');
  const standardLabel = `${usd(curve.standardMaximum)} · ${number(effectiveConfig.maxFinancingPercent)}% estándar`;
  const maxLabel = usd(curve.simulationMaximum);
  const selectedInstallment = r.installments.find(item => item.years === 15)?.total ?? 0;

  panel.innerHTML = `
    <div class="loan-control-heading"><label for="loan-amount-control">Ajustar monto del préstamo</label><span>Pasos de USD ${number(LOAN_STEP_USD)}</span></div>
    <p id="loan-slider-description" class="loan-slider-description">Mové la perilla para comparar el efectivo y las cuotas. El gráfico muestra la primera cuota estimada a 15 años.</p>
    <div class="loan-chart-wrap">
      <svg class="loan-chart" viewBox="0 0 1000 64" preserveAspectRatio="none" role="img" aria-label="Curva de la cuota mensual estimada a 15 años según el monto del préstamo">${boundary}<path class="loan-chart-line" d="${path}"/>${tierMarkers}<circle class="loan-chart-minimum" cx="${xFor(minPointIndex).toFixed(2)}" cy="${yFor(minPoint.monthlyPaymentUsd).toFixed(2)}" r="4"/><circle id="loan-chart-selection" class="loan-chart-selection" cx="${xFor(selectedIndex).toFixed(2)}" cy="${yFor(selectedInstallment).toFixed(2)}" r="5"/></svg>
      <input id="loan-amount-control" type="range" min="0" max="${curve.points.length - 1}" step="1" value="${selectedIndex}" style="--standard-position:${standardPosition.toFixed(2)}%" aria-label="Monto bruto del vale" aria-describedby="loan-slider-description loan-slider-status" />
    </div>
    <div class="loan-range-labels"><span>${usd(MIN_LOAN_USD)}</span><span class="loan-standard-label">${standardLabel}</span><span>${maxLabel}</span></div>
    <p class="loan-tier-legend">Franjas TEA: ${teaRanges}</p>
    <p class="loan-curve-legend">Cuota menor en el rango: <strong>${usd(minPoint.monthlyPaymentUsd)}</strong> con un vale de <strong>${usd(minPoint.grossLoanUsd)}</strong>. Incluye seguro de vida; otros débitos se muestran aparte.</p>
    <p id="loan-slider-status" class="loan-slider-status" aria-live="polite">Monto elegido: ${usd(r.grossLoan)} · ${number(r.teaPercent, 2)}% TEA · cuota a 15 años: ${usd(selectedInstallment)}</p>`;
  panel.dataset.yMin = String(yMin);
  panel.dataset.yMax = String(yMax);
  panel.querySelector('#loan-amount-control').addEventListener('input', event => {
    selectedLoanAmount = curve.points[Number(event.target.value)].grossLoanUsd;
    updateResults(true);
  });
}

function updateLoanControlPosition(r, curve) {
  const panel = document.querySelector('#loan-control-panel');
  const input = panel?.querySelector('#loan-amount-control');
  if (!input || !curve.points.length) { renderLoanControl(r, curve); return; }
  const index = Math.max(0, curve.points.findIndex(point => point.grossLoanUsd === r.grossLoan));
  input.value = String(index);
  const point = curve.points[index];
  const selectedInstallment = r.installments.find(item => item.years === 15)?.total ?? 0;
  const min = Number(panel.dataset.yMin);
  const max = Number(panel.dataset.yMax);
  const y = max === min ? 32 : 58 - ((selectedInstallment - min) / (max - min)) * 50;
  const x = curve.points.length <= 1 ? 0 : index / (curve.points.length - 1) * 1000;
  const marker = panel.querySelector('#loan-chart-selection');
  marker?.setAttribute('cx', x.toFixed(2));
  marker?.setAttribute('cy', y.toFixed(2));
  input.setAttribute('aria-valuetext', `${usd(r.grossLoan)} del vale, ${number(r.teaPercent, 2)}% TEA, primera cuota a 15 años ${usd(selectedInstallment)}`);
  const status = panel.querySelector('#loan-slider-status');
  if (status) status.textContent = `Monto elegido: ${usd(r.grossLoan)} · ${number(r.teaPercent, 2)}% TEA · cuota a 15 años: ${usd(selectedInstallment)}`;
}

function renderInstallments(r, noLoanRange = false) {
  const currency = currencies[currencyIndex];
  const format = usdValue => `${currency === 'UYU' ? '$' : currency} ${number(convert(usdValue, currency, effectiveConfig), 2)}`;
  const hasInstallments = Boolean(r?.installments.length);
  document.querySelector('#installments').innerHTML = `<div class="term-list">${TERMS.map((years, index) => {
    const entry = r?.installments[index];
    return `<div class="term-row ${hasInstallments ? '' : 'muted'}"><div class="term-label"><strong>${years}</strong><span>años<small>${years * 12} cuotas</small></span></div><div class="term-payment"><strong>${entry ? format(entry.total) : '—'}</strong>${entry ? `<small>Capital + interés: ${format(entry.principalInterest)}<br>Seguro de vida incluido: ${format(entry.lifeInsurance)}<br>Otros débitos, primer mes: ${format(entry.accountDebits)}</small>` : '<small>Sin calcular</small>'}</div></div>`;
  }).join('')}</div>`;
  document.querySelector('#installment-note').textContent = hasInstallments
    ? `Cuotas sobre un vale de ${usd(r.grossLoan)}${r.shortfall > 0 ? ', suponiendo que completás el efectivo faltante' : ''}. TEA aplicada: ${number(r.teaPercent, 2)}%. Incluyen seguro de vida estimado: ${number(effectiveConfig.lifeInsuranceAnnualPercent, 2)}% anual sobre saldo / 12. Otros débitos del primer mes: ${(r.installments[0].accountDebitRateAnnual).toFixed(3)}% anual sobre saldo. La fórmula debe confirmarse con el banco.`
    : noLoanRange ? `No hay cuotas: el préstamo mínimo publicado es ${usd(MIN_LOAN_USD)} y supera el precio del inmueble.` : r?.status === 'cash' ? 'No hay cuotas: tus ahorros cubren el inmueble y los honorarios.' : r?.noUsefulFinancing ? 'No hay cuotas: los cargos consumen todo el préstamo disponible.' : 'Ingresá un precio válido para comparar las cuotas.';
}

function configControl(field, value, index) {
  const id = `config-field-${index}`;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  if (field.type === 'rate-tiers' || field.type === 'fee-tiers') return tierControl(field, value, index);
  const controlValue = field.decimals === undefined ? value : Number(value).toFixed(field.decimals);
  if (field.type === 'select') {
    return `<select id="${id}" data-config-index="${index}" aria-describedby="${descriptionId} ${errorId}">${field.options.map(option => `<option value="${escape(option.value)}" ${option.value === value ? 'selected' : ''}>${escape(option.label)}</option>`).join('')}</select>`;
  }
  const input = `<div class="config-input-wrap"><input id="${id}" data-config-index="${index}" type="number" inputmode="decimal" value="${escape(controlValue)}" min="${field.min}"${field.max === undefined ? '' : ` max="${field.max}"`} step="${field.step}" aria-describedby="${descriptionId} ${errorId}" aria-invalid="false" /><span class="config-unit">${escape(field.unit)}</span></div>`;
  if (!quotationSources[field.key]) return input;
  const ariaLabel = field.key === 'usdUyu' ? 'Actualizar cotización de venta BROU desde Datos Uruguay' : 'Actualizar cotización de la UI desde Datos Uruguay';
  return `<div class="config-number-control">${input}<button class="refresh-quotation" type="button" aria-label="${ariaLabel}" data-update-quotation="${field.key}">Actualizar desde ${dataUruguayLogo()}</button><span class="quotation-update-status" data-quotation-status="${field.key}" role="status" aria-live="polite"></span></div>`;
}

function tierControl(field, value, index) {
  const isRate = field.type === 'rate-tiers';
  const rows = value.map((tier, tierIndex) => {
    const secondKey = isRate ? 'annualRatePercent' : 'percent';
    const secondValue = tier[secondKey];
    const cap = isRate ? '' : `<td><input class="tier-field" type="number" inputmode="decimal" data-tier-field="capUsd" data-tier-index="${tierIndex}" value="${tier.capUsd ?? ''}" min="0" step="0.01" aria-label="Tope del tramo ${tierIndex + 1}" placeholder="Sin tope" /></td>`;
    return `<tr><td><input class="tier-field" type="number" inputmode="decimal" data-tier-field="minLoanUsd" data-tier-index="${tierIndex}" value="${tier.minLoanUsd}" min="0" step="0.01" aria-label="Desde dólares del tramo ${tierIndex + 1}" /></td><td><input class="tier-field" type="number" inputmode="decimal" data-tier-field="${secondKey}" data-tier-index="${tierIndex}" value="${secondValue}" min="0" step="0.01" aria-label="${isRate ? 'TEA' : 'Porcentaje'} del tramo ${tierIndex + 1}" /></td>${cap}<td><button class="tier-remove" type="button" data-tier-action="remove" data-tier-index="${tierIndex}" ${value.length === 1 ? 'disabled' : ''} aria-label="Eliminar tramo ${tierIndex + 1}">×</button></td></tr>`;
  }).join('');
  return `<div class="tier-editor" data-tier-editor-index="${index}" data-tier-type="${field.type}" aria-describedby="config-field-${index}-description config-field-${index}-error"><table><thead><tr><th>Desde (USD)</th><th>${isRate ? 'TEA (%)' : 'Porcentaje (%)'}</th>${isRate ? '' : '<th>Tope (USD)</th>'}<th><span class="sr-only">Acciones</span></th></tr></thead><tbody>${rows}</tbody></table><button class="tier-add" type="button" data-tier-action="add">Agregar tramo</button><p class="config-error" id="config-field-${index}-error" role="alert"></p></div>`;
}

function tierDefault(field, values) {
  const last = values.at(-1);
  const minLoanUsd = (last?.minLoanUsd ?? 0) + 100000;
  return field.type === 'rate-tiers'
    ? { minLoanUsd, annualRatePercent: last?.annualRatePercent ?? 0 }
    : { minLoanUsd, percent: last?.percent ?? 0, capUsd: last?.capUsd ?? null };
}

function readTierValues(editor, field) {
  const rows = [...editor.querySelectorAll('tbody tr')];
  return rows.map(rowElement => {
    const values = {};
    rowElement.querySelectorAll('.tier-field').forEach(input => {
      const key = input.dataset.tierField;
      values[key] = key === 'capUsd' && input.value === '' ? null : Number(input.value);
    });
    return values;
  });
}

function persistTierValues(field, editor, values) {
  const errorElement = editor.querySelector('.config-error');
  try {
    const next = updateUserConfig(config, configFields, userConfig.overrides, field.key, values);
    userConfig = next;
    effectiveConfig = next.config;
    selectedLoanAmount = null;
    configurationError = '';
    errorElement.textContent = '';
    announce(next.storageError || 'Cambios guardados en este navegador.');
    return true;
  } catch (error) {
    errorElement.textContent = error.message;
    announce('El cambio no se guardó porque el tramo no es válido.');
    return false;
  }
}

function attachTierEditor(field, editor) {
  const sync = () => persistTierValues(field, editor, readTierValues(editor, field));
  editor.querySelectorAll('.tier-field').forEach(input => input.addEventListener('change', sync));
  editor.querySelector('[data-tier-action="add"]').addEventListener('click', () => {
    const values = [...effectiveConfig[field.key], tierDefault(field, effectiveConfig[field.key])];
    if (persistTierValues(field, editor, values)) { renderSettings(); announce('Tramo agregado y guardado.'); }
  });
  editor.querySelectorAll('[data-tier-action="remove"]').forEach(button => button.addEventListener('click', () => {
    const values = readTierValues(editor, field).filter((_, i) => i !== Number(button.dataset.tierIndex));
    if (persistTierValues(field, editor, values)) { renderSettings(); announce('Tramo eliminado y guardado.'); }
  }));
}

function renderSettings() {
  const sections = [...new Set(configFields.map(field => field.section))];
  const settingsMarkup = sections.map(section => {
    const fields = configFields.filter(field => field.section === section);
    return `<section class="settings-section"><h2>${escape(section)}</h2><div class="settings-section-card">${fields.map(field => {
      const index = configFields.indexOf(field);
      const error = field.type === 'rate-tiers' || field.type === 'fee-tiers' ? '' : `<p class="config-error" id="config-field-${index}-error" role="alert"></p>`;
      return `<div class="setting-row"><div class="setting-copy"><label for="config-field-${index}">${escape(field.label)}</label><p id="config-field-${index}-description">${escape(field.description)}</p>${error}</div><div class="setting-control">${configControl(field, effectiveConfig[field.key], index)}</div></div>`;
    }).join('')}</div></section>`;
  }).join('');
  main.innerHTML = `<section class="intro settings-intro"><p class="eyebrow">LAS BASES DE TU SIMULACIÓN</p><h1>Cada número,<br>en su lugar<span>.</span></h1><p>Estos son los valores que usa tu calculadora.</p></section>
    <div class="settings-layout"><aside class="settings-aside"><div class="settings-aside-icon">${icon('settings')}</div><h2>Una configuración.<br>Todas tus cuentas.</h2><p>Editá los valores que quieras. Se guardan en este navegador y se aplican enseguida a tus cálculos. Podés volver a los valores predeterminados cuando quieras.</p><p class="storage-note">${escape(userConfig.storageError || 'Tus cambios se guardan solo en este navegador y dispositivo.')}</p><button class="reset-config" id="reset-config" type="button">Restablecer valores predeterminados</button><div id="config-status" class="config-status" role="status" aria-live="polite"></div><a class="back-link" href="#calculadora">${icon('arrow', 'reversed')} Volver a calcular</a></aside>
    <section class="settings-card grouped-settings" aria-label="Valores de configuración">${settingsMarkup}</section></div>
    <section class="quotation-source-card"><div><div class="quotation-source-heading"><strong>Fuente de cotizaciones</strong><a class="datauruguay-brand-link" href="https://datosuruguay.com/api" target="_blank" rel="noopener noreferrer" aria-label="Datos Uruguay, API y atribución CC BY 4.0">${dataUruguayLogo()}</a></div><p>La UI proviene del BCU y el dólar usa la venta BROU, consultados mediante esta fuente.</p><div class="quotation-source-links"><a href="https://datosuruguay.com/ui?utm_source=api&utm_medium=attribution&utm_campaign=backlinks" target="_blank" rel="noopener noreferrer">UI · BCU</a><a href="https://datosuruguay.com/dolar?utm_source=api&utm_medium=attribution&utm_campaign=backlinks" target="_blank" rel="noopener noreferrer">Dólar · venta BROU</a></div></div></section>
    <section class="bottom-note">${icon('info')}<p>Los resultados son orientativos y no implican aprobación. El banco confirma las condiciones al evaluar cada solicitud.</p></section>`;
  document.querySelectorAll('[data-config-index]').forEach(control => {
    const field = configFields[Number(control.dataset.configIndex)];
    const handle = () => saveSetting(field, control);
    control.addEventListener('change', handle);
    if (field.type === 'number') control.addEventListener('input', handle);
  });
  document.querySelectorAll('[data-tier-editor-index]').forEach(editor => {
    attachTierEditor(configFields[Number(editor.dataset.tierEditorIndex)], editor);
  });
  document.querySelectorAll('[data-update-quotation]').forEach(button => {
    const field = configFields.find(item => item.key === button.dataset.updateQuotation);
    button.addEventListener('click', () => refreshQuotation(field, button));
  });
  document.querySelector('#reset-config').addEventListener('click', () => {
    const error = resetUserConfig();
    userConfig = { config: { ...config }, overrides: {}, storageError: error };
    effectiveConfig = userConfig.config;
    selectedLoanAmount = null;
    configurationError = '';
    renderSettings();
    document.querySelector('#reset-config')?.focus();
    announce(error || 'Valores predeterminados restaurados.');
  });
}

async function refreshQuotation(field, button) {
  const status = document.querySelector(`[data-quotation-status="${field.key}"]`);
  const input = document.querySelector(`[data-config-index="${configFields.indexOf(field)}"]`);
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
    status.textContent = 'Consultando la fuente de cotizaciones…';
  try {
    const quote = await fetchLatestQuotation(field.key);
    const updated = updateUserConfig(config, configFields, userConfig.overrides, field.key, quote.value);
    userConfig = updated;
    effectiveConfig = updated.config;
    configurationError = '';
    input.value = String(quote.value);
    input.setAttribute('aria-invalid', 'false');
    document.querySelector(`#config-field-${configFields.indexOf(field)}-error`).textContent = '';
    const date = new Date(quote.date.includes('T') ? quote.date : `${quote.date}T00:00:00Z`);
    const formattedDay = new Intl.DateTimeFormat('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(date);
    const formattedTime = quote.date.includes('T') ? ` ${new Intl.DateTimeFormat('es-UY', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(date)} UTC` : '';
    const brandedSource = `<a class="datauruguay-brand-link" href="${escape(quote.attributionUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Datos Uruguay, fuente del dato">${dataUruguayLogo()}</a>`;
    const rateLabel = field.key === 'usdUyu' ? 'Venta BROU' : 'UI del BCU';
    status.innerHTML = `${rateLabel} actualizada · dato del ${formattedDay}${formattedTime} · ${brandedSource}${updated.storageError ? ` ${escape(updated.storageError)}` : ''}`;
    if (!updated.storageError) announce('Cotización actualizada y guardada en este navegador.');
  } catch (error) {
    status.textContent = error.message;
    announce(error.message);
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

function announce(message) {
  const status = document.querySelector('#config-status');
  if (status) status.textContent = message;
}

function saveSetting(field, control) {
  const errorElement = document.querySelector(`#config-field-${control.dataset.configIndex}-error`);
  const value = field.type === 'number' ? Number(control.value) : control.value;
  if (control.value === '' || (field.type === 'number' && !Number.isFinite(value))) {
    control.setAttribute('aria-invalid', 'true');
    errorElement.textContent = 'Ingresá un valor válido para guardar.';
    return;
  }
  try {
    const next = updateUserConfig(config, configFields, userConfig.overrides, field.key, value);
    userConfig = next;
    effectiveConfig = next.config;
    selectedLoanAmount = null;
    configurationError = '';
    control.setAttribute('aria-invalid', 'false');
    errorElement.textContent = '';
    announce(next.storageError || 'Cambios guardados en este navegador.');
  } catch (error) {
    control.setAttribute('aria-invalid', 'true');
    errorElement.textContent = error.message;
    announce('El cambio no se guardó porque el valor no es válido.');
  }
}

function route() {
  const settings = location.hash === '#configuracion';
  document.querySelector('#nav-calculator').setAttribute('aria-current', settings ? 'false' : 'page');
  document.querySelector('#nav-settings').setAttribute('aria-current', settings ? 'page' : 'false');
  if (settings) renderSettings(); else renderCalculator();
}

window.addEventListener('hashchange', () => { route(); main.focus({ preventScroll: true }); window.scrollTo(0, 0); });
route();
