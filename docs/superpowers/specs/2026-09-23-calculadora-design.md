# Calculadora hipotecaria

## Ajustes vigentes del 24 de septiembre de 2026

Estas decisiones solicitadas por el usuario reemplazan las reglas anteriores de importe fijo de incendio y bloqueo de cuotas:

- Incendio configurable como porcentaje total del precio: `2759 / 195000 * 100` (≈1,414872%). Es una aproximación inferida, no una tasa anual ni una tarifa confirmada.
- Vale limitado tanto por financiación porcentual como por `maxLoanUsd: 165000`, el tope de la oferta de referencia; cero desactiva este último. A USD 195.000 se simula USD 165.000 de vale, USD 160.741 líquidos, entrega USD 34.259 y efectivo total USD 48.533.
- Seguro de vida incluido en la cuota total estimada, sin descontarlo otra vez del líquido: los cargos de administración e incendio ya explican la diferencia exacta del vale.
- Las cuotas se calculan aunque falte efectivo, sobre el menor entre el vale necesario y el disponible. Se informa que suponen completar el faltante; el efectivo mínimo se resalta en rojo.
- Se muestra el precio máximo de vivienda junto a los ahorros, incluyendo honorarios, incendio, administración, porcentaje y tope del vale. Valor inicial: USD 141.142,53; se redondea hacia abajo al centavo. También considera la alternativa al contado.
- Si se simula un préstamo, el efectivo necesario debe cubrir ese mismo escenario. Solo se usa el total al contado cuando ya alcanza para comprar sin préstamo o el banco no aporta líquido.
- El faltante positivo se redondea hacia arriba al centavo para evitar advertencias de «faltan USD 0,00».

## Objetivo y decisiones acordadas

Aplicación en español, responsive y pensada primero para celular. El usuario ingresa el valor del inmueble en USD y obtiene el efectivo necesario, el préstamo requerido y las cuotas para 10, 15, 20, 25 y 30 años. La configuración se define en un objeto JavaScript versionado en Git, sin autenticación y con acceso libre. Cambiarla requiere editar el archivo, hacer commit y publicar el nuevo despliegue.

## Arquitectura

Página estática publicada en GitHub Pages. Un archivo `src/config.js` exporta un único objeto con todos los parámetros y comentarios descriptivos. Los valores son comunes a todos los visitantes; solo cambian al publicar una nueva versión del archivo. No hay base de datos, API, autenticación ni almacenamiento de configuración en el navegador.

Frontend con Vite, JavaScript y CSS responsive. Módulo puro de cálculos, archivo de configuración y vistas de calculadora/configuración separados. La pantalla de configuración es de consulta: muestra valores, unidades y descripciones; no ofrece un botón para guardar. El README explica cómo editar el objeto y publicar los cambios mediante Git.

## Configuración inicial

Financiación máxima: 85%; ahorros: USD 35.000; TEA: 3,75% (un único campo); honorarios de escribana: 3%; honorarios de inmobiliaria: 3%; IVA sobre ambos honorarios: 22%; UI: UYU 6,6468 por UI; dólar: UYU 41,052 por USD. Las cotizaciones provienen de la captura y se etiquetan como referencias editables, sin actualización automática.

Todos los números deben ser finitos. Ahorros y honorarios pueden ser cero; financiación debe ser mayor que cero y como máximo 100%; TEA e IVA deben ser no negativos. Las cotizaciones deben ser estrictamente positivas. La aplicación valida el objeto al iniciar y muestra un error claro si algún valor es inválido; no calcula con una configuración inválida. Los cargos bancarios y el seguro de vida deben ser finitos y no negativos, y las opciones de cálculo deben pertenecer al conjunto documentado.

### Conceptos bancarios: referencia principal

La captura bancaria es la referencia principal para distinguir dinero recibido y deuda. Añadir estos campos a Configuración con ayuda visible:

