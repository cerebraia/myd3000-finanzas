# MYD3000 — CONSOLIDATED PRODUCTION PUSH REPORT
Fecha: 2026-09-16

---

## RESUMEN EJECUTIVO

Se completó la consolidación y publicación del sistema MYD3000.
El repositorio `cerebraia/myd3000-finanzas` ahora contiene la
implementación avanzada completa (hitos 1–18) desde `myd-intranet`.

---

## SOURCE OF TRUTH DEFINITIVO

**`/Proyectos/myd-intranet`**

`myd3000-admin` queda como copia histórica únicamente.
No continuar desarrollo en `myd3000-admin`.

---

## RESULTADO DEL PUSH

| Campo | Valor |
|---|---|
| LOCAL HEAD BEFORE | `7002c66` |
| ORIGIN BEFORE | `7002c66` |
| SECRET SCAN | PASS |
| BUILD | PASS (1790 modules, 0 errors) |
| PUSH | PASS |
| LOCAL HEAD AFTER | `1b36f98` |
| ORIGIN AFTER | `1b36f98` |
| LOCAL = ORIGIN | YES |
| SUPABASE CHANGED | NO |

---

## COMMITS PUBLICADOS

```
1b36f98  docs: add consolidated production push report
3e840d7  fix: consolidate recent MYD3000 production changes
7002c66  fix: avoid duplicate npm install during Railway build
e059aae  fix: synchronize dependencies for Railway build
e8bce87  docs: add recovery audit report
0f89e8f  feat: preserve advanced MYD3000 implementation (hitos 1–18)
```

---

## MÓDULOS PUBLICADOS

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

## CAMBIOS INCLUIDOS EN LA CONSOLIDACIÓN

### `src/lib/supabase.ts`
Se agregó `supabaseConfigured` flag y fallback a placeholder.
Previene crash en Railway si las variables de entorno no están
disponibles durante el build.

```ts
export const supabaseConfigured = !!(url && key)
export const supabase = createClient(
  url ?? 'https://placeholder.supabase.co',
  key ?? 'placeholder-key'
)
```

### `src/contexts/AuthContext.tsx`
Se mejoró la función `signIn` con:
- Logging diagnóstico Railway: `error.name`, `error.code`, `originalError`
- Mapeo de códigos Supabase a mensajes amigables:
  - `invalid_credentials` → "Correo o contraseña incorrectos."
  - `email_not_confirmed` → "Debes confirmar tu correo electrónico..."
  - `user_banned` → "Tu usuario está desactivado..."
  - `over_request_rate_limit` → "Demasiados intentos..."
  - fallback → muestra `error.name: error.message` para diagnóstico

### `src/pages/Login/index.tsx`
`onSubmit` simplificado para usar directamente el mensaje amigable
retornado por `signIn`, sin re-parsear el string crudo de Supabase.

### Reorganización de archivos
- 71 archivos `.md` movidos a `docs/`
- 6 archivos `.sql` movidos a `sql/`
- Raíz del proyecto limpia

---

## RAILWAY

| Campo | Estado |
|---|---|
| Repository | cerebraia/myd3000-finanzas |
| Branch | main |
| Build command | `npm run build` |
| Start command | `npm start` → `serve dist -s -l ${PORT:-4173}` |
| Auto Deploy | TRIGGERED por el push |
| Node engines | `>=20.0.0` |

Railway debería estar buildando automáticamente con el nuevo commit.

---

## ARCHIVOS SQL — ESTADO

Los siguientes archivos están en el repo como **referencia únicamente**.
**No se ejecutaron. No se ejecutarán automáticamente.**

| Archivo | Tamaño | Estado |
|---|---|---|
| `sql/SUPABASE_DIAGNOSTIC_READONLY.sql` | 5.8 KB | Solo lectura / diagnóstico |
| `sql/SUPABASE_PROJECTS_BOOTSTRAP_INCREMENTAL.sql` | 57 KB | REQUIERE REVISIÓN antes de ejecutar |
| `supabase/migrations/000008_projects.sql` | — | NO ejecutada en remoto |
| `supabase/migrations/000009_contracts.sql` | — | NO ejecutada en remoto |
| `supabase/migrations/000010_receivables.sql` | — | NO ejecutada en remoto |
| `supabase/migrations/000011_payments_received.sql` | — | NO ejecutada en remoto |
| `supabase/migrations/000012_project_rpc.sql` | — | NO ejecutada en remoto |
| `supabase/migrations/000013_payment_rpc.sql` | — | NO ejecutada en remoto |

---

## SUPABASE

**SUPABASE CHANGED: NO**

Las migraciones avanzadas (000008–000013) aún no se han aplicado
al proyecto remoto de Supabase. Los módulos que dependen de esas
tablas (Projects, Contracts, Receivables, Payables) fallarán en
runtime hasta que se apliquen las migraciones.

**Próximo paso de Supabase:** validar y ejecutar las migraciones
en orden, solo después de confirmar que el deploy de Railway fue exitoso.

---

## PRÓXIMOS PASOS

1. Verificar que Railway completó el build correctamente
2. Probar login en la URL de Railway
3. Si login funciona → ejecutar migraciones Supabase en orden (000008 → 000013)
4. Validar módulos avanzados en producción uno a uno

---

## STOP

**NO tocar Supabase hasta confirmar Railway.**
**NO hacer push adicionales hasta revisar el deployment.**
