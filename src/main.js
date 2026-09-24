import './style.css';
import { config, configFields } from './config.js';
import { calculate, convert, TERMS, validateConfig } from './calculator.js';

const icons = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  arrow: '<path d="m9 5 7 7-7 7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const number = (n, decimals = 0) => new Intl.NumberFormat('es-UY', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
const usd = n => `USD ${number(n, 2)}`;
const escape = text => String(text).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
let priceText = '165000';
let currencyIndex = 0;
const currencies = ['UYU', 'UI', 'USD'];
let configurationError = '';
try { validateConfig(config); } catch (error) { configurationError = error.message; }

const app = document.querySelector('#app');
app.innerHTML = `
  <header class="site-header"><div class="header-inner">
    <a class="brand" href="#calculadora" aria-label="Mi casa, inicio"><span class="brand-mark">${icon('home')}</span><span>mi casa<span class="brand-dot">.</span></span></a>
    <nav aria-label="Navegación principal"><a id="nav-calculator" href="#calculadora">Calculadora</a><a id="nav-settings" href="#configuracion">${icon('settings')}<span>Configuración</span></a></nav>
  </div></header>
  <main id="main" tabindex="-1"></main>
  <footer class="site-footer"><span>Hecho para planificar tu próxima casa.</span><span>Una estimación, un paso más cerca.</span></footer>`;
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
          <div class="section-top"><span class="step">01</span><h2 id="property-title">El inmueble que tenés en mente</h2></div>
          <label class="input-label" for="property-price">Precio del inmueble</label>
          <div class="price-field"><span>USD</span><input id="property-price" type="number" inputmode="decimal" min="0.01" max="1000000000000" step="any" placeholder="Ej. 165000" aria-describedby="price-help price-error" value="${escape(priceText)}" /></div>
          <p id="price-help" class="field-help">Ingresá el precio de venta en dólares.</p><p id="price-error" class="input-error" role="alert"></p>
          <div class="savings-line"><span class="small-icon">${icon('check')}</span><span>Partís de <strong>${usd(config.savingsUsd)}</strong> ahorrados</span><a href="#configuracion" aria-label="Ver configuración de ahorros">${icon('arrow')}</a></div>
        </section>
        <section class="card breakdown-card" aria-labelledby="cash-title"><div class="section-top"><span class="step">02</span><h2 id="cash-title">Tu efectivo, paso a paso</h2></div><div id="cash-breakdown"></div></section>
        <div class="reference-note">${icon('info')}<p>Usamos tus honorarios y los cargos de la referencia bancaria. <a href="#configuracion">Ver valores y supuestos</a></p></div>
      </div>
      <div class="right-column">
        <section id="loan-summary" class="loan-card" aria-label="Resumen del préstamo" aria-live="polite"></section>
        <section class="card installments-card" aria-labelledby="installments-title">
          <div class="section-top"><span class="step">03</span><h2 id="installments-title">Tus cuotas, a tu ritmo</h2></div>
          <div class="installments-toolbar"><p>Primera cuota mensual estimada</p><div class="currency-switch" role="group" aria-label="Moneda de las cuotas"><button id="currency-prev" type="button" aria-label="Moneda anterior">${icon('arrow', 'reversed')}</button><span id="currency-label" aria-live="polite">UYU</span><button id="currency-next" type="button" aria-label="Moneda siguiente">${icon('arrow')}</button></div></div>
          <div id="installments"></div><p id="installment-note" class="footnote"></p>
        </section>
      </div>
    </div>
    <section class="bottom-note">${icon('info')}<p>El préstamo se calcula en UI. Las equivalencias en pesos y dólares usan cotizaciones de referencia; pueden cambiar con el tiempo. La simulación no implica aprobación bancaria.</p></section>`;
  document.querySelector('#property-price').addEventListener('input', event => { priceText = event.target.value; updateResults(); });
  document.querySelector('#currency-prev').addEventListener('click', () => changeCurrency(-1));
  document.querySelector('#currency-next').addEventListener('click', () => changeCurrency(1));
  updateResults();
}

function changeCurrency(direction) {
  currencyIndex = (currencyIndex + direction + currencies.length) % currencies.length;
  updateResults();
}

function updateResults() {
  const input = document.querySelector('#property-price');
  const errorEl = document.querySelector('#price-error');
  let result;
  let error = configurationError;
  if (!error && priceText !== '') {
    try { result = calculate(Number(priceText), config); } catch (e) { error = e.message; }
  }
  errorEl.textContent = error;
  input.setAttribute('aria-invalid', String(Boolean(error)));
  const currency = currencies[currencyIndex];
  document.querySelector('#currency-label').textContent = currency;
  if (!result) {
    document.querySelector('#cash-breakdown').innerHTML = '<p class="empty-state">Ingresá un precio válido para ver cómo se distribuyen tus ahorros.</p>';
    document.querySelector('#loan-summary').innerHTML = `<p class="eyebrow">TU PRÉSTAMO</p><h2>Hagamos las cuentas.</h2><p>${error ? 'Revisá los valores para continuar.' : 'Empezá por el precio del inmueble.'}</p>`;
    renderInstallments(null);
    return;
  }
  const r = result;
  document.querySelector('#cash-breakdown').innerHTML =
    row('Escribana', usd(r.notary), `${number(config.notaryPercent, 2)}% + IVA ${number(config.vatPercent)}%`) +
    row('Inmobiliaria', usd(r.agency), `${number(config.agencyPercent, 2)}% + IVA ${number(config.vatPercent)}%`) +
    row('Total de honorarios', usd(r.feesTotal), 'Se pagan con tus ahorros', 'subtotal') +
    (r.upfrontBankCosts ? row('Gastos bancarios en efectivo', usd(r.upfrontBankCosts), 'Administración + seguro de incendio') : '') +
    row(r.status === 'cash' ? 'Destinás a la compra' : 'Disponible para la entrega', usd(r.downPayment), r.status === 'cash' ? 'Cubrís el precio completo sin préstamo' : 'Tus ahorros menos gastos en efectivo', 'highlight-row') +
    (r.feesShortfall > 0 ? `<p class="inline-warning">Te faltan ${usd(r.feesShortfall)} para cubrir los gastos en efectivo, antes de la entrega.</p>` : '') +
    row(r.status === 'cash' || r.noUsefulFinancing ? 'Efectivo total para comprar' : 'Efectivo mínimo necesario', usd(r.cashRequired), r.status === 'cash' || r.noUsefulFinancing ? 'Precio + honorarios, sin préstamo' : 'Honorarios + entrega mínima + cargos en efectivo', 'total-row') +
    (r.status === 'cash' ? row('Ahorros que te quedan', usd(r.remainingSavings)) : '');

  const cash = r.status === 'cash';
  const insufficient = r.status === 'insufficient';
  document.querySelector('#loan-summary').innerHTML = `
    <div class="loan-heading"><p class="eyebrow">${cash ? 'TU COMPRA' : 'PRÉSTAMO QUE NECESITÁS'}</p><span class="pill">${number(config.teaPercent, 2)}% TEA</span></div>
    <div class="loan-amount"><span>USD</span> ${number(r.grossRequired, 2)}</div>
    <p class="loan-caption">${cash ? 'Podés comprar sin préstamo.' : 'Monto del vale · tu deuda total con el banco'}</p>
    ${cash ? '' : `<div class="loan-details">${row('Líquido para la compra', usd(r.netRequired))}${row('Gastos incluidos en el vale', usd(r.financedCosts), r.financedCosts ? 'Administración + seguro de incendio' : 'Se pagan por separado con tus ahorros')}${row('Máximo del vale', usd(r.grossMaximum), `${number(config.maxFinancingPercent)}% del precio · límite sobre ${config.financingLimitBasis === 'gross' ? 'el vale' : 'el líquido'}`)}${row('Máximo líquido para comprar', usd(r.netMaximum))}</div>`}
    <div class="eligibility ${insufficient ? 'warning' : 'success'}">${icon(insufficient ? 'info' : 'check')}<div><strong>${insufficient ? `Te faltan ${usd(r.shortfall)} de efectivo` : cash ? 'Tus ahorros cubren la compra' : 'Tus ahorros alcanzan para la entrega'}</strong><p>${insufficient ? (r.noUsefulFinancing ? 'Los cargos consumen todo el máximo financiable: el préstamo no aporta dinero para la compra. El faltante corresponde a comprar al contado.' : 'Con este precio superás el límite de financiación. Las cuotas se habilitan cuando alcanza tu entrega.') : cash ? 'No necesitás financiar ni pagar cargos de préstamo.' : 'Podés comparar los cinco plazos de financiación.'}</p></div></div>`;
  renderInstallments(r);
}

function renderInstallments(r) {
  const currency = currencies[currencyIndex];
  const format = usdValue => `${currency === 'UYU' ? '$' : currency} ${number(convert(usdValue, currency, config), 2)}`;
  const eligible = r?.status === 'eligible';
  document.querySelector('#installments').innerHTML = `<div class="term-list">${TERMS.map((years, index) => {
    const entry = r?.installments[index];
    return `<div class="term-row ${eligible ? '' : 'muted'}"><div class="term-label"><strong>${years}</strong><span>años<small>${years * 12} cuotas</small></span></div><div class="term-payment"><strong>${entry ? format(entry.total) : '—'}</strong>${entry ? `<small>Capital + interés: ${format(entry.principalInterest)}<br>Seguro de vida: ${format(entry.lifeInsurance)}</small>` : '<small>Sin calcular</small>'}</div></div>`;
  }).join('')}</div>`;
  document.querySelector('#installment-note').textContent = eligible
    ? `Incluye seguro de vida estimado: ${number(config.lifeInsuranceAnnualPercent, 2)}% anual sobre saldo / 12. La fórmula debe confirmarse con el banco. El seguro disminuye al amortizar; las cotizaciones pueden variar.`
    : r?.status === 'cash' ? 'No hay cuotas: tus ahorros cubren el inmueble y los honorarios.' : 'Las cuotas aparecerán cuando el precio y tus ahorros permitan cumplir el límite del banco.';
}

function renderSettings() {
  const optionLabels = { financed: 'Descontados del vale', cash: 'Con ahorros', gross: 'Monto del vale', net: 'Monto líquido' };
  main.innerHTML = `<section class="intro settings-intro"><p class="eyebrow">LAS BASES DE TU SIMULACIÓN</p><h1>Cada número,<br>en su lugar<span>.</span></h1><p>Estos son los valores que usa tu calculadora.</p></section>
    <div class="settings-layout"><aside class="settings-aside"><div class="settings-aside-icon">${icon('settings')}</div><h2>Una configuración.<br>Todas tus cuentas.</h2><p>Para cambiar los valores, editá <code>src/config.js</code>, hacé commit y publicá el cambio.</p><p>Los valores son comunes para todos los visitantes.</p><a class="back-link" href="#calculadora">${icon('arrow', 'reversed')} Volver a calcular</a></aside>
    <section class="card settings-card" aria-label="Valores de configuración">${configFields.map(([key, label, unit, description]) => {
      const value = unit === 'option' ? optionLabels[config[key]] : unit === 'USD' ? usd(config[key]) : `${number(config[key], unit.startsWith('UYU/') ? 4 : 2)} ${unit}`;
      return `<div class="setting-row"><div><h2>${escape(label)}</h2><p>${escape(description)}</p><code>${key}</code></div><strong>${escape(value)}</strong></div>`;
    }).join('')}</section></div>
    <section class="bottom-note">${icon('info')}<p>Los gastos bancarios provienen de la simulación de un inmueble de USD 195.000 a 20 años. Las cotizaciones corresponden a otra captura y no son valores actuales. El seguro de vida y la base del límite requieren confirmación del banco.</p></section>`;
}

function route() {
  const settings = location.hash === '#configuracion';
  document.querySelector('#nav-calculator').setAttribute('aria-current', settings ? 'false' : 'page');
  document.querySelector('#nav-settings').setAttribute('aria-current', settings ? 'page' : 'false');
  if (settings) renderSettings(); else renderCalculator();
}
window.addEventListener('hashchange', () => { route(); main.focus({ preventScroll: true }); window.scrollTo(0, 0); });
route();
