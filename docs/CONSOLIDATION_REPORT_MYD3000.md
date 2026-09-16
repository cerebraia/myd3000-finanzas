# MYD3000 — ADMIN → INTRANET CONSOLIDATION REPORT
Fecha: 2026-09-16

---

## CONTEXTO

Existían DOS carpetas locales apuntando al mismo repositorio GitHub
(`cerebraia/myd3000-finanzas`) con estados completamente diferentes:

| | myd3000-admin | myd-intranet |
|---|---|---|
| Path | `/Proyectos/myd3000-admin` | `/Proyectos/myd-intranet` |
| Remote | cerebraia/myd3000-finanzas | cerebraia/myd3000-finanzas |
| HEAD antes de consolidar | `18c09bd` | `7002c66` |
| Branch | main | main |

Ambos divergieron tras el commit `f47bf83` (chore: incorporate remote brand assets).

- **myd3000-admin**: 5 commits de divergencia (Railway TypeScript fixes, auth diagnosis)
- **myd-intranet**: 4 commits de divergencia (preservación implementación avanzada hitos 1–18)

---

## RESULTADO

**SOURCE OF TRUTH FINAL: `myd-intranet`**

---

## ESTADO FINAL

| Campo | Resultado |
|---|---|
| MYD-ADMIN WORK PRESERVED | YES — commit `3026829` en myd3000-admin |
| MYD-INTRANET WORK PRESERVED | YES — todos los módulos avanzados intactos |
| ADMIN UNCOMMITTED WORK FOUND | YES — `AUDIT_LOCAL_GITHUB_RAILWAY_MYD3000.md` |
| ADMIN PRESERVATION COMMIT | `3026829` en `/Proyectos/myd3000-admin` |
| SECRET SCAN | PASS |
| CLEAN NPM CI | PASS |
| BUILD | PASS (1790 modules, 0 errors) |
| CONSOLIDATION COMMIT | `3e840d7` en myd-intranet |
| SUPABASE CHANGED | NO |
| SAFE TO PUSH | PENDIENTE REVISIÓN |

---

## MATRIZ DE CONSOLIDACIÓN

| FILE / AREA | MYD-INTRANET | MYD3000-ADMIN | DECISIÓN | ACCIÓN | RAZÓN |
|---|---|---|---|---|---|
| `App.tsx` | 40+ rutas lazy, full modules | 12 rutas, stubs | INTRANET | KEEP | Versión avanzada |
| `ProtectedRoute.tsx` | session/profile/active=false guard | simple user check | INTRANET | KEEP | Más robusto, previene login loops |
| `AuthContext.tsx` | isMounted, session/profile, signIn/signOut | login/logout/user simpler | INTRANET + ADMIN | CHERRY-PICK | Se integraron error codes y diagnostic logging de admin |
| `supabase.ts` | sin guard de env vars | supabaseConfigured + placeholder | ADMIN | CHERRY-PICK | Previene crash en Railway si vars no están seteadas |
| `Login/index.tsx` | error handling básico | mejor error mapping | MERGE | ACTUALIZADO | Simplificado para usar mensajes amigables de signIn |
| `package.json` | v1.0.0 + engines + start script + serve | v0.1.0 + sonner, sin start | INTRANET | KEEP | Railway production ready |
| `railway.json` | presente | MISSING | INTRANET | KEEP | Config de deploy correcta |
| `Projects/` | 5 archivos, CRUD completo (~1465 líneas) | PlaceholderPage | INTRANET | KEEP | Implementación avanzada |
| `Quotes/` | 6 archivos (EditQuote, Print, Form) | NewQuote + QuoteDetail básico | INTRANET | KEEP | Versión más completa |
| `Clients/` | ClientDetail + NewClient | ClientDetail/index + ClientFormModal | INTRANET | KEEP | Compatible con rutas existentes |
| `Contracts/` | ContractDetail + index | PlaceholderPage | INTRANET | KEEP | Implementación real vs stub |
| `Employees/` | EmployeeDetail + index | MISSING | INTRANET | KEEP | Solo existe en intranet |
| `Receivables/Payables/Reportes` | completo (9 reportes) | MISSING | INTRANET | KEEP | Solo existe en intranet |
| `supabase/migrations/` | 000000–000013 + fix_clients | 001-003 solamente | INTRANET | KEEP | Más completo |
| `tsconfig.app.json` | sin ignoreDeprecations | idéntico | INTRANET | KEEP | Sin diferencias |
| `docs/*.md` + `sql/*.sql` | reorganizados en carpetas | — | INTRANET | REORGANIZADO | Raíz limpia |

---

## CAMBIOS CHERRY-PICKED DESDE myd3000-admin

### 1. `src/lib/supabase.ts`
**Problema resuelto:** myd-intranet crasheaba si `VITE_SUPABASE_URL` o
`VITE_SUPABASE_ANON_KEY` no estaban definidas al momento del build en Railway.

