# Mi casa · Calculadora hipotecaria

Una página en español para saber cuánto efectivo necesitás para comprar un inmueble y cómo quedarían las cuotas a **10, 15, 20, 25 o 30 años**. Adaptada a celular, con cambio entre UYU, UI y USD mediante flechas.

## Configuración y persistencia

Los valores predeterminados están en **[`src/config.js`](src/config.js)**, dentro de `config`. La pantalla Configuración permite editar los doce valores y guarda solo las diferencias en `localStorage` del navegador actual. No hay base de datos ni sincronización entre dispositivos.

Si cambiás un valor desde la pantalla, se aplica enseguida a la calculadora y permanece después de recargar. “Restablecer valores predeterminados” elimina únicamente la configuración de esta aplicación. Cambiar los defaults para todos requiere editar `src/config.js`, hacer commit y publicar un nuevo deploy.

Junto a la UI y el dólar hay botones para actualizarlos manualmente desde [Datos Uruguay](https://datosuruguay.com/api). La UI usa el valor diario del BCU; el dólar usa el valor de **venta BROU**, publicado con compra y venta aproximadamente cada 10 minutos. El valor y su fecha se guardan como overrides locales; si el endpoint falla, se conserva el valor anterior. La atribución visible enlaza a Datos Uruguay; sus datos se publican bajo CC BY 4.0.

```js
export const config = Object.freeze({
  savingsUsd: 35000,
  maxFinancingPercent: 85,
  teaPercent: 3.75,
  // ... los demás parámetros están en src/config.js
});
```

Los porcentajes se expresan como `3.75` (no `0.0375`). Los decimales en JavaScript usan punto. Los importes son USD y las cotizaciones UYU por UI/USD. No pongas claves ni datos privados: el archivo es público.

### Valores iniciales

| Parámetro | Valor | Significado |
| --- | ---: | --- |
| Ahorros | USD 35.000 | Efectivo antes de gastos |
| Financiación máxima | 85% | Máximo del vale calculado sobre el precio |
| TEA | 3,75% | Tasa efectiva anual del préstamo en UI |
| Escribana / inmobiliaria | 3% cada una | Sobre el precio, antes del IVA |
| IVA | 22% | Solo sobre esos honorarios |
| UI | UYU 6,6468 | Referencia de la primera captura; actualizar manualmente |
| Dólar | UYU 41,052 | Referencia de la primera captura; actualizar manualmente |
| Administración | USD 1.500 | Cargo total bancario |
| Seguro de incendio | ≈1,414872% del inmueble | `fireInsurancePercent: 2759 / 195000 * 100`; cargo total, no anual |
| Seguro de vida | 0,78% | Se estima anual sobre saldo / 12; confirmar con el banco |
| Pago de cargos | `financed` | Descontados del préstamo; `cash` los paga con ahorros |

Administración e incendio se basan en una simulación para **USD 195.000 a 20 años**. Administración se mantiene en USD 1.500; incendio escala con el precio usando la proporción aproximada `2759/195000`. Esta proporción no confirma una tarifa bancaria universal ni su dependencia del plazo.

## Cómo se calcula

1. Honorario = precio × porcentaje × (1 + IVA).
2. Se restan los honorarios y, si corresponde, los cargos pagados en efectivo de tus ahorros.
3. El resto se destina a la entrega, sin valores negativos ni mayores que el precio.
4. Líquido necesario = precio − entrega.
5. Vale necesario = líquido necesario + cargos financiados. Vale máximo = precio × 85%. Vale a simular = menor entre el necesario y el máximo porcentual. **Las cuotas se calculan sobre ese vale**, que es tu deuda.
6. Líquido disponible = vale a simular − cargos financiados. Entrega al banco = precio − líquido disponible. Aunque falte efectivo, se muestran las cuotas del préstamo disponible, suponiendo que completás el faltante. La fila de efectivo mínimo se resalta en rojo y muestra cuánto falta. La entrega exactamente igual a la mínima es válida.
7. Si podés comprar al contado, no se aplican seguros ni cargos del préstamo y se muestran los ahorros restantes.

La cuota base usa sistema francés y tasa mensual efectiva:

```
r = (1 + TEA/100)^(1/12) − 1
n = años × 12
cuota = vale × r / (1 − (1+r)^(-n))
```

Con tasa cero: `vale/n`. Se agrega por separado el seguro de vida inicial estimado: `vale × tasaAnual/100 / 12`. Se muestra **primera cuota estimada**: el seguro sobre saldo disminuye al amortizar. Las conversiones son equivalencias a las cotizaciones configuradas; no predicen futuras cuotas en UYU o USD ni la evolución de la UI.

El seguro de vida está incluido en la cuota total del préstamo. No se deduce otra vez del líquido: administración e incendio ya explican exactamente `165000 − 1500 − 2759 = 160741`.

### Precio máximo de vivienda

Junto a los ahorros aparece el máximo de compra según el efectivo y los límites configurados, incluyendo honorarios, administración e incendio. Con los valores iniciales es **USD 141.142,53**. Se redondea hacia abajo al centavo; no evalúa ingresos ni aprobación del banco.

Con el 85% aplicado al vale, la restricción porcentual es `precio ≤ (ahorros − administración) / (1 − financiación + honorariosConIVA + incendio)`. También se contempla comprar al contado sin cargos de préstamo. El valor mostrado es una estimación de efectivo y no evalúa ingresos ni aprobación bancaria.

### Referencias verificadas

- **Captura bancaria:** precio USD 195.000, vale USD 165.000, administración USD 1.500 e incendio USD 2.759 → líquido USD 160.741, entrega USD 34.259. Sumando honorarios de USD 14.274, necesitás USD 48.533 en efectivo: faltan USD 13.533 respecto de USD 35.000. El vale ofrecido de USD 165.000 es distinto del máximo teórico de USD 165.750.
- **Ejemplo original sin cargos bancarios:** precio USD 165.000 → honorarios USD 12.078, entrega USD 22.922, líquido necesario USD 142.078, máximo USD 140.250, faltante USD 1.828. Para reproducirlo, poné administración e incendio en cero.
- **Configuración inicial con cargos bancarios:** precio USD 165.000 → incendio USD 2.334,54; vale necesario USD 145.912,54; vale simulado USD 140.250; líquido USD 136.415,46; entrega USD 28.584,54; faltante USD 5.662,54. Las cuotas se calculan sobre USD 140.250.

- **Regla dinámica sin tope fijo:** precio USD 195.000 → máximo bruto 85% = USD 165.750; incendio USD 2.759; líquido estimado USD 161.491; entrega mínima USD 33.509; efectivo total estimado USD 47.783; faltante USD 12.783. La oferta de la captura con vale de USD 165.000 se conserva como referencia histórica.

La cuota de **6.412 UI / UYU 42.578** de la captura no se puede reconstruir exactamente sin la fórmula del seguro de vida y las cotizaciones de esa simulación. No se mezclan silenciosamente con las cotizaciones de la otra captura ni se inventa una fórmula para forzar coincidencia. El resultado es una estimación, no una oferta bancaria.

## Ejecutar en tu computadora

Requiere Node.js 22.12 o posterior y npm.

```bash
npm ci
npm run dev
```

Abrí la dirección que imprime Vite. Para validar y compilar:

```bash
npm test
npm run build
npm run preview
```

`dist/` contiene la página lista para publicar. Se genera con rutas relativas, compatibles con repositorios de GitHub Pages como `/calculadora-credito-hipotecario/`.

## Mini guía: GitHub Pages

GitHub Pages es suficiente: esta aplicación es estática. No necesita Vercel ni servidores adicionales.

1. Subí estos archivos a un repositorio de GitHub, con rama **`main`**. Incluí `package-lock.json` y `.github/workflows/deploy.yml`; no subas `node_modules` ni `dist`. Si tu rama tiene otro nombre, cambiá `branches: [main]` en el workflow.
2. En el repositorio, entrá a **Settings → Pages → Build and deployment → Source** y elegí **GitHub Actions**. En una cuenta gratuita, usá un repositorio público para Pages.
3. Hacé push a `main`. Si el primer push ocurrió antes de habilitar Pages, entrá a **Actions → Publicar calculadora en GitHub Pages → Run workflow**.
4. Esperá a que terminen `build` y `deploy`. El flujo ejecuta pruebas antes de publicar. La URL aparece en el job de deploy y en Settings → Pages, normalmente `https://TU-USUARIO.github.io/NOMBRE-REPO/`.
5. Para cambiar los valores predeterminados para todos: editá `src/config.js`, hacé commit y push a `main`. El workflow vuelve a probar y publicar. Los cambios hechos desde la interfaz quedan solo en el navegador donde se hicieron.

También podés editar `src/config.js` desde la web de GitHub y confirmar el cambio en `main`.

## Estructura

- `src/config.js`: valores predeterminados y metadata de controles.
- `src/user-config.js`: overrides parciales y persistencia local segura.
- `src/quotations.js`: descarga la UI diaria del BCU y la venta BROU del dólar vía Datos Uruguay.
- `src/calculator.js`: fórmulas y validaciones, sin dependencias del DOM.
- `src/main.js`: pantallas y navegación; estado temporal de precio/moneda.
- `src/style.css`: diseño responsive y accesibilidad visual.
- `tests/calculator.test.js`: referencias, casos límite, tasas y conversiones.
- `tests/user-config.test.js`: defaults, overrides, reset, datos inválidos y storage bloqueado.
- `.github/workflows/deploy.yml`: compilación y publicación.

Las fuentes tienen alternativas locales: si Google Fonts no está disponible, la calculadora sigue funcionando.

### Verificación opcional en navegador

Hay una prueba reproducible de navegación, resultados, monedas, edición/persistencia local, accesibilidad por teclado y anchos 320/390/768/1440 px:

```bash
npm install --no-save playwright
npx playwright install chromium
npm run build
node tests/browser.mjs
```

Genera capturas en `test-results/` (ignorado por Git). Para usar Chrome instalado, podés pasar `CHROME_PATH=/ruta/a/chrome`. Esta prueba levanta un servidor temporal y lo cierra al terminar.
