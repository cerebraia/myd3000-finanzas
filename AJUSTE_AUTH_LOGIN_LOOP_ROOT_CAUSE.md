# AUTH — ROOT CAUSE REPORT: Login Loop

**Fecha:** 2026-09-06

---

## SYMPTOM

Usuario ingresa credenciales válidas → Supabase autentica → app navega al Dashboard → segundos después regresa a /login automáticamente. El ciclo se repite indefinidamente.

---

## ROOT CAUSE PRIMARIA

**`profile.active === false` en la tabla `profiles` de Supabase.**

Cuando Supabase acepta el login (auth.users), el campo `active` en `profiles` es independiente. Si el usuario tiene `active = false`, el flujo es:

```
signInWithPassword() → OK (Supabase no consulta profiles.active)
↓
SIGNED_IN event → fetchProfile(userId)
↓
profile.active === false → supabase.auth.signOut() ← BUG
↓
SIGNED_OUT event → setSession(null) → setProfile(null)
↓
ProtectedRoute: !session → Navigate('/login')
↓
Usuario ve /login de nuevo
↓
Puede volver a iniciar sesión
↓
LOOP
```

La línea responsable es `AuthContext.tsx:64`:
```typescript
await supabase.auth.signOut()  // ← auto-logout cuando active=false
```

Combinada con `ProtectedRoute.tsx:28`:
```typescript
if (!session) return <Navigate to="/login" replace />  // ← redirect
```

Esto produce el loop.

---

## ROOT CAUSE SECUNDARIA

**Doble inicialización de sesión (`getSession` + `onAuthStateChange`).**

El `AuthContext.useEffect` ejecuta TANTO `supabase.auth.getSession()` como `supabase.auth.onAuthStateChange()`. Ambos esperan a `initializePromise` (la misma inicialización interna de Supabase) y por tanto ambos disparan `fetchProfile()` al mismo tiempo, resultando en 2 queries paralelas a `profiles` en cada carga. Esto no causa el loop, pero es arquitectura innecesariamente frágil y difícil de razonar.

Además: `setLoading(false)` está repartido en múltiples lugares (getSession else branch, onAuthStateChange else branch, fetchProfile finally) lo que dificulta razonar sobre cuándo la UI se desbloquea.

---

## FLUJO ANTES DEL FIX

```
AuthProvider mount
  ↓
getSession() [async, inicia] ─────────────────────────┐
onAuthStateChange registered                          │
  ↓                                                   │
INITIAL_SESSION fires (async via initializePromise)   │
  ↓                                                   │
if session: fetchProfile() [call A] ← CONCURRENTE ←──┘
   + getSession resolves: fetchProfile() [call B]
  
fetchProfile [A o B]:
  ↓
  profile.active === false?
  YES → signOut() → SIGNED_OUT → session=null → /login (LOOP)
  NO  → setProfile(profile) → setLoading(false) → Dashboard OK
```

---

## FLUJO DESPUÉS DEL FIX

```
AuthProvider mount
  ↓
onAuthStateChange registered ONLY (sin getSession separado)
  ↓
INITIAL_SESSION fires (async)
  ↓
  session válida? → fetchProfile() [1 sola call] → setLoading(false)
  sin sesión?     → setProfile(null) → setLoading(false)
  ↓
ProtectedRoute:
  loading=true   → spinner (nunca parpadea a /login)
  loading=false + !session  → /login
  loading=false + session + profile.active=false → "Cuenta desactivada" (NO /login, NO loop)
  loading=false + session → Dashboard OK
```

---

## ARCHIVOS AFECTADOS

| Archivo | Cambio |
|---------|--------|
| `src/contexts/AuthContext.tsx` | Eliminar `getSession()` duplicado, usar solo `onAuthStateChange`, eliminar auto-signOut en fetchProfile, añadir `isMounted` guard |
| `src/components/layout/ProtectedRoute.tsx` | Eliminar `useEffect` de signOut para inactive, mostrar pantalla "cuenta desactivada" en lugar de redirigir a /login |

---

## POSIBLES CAUSAS DE QUE profile.active === false

1. El perfil fue desactivado manualmente desde /configuracion/usuarios
2. El perfil fue creado con `active = false` por defecto (bug en trigger de creación)
3. El perfil pertenece a un usuario al que se aplicó "baja" sin haber cerrado sesión primero

**Acción recomendada post-fix:** Verificar el valor de `active` en la tabla `profiles` para el usuario afectado y actualizarlo a `true` si corresponde.

---

## WHY THE AUTO-SIGNOUT WAS WRONG

El `signOut()` automático cuando `active=false` fue implementado para "proteger" el acceso de usuarios desactivados. Pero:

1. Supabase RLS ya protege el acceso a datos de usuarios desactivados (si está configurado)
2. El auto-signOut causa un loop: el usuario puede volver a iniciar sesión inmediatamente
3. La UX correcta es mostrar "cuenta desactivada" y un botón de cerrar sesión
4. Si el admin quiere impedir el acceso, debe revocar la sesión desde Supabase Auth dashboard

**El fix correcto:** No llamar `signOut()` automáticamente. Mostrar pantalla informativa. Dejar que el usuario cierre sesión manualmente.
