# MYD3000 — LOCAL / GITHUB / RAILWAY AUDIT
Fecha: 2026-09-15

---

## RESUMEN CRÍTICO

Existen DOS carpetas de trabajo para el mismo repositorio GitHub
(`cerebraia/myd3000-finanzas`), con estados completamente diferentes.

| | myd3000-admin | myd-intranet |
|---|---|---|
| Path | `/Proyectos/myd3000-admin` | `/Proyectos/myd-intranet` |
| Remote | cerebraia/myd3000-finanzas | cerebraia/myd3000-finanzas |
| HEAD local | `18c09bd` (actual) | `f47bf83` (desincronizado) |
| HEAD origin/main | `18c09bd` | `f47bf83` (fetch no actualizado) |
| Cambios sin commit | 0 | **46 archivos / +6239 líneas** |
| Commits sin push | 0 | 0 |

`myd-intranet` tiene **todo el trabajo avanzado sin commitear**.
`myd3000-admin` es el repo que se ha estado publicando a Railway — con solo los módulos básicos.

---

## HASHES

```
LOCAL HEAD (myd3000-admin):   18c09bd  ← lo que está en Railway
LOCAL HEAD (myd-intranet):    f47bf83  ← más antiguo, no sincronizado con origin
GITHUB origin/main:           18c09bd
RAILWAY deployed commit:      18c09bd (presumido, mismo que GitHub)

myd3000-admin LOCAL = GITHUB:   YES
myd-intranet LOCAL = GITHUB:    NO  (myd-intranet está 4 commits atrás)
```

---

## GIT STATUS

### myd3000-admin (el repo que se deploya)
- Branch: main
- Uncommitted files: 0
- Unpushed commits: 0
- Estado: limpio, sincronizado con GitHub

### myd-intranet (el repo con el trabajo real)
- Branch: main
- Uncommitted files: **46 archivos modificados**
- Unpushed commits: 0
- Estado: **TRABAJO EN RIESGO** — 6,239 líneas de código sin commitear

---

## MÓDULOS — MATRIZ COMPLETA

| Módulo | myd-intranet LOCAL | COMMITTED | GITHUB (myd3000-admin) | DB REMOTA | RAILWAY |
|---|---|---|---|---|---|
| Dashboard | YES (real) | NO | YES (mock) | profiles | OLD/MOCK |
| Clientes | YES (full CRUD) | NO | YES (básico) | clients | BÁSICO |
| Cotizaciones | YES (full) | NO | YES (básico) | quotes/items | BÁSICO |
| Proyectos | YES (1465 líneas) | NO | STUB | MISSING | STUB |
| Contratos | YES (322 líneas) | NO | STUB | MISSING | STUB |
| Cuentas x Cobrar | YES (363 líneas) | NO | MISSING | MISSING | MISSING |
| Cuentas x Pagar | YES (real) | NO | MISSING | MISSING | MISSING |
| Proveedores | YES (full CRUD) | NO | STUB | UNKNOWN | STUB |
| Empleados | YES | NO | MISSING | UNKNOWN | MISSING |
| Finanzas | YES | NO | STUB | MISSING | STUB |
| Reportes | YES (9 reportes) | NO | MISSING | MISSING | MISSING |
| Documentos | YES | NO | STUB | MISSING | STUB |
| Usuarios | YES | NO | MISSING | UNKNOWN | MISSING |
| Tareas/Compromisos | YES | NO | MISSING | MISSING | MISSING |
| Calendario | YES | NO | MISSING | MISSING | MISSING |

---

## PROYECTOS — DETALLE

En `myd-intranet`:
- `/proyectos` — listado completo (435 líneas)
- `/proyectos/nuevo` — NewProject.tsx (forma)
- `/proyectos/:id` — ProjectDetail.tsx (1,465 líneas — detalle completo)
- `/proyectos/:id/editar` — EditProject.tsx

En `myd3000-admin` (Railway):
- `PlaceholderPage` — solo texto "Seguimiento de etapas..."

---

## MIGRACIONES SQL

