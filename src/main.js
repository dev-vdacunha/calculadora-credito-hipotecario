import './style.css';
import { config, configFields } from './config.js';
import { calculate, convert, TERMS, validateConfig, maximumPropertyPrice } from './calculator.js';
import { readUserConfig, updateUserConfig, resetUserConfig } from './user-config.js';

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

let priceText = '165000';
let currencyIndex = 0;
const currencies = ['UYU', 'UI', 'USD'];
let userConfig = readUserConfig(config, configFields);
let effectiveConfig = userConfig.config;
let configurationError = '';

try { validateConfig(effectiveConfig); } catch (error) { configurationError = error.message; }

const app = document.querySelector('#app');
app.innerHTML = `
  <header class="site-header"><div class="header-inner">
    <a class="brand" href="#calculadora" aria-label="Mi casa, inicio"><span class="brand-mark">${icon('home')}</span><span>mi casa<span class="brand-dot">.</span></span></a>
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
        <div class="reference-note">${icon('info')}<p>Valores basados en honorarios y cargos obligatorios del banco. <a href="https://dev-vdacunha.github.io/calculadora-credito-hipotecario/#configuracion">Ver configuración</a></p></div>
      </div>
      <div class="right-column">
        <section id="loan-summary" class="loan-card" aria-label="Resumen del préstamo" aria-live="polite"></section>
        <section class="card installments-card" aria-labelledby="installments-title">
          <div class="section-top"><span class="step">03</span><h2 id="installments-title">Valor mensual de las cuotas</h2></div>
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
    try { result = calculate(Number(priceText), effectiveConfig); } catch (e) { error = e.message; }
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
    document.querySelector('#loan-summary').innerHTML = `<p class="eyebrow">TU PRÉSTAMO</p><h2>Hagamos las cuentas.</h2><p>${error ? 'Revisá los valores para continuar.' : 'Empezá por el precio del inmueble.'}</p>`;
    renderInstallments(null);
    return;
  }
  const r = result;
  document.querySelector('#cash-breakdown').innerHTML =
    row('Escribana', usd(r.notary), `${number(effectiveConfig.notaryPercent, 2)}% + IVA`) +
    row('Inmobiliaria', usd(r.agency), `${number(effectiveConfig.agencyPercent, 2)}% + IVA`) +
    row('Total de honorarios', usd(r.feesTotal), 'Se pagan con tus ahorros', 'subtotal') +
    (r.upfrontBankCosts ? row('Administración en efectivo', usd(effectiveConfig.administrationUsd)) + row('Incendio en efectivo', usd(r.fireInsurance), `${number(effectiveConfig.fireInsurancePercent, 4)}% del inmueble`) : '') +
    row(r.status === 'cash' ? 'Destinás a la compra' : 'Disponible para la entrega', usd(r.downPayment), r.status === 'cash' ? 'Cubrís el precio completo sin préstamo' : 'Tus ahorros menos gastos en efectivo', 'highlight-row') +
    (r.feesShortfall > 0 ? `<p class="inline-warning">Te faltan ${usd(r.feesShortfall)} para cubrir los gastos en efectivo, antes de la entrega.</p>` : '') +
    (r.status !== 'cash' && !r.noUsefulFinancing ? row('Entrega al banco', usd(r.requiredDownPayment), 'Precio del inmueble menos el líquido del préstamo') : '') +
    row(r.status === 'cash' || r.noUsefulFinancing ? 'Efectivo total para comprar' : 'Efectivo mínimo necesario', usd(r.cashRequired), r.shortfall > 0 ? `Te faltan ${usd(r.shortfall)} sobre tus ahorros` : r.status === 'cash' || r.noUsefulFinancing ? 'Precio + honorarios, sin préstamo' : 'Honorarios + entrega mínima + cargos en efectivo', `total-row${r.shortfall > 0 ? ' cash-shortfall' : ''}`) +
    (r.status === 'cash' ? row('Ahorros que te quedan', usd(r.remainingSavings)) : '');

  const cash = r.status === 'cash';
  const insufficient = r.status === 'insufficient';
  document.querySelector('#loan-summary').innerHTML = `
    <div class="loan-heading"><p class="eyebrow">${cash ? 'TU COMPRA' : 'PRÉSTAMO A SIMULAR'}</p><span class="pill">${number(effectiveConfig.teaPercent, 2)}% TEA</span></div>
    <div class="loan-amount"><span>USD</span> ${number(r.grossLoan, 2)}</div>
    <p class="loan-caption">${cash ? 'Podés comprar sin préstamo.' : r.noUsefulFinancing ? 'El préstamo no aporta líquido para esta compra.' : 'Monto del vale · base de las cuotas'}</p>
    ${cash ? '' : `<div class="loan-details">${row('Líquido para la compra', usd(r.netLoan))}${r.financedCosts && !r.noUsefulFinancing ? row('Administración incluida en el vale', usd(effectiveConfig.administrationUsd)) + row('Incendio incluido en el vale', usd(r.fireInsurance), `${number(effectiveConfig.fireInsurancePercent, 4)}% del inmueble`) : ''}${row('Máximo del vale', usd(r.grossMaximum), `${number(effectiveConfig.maxFinancingPercent)}% del precio`)}${insufficient ? row('Vale que requerirían tus ahorros actuales', usd(r.grossRequired), 'Supera el máximo disponible') : ''}</div>`}
    <div class="eligibility ${insufficient ? 'warning' : 'success'}">${icon(insufficient ? 'info' : 'check')}<div><strong>${insufficient ? `Te faltan ${usd(r.shortfall)} de efectivo` : cash ? 'Tus ahorros cubren la compra' : 'Tus ahorros alcanzan para la entrega'}</strong><p>${insufficient ? (r.noUsefulFinancing ? 'Los cargos consumen todo el máximo financiable: el préstamo no aporta dinero para la compra. El faltante corresponde a comprar al contado.' : 'Podés ver las cuotas sobre el máximo disponible del banco. Para concretar la compra necesitás completar el efectivo faltante.') : cash ? 'No necesitás financiar ni pagar cargos de préstamo.' : 'Podés comparar los cinco plazos de financiación.'}</p></div></div>`;
  renderInstallments(r);
}

function renderInstallments(r) {
  const currency = currencies[currencyIndex];
  const format = usdValue => `${currency === 'UYU' ? '$' : currency} ${number(convert(usdValue, currency, effectiveConfig), 2)}`;
  const hasInstallments = Boolean(r?.installments.length);
  document.querySelector('#installments').innerHTML = `<div class="term-list">${TERMS.map((years, index) => {
    const entry = r?.installments[index];
    return `<div class="term-row ${hasInstallments ? '' : 'muted'}"><div class="term-label"><strong>${years}</strong><span>años<small>${years * 12} cuotas</small></span></div><div class="term-payment"><strong>${entry ? format(entry.total) : '—'}</strong>${entry ? `<small>Capital + interés: ${format(entry.principalInterest)}<br>Seguro de vida incluido: ${format(entry.lifeInsurance)}</small>` : '<small>Sin calcular</small>'}</div></div>`;
  }).join('')}</div>`;
  document.querySelector('#installment-note').textContent = hasInstallments
    ? `Cuotas sobre un vale de ${usd(r.grossLoan)}${r.shortfall > 0 ? ', suponiendo que completás el efectivo faltante' : ''}. Incluyen seguro de vida estimado: ${number(effectiveConfig.lifeInsuranceAnnualPercent, 2)}% anual sobre saldo / 12. La fórmula debe confirmarse con el banco. El seguro disminuye al amortizar; las cotizaciones pueden variar.`
    : r?.status === 'cash' ? 'No hay cuotas: tus ahorros cubren el inmueble y los honorarios.' : r?.noUsefulFinancing ? 'No hay cuotas: los cargos consumen todo el préstamo disponible.' : 'Ingresá un precio válido para comparar las cuotas.';
}

function configControl(field, value, index) {
  const id = `config-field-${index}`;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const controlValue = field.decimals === undefined ? value : Number(value).toFixed(field.decimals);
  if (field.type === 'select') {
    return `<select id="${id}" data-config-index="${index}" aria-describedby="${descriptionId} ${errorId}">${field.options.map(option => `<option value="${escape(option.value)}" ${option.value === value ? 'selected' : ''}>${escape(option.label)}</option>`).join('')}</select>`;
  }
  return `<div class="config-input-wrap"><input id="${id}" data-config-index="${index}" type="number" inputmode="decimal" value="${escape(controlValue)}" min="${field.min}"${field.max === undefined ? '' : ` max="${field.max}"`} step="${field.step}" aria-describedby="${descriptionId} ${errorId}" aria-invalid="false" /><span class="config-unit">${escape(field.unit)}</span></div>`;
}

function renderSettings() {
  main.innerHTML = `<section class="intro settings-intro"><p class="eyebrow">LAS BASES DE TU SIMULACIÓN</p><h1>Cada número,<br>en su lugar<span>.</span></h1><p>Estos son los valores que usa tu calculadora.</p></section>
    <div class="settings-layout"><aside class="settings-aside"><div class="settings-aside-icon">${icon('settings')}</div><h2>Una configuración.<br>Todas tus cuentas.</h2><p>Editá los valores que quieras. Se guardan en este navegador y se aplican enseguida a tus cálculos. Podés volver a los valores predeterminados cuando quieras.</p><p class="storage-note">${escape(userConfig.storageError || 'Tus cambios se guardan solo en este navegador y dispositivo.')}</p><button class="reset-config" id="reset-config" type="button">Restablecer valores predeterminados</button><div id="config-status" class="config-status" role="status" aria-live="polite"></div><a class="back-link" href="#calculadora">${icon('arrow', 'reversed')} Volver a calcular</a></aside>
    <section class="card settings-card" aria-label="Valores de configuración">${configFields.map((field, index) => `<div class="setting-row"><div class="setting-copy"><label for="config-field-${index}">${escape(field.label)}</label><p id="config-field-${index}-description">${escape(field.description)}</p><p class="config-error" id="config-field-${index}-error" role="alert"></p></div><div class="setting-control">${configControl(field, effectiveConfig[field.key], index)}</div></div>`).join('')}</section></div>
    <section class="bottom-note">${icon('info')}<p>Los valores por defecto provienen de simulación de créditos hipotecarios en la web</p></section>`;
  document.querySelectorAll('[data-config-index]').forEach(control => {
    const field = configFields[Number(control.dataset.configIndex)];
    const handle = () => saveSetting(field, control);
    control.addEventListener('change', handle);
    if (field.type === 'number') control.addEventListener('input', handle);
  });
  document.querySelector('#reset-config').addEventListener('click', () => {
    const error = resetUserConfig();
    userConfig = { config: { ...config }, overrides: {}, storageError: error };
    effectiveConfig = userConfig.config;
    configurationError = '';
    renderSettings();
    announce(error || 'Valores predeterminados restaurados.');
  });
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
