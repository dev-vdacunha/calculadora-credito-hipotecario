/**
 * VALORES PREDETERMINADOS DEL PROYECTO
 * Editá este objeto para cambiar los valores iniciales de todos los visitantes.
 * Cada navegador puede guardar sus propios overrides desde la pantalla Configuración.
 * Los porcentajes se escriben como 3.75, NO como 0.0375.
 * Todos los importes son USD salvo las cotizaciones, que son UYU por unidad.
 * Los cargos de otorgamiento e incendio son estimaciones configurables.
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
  uiUyu: 6.6468,                      // Pesos por UI. Actualizable desde la cotización del BCU.
  usdUyu: 41.052,                     // Pesos por USD. Actualizable desde la venta BROU.
  originationFeeTiers: Object.freeze([
    Object.freeze({ minLoanUsd: 0, percent: 2.5, capUsd: null }),
    Object.freeze({ minLoanUsd: 30000, percent: 1.5, capUsd: 1500 }),
  ]),                                // Gastos de otorgamiento sobre capital antes del gasto.
  fireInsurancePercent: 1.415,             // Cargo estimado sobre el valor del inmueble, no anual.
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
  { key: 'uiUyu', section: 'Honorarios y cotizaciones', label: 'Cotización de la UI', unit: 'UYU/UI', type: 'number', min: 0.000001, step: 0.0001, decimals: 4, description: 'Pesos por unidad indexada para convertir las cuotas. Podés actualizarla desde el BCU o editarla manualmente.' },
  { key: 'usdUyu', section: 'Honorarios y cotizaciones', label: 'Cotización del dólar · venta BROU', unit: 'UYU/USD', type: 'number', min: 0.000001, step: 0.001, decimals: 3, description: 'Pesos por dólar a la venta según BROU. Es la cotización que usamos para estimar cuántos pesos equivalen a una cuota en dólares.' },
  { key: 'originationFeeTiers', section: 'Cargos bancarios', label: 'Gastos de otorgamiento', type: 'fee-tiers', description: 'Cargo inicial estimado por formalizar el préstamo. Valores predeterminados: 2,5% para montos menores a USD 30.000; desde USD 30.000, 1,5% con tope de USD 1.500. La cartilla no publica una tarifa general para compra; sus USD 850 son de arquitectura y control de obra.' },
  { key: 'fireInsurancePercent', section: 'Cargos bancarios', label: 'Seguro de incendio', unit: '%', type: 'number', min: 0, step: 0.001, decimals: 3, description: 'Cargo único estimado sobre el valor del inmueble. El valor predeterminado es 1,415%; no es una tasa anual.' },
  { key: 'regulatoryDebitAnnualPercent', section: 'Cargos bancarios', label: 'Tasa de control regulatorio', unit: '% anual', type: 'number', min: 0, step: 0.001, decimals: 3, description: 'Débito estimado sobre el saldo de capital al cierre de cada mes.' },
  { key: 'complementaryServiceAnnualPercent', section: 'Cargos bancarios', label: 'Prestación complementaria', unit: '% anual', type: 'number', min: 0, step: 0.001, decimals: 3, description: 'Débito estimado sobre el saldo de capital al cierre de cada mes.' },
  { key: 'bankCostsPayment', section: 'Cargos bancarios', label: 'Pago de gastos bancarios', unit: '', type: 'select', options: [{ value: 'financed', label: 'Se descuentan del préstamo' }, { value: 'cash', label: 'Los pago con mis ahorros' }], description: 'Elegí si otorgamiento e incendio se descuentan del vale o salen de tus ahorros.' },
  { key: 'lifeInsuranceAnnualPercent', section: 'Seguros', label: 'Seguro de vida · tasa estimada', unit: '%', type: 'number', min: 0, step: 0.01, description: 'Incluido en la cuota estimada. Se calcula como una tasa anual sobre el saldo, dividida entre 12; confirmá la fórmula exacta con el banco.' },
];
