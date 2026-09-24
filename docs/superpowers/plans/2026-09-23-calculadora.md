# Calculadora hipotecaria Implementation Plan

> Execute inline with superpowers:executing-plans; user explicitly requested implementation.

**Goal:** Calculadora mobile con referencia bancaria, parámetros en JS y publicación estática.
**Architecture:** Funciones puras de cálculo, objeto de configuración único, interfaz DOM accesible.
**Tech Stack:** JavaScript ES modules, CSS, Vite, Node test runner.
**Spec:** ../specs/2026-09-23-calculadora-design.md

## Global constraints
- Configuración en src/config.js, sin backend, auth ni localStorage.
- TEA 3,75%, plazos 10/15/20/25/30, honorarios 3% + IVA 22%.
- Sin cuotas cuando no alcanza; mostrar líquido, vale, tope y faltante.
- Seguro de vida estimado identificado; importes bancarios de referencia.

## Review focus
- Ahorros menores que honorarios: entrega nunca negativa.
- Ahorros suficientes para compra: sin cargos de préstamo.
- Importe vacío/no finito/negativo: sin resultados engañosos.
- Límite exacto: admitido con tolerancia numérica menor a un centavo.
- Publicación en subruta y pantalla de 320 px: módulos accesibles, sin scroll horizontal.

## Task 1: Motor y configuración
- [x] Crear package.json y tests/calculator.test.js con casos de 165000 sin cargos (142078 requerido, 1828 faltante), referencia bancaria (160741 líquido, 34259 entrega), cargos iniciales, borde, efectivo, conversiones y validación.
- [x] Ejecutar `npm test` antes de implementar y observar fallo por módulo ausente.
- [x] Crear src/config.js con objeto documentado y src/calculator.js exportando validateConfig(config), calculate(price, config), payment(principal, tea, years), convert(usd, currency, config), bankBreakdown(price, gross, config).
- [x] Ejecutar `npm test` y verificar todas las expectativas.

## Task 2: Interfaz
- [x] Crear index.html, src/main.js y src/style.css: entrada USD, resumen de fondos, estado de elegibilidad, cuotas, selector con flechas y configuración de consulta.
- [x] Comprobar navegación por teclado, casos vacío/viable/no viable, moneda en todos los plazos y consulta de parámetros en browser.
- [x] Comprobar 320/390/768/1440 px sin desbordamiento y revisar captura visual.

## Task 3: Publicación y cierre
- [x] Crear workflow Pages con npm ci, tests, build y artifact; base relativa para subrutas.
- [x] Crear README con edición config, fórmulas, supuestos, prueba local y pasos de GitHub Pages.
- [x] Ejecutar suite y build finales; revisión independiente del código y corrección de hallazgos relevantes.

## Execution ledger
- No hay repositorio Git funcional: .git es un directorio vacío protegido. Se trabaja en el workspace autorizado, sin commits ni worktree. Entregar archivos y guía para inicializar/publicar desde un checkout Git real.
- Implementación autorizada por «Implementar». Plan ejecutado inline sin otra ronda de aprobación.

- Motor: 14 pruebas pasan, incluido el caso de compra al contado y los dos hallazgos del revisor (financiación sin líquido útil, conversiones no finitas).
- Browser: navegación, cuotas, monedas, teclado, estados vacíos/inválidos/al contado, configuración de consulta, ausencia de localStorage, publicación en subruta y anchos 320/390/768/1440 verificados con Chrome. Capturas revisadas visualmente.
- Build Vite correcto, workflow y guía listos. Sin publicación externa ni commits: el workspace no tiene metadatos Git funcionales.
- Ruling: seguro de vida estimado anual sobre saldo, base del 85% sobre vale, ambos explicados/configurables conforme al diseño. Si el banco usa otra fórmula, será necesario ajustar la estimación.
- Revisión independiente completada; ambos hallazgos corregidos. No quedan hallazgos diferidos.
