/**
 * CONFIGURACIÓN COMPARTIDA
 * Editá este objeto, hacé commit y publicá el deploy de GitHub Pages.
 * Los porcentajes se escriben como 3.75, NO como 0.0375.
 * Todos los importes son USD salvo las cotizaciones, que son UYU por unidad.
 * Los importes bancarios son referencias de la simulación de USD 195.000 a 20 años.
 */
export const config = Object.freeze({
  savingsUsd: 35000,                 // Ahorros totales, antes de pagar honorarios.
  maxFinancingPercent: 85,            // Porcentaje máximo del precio que financia el banco.
  maxLoanUsd: 165000,                 // Tope del vale de tu oferta bancaria. 0 = solo límite porcentual.
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
  financingLimitBasis: 'gross',       // 'gross': límite sobre vale; 'net': límite sobre líquido para compra.
});

// Descripciones de la pantalla. Los valores siempre se leen del objeto anterior.
export const configFields = [
  ['savingsUsd', 'Ahorros disponibles', 'USD', 'Tu efectivo total antes de pagar la entrega y todos los gastos.'],
  ['maxFinancingPercent', 'Financiación máxima', '%', 'Porcentaje del precio del inmueble que admite el banco.'],
  ['maxLoanUsd', 'Tope del vale de referencia', 'USD', 'USD 165.000 en tu oferta para una vivienda de USD 195.000. Se aplica además del límite porcentual; editá este valor si cambia la oferta. 0 desactiva este tope.'],
  ['teaPercent', 'Tasa efectiva anual', '%', 'TEA del préstamo en UI. Se convierte a tasa efectiva mensual para calcular cada cuota.'],
  ['notaryPercent', 'Honorarios de escribana', '%', 'Porcentaje sobre el precio del inmueble, antes de IVA.'],
  ['agencyPercent', 'Comisión inmobiliaria', '%', 'Porcentaje sobre el precio del inmueble, antes de IVA.'],
  ['vatPercent', 'IVA de los honorarios', '%', 'Se aplica a escribana e inmobiliaria; no a los cargos bancarios.'],
  ['uiUyu', 'Cotización de la UI', 'UYU/UI', 'Pesos por unidad indexada. Valor de referencia de tu primera captura; actualizalo manualmente.'],
  ['usdUyu', 'Cotización del dólar', 'UYU/USD', 'Pesos por dólar. Valor de referencia de tu primera captura; actualizalo manualmente.'],
  ['administrationUsd', 'Gastos administrativos', 'USD', 'Cargo total del banco. Se descuenta del vale o se paga con ahorros según la opción de abajo.'],
  ['fireInsurancePercent', 'Seguro de incendio', '%', 'Estimación: USD 2.759 / USD 195.000 × 100 ≈ 1,414872% del inmueble. Se cobra una vez dentro de los gastos bancarios; no es una tasa anual. Es una proporción inferida de esa oferta, no una tarifa confirmada para todos los plazos.'],
  ['bankCostsPayment', 'Pago de gastos bancarios', 'option', 'Descontados del vale: aumentan tu deuda. Con ahorros: reducen el efectivo disponible para la entrega.'],
  ['lifeInsuranceAnnualPercent', 'Seguro de vida · tasa estimada', '%', 'Incluido en la cuota total del préstamo. La captura indica 0,78% sin detallar su cálculo; se estima anual sobre saldo / 12. No se resta nuevamente del líquido: USD 165.000 − 1.500 − 2.759 ya da USD 160.741.'],
  ['financingLimitBasis', 'Base del límite de financiación', 'option', 'Vale: limita la deuda total, incluidos los cargos financiados. Líquido: limita solo lo destinado a la compra. Confirmá la base con el banco.'],
];
