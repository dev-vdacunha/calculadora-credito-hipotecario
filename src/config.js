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
  teaPercent: 3.75,                   // Tasa efectiva anual del préstamo en UI.
  notaryPercent: 3,                   // Honorarios de escribana, sin IVA, sobre el precio.
  agencyPercent: 3,                   // Comisión inmobiliaria, sin IVA, sobre el precio.
  vatPercent: 22,                     // IVA aplicado solo a los dos honorarios anteriores.
  uiUyu: 6.6468,                      // Pesos por UI. Referencia de la primera captura, no cotización actual.
  usdUyu: 41.052,                     // Pesos por USD. Referencia de la primera captura, no cotización actual.
  administrationUsd: 1500,            // Cargo administrativo total del banco.
  fireInsurancePercent: 2759 / 195000 * 100, // ≈1,414872% del precio: estimación a partir de la captura. Cargo total, no anual.
  bankCostsPayment: 'financed',       // 'financed': descontados del vale; 'cash': pagados con ahorros.
  lifeInsuranceAnnualPercent: 0.78,   // Supuesto: tasa anual sobre saldo / 12. El banco debe confirmar la fórmula.
});

// Metadata visible de la pantalla. Las keys solo conectan controles con el objeto; nunca se muestran.
export const configFields = [
  { key: 'savingsUsd', label: 'Ahorros disponibles', unit: 'USD', type: 'number', min: 0, step: 0.01, description: 'Tu efectivo total antes de pagar la entrega y todos los gastos.' },
  { key: 'maxFinancingPercent', label: 'Financiación máxima', unit: '%', type: 'number', min: 0, max: 100, step: 0.01, description: 'Porcentaje del precio del inmueble que admite el banco.' },
  { key: 'teaPercent', label: 'Tasa efectiva anual', unit: '%', type: 'number', min: 0, step: 0.01, description: 'TEA del préstamo en UI. Se convierte a tasa efectiva mensual para calcular cada cuota.' },
  { key: 'notaryPercent', label: 'Honorarios de escribana', unit: '%', type: 'number', min: 0, step: 0.01, description: 'Porcentaje sobre el precio del inmueble, antes de IVA.' },
  { key: 'agencyPercent', label: 'Comisión inmobiliaria', unit: '%', type: 'number', min: 0, step: 0.01, description: 'Porcentaje sobre el precio del inmueble, antes de IVA.' },
  { key: 'vatPercent', label: 'IVA de los honorarios', unit: '%', type: 'number', min: 0, step: 0.01, description: 'Se aplica a escribana e inmobiliaria; no a los cargos bancarios.' },
  { key: 'uiUyu', label: 'Cotización de la UI', unit: 'UYU/UI', type: 'number', min: 0.000001, step: 0.0001, decimals: 4, description: 'Pesos por unidad indexada. Valor de referencia de tu primera captura; actualizalo manualmente.' },
  { key: 'usdUyu', label: 'Cotización del dólar · venta BROU', unit: 'UYU/USD', type: 'number', min: 0.000001, step: 0.001, decimals: 3, description: 'Pesos por dólar a la venta según BROU. Es la cotización que usamos para estimar cuántos pesos equivalen a una cuota en dólares.' },
  { key: 'administrationUsd', label: 'Gastos administrativos', unit: 'USD', type: 'number', min: 0, step: 0.01, description: 'Cargo total del banco. Se descuenta del préstamo o se paga con ahorros según la opción de abajo.' },
  { key: 'fireInsurancePercent', label: 'Seguro de incendio', unit: '%', type: 'number', min: 0, step: 0.000001, decimals: 6, description: 'Estimación: USD 2.759 / USD 195.000 × 100 ≈ 1,414872% del inmueble. Es un cargo total inferido de esa oferta, no una tarifa anual confirmada.' },
  { key: 'bankCostsPayment', label: 'Pago de gastos bancarios', unit: '', type: 'select', options: [{ value: 'financed', label: 'Se descuentan del préstamo' }, { value: 'cash', label: 'Los pago con mis ahorros' }], description: 'Elegí si administración y seguro de incendio se descuentan del vale o salen de tus ahorros.' },
  { key: 'lifeInsuranceAnnualPercent', label: 'Seguro de vida · tasa estimada', unit: '%', type: 'number', min: 0, step: 0.01, description: 'Incluido en la cuota total del préstamo. La captura indica 0,78% sin detallar el cálculo; se estima anual sobre saldo / 12.' },
];
