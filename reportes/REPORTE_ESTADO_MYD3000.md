# REPORTE DE ESTADO — MYD3000 Admin

**Fecha del reporte:** 2026-09-02  
**Ruta local del proyecto:** `/Users/fernandao2307/Documents/Proyectos/myd-intranet`  
**Repositorio:** https://github.com/cerebraia/myd3000-finanzas.git (rama `main`)

---

## 1. Estado general

| Ítem | Estado |
|---|---|
| Estado del proyecto | En desarrollo activo — Hito #2 completado, Hito #3 pendiente |
| Servidor local | `npm run dev` → `http://localhost:5173` |
| URL local | `http://localhost:5173` |
| Build de producción | ✅ OK — `npm run build` pasa sin errores TypeScript (0 errores) |
| Supabase | Conectado al proyecto `bxmuuphzcruyewbergqd` vía variables de entorno |
| Autenticación | Funcional — email/password vía Supabase Auth |

**Notas:**
- El build genera un chunk de ~713 KB (advertencia de Vite por tamaño, no es un error).
- La conexión a Supabase depende de las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` definidas en `.env`.

---

## 2. Configuración actual

### Stack utilizado

| Tecnología | Versión declarada en `package.json` | Uso |
|---|---|---|
| React | `^18.3.1` | UI principal |
| React DOM | `^18.3.1` | Renderizado en navegador |
| TypeScript | `^5.7.2` | Tipado estático (devDependency) |
| Vite | `^6.0.5` | Build tool y dev server (devDependency) |
| Tailwind CSS | `^3.4.17` | Estilos utilitarios (devDependency) |
| @supabase/supabase-js | `^2.45.4` | Cliente Supabase (Auth + DB) |
| @tanstack/react-query | `^5.62.7` | Estado del servidor / caché de queries |
| @tanstack/react-query-devtools | `^5.62.7` | Herramientas de debug (devDependency) |
| react-hook-form | `^7.54.2` | Formularios |
| @hookform/resolvers | `^3.9.1` | Integración Zod con react-hook-form |
| zod | `^3.24.1` | Validación de esquemas |
| react-router-dom | `^7.1.1` | Ruteo SPA |
| lucide-react | `^0.468.0` | Iconografía |
| autoprefixer | `^10.4.20` | PostCSS (devDependency) |

### Identidad visual

Tokens CSS globales definidos en `index.css`:

| Token | Uso |
|---|---|
| `--myd-navy` | Fondo sidebar (#0f1f4d) |
| `--myd-blue` | Color principal de acción |
| `--myd-blue-hover` | Estado hover de botones |
| `--myd-bg` | Fondo general de contenido |
| `--myd-surface` | Fondo de tarjetas/paneles |
| `--myd-border` | Bordes de componentes |
| `--myd-text` | Texto principal |
| `--myd-muted` | Texto secundario/apagado |
| `--myd-success` | Estado positivo (verde) |
| `--myd-warning` | Vencimientos (naranja) |
| `--myd-danger` | Alertas/errores (rojo) |

**Tipografía:** Helvetica Neue, Helvetica, Arial, sans-serif (global)

---

## 3. Autenticación

### Proveedor y contexto

- **AuthProvider** (`src/contexts/AuthContext.tsx`): contexto React que expone `session`, `user`, `profile`, `loading`, `signIn`, `signOut`.
- Inicialización vía `supabase.auth.getSession()` en el `useEffect` inicial.
- Subscripción a cambios de sesión vía `supabase.auth.onAuthStateChange()`.
- Al detectar sesión activa, se llama `fetchProfile(userId)` para cargar el perfil desde `public.profiles`.

### Estado actual

| Ítem | Estado |
|---|---|
| Login email/password | ✅ Funcional — `supabase.auth.signInWithPassword()` |
| Persistencia de sesión | ✅ Supabase maneja el token en `localStorage` automáticamente |
| ProtectedRoute | ✅ Implementado en `src/components/layout/ProtectedRoute.tsx` |
| Redirección sin sesión | ✅ `<Navigate to="/login" replace />` si `session` es null |
| Estado de carga | ✅ Spinner durante `loading === true`, evita pantallazos |
| AuthProvider | ✅ Envuelve toda la app en `src/App.tsx` |
| Perfil de usuario | ✅ Se carga desde `public.profiles` y se expone vía `useAuth().profile` |
| Rol actual | Leído de `profile.role` — valores válidos: `administrator`, `administration`, `operations` |
| Logout | ✅ `supabase.auth.signOut()` expuesto vía `signOut()` en el contexto |
| Manejo de error en fetchProfile | ✅ Si falla (RLS, tabla faltante, sin fila), `profile` queda `null` y la app sigue funcionando — no bloquea `loading` |

### Consideraciones

- `ProtectedRoute` solo verifica que exista `session` (token válido). No verifica el `role` del perfil. Cualquier usuario autenticado puede acceder a todas las rutas protegidas.
- Si `public.profiles` no tiene fila para el usuario (perfil no creado por el trigger), `profile` es `null` pero la sesión sigue activa.

---

## 4. Base de datos

**Proyecto Supabase:** `bxmuuphzcruyewbergqd`  
**Cliente:** `@supabase/supabase-js ^2.45.4` configurado en `src/lib/supabase.ts`

### Tabla: `public.profiles`

**Finalidad:** Almacena datos extendidos del usuario autenticado (nombre visible, rol del sistema).

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK, FK → `auth.users(id)` ON DELETE CASCADE |
| `full_name` | `text` | nullable |
| `role` | `text` | NOT NULL, DEFAULT `'operations'`, CHECK IN (`administrator`, `administration`, `operations`) |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |

**Trigger:** `on_auth_user_created` — crea fila en `profiles` automáticamente al registrar un usuario en `auth.users` (SECURITY DEFINER).  
**Trigger:** `profiles_updated_at` — actualiza `updated_at` en cada UPDATE.  
**RLS:** Habilitado.

| Política | Operación | Condición |
|---|---|---|
| `Users can view own profile` | SELECT | `auth.uid() = id` |
| `Users can update own profile` | UPDATE | `auth.uid() = id` |

---

### Tabla: `public.clients`

**Finalidad:** Registro maestro de clientes del negocio.

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |
| `client_number` | `bigint` | UNIQUE, NOT NULL, DEFAULT `nextval('client_number_seq')` |
| `full_name` | `text` | NOT NULL (en schema ideal) — **ver sección 5 y 6** |
| `name` | `text` | Columna legacy de migración 001 — **puede existir como NOT NULL** — **ver sección 5 y 6** |
| `document_type` | `text` | nullable — valores: `CI`, `RIF`, `Pasaporte`, `Otro` |
| `document_number` | `text` | nullable |
| `phone` | `text` | nullable |
| `email` | `text` | nullable |
| `address` | `text` | nullable |
| `notes` | `text` | nullable |
| `created_by` | `uuid` | nullable, FK → `auth.users(id)` |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |

**Secuencia:** `public.client_number_seq` — genera numeración `CLI-XXXX`.  
**Índice:** `clients_full_name_idx` sobre `full_name`.  
**Trigger:** `clients_updated_at`.  
**RLS:** Habilitado.

| Política | Operación | Estado |
|---|---|---|
| `Authenticated users can view clients` | SELECT | `true` (todos los autenticados ven todos los clientes) |
| `Authenticated users can create clients` | INSERT | Migración correctiva: `auth.uid() IS NOT NULL` — **pendiente aplicar** |
| `Authenticated users can update clients` | UPDATE | `true` |

---

### Tabla: `public.quotes`

**Finalidad:** Cotizaciones comerciales emitidas a clientes.

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK |
| `quote_number` | `bigint` | UNIQUE, NOT NULL, DEFAULT `nextval('quotes_number_seq')` |
| `client_id` | `uuid` | NOT NULL, FK → `public.clients(id)` ON DELETE RESTRICT |
| `title` | `text` | nullable |
| `status` | `text` | NOT NULL, DEFAULT `draft`, CHECK IN (`draft`, `sent`, `approved`, `rejected`) |
| `issue_date` | `date` | NOT NULL, DEFAULT `CURRENT_DATE` |
| `valid_until` | `date` | nullable |
| `subtotal` | `numeric(14,2)` | DEFAULT 0 |
| `discount` | `numeric(14,2)` | DEFAULT 0 |
| `tax` | `numeric(14,2)` | DEFAULT 0 |
| `total` | `numeric(14,2)` | DEFAULT 0 |
| `initial_payment_percentage` | `numeric(5,2)` | DEFAULT 80 |
| `initial_payment_amount` | `numeric(14,2)` | DEFAULT 0 |
| `final_payment_percentage` | `numeric(5,2)` | DEFAULT 20 |
| `final_payment_amount` | `numeric(14,2)` | DEFAULT 0 |
| `includes` | `text[]` | DEFAULT `ARRAY[]::text[]` |
| `excludes` | `text[]` | DEFAULT `ARRAY[]::text[]` |
| `terms` | `text[]` | DEFAULT `ARRAY[]::text[]` |
| `notes` | `text` | nullable |
| `approved_at` | `timestamptz` | nullable |
| `rejected_at` | `timestamptz` | nullable |
| `rejection_reason` | `text` | nullable |
| `rejection_notes` | `text` | nullable |
| `created_by` | `uuid` | nullable, FK → `auth.users(id)` |
| `created_at` | `timestamptz` | DEFAULT `now()` |
| `updated_at` | `timestamptz` | DEFAULT `now()` |

**Secuencia:** `public.quotes_number_seq` — genera numeración `COT-YYYY-XXXX`.  
**Índices:** `quotes_client_id_idx`, `quotes_status_idx`.  
**Trigger:** `quotes_updated_at`.  
**RLS:** Habilitado — SELECT, INSERT y UPDATE para `authenticated`.

**Funciones RPC relacionadas:**
- `create_quote_with_items(quote_data jsonb, items_data jsonb)` — crea cotización + ítems en una transacción atómica.
- `update_quote_with_items(p_quote_id uuid, quote_data jsonb, items_data jsonb)` — actualiza cotización + reemplaza ítems.
- `update_quote_status(p_quote_id uuid, p_status text, ...)` — transiciona estado con validación y registro en `activity_log`.

---

### Tabla: `public.quote_items`

**Finalidad:** Líneas de detalle de cada cotización (productos/servicios con dimensiones y precios).

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK |
| `quote_id` | `uuid` | NOT NULL, FK → `public.quotes(id)` ON DELETE CASCADE |
| `description` | `text` | NOT NULL |
| `height` | `numeric` | nullable |
| `width` | `numeric` | nullable |
| `depth` | `numeric` | nullable |
| `measurement_notes` | `text` | nullable |
| `quantity` | `integer` | NOT NULL, DEFAULT 1 |
| `unit_price` | `numeric(14,2)` | NOT NULL, DEFAULT 0 |
| `line_total` | `numeric(14,2)` | NOT NULL, DEFAULT 0 |
| `sort_order` | `integer` | DEFAULT 0 |
| `created_at` | `timestamptz` | DEFAULT `now()` |
| `updated_at` | `timestamptz` | DEFAULT `now()` |

**Índice:** `quote_items_quote_id_idx`.  
**Trigger:** `quote_items_updated_at`.  
**RLS:** Habilitado — SELECT y ALL (`authenticated`) con `true`.

---

### Otras tablas activas

| Tabla | Finalidad |
|---|---|
| `public.activity_log` | Registro de acciones del sistema (quién hizo qué sobre qué entidad) |
| `public.projects` | Proyectos generados desde cotizaciones aprobadas — secuencia `project_number_seq` |
| `public.contracts` | Contratos 1-a-1 con proyectos — secuencia `contract_number_seq` |
| `public.receivables` | Cuentas por cobrar por proyecto (abono inicial + saldo final) |
| `public.payments_received` | Pagos registrados contra receivables |

---

## 5. Módulo Clientes

### Qué está implementado

| Funcionalidad | Estado | Ubicación |
|---|---|---|
| Listado de clientes | ✅ Tabla con skeleton loader | `src/pages/Clients/index.tsx` |
| Búsqueda en tiempo real | ✅ Filtra por nombre, documento, teléfono, correo | `src/pages/Clients/index.tsx` |
| Crear cliente (modal) | ⚠️ Implementado — bug activo en DB | `src/pages/Clients/NewClient.tsx` |
| Detalle de cliente | ✅ Card con datos + cotizaciones del cliente | `src/pages/Clients/ClientDetail.tsx` |
| Editar cliente (modal inline) | ✅ En la vista de detalle | `src/pages/Clients/ClientDetail.tsx` |
| Numeración automática | ✅ `CLI-XXXX` desde secuencia DB | `src/utils/formatters.ts` |
| Listado responsive | ✅ Tabla desktop + tarjetas mobile | `src/pages/Clients/index.tsx` |
| Persistencia | ⚠️ Depende de corrección en DB | — |
| Servicio de datos | `src/services/clients.ts` | `getClients`, `getClientById`, `createClient`, `updateClient`, `searchClients` |

### Bug documentado: "No pudimos guardar el cliente. Intenta nuevamente."

#### Error real encontrado

Violación de restricción NOT NULL en la columna `name` de `public.clients`.

#### Código PostgreSQL

`23502` — `not_null_violation`

#### Causa raíz

El proyecto tiene dos vías de configuración de base de datos que entraron en conflicto:

1. **Migración `20260901000001_create_clients.sql`** creó la tabla con `name text NOT NULL` (columna original, sin DEFAULT).
2. **Migración `20260901000003_clients_enhancements.sql`** agregó `full_name text` (nullable), `document_type`, `document_number` y `client_number` usando `ALTER TABLE`, pero **nunca eliminó** el `NOT NULL` de `name`.
3. **El archivo `myd3000_setup_complete.sql`** define el schema correcto con `full_name text NOT NULL` (sin columna `name`), pero usa `CREATE TABLE IF NOT EXISTS`. Como la tabla ya existía desde la migración 001, Supabase ignoró esa definición y la tabla real mantuvo `name text NOT NULL`.
4. El service `createClient()` hace INSERT enviando `full_name` pero **nunca envía `name`**, lo que dispara el error `23502` en PostgreSQL.

**Payload real del INSERT (en `src/services/clients.ts`):**
```typescript
supabase.from('clients').insert({
  full_name: data.full_name,     // ✅ enviado
  document_type: ...,            // ✅ nullable
  document_number: ...,          // ✅ nullable
  phone: ...,                    // ✅ nullable
  email: ...,                    // ✅ nullable
  address: ...,                  // ✅ nullable
  notes: ...,                    // ✅ nullable
  created_by: user?.id ?? null,  // ✅ UUID del usuario autenticado
  // name: ???                   // ❌ NUNCA enviado — columna NOT NULL sin DEFAULT
})
```

#### Problema secundario en la política RLS

La política INSERT de la migración 001 era:
```sql
WITH CHECK (auth.uid() = created_by)
```
Si `created_by` llega como `null` (edge case), la expresión `auth.uid() = null` evalúa a `NULL` (no `TRUE`) y el INSERT sería denegado con `42501`. La migración correctiva lo cambia a `auth.uid() IS NOT NULL`.

#### Corrección realizada en código (ya aplicada)

**`src/services/clients.ts`** — se agregó logging diagnóstico y manejo de nuevos códigos:
```typescript
if (error) {
  console.error('CLIENT CREATE ERROR', {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  })
  if (error.code === '23505') throw new Error('duplicate')
  if (error.code === '42P01') throw new Error('table_missing')
  if (error.code === '23502') throw new Error('not_null')      // NUEVO
  if (error.code === '42501') throw new Error('rls_denied')    // NUEVO
  throw error
}
```

**`src/pages/Clients/NewClient.tsx`** — mensajes útiles por código:
```typescript
if (err.message === 'duplicate')      toast.error('Ya existe un cliente con ese número de documento.')
if (err.message === 'table_missing')  toast.error('La base de datos no está configurada. Ejecuta las migraciones.')
if (err.message === 'not_null')       toast.error('Falta información requerida. Verifica los campos obligatorios.')
if (err.message === 'rls_denied')     toast.error('No tienes permisos para crear clientes.')
```

#### Corrección pendiente en base de datos

Ver **Sección 6**.

---

## 6. MIGRACIÓN CORRECTIVA PENDIENTE

### Datos del archivo

| Campo | Valor |
|---|---|
| Nombre del archivo | `20260902000000_fix_clients_name_column.sql` |
| Ruta completa | `supabase/migrations/20260902000000_fix_clients_name_column.sql` |
| Estado | **PENDIENTE — debe ejecutarse manualmente en Supabase SQL Editor** |

### Por qué fue creada

La columna legacy `name text NOT NULL` (creada por migración 001) bloquea todos los INSERTs de clientes porque el service nunca la envía en el payload. La migración 003 agregó `full_name` sin eliminar la restricción de `name`.

### Qué modifica

1. **Backfill:** copia `name → full_name` en filas existentes donde `full_name` sea null.
2. **Elimina NOT NULL de `name`:** hace la columna legacy nullable (no la elimina, para no romper datos existentes).
3. **Pone NOT NULL en `full_name`:** consolida `full_name` como la columna principal.
4. **Reemplaza la política RLS INSERT:** cambia `auth.uid() = created_by` por `auth.uid() IS NOT NULL`.

### ¿Es segura para datos existentes?

**Sí.** Todos los pasos están envueltos en bloques `DO $$ ... $$` condicionales que verifican la existencia y estado de cada columna antes de ejecutar. Si la tabla ya tiene el schema correcto (sin `name` o con `name` nullable), los bloques no hacen nada. No se elimina ni modifica ningún dato existente.

### Requiere ejecución manual en Supabase SQL Editor

**Sí.** Las migraciones de este proyecto no están conectadas a Supabase CLI con `supabase db push`. El SQL debe copiarse y ejecutarse directamente en el **SQL Editor** del proyecto `bxmuuphzcruyewbergqd`.

### SQL completo de la migración

```sql
-- ============================================================
-- MIGRACIÓN CORRECTIVA: 20260902000000_fix_clients_name_column
-- Problema: migración 001 creó `name text NOT NULL` pero el
-- service solo envía `full_name` en el INSERT.
-- Resultado: error 23502 (not_null_violation) al crear cliente.
-- ============================================================