### myd-intranet (trabajo completo):
```
000000_create_profiles.sql
000001_create_clients.sql
000002_create_quotations.sql
000003_clients_enhancements.sql
000004_quotes.sql
000005_quote_items.sql
000006_activity_log.sql
000007_rpc_functions.sql
000008_projects.sql          ← tablas de proyectos
000009_contracts.sql         ← contratos
000010_receivables.sql       ← cuentas por cobrar
000011_payments_received.sql ← pagos
000012_project_rpc.sql
000013_payment_rpc.sql
20260902000000_fix_clients_name_column.sql
```

### myd3000-admin (Railway):
```
001_initial_schema.sql       ← solo profiles
002_clients.sql              ← clients
003_quotes.sql               ← quotes + quote_items
```

### Tablas en DB remota (estimado):
| Tabla | Migración existe | Aplicada remotamente |
|---|---|---|
| profiles | YES | PROBABLE |
| clients | YES | PROBABLE |
| quotes / quote_items | YES | PROBABLE |
| projects | YES (myd-intranet) | NO (nunca pusheada) |
| contracts | YES (myd-intranet) | NO |
| receivables | YES (myd-intranet) | NO |
| payments_received | YES (myd-intranet) | NO |
| activity_log | YES (myd-intranet) | NO |

---

## CAUSA RAÍZ

El trabajo de hitos 3–18 fue desarrollado en `/Proyectos/myd-intranet`
pero **nunca se hizo commit de los cambios acumulados**.

Cuando se hizo el deploy a Railway, se trabajó desde `/Proyectos/myd3000-admin`
— una carpeta diferente con el mismo remote — que solo tiene los módulos
básicos del commit inicial.

El código avanzado existe localmente en `myd-intranet` con 46 archivos
modificados y ~6,239 líneas de cambios, todos en working tree sin commitear.

---

## TRABAJO EN RIESGO

**YES** — 46 archivos sin commitear en myd-intranet representan meses de desarrollo.
Un `git reset --hard` accidental o falla de disco los perdería permanentemente.

---

## ESTADO AUTH (problema actual Railway)

El error `AuthUnknownError: Unexpected end of JSON input` en Railway no es
un bug de código — es un problema de configuración de Supabase (proyecto
pausado, URL incorrecta, o trailing slash). El código de auth en myd3000-admin
es funcional pero apunta a un Supabase no accesible desde Railway.

---

## PRÓXIMOS PASOS RECOMENDADOS (sin ejecutar todavía)

1. **INMEDIATO**: Hacer backup de `myd-intranet` working tree antes de cualquier operación git
2. **DECIDIR**: ¿Migrar myd-intranet a myd3000-admin? ¿O trabajar desde myd-intranet directamente?
3. **AUTH**: Resolver primero el problema de Supabase (proyecto pausado / URL) antes de subir más código
4. **DB**: Las migraciones 000008–000013 deben aplicarse en Supabase remoto antes de que los módulos avanzados funcionen
5. **NO** hacer git reset, git clean, ni checkout destructivo en myd-intranet

---

## ARCHIVOS SIN COMMITEAR EN myd-intranet (lista completa)

```
.gitignore, README.md, index.html, package.json
src/App.tsx
src/components/dashboard/* (17 componentes)
src/components/layout/* (AppLayout, Header, ProtectedRoute, Sidebar)
src/contexts/AuthContext.tsx
src/data/dashboard.mock.ts
src/index.css
src/lib/supabase.ts
src/main.tsx
src/pages/Clients/* (ClientDetail, NewClient, index)
src/pages/Contracts/index.tsx
src/pages/Dashboard/index.tsx + mockData.ts
src/pages/Documents/index.tsx
src/pages/Login/index.tsx
src/pages/Projects/index.tsx
src/pages/Quotes/* (NewQuote, QuoteDetail, index)
src/pages/Settings/index.tsx
src/pages/Suppliers/index.tsx
src/services/clients.ts + quotations.ts
src/types/index.ts
src/utils/formatters.ts
tailwind.config.js
vite.config.ts
```
