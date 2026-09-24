/**
 * VALORES PREDETERMINADOS DEL PROYECTO
 * Editá este objeto para cambiar los valores iniciales de todos los visitantes.
 * Cada navegador puede guardar sus propios overrides desde la pantalla Configuración.
 * Los porcentajes se escriben como 3.75, NO como 0.0375.
 * Todos los importes son USD salvo las cotizaciones, que son UYU por unidad.
 * Los importes bancarios son referencias de la simulación de USD 195.000 a 20 años.
 */
export const config = Object.freeze({
  savingsUsd: 35000,                 // Ahorros totales, antes de pagar honorarios.
  maxFinancingPercent: 85,            // Porcentaje máximo del precio que financia el banco.
  teaTiers: Object.freeze([
    Object.freeze({ minLoanUsd: 0, annualRatePercent: 4.75 }),
    Object.freeze({ minLoanUsd: 100000, annualRatePercent: 3.75 }),
  ]),                                // TEA según capital bruto solicitado.
  notaryPercent: 3,                   // Honorarios de escribana, sin IVA, sobre el precio.
  agencyPercent: 3,                   // Comisión inmobiliaria, sin IVA, sobre el precio.
  vatPercent: 22,                     // IVA aplicado solo a los dos honorarios anteriores.
  uiUyu: 6.6468,                      // Pesos por UI. Referencia de la primera captura, no cotización actual.
  usdUyu: 41.052,                     // Pesos por USD. Referencia de la primera captura, no cotización actual.
  originationFeeTiers: Object.freeze([
    Object.freeze({ minLoanUsd: 0, percent: 2.5, capUsd: null }),
    Object.freeze({ minLoanUsd: 30000, percent: 1.5, capUsd: 1500 }),
  ]),                                // Gastos de otorgamiento sobre capital antes del gasto.
  fireInsurancePercent: 2759 / 195000 * 100, // ≈1,414872% del precio: estimación a partir de la captura. Cargo total, no anual.
  regulatoryDebitAnnualPercent: 0.1,  // Débito regulatorio sobre saldo al cierre del mes.
  complementaryServiceAnnualPercent: 0.345, // Prestación complementaria sobre saldo al cierre del mes.
  bankCostsPayment: 'financed',       // 'financed': descontados del vale; 'cash': pagados con ahorros.
  lifeInsuranceAnnualPercent: 0.78,   // Supuesto: tasa anual sobre saldo / 12. El banco debe confirmar la fórmula.
});

// Metadata visible de la pantalla. Las keys solo conectan controles con el objeto; nunca se muestran.
export const configFields = [
  { key: 'savingsUsd', section: 'Financiamiento', label: 'Ahorros disponibles', unit: 'USD', type: 'number', min: 0, step: 0.01, description: 'Tu efectivo total antes de pagar la entrega y todos los gastos.' },
  { key: 'maxFinancingPercent', section: 'Financiamiento', label: 'Financiación máxima', unit: '%', type: 'number', min: 0, max: 100, step: 0.01, description: 'Porcentaje del precio del inmueble que admite el banco.' },
  { key: 'teaTiers', section: 'Financiamiento', label: 'Tasas por monto solicitado', type: 'rate-tiers', description: 'La TEA se elige por el vale bruto: el último tramo cuyo mínimo no supere el monto solicitado.' },
  { key: 'notaryPercent', section: 'Honorarios y cotizaciones', label: 'Honorarios de escribana', unit: '%', type: 'number', min: 0, step: 0.01, description: 'Porcentaje sobre el precio del inmueble, antes de IVA.' },
  { key: 'agencyPercent', section: 'Honorarios y cotizaciones', label: 'Comisión inmobiliaria', unit: '%', type: 'number', min: 0, step: 0.01, description: 'Porcentaje sobre el precio del inmueble, antes de IVA.' },
  { key: 'vatPercent', section: 'Honorarios y cotizaciones', label: 'IVA de los honorarios', unit: '%', type: 'number', min: 0, step: 0.01, description: 'Se aplica a escribana e inmobiliaria; no a los cargos bancarios.' },
  { key: 'uiUyu', section: 'Honorarios y cotizaciones', label: 'Cotización de la UI', unit: 'UYU/UI', type: 'number', min: 0.000001, step: 0.0001, decimals: 4, description: 'Pesos por unidad indexada. Valor de referencia de tu primera captura; actualizalo manualmente.' },
  { key: 'usdUyu', section: 'Honorarios y cotizaciones', label: 'Cotización del dólar · venta BROU', unit: 'UYU/USD', type: 'number', min: 0.000001, step: 0.001, decimals: 3, description: 'Pesos por dólar a la venta según BROU. Es la cotización que usamos para estimar cuántos pesos equivalen a una cuota en dólares.' },
  { key: 'originationFeeTiers', section: 'Cargos bancarios', label: 'Gastos de otorgamiento', type: 'fee-tiers', description: 'Se calculan sobre el capital antes de sumar este gasto. Los topes se expresan en dólares.' },
  { key: 'fireInsurancePercent', section: 'Cargos bancarios', label: 'Seguro de incendio', unit: '%', type: 'number', min: 0, step: 0.000001, decimals: 6, description: 'Estimación: USD 2.759 / USD 195.000 × 100 ≈ 1,414872% del inmueble. Es un cargo total inferido de esa oferta, no una tarifa anual confirmada.' },
  { key: 'regulatoryDebitAnnualPercent', section: 'Cargos bancarios', label: 'Tasa de control regulatorio', unit: '% anual', type: 'number', min: 0, step: 0.001, decimals: 3, description: 'Débito estimado sobre el saldo de capital al cierre de cada mes.' },
  { key: 'complementaryServiceAnnualPercent', section: 'Cargos bancarios', label: 'Prestación complementaria', unit: '% anual', type: 'number', min: 0, step: 0.001, decimals: 3, description: 'Débito estimado sobre el saldo de capital al cierre de cada mes.' },
  { key: 'bankCostsPayment', section: 'Cargos bancarios', label: 'Pago de gastos bancarios', unit: '', type: 'select', options: [{ value: 'financed', label: 'Se descuentan del préstamo' }, { value: 'cash', label: 'Los pago con mis ahorros' }], description: 'Elegí si otorgamiento e incendio se descuentan del vale o salen de tus ahorros.' },
  { key: 'lifeInsuranceAnnualPercent', section: 'Seguros', label: 'Seguro de vida · tasa estimada', unit: '%', type: 'number', min: 0, step: 0.01, description: 'Incluido en la cuota total del préstamo. La captura indica 0,78% sin detallar el cálculo; se estima anual sobre saldo / 12.' },
];
