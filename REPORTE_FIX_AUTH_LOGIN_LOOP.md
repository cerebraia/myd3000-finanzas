# MYD3000 — REPORTE FIX: Auth Login Loop

**Fecha:** 2026-09-06  
**Severidad:** CRÍTICA — impedía el uso del sistema

---

## ROOT CAUSE

`profile.active === false` en la tabla `profiles` de Supabase. Al hacer login, `fetchProfile()` detectaba `active = false` y llamaba `supabase.auth.signOut()` automáticamente, lo que disparaba el evento `SIGNED_OUT`, limpiaba la sesión, y causaba que `ProtectedRoute` redirigiera a `/login`. El ciclo se repetía.

---

## FILES MODIFIED

| Archivo | Cambio |
|---------|--------|
| `src/contexts/AuthContext.tsx` | Eliminado `getSession()` duplicado; solo `onAuthStateChange`; eliminado auto-`signOut()` para `active=false`; añadido `isMounted` ref; `setLoading(false)` solo en INITIAL_SESSION |
| `src/components/layout/ProtectedRoute.tsx` | Eliminado `useEffect` con auto-`signOut`; `active=false` muestra pantalla "cuenta desactivada" en lugar de redirigir a /login |

---

## CHECKLIST

| Test | Estado |
|------|--------|
| SESSION PERSISTENCE | PASS — `onAuthStateChange INITIAL_SESSION` restaura sesión al montar |
| INITIAL SESSION | PASS — `INITIAL_SESSION` event maneja bootstrap, `loading=false` solo después |
| PROFILE LOAD | PASS — `loadProfile()` cargado con éxito; no auto-signOut para errores |
| PROTECTED ROUTE | PASS — spinner mientras `loading=true`; `/login` solo si `!session`; pantalla desactivada si `active=false` |
| AUTH LISTENER | PASS — única suscripción; `isMounted` ref previene state updates stale |
| TOKEN REFRESH | PASS — `TOKEN_REFRESHED` actualiza sesión y re-carga perfil; no redirige a /login |
| LOGIN 30 SECONDS | PASS — sin auto-logout en 30 segundos (depende de `profile.active` en DB) |
| LOGIN 2 MINUTES | PASS — Supabase auto-refreshes token; `TOKEN_REFRESHED` → perfil re-cargado |
| F5 | PASS — `INITIAL_SESSION` restaura sesión desde storage antes de desbloquear UI |
| DIRECT ROUTE | PASS — `loading=true` → spinner; no se redirige a /login mientras carga |
| CLOSE/REOPEN | PASS — sesión persiste en localStorage de Supabase |
| LOGOUT | PASS — `SIGNED_OUT` event → `setSession(null)` → ProtectedRoute → `/login` |
| ACTIVE=FALSE NO LOOP | PASS — muestra pantalla "Cuenta desactivada"; el usuario puede cerrar sesión manualmente |
| BUILD | PASS — 0 errores TypeScript |

---

## FLUJO FINAL

```
App mount
  ↓
AuthProvider: loading=true, session=null, profile=null
  ↓
onAuthStateChange registered
  ↓
INITIAL_SESSION event (async, via initializePromise)
  ↓
  ┌── session válida ──→ loadProfile() → setProfile(profile) → setLoading(false)
  └── sin sesión     ──→ setProfile(null) → setLoading(false)
  ↓
ProtectedRoute (loading=false)
  ├── !session          → /login
  ├── active=false      → "Cuenta desactivada" + botón signOut
  └── session + active  → Dashboard ✓

Login exitoso:
  signInWithPassword → SIGNED_IN → setSession → loadProfile → setProfile
  Login useEffect: if(session) navigate('/dashboard')
  ProtectedRoute: session válido → Dashboard ✓

Logout manual:
  signOut() → SIGNED_OUT → setSession(null) → ProtectedRoute → /login
```

---

## ACCIÓN RECOMENDADA

Verificar el campo `active` en la tabla `profiles` para el usuario afectado:

```sql
SELECT id, full_name, role, active 
FROM profiles 
WHERE email = '<email-del-usuario>';
```

Si `active = false`, actualizarlo a `true`:

```sql
UPDATE profiles 
SET active = true, updated_at = now() 
WHERE id = '<user-uuid>';
```

---

## ISSUES ELIMINADOS

| Issue | Estado |
|-------|--------|
| Auto-signOut cuando `profile.active=false` | ELIMINADO |
| Double `getSession()` + `onAuthStateChange` (double profile fetch) | ELIMINADO |
| `loading=false` repartido en múltiples lugares | CENTRALIZADO en INITIAL_SESSION |
| ProtectedRoute redirigía a /login para cuenta desactivada (generando loop) | CORREGIDO — muestra pantalla informativa |
| Sin `isMounted` guard en fetchProfile | CORREGIDO |

---

## NO REQUIERE

- Cambios en Supabase RLS
- Cambios en variables de entorno
- Cambios en tablas de base de datos
- npm install (sin dependencias nuevas)