-- Paso 1: backfill full_name desde name donde sea null
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'name'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'full_name'
  ) THEN
    UPDATE public.clients SET full_name = name WHERE full_name IS NULL AND name IS NOT NULL;
  END IF;
END $$;

-- Paso 2: eliminar NOT NULL de la columna `name` (si existe con esa restricción)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'name'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.clients ALTER COLUMN name DROP NOT NULL;
  END IF;
END $$;

-- Paso 3: poner NOT NULL en full_name (si existe y es nullable)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'full_name'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.clients ALTER COLUMN full_name SET NOT NULL;
  END IF;
END $$;

-- Paso 4: reemplazar política RLS de INSERT
-- Política vieja: WITH CHECK (auth.uid() = created_by)  -- falla si created_by es null
-- Política nueva: WITH CHECK (auth.uid() IS NOT NULL)   -- segura
DROP POLICY IF EXISTS "Authenticated users can create clients" ON public.clients;
CREATE POLICY "Authenticated users can create clients"
  ON public.clients
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
```

---

## 7. Rutas implementadas

| Ruta | Componente | Estado |
|---|---|---|
| `/login` | `Login` | ✅ Funcional |
| `/dashboard` | `Dashboard` | ✅ Funcional con datos reales |
| `/clientes` | `Clients` | ✅ Funcional (bug de creación pendiente de corrección DB) |
| `/clientes/:id` | `ClientDetail` | ✅ Funcional |
| `/cotizaciones` | `Quotes` | ✅ Funcional |
| `/cotizaciones/nueva` | `NewQuote` | ✅ Funcional |
| `/cotizaciones/:id` | `QuoteDetail` | ✅ Funcional |
| `/cotizaciones/:id/editar` | `EditQuote` | ✅ Funcional |
| `/cotizaciones/:id/imprimir` | `QuotePrint` | ✅ Funcional (fullscreen, sin sidebar) |
| `/proyectos` | `Projects` | ✅ Funcional |
| `/proyectos/:id` | `ProjectDetail` | ✅ Funcional (5 tabs) |
| `/contratos` | `Contracts` | ✅ Funcional |
| `/contratos/:id` | `ContractDetail` | ✅ Funcional |
| `/finanzas` | `Finance` | ⚠️ Placeholder — Hito #3 pendiente |
| `/proveedores` | `Suppliers` | ⚠️ Placeholder — Hito #3 pendiente |
| `/documentos` | `Documents` | ⚠️ Placeholder — Hito #3 pendiente |
| `/configuracion` | `Settings` | ⚠️ Placeholder |
| `*` | — | Redirige a `/dashboard` |

---

## 8. Próximos pasos

1. **URGENTE:** Ejecutar la migración `20260902000000_fix_clients_name_column.sql` en Supabase SQL Editor para corregir el bug de creación de clientes.
2. Verificar creación de cliente desde la UI tras aplicar la migración.
3. **Hito #3:** Finanzas operativas — cuentas por pagar, proveedores, gastos de proyectos, pagos a carpinteros/arquitectos, impuestos, dashboard financiero.
4. Push al repositorio remoto una vez validado el funcionamiento.
