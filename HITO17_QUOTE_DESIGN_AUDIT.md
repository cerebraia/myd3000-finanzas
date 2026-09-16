# HITO #17 — AUDITORÍA DE DISEÑO DE COTIZACIONES

**Fecha:** 2026-09-09

---

## ESTADO ACTUAL — COMPONENTES

| Componente | Líneas | Estado |
|-----------|--------|--------|
| /cotizaciones (index.tsx) | 363 | BUENO — lista, KPIs, filtros, mobile cards |
| /cotizaciones/nueva (NewQuote.tsx) | 9 | BUENO — delega a QuoteForm |
| /cotizaciones/:id (QuoteDetail.tsx) | 678 | BUENO — detalle, acciones, versiones |
| /cotizaciones/:id/editar (EditQuote.tsx) | 57 | BUENO — carga datos y delega a QuoteForm |
| QuoteForm.tsx | 681 | BUENO — zod, fieldArray, cálculos en tiempo real |
| QuotePrint.tsx | 324 | MEJORABLE — estructura correcta, visual mejorable |

---

## AUDITORÍA ESPECÍFICA — QuotePrint.tsx

### Problemas visuales identificados

| # | Problema | Severidad | Fix |
|---|---------|-----------|-----|
| P1 | Plan de pago usa cards web con bordes redondeados | ALTA | Cambiar a tabla editorial limpia |
| P2 | `✓` y `✕` emoji en includes/excludes no confiables en print | MEDIA | Cambiar a texto plano `—` |
| P3 | `formatMeasures` muestra "Mts Alto", "Mts Ancho" verbose | BAJA | Simplificar a `2.40 × 1.00 × 0.60 m` |
| P4 | Label "Facturar a" es lenguaje contable/técnico | BAJA | Cambiar a "CLIENTE" |
| P5 | `company_settings` no usado — nombre hardcodeado | MEDIA | Cargar desde DB con fallback |
| P6 | Sin `-webkit-print-color-adjust` — navy puede no imprimir | ALTA | Agregar en CSS |
| P7 | Sin break-inside protect en secciones clave | MEDIA | Agregar en firma y total |
| P8 | Firma usa "Nombre: ___..." — puede simplificarse | BAJA | Limpiar formato |

### Lo que funciona bien

- Estructura A4 correcta (`@page { size: A4; margin: 20mm 18mm; }`)
- Header logo + número alineados correctamente
- Tabla de items con header navy ✅
- Total alineado a la derecha ✅
- Condiciones numeradas ✅
- `thead { display: table-header-group; }` para multi-página ✅
- `tr { page-break-inside: avoid; }` para filas ✅
- Nav bar oculta en impresión ✅

### Información duplicada

- Ninguna duplicación encontrada

### Información faltante

- Número de página (P-1 de X) — opcional
- Información empresa del pie de página usa hardcode en vez de DB

---

## AUDITORÍA — QuoteDetail.tsx

| Elemento | Estado | Acción |
|----------|--------|--------|
| Header + acciones | ✅ Correcto | Ninguna |
| Sección "Facturar a" | ✅ Aceptable | Renombrar a "Cliente" |
| Tabla items (desktop) | ✅ Correcto | Ninguna |
| Cards items (mobile) | ✅ Correcto | Ninguna |
| Resumen financiero | ✅ Correcto | Ninguna |
| Plan de pago (detail) | ✅ Correcto | Ninguna |
| Incluye/No incluye | ✅ Con iconos Lucide | Ninguna |
| Condiciones | ✅ Numeradas | Ninguna |
| Historial versiones | ✅ Implementado | Ninguna |
| Modal Aprobar | ✅ Con lista de consecuencias | Ninguna |
| Modal No aprobar | ✅ Con selectores | Ninguna |

---

## AUDITORÍA — Quotes/index.tsx (lista)

| Elemento | Estado | Acción |
|----------|--------|--------|
| KPI bar (4 cards) | ✅ | Ninguna |
| Filtros por estado | ✅ | Ninguna |
| Búsqueda | ✅ | Ninguna |
| Tabla desktop | ✅ | Agregar acción Imprimir en fila |
| Cards mobile | ✅ | Ninguna |
| Empty state | ✅ | Ninguna |
| Archive/Restore | ✅ | Ninguna |

---

## AUDITORÍA — QuoteForm.tsx

| Elemento | Estado | Acción |
|----------|--------|--------|
| Selector cliente con búsqueda | ✅ | Ninguna |
| Quick create cliente | ✅ | Ninguna |
| Includes/Excludes checklist | ✅ Toggles con defaults | Ninguna |
| Items con fieldArray | ✅ | Ninguna |
| Cálculo en tiempo real | ✅ | Ninguna |
| Plan de pago | ✅ | Ninguna |
| Validación Zod | ✅ | Ninguna |
| Condiciones textarea | ✅ | Ninguna |
| Guard beforeunload | ✅ | Ninguna |
| Botones Borrador / Enviar revisión | ✅ | Ninguna |

---

## CSS DE IMPRESIÓN — index.css

| Elemento | Estado | Acción |
|----------|--------|--------|
| `@page` A4 con márgenes | ✅ | Ninguna |
| `.no-print` hide | ✅ | Ninguna |
| `thead display: table-header-group` | ✅ | Ninguna |
| `tr break-inside: avoid` | ✅ | Ninguna |
| `-webkit-print-color-adjust` | ❌ FALTA | Agregar para navy header |
| `print-color-adjust` | ❌ FALTA | Agregar |
| `.print-protect` break class | ❌ FALTA | Agregar |

---

## DECISIONES DE DISEÑO

### Paleta de impresión
- Texto principal: `#1a2332` (navy oscuro)
- Texto secundario: `#6b7a90` (gris MYD)
- Acento / totales: `#0f2040` (myd-navy)
- Header tabla: `#0f2040` texto blanco
- Filas alternas: `#f8fafc` / blanco
- Separadores: `#e2e8f0`

### Tipografía
- Body: Helvetica 11pt
- Encabezados sección: uppercase tracking-widest 8pt gris
- Total: bold 13pt navy
- Firmas: 8pt gris

### No usar en print
- Sombras (box-shadow)
- Border-radius prominentes
- Cards con bordes redondeados para datos financieros
