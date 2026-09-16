# AJUSTE #001 — AUDITORÍA DE USO REAL

**Fecha:** 2026-09-03  
**Perspectiva:** Gerente (Jefferson) + Administración + Operaciones  
**Build:** PASS — 0 errores TypeScript

---

## Rutas revisadas

| # | Ruta | Estado |
|---|------|--------|
| 1 | `/dashboard` | Revisado |
| 2 | `/cotizaciones` | Revisado |
| 3 | `/cotizaciones/nueva` (QuoteForm) | Revisado |
| 4 | `/cotizaciones/:id` (QuoteDetail) | Revisado |
| 5 | `/proyectos` | Revisado |
| 6 | `/proyectos/:id` (ProjectDetail, 7 tabs) | Revisado |
| 7 | `/clientes` | Revisado |
| 8 | `/cuentas-por-cobrar` | Revisado |
| 9 | `/cuentas-por-pagar` + `/cuentas-por-pagar/:id` | Revisado |
| 10 | `/compromisos` (Giacomo/Giovanni) | Revisado |
| 11 | `/obligaciones` | Revisado |
| 12 | `/personal` | Revisado |
| 13 | `/documentos` | Revisado |
| 14 | `/reportes/*` (7 sub-rutas) | Revisado |
| 15 | `/configuracion/usuarios` | Revisado |
| 16 | `/configuracion/sistema` | Revisado |
| 17 | `/configuracion` | Revisado |
| 18 | `/auditoria` | Revisado |
| 19 | `/tareas` | Revisado |
| 20 | `/calendario` | Revisado |
| 21 | `/papelera` | Revisado |
| 22 | `/mi-perfil` | Revisado |
| 23 | `/notificaciones` | Revisado |
| 24 | `/health` | Revisado |

**Total: 24 rutas revisadas**

---

## HALLAZGOS

### BUGS

#### BUG-001 — ALTO — Anular pago no tiene UI (payments.void)
**Módulo:** Cuentas por cobrar / Cuentas por pagar  
**Problema:** El permiso `payments.void` existe en la config y está asignado a `administrator` y `manager`. La DB tiene las columnas `voided_at` y `void_reason`. Pero **no existe ningún botón "Anular pago" en ninguna página** del frontend. El permiso es letra muerta desde el punto de vista del usuario.  
**Impacto:** Jefferson no puede anular un pago equivocado desde la UI. Requeriría modificar la DB directamente, lo que viola las reglas de operación.  
**Tipo:** BUG / BUSINESS FLOW  
**Esfuerzo:** M

#### BUG-002 — ALTO — Manager excluido del botón "Generar obligaciones" en Dashboard
**Módulo:** Dashboard  
**Problema:** `const isAdmin = profile?.role === 'administrator' || profile?.role === 'administration'` — incluye `administration` (que no debería generar obligaciones por su cuenta) pero excluye `manager` (que sí debería poder hacerlo). El botón "Generar obligaciones" solo aparece para esos dos roles.  
**Impacto:** Jefferson como manager no ve el botón. Debe ir a `/configuracion/sistema` para ejecutar la misma acción.  
**Tipo:** BUG  
**Esfuerzo:** S

#### BUG-003 — MEDIO — Títulos de página incorrectos en AppLayout
**Módulo:** Layout / Navegación  
**Problema:** `getPageTitle()` en AppLayout.tsx no tiene handlers para rutas añadidas en HITOs 11-18. Estas rutas muestran "MYD3000 Admin" en el header:  
`/tareas`, `/compromisos`, `/reportes`, `/reportes/*`, `/calendario`, `/papelera`, `/mi-perfil`, `/configuracion/usuarios`, `/configuracion/sistema`  
**Impacto:** UX confuso — el header no da contexto sobre dónde está el usuario.  
**Tipo:** BUG / UX  
**Esfuerzo:** S

#### BUG-004 — MEDIO — Dashboard "Saldo neto" usa Math.abs() con número negativo
**Módulo:** Dashboard  
**Problema:** `value={formatCurrency(Math.abs(netBalance))}` — cuando el saldo neto es negativo (se pagó más de lo que se cobró), el número grande muestra un valor positivo en rojo. El texto complementario dice "negativo" pero el número principal podría ser $3,000 negativo y aparecer como $3,000.  
**Impacto:** Confusión financiera. Un gerente puede interpretar "$3,000 negativo" como que hay $3,000 disponibles.  
**Tipo:** BUG / DATA  
**Esfuerzo:** S

---

### UX ISSUES

#### UX-001 — MEDIO — Manager ve lista de usuarios sin poder accionar
**Módulo:** /configuracion/usuarios  
**Problema:** El manager tiene `users.view` y ve la tabla completa de usuarios con columna "Acciones". Pero no tiene `users.disable` ni `users.change_role`, por lo que el menú "Acciones" no aparece en ninguna fila. La columna queda vacía y parece rota.  
**Impacto:** Confusión visual para el manager.  
**Tipo:** UX  
**Esfuerzo:** S

#### UX-002 — MEDIO — ProjectDetail tiene 7 tabs, "Partidas" raramente útil
**Módulo:** /proyectos/:id  
**Problema:** Tab "Partidas" muestra los ítems de la cotización original. Durante la gestión del proyecto, este dato es raramente consultado — la cotización ya se puede ver desde el link. Los 7 tabs hacen que la navegación sea densa.  
**Impacto:** Fricción visual. El tab de "Partidas" ocupa espacio sin aportar en el flujo operativo diario.  
**Tipo:** UX  
**Esfuerzo:** S