| Campo | Valor inicial | Descripción |
| --- | --- | --- |
| Gastos administrativos | USD 1.500 | Cargo del banco; en la referencia se descuenta del monto del vale y reduce el dinero que llega a la compra. Importe editable, no porcentaje inferido. |
| Seguro de incendio | USD 2.759 | Importe total mostrado por el banco, descontado del vale en esta referencia. Editable; no se presume que se mantenga igual para todos los inmuebles o plazos. |
| Forma de pagar estos gastos | Descontados del vale | Alternativa: pagados con efectivo propio. Define si aumentan la deuda necesaria o se restan de los ahorros antes de determinar la entrega. |
| Tasa de seguro de vida | 0,78% | Tasa mostrada en la captura. Su periodicidad y base no aparecen; no se presenta como una fórmula bancaria confirmada. |
| Cálculo del seguro de vida | Estimación anual sobre saldo | Supuesto explícito: tasa/12 aplicada al saldo de deuda antes de cada cuota. La primera cuota usa el vale completo; el componente de seguro disminuye al amortizar. |
| Aplicar límite de financiación a | Monto del vale | Supuesto inicial conservador. Alternativa configurable: monto líquido destinado a la vivienda. El banco debe confirmar qué base usa para el 85%. |

Los importes de administración e incendio son referencias editables, no tarifas universales. La pantalla señala que provienen de una simulación para USD 195.000 y 20 años. No se usa IVA de honorarios para estos cargos automáticamente.

## Cálculos sin cargos bancarios

Para precio P, ahorro A, financiación máxima f, honorarios e/i e IVA v, expresados como fracciones:

- Escribana = P × e × (1 + v).
- Inmobiliaria = P × i × (1 + v).
- Gastos = suma de ambos honorarios.
- Efectivo disponible tras gastos = A − gastos.
- Entrega aplicable = máximo entre cero y el mínimo entre P y el efectivo disponible tras gastos.
- Préstamo necesario = P − entrega aplicable.
- Préstamo máximo = P × f.
- Entrega mínima = P × (1 − f).
- Efectivo mínimo total = gastos + entrega mínima.
- Faltante = máximo entre cero y efectivo mínimo total − A.

Se admite exactamente la entrega mínima, porque el préstamo cubre hasta el porcentaje configurado. Si hay faltante, se muestran el desglose, el préstamo necesario y el máximo permitido, pero las cuotas quedan como «—». Si ni siquiera se cubren los honorarios, se informa el faltante sin mostrar una entrega negativa. Si los ahorros cubren toda la compra y los gastos, se informa que no es necesario pedir préstamo.

Cuotas estimadas con sistema francés: tasa mensual r = (1 + TEA)^(1/12) − 1, n = años × 12, cuota = capital × r / (1 − (1 + r)^(-n)). Para TEA cero, capital/n. El capital se convierte a UI usando las cotizaciones configuradas. Las equivalencias en UYU y USD usan esas mismas cotizaciones, sin pronosticar inflación ni cambios futuros.

La cuota base representa capital e intereses. La ampliación bancaria siguiente incorpora los cargos identificados y separa el seguro de vida estimado. No se agregan cargos sin referencia, como tasación, por cuenta propia.

### Ajuste del cálculo con gastos bancarios

La sección anterior define el cálculo sin cargos bancarios. Para el modo de referencia bancaria se amplía así:

- B = gastos administrativos + seguro de incendio.
- Si B se descuenta del vale: la entrega sale de A menos honorarios; líquido necesario = precio menos entrega; vale necesario = líquido necesario + B.
- Si B se paga en efectivo: la entrega sale de A menos honorarios menos B; líquido necesario = precio menos entrega; vale necesario = líquido necesario.
- Con límite aplicado al vale, vale máximo = P × f; con gastos descontados, líquido máximo = máximo(0, vale máximo − B).
- Con límite aplicado al líquido, líquido máximo = P × f; con gastos descontados, vale máximo = líquido máximo + B.
- Efectivo mínimo = honorarios + precio − líquido máximo, más B cuando se paga en efectivo.
- Si vale máximo no alcanza a cubrir los cargos descontados, no hay financiación útil para la compra y se informa ese estado.
- Si los ahorros alcanzan para comprar sin préstamo, no se aplican cargos del préstamo ni seguros bancarios.

