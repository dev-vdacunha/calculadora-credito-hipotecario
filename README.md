# Mi casa · Calculadora hipotecaria

Una página en español para saber cuánto efectivo necesitás para comprar un inmueble y cómo quedarían las cuotas a **10, 15, 20, 25 o 30 años**. Adaptada a celular, con cambio entre UYU, UI y USD mediante flechas.

## Configuración: editar, commit y publicar

Todos los valores están en **[`src/config.js`](src/config.js)**, dentro de `config`. Cada propiedad tiene un comentario y una descripción visible en la pantalla Configuración. No hay base de datos, cuentas, API ni almacenamiento local de parámetros. La pantalla es de consulta: los cambios se hacen en Git.

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
| Financiación máxima | 85% | Límite sobre la base seleccionada |
| TEA | 3,75% | Tasa efectiva anual del préstamo en UI |
| Escribana / inmobiliaria | 3% cada una | Sobre el precio, antes del IVA |
| IVA | 22% | Solo sobre esos honorarios |
| UI | UYU 6,6468 | Referencia de la primera captura; actualizar manualmente |
| Dólar | UYU 41,052 | Referencia de la primera captura; actualizar manualmente |
| Administración | USD 1.500 | Cargo total bancario |
| Seguro de incendio | USD 2.759 | Importe total, no mensual |
| Seguro de vida | 0,78% | Se estima anual sobre saldo / 12; confirmar con el banco |
| Pago de cargos | `financed` | Descontados del vale; `cash` los paga con ahorros |
| Base del límite | `gross` | Vale completo; `net` aplica el límite al líquido de compra |

Administración e incendio son importes de una simulación para **USD 195.000 a 20 años**: no se conoce su fórmula para otros precios/plazos. Se mantienen como importes configurables y no se presentan como tarifas universales. La aplicación indica esto en la pantalla de configuración.

## Cómo se calcula

1. Honorario = precio × porcentaje × (1 + IVA).
2. Se restan los honorarios y, si corresponde, los cargos pagados en efectivo de tus ahorros.
3. El resto se destina a la entrega, sin valores negativos ni mayores que el precio.
4. Líquido necesario = precio − entrega.
5. Vale necesario = líquido necesario + cargos financiados. **Las cuotas se calculan sobre el vale**, que es tu deuda.
6. Se compara el vale o el líquido con el límite seleccionado. Si falta efectivo no se calculan cuotas, pero se muestran ambos máximos y cuánto falta. La entrega exactamente igual a la mínima es válida.
7. Si podés comprar al contado, no se aplican seguros ni cargos del préstamo y se muestran los ahorros restantes.

La cuota base usa sistema francés y tasa mensual efectiva:

```
r = (1 + TEA/100)^(1/12) − 1
n = años × 12
cuota = vale × r / (1 − (1+r)^(-n))
```

Con tasa cero: `vale/n`. Se agrega por separado el seguro de vida inicial estimado: `vale × tasaAnual/100 / 12`. Se muestra **primera cuota estimada**: el seguro sobre saldo disminuye al amortizar. Las conversiones son equivalencias a las cotizaciones configuradas; no predicen futuras cuotas en UYU o USD ni la evolución de la UI.

### Referencias verificadas

- **Captura bancaria:** precio USD 195.000, vale USD 165.000, administración USD 1.500 e incendio USD 2.759 → líquido USD 160.741, entrega USD 34.259. Sumando honorarios de USD 14.274, necesitás USD 48.533 en efectivo: faltan USD 13.533 respecto de USD 35.000. El vale ofrecido de USD 165.000 es distinto del máximo teórico de USD 165.750.
- **Ejemplo original sin cargos bancarios:** precio USD 165.000 → honorarios USD 12.078, entrega USD 22.922, líquido necesario USD 142.078, máximo USD 140.250, faltante USD 1.828. Para reproducirlo, poné administración e incendio en cero.
- **Configuración inicial con cargos bancarios:** precio USD 165.000 → vale necesario USD 146.337, máximo USD 140.250, faltante USD 6.087.

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
5. Para cambiar parámetros: editá `src/config.js`, hacé commit y push a `main`. El workflow vuelve a probar y publicar. Recargá la página cuando termine el deploy para ver los valores nuevos.

También podés editar `src/config.js` desde la web de GitHub y confirmar el cambio en `main`.

## Estructura

- `src/config.js`: valores compartidos y descripciones.
- `src/calculator.js`: fórmulas y validaciones, sin dependencias del DOM.
- `src/main.js`: pantallas y navegación; estado temporal de precio/moneda.
- `src/style.css`: diseño responsive y accesibilidad visual.
- `tests/calculator.test.js`: referencias, casos límite, tasas y conversiones.
- `.github/workflows/deploy.yml`: compilación y publicación.

Las fuentes tienen alternativas locales: si Google Fonts no está disponible, la calculadora sigue funcionando.

### Verificación opcional en navegador

Hay una prueba reproducible de navegación, resultados, monedas, accesibilidad por teclado, ausencia de almacenamiento y anchos 320/390/768/1440 px:

```bash
npm install --no-save playwright
npx playwright install chromium
npm run build
node tests/browser.mjs
```

Genera capturas en `test-results/` (ignorado por Git). Para usar Chrome instalado, podés pasar `CHROME_PATH=/ruta/a/chrome`. Esta prueba levanta un servidor temporal y lo cierra al terminar.