#### UX-003 — MEDIO — QuoteForm es muy larga, sin indicador de progreso
**Módulo:** /cotizaciones/nueva  
**Problema:** El formulario tiene 8+ secciones en scroll vertical: cliente, datos, items, totales, condiciones, incluye, no incluye, términos, notas. En mobile es especialmente pesado. No hay indicador de progreso ni secciones colapsables.  
**Impacto:** Primera vez puede parecer abrumador. En mobile la UX es deficiente.  
**Tipo:** UX  
**Esfuerzo:** L

#### UX-004 — BAJO — Header search bar es decorativa
**Módulo:** Header  
**Problema:** El botón de búsqueda en el header no hace nada cuando se hace click. Muestra "Buscar... ⌘K" pero no tiene implementación.  
**Impacto:** Expectativa no cumplida. Usuarios intentarán buscar y nada pasará.  
**Tipo:** UX  
**Esfuerzo:** S (quitar el placeholder o M para implementar)

#### UX-005 — BAJO — Botones de acción rápida en Dashboard tienen igual peso visual
**Módulo:** Dashboard  
**Problema:** "Nueva cotización", "Nueva tarea", "Generar obligaciones", "Calendario" tienen el mismo estilo visual (border buttons pequeños). "Nueva cotización" debería ser el botón principal destacado.  
**Impacto:** El flujo más importante (crear cotización) no se destaca.  
**Tipo:** UX / VISUAL  
**Esfuerzo:** S

#### UX-006 — BAJO — Dashboard tiene 8 KPIs + compromisos + proyectos activos en primera pantalla
**Módulo:** Dashboard  
**Problema:** La primera pantalla muestra: pendientes urgentes + 4 KPIs financieros + 4 KPIs operativos + compromisos (Giacomo/Giovanni) + proyectos activos. Es mucha información simultánea.  
**Impacto:** Dificulta la tarea central del dashboard: saber qué hacer hoy.  
**Tipo:** UX  
**Esfuerzo:** M

---

### VISUAL

#### VIS-001 — BAJO — Ícono DollarSign en "Actividad reciente" header
**Módulo:** Dashboard  
**Problema:** El header de la sección "Actividad reciente" tiene un ícono `DollarSign` que no es semánticamente correcto para actividad.  
**Tipo:** VISUAL  
**Esfuerzo:** S

---

### DEAD CODE / ROUTES

*(Ya limpiado en HITO18 — 14 archivos eliminados)*  
*(Sin rutas muertas ni botones sin handler adicionales encontrados)*

---

## Scores de uso (1-10, justificados)

| Área | Score | Justificación |
|------|-------|---------------|
| Facilidad de uso | 7/10 | El flujo principal funciona bien. La falta de void payment y los page titles rotos bajan |
| Cotizaciones | 8/10 | Bien estructurado con defaults. Solo la longitud del form en mobile baja |
| Proyectos | 7/10 | 7 tabs son muchos pero la info está bien organizada |
| Finanzas | 6/10 | Sin void payment UI, un flujo importante está incompleto |
| Dashboard | 7/10 | Pendientes accionables funcionan bien. isAdmin bug baja para manager |
| Mobile | 5/10 | El QuoteForm es difícil en móvil. Dashboard KPIs son manejables |
| Consistencia | 7/10 | Page titles rotos bajan la consistencia |
| Estabilidad | 9/10 | Build limpio, sin crashes conocidos |

---

## User Journey — Jefferson (Manager)

| Paso | Estado | Problema |
|------|--------|---------|
| Entrar + ver dashboard | ✅ | OK |
| Ver pendientes urgentes | ✅ | OK |
| Generar obligaciones | ⚠️ | Debe ir a /configuracion/sistema — no está en Dashboard |
| Revisar Giacomo/Giovanni | ✅ | OK — /compromisos funciona bien |
| Ver cobros pendientes | ✅ | OK |
| Registrar cobro | ✅ | OK |
| **Anular cobro equivocado** | ❌ | NO EXISTE botón de anulación en UI |
| Revisar reportes financieros | ✅ | OK (manager tiene reports.financial) |
| Salir | ✅ | OK |

---

## User Journey — Administración

| Paso | Estado | Problema |
|------|--------|---------|
| Crear cotización | ✅ | OK, quick create de cliente funciona |
| Aprobar cotización | ✅ | OK |
| Ver proyecto generado | ✅ | OK |
| Registrar cobro | ✅ | OK |
| Gestionar documentos | ✅ | OK |

---

## User Journey — Operaciones

| Paso | Estado | Problema |
|------|--------|---------|
| Ver proyecto asignado | ✅ | OK |
| Subir diseño PDF | ✅ | OK |
| Aprobar diseño (arquitecto) | ✅ | OK |
| Agregar materiales | ✅ | OK |
| Crear tarea | ✅ | OK |

---

## CRÍTICOS PARA OPERAR

- **BUG-001** (void payment): Financieramente bloqueante. No existe forma de anular un pago desde la UI.
- **BUG-002** (manager + obligaciones): Acceso a función clave desde el dashboard.

## QUICK WINS (bajo riesgo, alto impacto)

- **BUG-002**: 1 línea de código — `||profile?.role === 'manager'`
- **BUG-003**: 10 líneas — agregar cases en `getPageTitle`
- **BUG-004**: 1 línea — quitar `Math.abs()` del netBalance negativo
- **UX-001**: 3 líneas — ocultar columna Acciones si no tiene permisos
- **VIS-001**: 1 línea — cambiar ícono

**5 quick wins en < 20 líneas totales.**