La cuota de capital e intereses se calcula sobre el vale, no sobre el líquido. Se muestra separadamente el seguro de vida estimado y la primera cuota total para cada plazo. Su conversión entre UI, UYU y USD usa las cotizaciones configuradas. El encabezado dice «Primera cuota estimada» para no sugerir un seguro constante. No se añade el seguro de incendio mensual: el importe de referencia ya está incluido en B.

La fórmula del seguro de vida sigue siendo un supuesto visible hasta que el banco confirme periodicidad, base y cargos incluidos. No se ajusta una fórmula arbitrariamente para igualar una sola cuota.

## Pantallas y comportamiento

Calculadora: input de precio en USD; desglose de los dos honorarios, ahorros, entrega y efectivo mínimo; resultado de préstamo requerido, tope y faltante; cinco plazos con cuotas. Flechas izquierda/derecha cambian la moneda de todas las cuotas entre UYU, UI y USD. El tope permanece visible incluso cuando las cuotas están bloqueadas.

Configuración: pantalla de consulta con valores, unidades explícitas, descripciones y navegación de regreso. Incluye el texto «Para cambiar estos valores, editá src/config.js y publicá el cambio». Los datos se leen del mismo objeto que usa el cálculo, evitando duplicar valores. No hay guardado desde la interfaz, estados de conexión a base de datos ni claves externas.

Diseño con jerarquía clara, tarjetas legibles, controles táctiles, etiquetas accesibles, foco visible, navegación por teclado y sin desbordamiento horizontal en celular. Estados vacíos y entradas inválidas no producen NaN ni resultados engañosos.

## Referencias y verificación

USD 165.000: USD 6.039 por honorario, USD 12.078 de gastos, USD 22.922 disponibles para entrega, USD 142.078 requeridos de préstamo, tope USD 140.250, faltante USD 1.828. No se calculan cuotas.

USD 195.000 con las reglas configuradas: honorarios USD 7.137 cada uno, entrega disponible USD 20.726, préstamo necesario USD 174.274, tope USD 165.750 y faltante USD 8.524. El desglose específico de la captura bancaria se verifica a continuación.

Los dos ejemplos anteriores corresponden a gastos bancarios en cero. Con los nuevos valores iniciales y límite sobre el vale, a USD 165.000 se requieren USD 146.337 de vale y faltan USD 6.087; a USD 195.000 se requieren USD 178.533 de vale y faltan USD 12.783.

Referencia bancaria exacta para probar el desglose: precio USD 195.000; vale USD 165.000; administración USD 1.500; incendio USD 2.759; líquido = 165.000 − 1.500 − 2.759 = USD 160.741; entrega = 195.000 − 160.741 = USD 34.259. Sumando honorarios externos de USD 14.274, el efectivo necesario es USD 48.533 y faltan USD 13.533 respecto de USD 35.000. El vale ofrecido de USD 165.000 es inferior al tope teórico de USD 165.750: no se sustituye uno por otro al comprobar la captura.

La misma captura indica 985.000 UI de líquido, cuota 6.412 UI / UYU 42.578, 20 años, tasa 3,75% y tasa de vida 0,78%. No muestra cotizaciones explícitas ni fórmula del seguro. No se mezclan las cotizaciones de la otra captura para exigir coincidencia. La cuota bancaria se conserva como referencia, no como prueba de igualdad para una fórmula no confirmada.

Pruebas de cálculo para ejemplos, compra viable, umbral exacto, ahorro insuficiente para gastos, compra sin préstamo, tasa cero, cinco plazos y conversiones. Verificación de formulario, errores, navegación, cambio de moneda y vistas mobile/desktop. Verificar que cambiar el objeto de configuración modifica los resultados y los valores de la pantalla de consulta, y que el build incluye esos cambios sin usar almacenamiento local ni servicios externos.

## Entregables

Código fuente, objeto JavaScript de configuración documentado, pruebas de cálculo, build estático, workflow de publicación en GitHub Pages y README con guía corta de desarrollo, edición de parámetros y despliegue. No se requieren servicios externos además de GitHub Pages.