**Cambio:** Se agregó `supabaseConfigured` flag y fallback a placeholder,
con `console.warn` explicativo. El cliente se crea siempre sin lanzar excepción.

### 2. `src/contexts/AuthContext.tsx` — función `signIn`
**Problema resuelto:** En Railway, cuando Supabase no es alcanzable, el error
retornado es `AuthUnknownError` con `code=undefined` y `status=undefined`,
lo que hacía imposible diagnosticar la causa sin DevTools.

**Cambio:** Se agregó:
- Logging diagnóstico detallado: `error.name`, `error.code`, `error.status`,
  `error.message`, y `originalError` (para capturar network errors subyacentes)
- Mapeo de códigos de error a mensajes amigables:
  - `invalid_credentials` → "Correo o contraseña incorrectos."
  - `email_not_confirmed` → "Debes confirmar tu correo electrónico..."
  - `user_banned` → "Tu usuario está desactivado..."
  - `over_request_rate_limit` → "Demasiados intentos..."
  - fallback → muestra `error.name: error.message` para diagnóstico visible

### 3. `src/pages/Login/index.tsx`
**Cambio:** `onSubmit` simplificado para usar directamente `error.message`
(que ahora viene pre-procesado y amigable desde `signIn`) en lugar de hacer
su propio parsing del string crudo de Supabase.

---

## CAMBIOS DESCARTADOS DE myd3000-admin

| Archivo | Razón del descarte |
|---|---|
| `App.tsx` completo | myd-intranet tiene 40+ rutas vs 12 stubs |
| `ProtectedRoute.tsx` completo | intranet maneja active=false sin loops |
| `AuthContext.tsx` estructura (login/logout/user) | intranet tiene arquitectura más robusta con isMounted y session/profile separados |
| `package.json` completo | intranet ya tiene mejor config Railway (engines, start script, serve) |
| `sonner` dependency | intranet tiene su propio sistema Toast (ToastContext) |

---

## MÓDULOS AVANZADOS — ESTADO FINAL

| Módulo | Estado |
|---|---|
| Projects (List, New, Detail, Edit) | PRESERVED |
| Quotes (List, New, Detail, Edit, Print) | PRESERVED |
| Clients (List, Detail, New) | PRESERVED |
| Contracts (List, Detail) | PRESERVED |
| Receivables | PRESERVED |
| Payables (List, Detail) | PRESERVED |
| Employees (List, Detail) | PRESERVED |
| Reportes (9 reportes) | PRESERVED |
| Suppliers (List, New, Edit) | PRESERVED |
| Dashboard | PRESERVED |
| Auth (signIn, signOut, ProtectedRoute) | PRESERVED + mejorado |

---

## RAILWAY — ESTADO

| Componente | Estado |
|---|---|
| `railway.json` | Presente en myd-intranet |
| `package.json start script` | `serve dist -s -l ${PORT:-4173}` |
| `engines.node` | `>=20.0.0` |
| `serve` dependency | `^14.2.4` |
| Build command | `npm run build` (vía railway.json) |

---

## DATABASE / SQL

| Archivo | Origen | Estado |
|---|---|---|
| `supabase/migrations/000000–000013` | myd-intranet | Completo, NO ejecutado remotamente para tablas avanzadas |
| `sql/SUPABASE_DIAGNOSTIC_READONLY.sql` | myd-intranet (untracked) | Creado en intranet, seguro para leer — NO ejecutar sin revisión |
| `sql/SUPABASE_PROJECTS_BOOTSTRAP_INCREMENTAL.sql` | myd-intranet (untracked) | Creado en intranet, REQUIERE REVISIÓN antes de ejecutar |

**SUPABASE CHANGED: NO**

---

## GIT — ESTADO FINAL

```
myd-intranet HEAD:   3e840d7  fix: consolidate recent MYD3000 production changes
myd3000-admin HEAD:  3026829  chore: preserve recent MYD3000 admin work before consolidation
GITHUB origin/main:  7002c66  (no push realizado)
```

**SAFE TO PUSH: PENDIENTE REVISIÓN**

---

## PRÓXIMOS PASOS RECOMENDADOS

1. Revisar commit `3e840d7` en myd-intranet
2. Si aprobado → push a `origin/main`
3. Verificar que Railway esté apuntando a `myd-intranet` (no a `myd3000-admin`)
4. Revisar variables de entorno en Railway (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
5. Antes de aplicar migraciones SQL avanzadas (000008–000013): revisar y validar contra esquema remoto actual
6. `SUPABASE_PROJECTS_BOOTSTRAP_INCREMENTAL.sql` — revisar si es compatible con el código antes de ejecutar

---

## STOP

**NO PUSH.**
**NO SUPABASE MIGRATIONS.**
**NO RAILWAY CHANGES.**

Hasta que el usuario confirme el commit de consolidación.
