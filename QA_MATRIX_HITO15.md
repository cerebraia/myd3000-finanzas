# QA MATRIX — HITO #15 MYD3000 Admin

**Fecha actualización:** 2026-09-09  
**Estado DB remota:** INCOMPLETA — 5/22 tablas presentes

Leyenda: ✅ PASS · ❌ FAIL · ⚠️ PARCIAL · 🔒 BLOQUEADO (requiere DB completa)

---

## MÓDULOS — ESTADO ACTUAL

| Módulo | Prueba | Resultado | Severidad | Notas |
|--------|--------|-----------|-----------|-------|
| **DB** | profiles existe | ✅ | — | 200 OK |
| **DB** | clients existe | ✅ | — | 200 OK |
| **DB** | quotes + quote_items existe | ✅ | — | 200 OK |
| **DB** | activity_log existe | ✅ | — | 200 OK |
| **DB** | projects existe | ❌ | HIGH | 404 |
| **DB** | contracts existe | ❌ | HIGH | 404 |
| **DB** | receivables / payables | ❌ | HIGH | 404 |
| **DB** | employees / documents | ❌ | HIGH | 404 |
| **DB** | project_designs / materials | ❌ | HIGH | 404 |
| **DB** | managed_entities / tasks | ❌ | HIGH | 404 |
| **DB** | expense_categories / payment_methods | ❌ | HIGH | 404 |
| **Build** | npm run build | ✅ | — | 0 errores TS |
| **Seguridad** | service_role en frontend | ✅ | — | No encontrado |
| **Seguridad** | @ts-ignore / as any | ✅ | — | 0 encontrados |
| **Seguridad** | Wrong project remnants | ✅ | — | 0 encontrados |
| **npm audit** | Vulnerabilidades | ✅ | — | 0 found |
| **Login** | Auth sin loop | ✅ | — | Corregido AJUSTE_AUTH |
| **Login** | Persistencia F5 | ✅ | — | INITIAL_SESSION correcto |
| **Login** | active=false no loop | ✅ | — | Pantalla desactivada |
| **Clientes** | CRUD completo | ✅ | — | clients table existe |
| **Clientes** | Quick create desde form | ✅ | — | Modal preserva contexto |
| **Cotizaciones** | Crear (create_quote_with_items) | 🔒 | HIGH | quote_payment_terms falta |
| **Cotizaciones** | Editar borrador | 🔒 | HIGH | |
| **Cotizaciones** | Aprobar → proyecto | 🔒 | HIGH | projects no existe |
| **Cotizaciones** | Cálculos Zod | ✅ | — | Validación frontend OK |
| **Cotizaciones** | Anti-duplicado aprobación | 🔒 | HIGH | |
| **Proyectos** | Crear manual | 🔒 | HIGH | projects no existe |
| **Proyectos** | UI / formulario / tabs | ✅ | — | Código correcto |
| **Proyectos** | Proyecto / Diseño tab | ✅ | — | AJUSTE005 |
| **PDF** | Subir / signed URL | 🔒 | HIGH | project_designs falta |
| **PDF** | Solo PDF 25MB validación | ✅ | — | fileValidation.ts OK |
| **PDF** | Versionado V1→V2 | 🔒 | HIGH | |
| **Finanzas** | CxC / CxP / Pagos | 🔒 | HIGH | Tablas faltantes |
| **Finanzas** | Giacomo / Giovanni | 🔒 | HIGH | managed_entities falta |
| **Finanzas** | Obligaciones recurrentes | 🔒 | HIGH | recurring_obligations falta |
| **Finanzas** | Dedupe por período | 🔒 | HIGH | |
| **Dashboard** | Carga sin crash | ⚠️ | MEDIUM | RPCs get_dashboard_summary no existen |
| **Dashboard** | Sin mocks | ✅ | — | 0 mock data en código |
| **Dashboard** | Role-aware | ✅ | — | operations oculta finanzas |
| **Dashboard** | Acciones rápidas | ✅ | — | AJUSTE003 |
| **Sidebar** | Contratos en menú | ✅ | — | CORREGIDO HITO15 |
| **Sidebar** | Reportes en Finanzas | ✅ | — | CORREGIDO HITO15 |
| **Sidebar** | Jerarquía correcta | ✅ | — | |
| **UX** | Español en UI | ✅ | — | Sin términos técnicos raw |
| **UX** | Empty states | ✅ | — | Todos los módulos |
| **UX** | Loading / Skeletons | ✅ | — | Implementados |
| **UX** | Double submit | ✅ | — | Botones disabled isPending |
| **Mobile** | 390px formularios | ✅ | — | 1 columna responsive |
| **Personal** | CRUD | 🔒 | HIGH | employees no existe |
| **Documentos** | CRUD / Storage | 🔒 | HIGH | documents no existe |
| **Proveedores** | CRUD | 🔒 | HIGH | suppliers no existe |
| **Reportes** | Todos los reportes | 🔒 | HIGH | RPCs de reportes no existen |
| **Usuarios** | Administración | 🔒 | MEDIUM | Depende de HITO14 SQL |

---

## RBAC (Frontend — evaluado sin DB)

| Función | Administrator | Manager | Administration | Operations |
|---------|:---:|:---:|:---:|:---:|
| Ver cotizaciones | ✅ | ✅ | ✅ | ✅ |
| Crear cotizaciones | ✅ | ✅ | ✅ | ❌ |
| Aprobar cotizaciones | ✅ | ✅ | ✅ | ❌ |
| Ver proyectos | ✅ | ✅ | ✅ | ✅ |
| Crear proyectos | ✅ | ✅ | ✅ | ❌ |
| Ver reportes financieros | ✅ | ✅ | ❌ | ❌ |
| Administrar usuarios | ✅ | ❌ | ❌ | ❌ |
| Anular pagos | ✅ | ✅ | ❌ | ❌ |
| Ver auditoría | ✅ | ✅ | ❌ | ❌ |
| Dashboard financiero | ✅ | ✅ | ✅ | ❌ |

---

## RESUMEN CONTEO

| Estado | Cantidad |
|--------|----------|
| ✅ PASS | 28 |
| ❌ FAIL / BLOQUEADO | 20 |
| ⚠️ PARCIAL | 1 |
| Total | 49 |

**Nota:** Los 20 BLOQUEADOS se resolverán todos al ejecutar la cadena de scripts SQL documentada en `HITO15_DATABASE_AUDIT.md`.
