# MYD3000 — REPORTE HITO #17: COTIZACIONES

**Fecha:** 2026-09-09  
**Scope:** Pulido módulo de cotizaciones + rediseño documento

---

## QUOTE LIST: PASS
Lista con KPIs, filtros, búsqueda, mobile cards. Acción Imprimir añadida a cada fila.

## NEW QUOTE UX: PASS
Formulario con selector de cliente, fieldArray de items, plan de pago con validación 100%, checklist Incluye/No incluye, condiciones textarea. Sin cambios a la lógica.

## ITEM UX: PASS
Campos claros: descripción, dimensiones (alto/ancho/prof.), cantidad, precio, subtotal calculado en tiempo real.

## PAYMENT TERMS: PASS
Presets 80/20 default. Suma validada al 100% con mensaje de error claro. Plan flexible con N cuotas.

## QUOTE DETAIL: PASS
Header con número, estado, acciones. Cliente, partidas (desktop/mobile), resumen financiero, plan de pago, incluye/no incluye, condiciones, historial de versiones, modales Aprobar/No aprobar.

## DOCUMENT DESIGN: PASS
Rediseño completo de QuotePrint.tsx. Estructura A/B/C/.../L según spec.

## LOGO: PASS
Logo MYD3000 en header del documento. Fallback a texto si SVG no carga.

## BRANDING: PASS
Helvetica, navy #0f2040, blanco, grises. Sin glassmorphism ni gradientes.

## A4: PASS
`@page { size: A4 portrait; margin: 20mm 18mm 20mm 18mm; }`

## LONG QUOTE: PASS
`thead { display: table-header-group; }` para repetición en multi-página. `tr { break-inside: avoid; }` para filas.

## PAGE BREAKS: PASS
`.print-protect` en total, forma de pago y firmas. `h1,h2,h3 { break-after: avoid; }` para títulos.

## PAYMENT PLAN PRINT: PASS
Cambiado de cards web a tabla editorial limpia: Concepto | % | Monto.

## INCLUDES: PASS
Lista con `—` como marcador. Sin emoji.

## EXCLUDES: PASS
Lista con `—` como marcador. Sin emoji.

## TERMS: PASS
Numeración 1. 2. 3. ... con font-size y espaciado adecuado.

## SIGNATURES: PASS
Dos columnas: empresa (con nombre y cargo de company_settings) y cliente. Campos de nombre, CI/RIF y fecha.

## NO NULL/UNDEFINED: PASS
Todos los campos usan `?? '—'` o renderizado condicional. `formatMeasures` devuelve '' si no hay medidas.

## PRINT WITHOUT APP UI: PASS
`.no-print` oculta nav bar. `aside, header, nav` ocultos. Solo el documento se imprime.

## MOBILE: PASS
Detalle: cards para items en mobile. Lista: cards. Formulario: una columna.

## SAVE REGRESSION: PASS
Sin cambios al motor financiero, RPCs, ni validaciones Zod.

## EDIT REGRESSION: PASS
Sin cambios al flujo de edición.

## APPROVAL REGRESSION: PASS
Sin cambios al flujo de aprobación.

## NO DUPLICATE PROJECT: PASS
RPC `approve_quote` tiene guard `IF EXISTS (SELECT 1 FROM projects WHERE quote_id = p_quote_id) RAISE EXCEPTION`.

## TYPESCRIPT: PASS
0 errores TypeScript.

## BUILD: PASS
✓ built in 1.62s

## READY FOR DEMO: YES (si DB bootstrap ejecutado)

---

## CAMBIOS IMPLEMENTADOS

### QuotePrint.tsx — Rediseño completo del documento

| Elemento | Antes | Después |
|---------|-------|---------|
| Payment plan | Cards con `rounded-lg border` web-style | Tabla editorial limpia (Concepto / % / Monto) |
| Includes ✓ | Emoji `✓` (unreliable en print) | `—` en verde |
| Excludes ✕ | Emoji `✕` | `—` en rojo |
| formatMeasures | "2.40 Mts Alto × 1.00 Mts Ancho" | "2.40 × 1.00 m" |
| Label cliente | "Facturar a" | "Cliente" (uppercase label) |
| Company settings | Hardcoded | useQuery(getCompanySettings) + fallback a DEFAULT_COMPANY |
| Footer | Solo nombre + número | Nombre, dirección, teléfono, email + número |
| Firma empresa | Nombre hardcoded | Usa `authorized_signer_name` de company_settings |
| Header acento | `border-b border-gray-200` | `border-bottom: 3px solid navy` |
| `print-color-adjust` | Faltaba | `exact !important` en CSS |
| `.print-protect` | No existía | Añadido para total, pago, firmas |

### index.css
- Añadido `-webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;`
- Añadido `h1, h2, h3 { break-after: avoid; }`
- Añadido `.print-protect { break-inside: avoid; }`
- Margen inferior ajustado a 20mm

### QuoteDetail.tsx
- "Facturar a" → "Cliente"

### Quotes/index.tsx
- Icono `Printer` añadido a acciones de fila desktop
- Click en Printer → `/cotizaciones/:id/imprimir`
