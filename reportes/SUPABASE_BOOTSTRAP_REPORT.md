# REPORTE DE BOOTSTRAP — MYD3000 Demo

**Archivo:** `supabase/bootstrap_myd3000_demo.sql`  
**Estado:** PENDIENTE — No ejecutado. Listo para revisión manual.  
**Proyecto Supabase:** `bxmuuphzcruyewbergqd`  
**Fecha de generación:** 2026-09-02

---

## CONTEXTO

La base de datos remota devolvió `relation "public.clients" does not exist` al intentar
ejecutar la migración correctiva anterior. Esto confirma que Supabase está vacío o
parcialmente sin migrar. Este bootstrap crea la estructura mínima necesaria para que
funcionen los módulos de Clientes y Cotizaciones.

---

## TABLAS QUE CREARÁ

Todas usan `CREATE TABLE IF NOT EXISTS`. Si la tabla ya existe, no la modifica ni elimina datos.

| Tabla | Estado esperado | Propósito |
|---|---|---|
| `public.profiles` | Creada si no existe | Datos extendidos del usuario autenticado (nombre, rol) |
| `public.clients` | Creada si no existe | Registro maestro de clientes (schema limpio, sin columna `name`) |
| `public.quotes` | Creada si no existe | Cotizaciones comerciales |
| `public.quote_items` | Creada si no existe | Líneas de detalle de cada cotización |
| `public.activity_log` | Creada si no existe | Registro de acciones — requerido por los RPC |

### Columnas clave de `public.clients`

```
id              uuid        PK, gen_random_uuid()
client_number   bigint      UNIQUE NOT NULL, DEFAULT nextval('client_number_seq')
full_name       text        NOT NULL                ← columna correcta, sin "name"
document_type   text        nullable
document_number text        nullable
phone           text        nullable
email           text        nullable
address         text        nullable
notes           text        nullable
created_by      uuid        nullable, FK → auth.users(id)
created_at      timestamptz NOT NULL DEFAULT now()
updated_at      timestamptz NOT NULL DEFAULT now()
```

**La columna legacy `name` NO se crea.** Esto es el schema que el frontend espera.

### Columnas clave de `public.quotes`

Verificadas campo a campo contra `src/services/quotes.ts` (`CreateQuoteData`),
`src/types/index.ts` (`Quote`), y `src/pages/Quotes/QuoteForm.tsx` (`quotePayload`):

```
id, quote_number, client_id, title, status, issue_date, valid_until,
subtotal, discount, tax, total,
initial_payment_percentage, initial_payment_amount,
final_payment_percentage, final_payment_amount,
includes (text[]), excludes (text[]), terms (text[]),
notes, approved_at, rejected_at, rejection_reason, rejection_notes,
created_by, created_at, updated_at
```

### Columnas clave de `public.quote_items`

Verificadas contra `QuoteItemInput` en `src/services/quotes.ts`
y `itemsPayload` en `QuoteForm.tsx`:

```
id, quote_id, description,
height, width, depth, measurement_notes,
quantity, unit_price, line_total, sort_order,
created_at, updated_at
```

---

## SECUENCIAS

| Secuencia | Tabla | Genera | Start |
|---|---|---|---|
| `public.client_number_seq` | `clients.client_number` | `CLI-XXXX` | 1 |
| `public.quotes_number_seq` | `quotes.quote_number` | `COT-YYYY-XXXX` | 1 |

Ambas usan `CREATE SEQUENCE IF NOT EXISTS`. Si ya existen, no se reinician.

---

## POLICIES (RLS)

Todas las políticas se crean con `DROP POLICY IF EXISTS` + `CREATE POLICY` para evitar errores si ya existen con el mismo nombre.

### `public.profiles`

| Política | Operación | Condición |
|---|---|---|
| `Users can view own profile` | SELECT | `auth.uid() = id` |
| `Users can update own profile` | UPDATE | `auth.uid() = id` |

### `public.clients`

| Política | Operación | Condición | Motivo |
|---|---|---|---|
| `Authenticated users can view clients` | SELECT | `true` | Todos ven todos |
| `Authenticated users can create clients` | INSERT | `auth.uid() IS NOT NULL` | Seguro con `created_by: user?.id ?? null` del service |
| `Authenticated users can update clients` | UPDATE | `true` | Todos pueden editar |

### `public.quotes`

| Política | Operación | Condición |
|---|---|---|
| `Authenticated users can view quotes` | SELECT | `true` |
| `Authenticated users can create quotes` | INSERT | `auth.uid() IS NOT NULL` |
| `Authenticated users can update quotes` | UPDATE | `true` |

### `public.quote_items`

| Política | Operación | Condición |
|---|---|---|
| `Authenticated users can view quote items` | SELECT | `true` |
| `Authenticated users can insert quote items` | INSERT | `true` |
| `Authenticated users can update quote items` | UPDATE | `true` |
| `Authenticated users can delete quote items` | DELETE | `true` — requerido por `update_quote_with_items` que hace DELETE + re-INSERT |

### `public.activity_log`

| Política | Operación | Condición |
|---|---|---|
| `Authenticated users can view activity log` | SELECT | `true` |
| `Authenticated users can insert activity log` | INSERT | `true` |

---

## TRIGGERS

| Trigger | Tabla | Evento | Función |
|---|---|---|---|
| `profiles_updated_at` | `profiles` | BEFORE UPDATE | `set_updated_at()` |
| `on_auth_user_created` | `auth.users` | AFTER INSERT | `handle_new_user()` |
| `clients_updated_at` | `clients` | BEFORE UPDATE | `set_updated_at()` |
| `quotes_updated_at` | `quotes` | BEFORE UPDATE | `set_updated_at()` |
| `quote_items_updated_at` | `quote_items` | BEFORE UPDATE | `set_updated_at()` |

Todos usan `DROP TRIGGER IF EXISTS` antes de `CREATE TRIGGER`.

---

## RPC (FUNCIONES ALMACENADAS)

Verificadas contra `src/services/quotes.ts`:

| Función | Llamada desde el frontend | SECURITY |
|---|---|---|
| `create_quote_with_items(quote_data jsonb, items_data jsonb)` | `supabase.rpc('create_quote_with_items', ...)` | INVOKER |
| `update_quote_with_items(p_quote_id uuid, quote_data jsonb, items_data jsonb)` | `supabase.rpc('update_quote_with_items', ...)` | INVOKER |
| `update_quote_status(p_quote_id uuid, p_status text, ...)` | `supabase.rpc('update_quote_status', ...)` | INVOKER |

**SECURITY INVOKER** significa que las funciones corren con los permisos del usuario autenticado.
Las políticas RLS de las tablas se evalúan normalmente.

Cada RPC escribe en `activity_log` como su última operación. Por eso `activity_log` es
obligatoria — sin ella los RPC fallan aunque quotes y quote_items existan.

Funciones utilitarias también creadas/reemplazadas:

| Función | Uso |
|---|---|
| `set_updated_at()` | Trigger compartido que actualiza `updated_at` |
| `handle_new_user()` | Crea `profiles` al registrar nuevo usuario en `auth.users` |

---

## DATOS QUE INSERTA

| Tabla | Qué inserta | Estrategia |
|---|---|---|
| `public.profiles` | Perfil del administrador (`90263f6e-9444-49ca-9086-ad2c1c289bd4`) con `full_name = 'Administrador MYD3000'` y `role = 'administrator'` | `ON CONFLICT (id) DO UPDATE SET full_name, role, updated_at` |

No se inserta ningún cliente, cotización ni ítem de prueba.

---

## DATOS QUE ELIMINA

**NINGUNO.**

El script no contiene `DROP TABLE`, `TRUNCATE`, `DELETE` masivo, ni `UPDATE` masivo.
El único `UPDATE` posible es en el profile del administrador (`ON CONFLICT DO UPDATE`),
que solo actualiza `full_name`, `role` y `updated_at` de esa fila específica.

---

## ESTADO DE LA MIGRACIÓN CORRECTIVA ANTERIOR

`supabase/migrations/20260902000000_fix_clients_name_column.sql`

Esa migración fue creada para corregir la columna `name NOT NULL` en una tabla **ya existente**.
Como `public.clients` **no existe** en Supabase, esa migración **ya no es necesaria**.

El bootstrap crea `public.clients` directamente con el schema correcto (solo `full_name`, sin `name`).

**La migración correctiva NO debe ejecutarse** antes ni después del bootstrap.
Puede ignorarse o eliminarse.

---

## ORDEN DE EJECUCIÓN INTERNO

El SQL está ordenado para respetar dependencias:

```
1. set_updated_at()            — función base usada por todos los triggers
2. handle_new_user()           — función del trigger de auth
3. public.profiles             — sin FK externas excepto auth.users
4. Profile admin (INSERT)      — requiere que profiles exista
5. public.client_number_seq    — requiere schema public
6. public.clients              — sin FK externas excepto auth.users
7. public.quotes_number_seq    — requiere schema public
8. public.quotes               — FK → clients
9. public.quote_items          — FK → quotes
10. public.activity_log        — sin FK a tablas de negocio
11. RPC create_quote_with_items — requiere quotes, quote_items, activity_log
12. RPC update_quote_with_items — requiere quotes, quote_items, activity_log
13. RPC update_quote_status     — requiere quotes, activity_log
```

---

## RIESGO

**BAJO.**

- No elimina tablas ni datos.
- Todas las creaciones son idempotentes (`IF NOT EXISTS`, `OR REPLACE`).
- El único write a datos existentes es el `ON CONFLICT DO UPDATE` del perfil admin.
- Si la base ya tiene algunas de estas tablas correctamente configuradas, el script las omite.
- Si la base está completamente vacía, el script la deja lista para la demo.

---

## INSTRUCCIONES DE EJECUCIÓN

1. Abre el **SQL Editor** en el proyecto Supabase `bxmuuphzcruyewbergqd`.
2. Copia el contenido de `supabase/bootstrap_myd3000_demo.sql`.
3. Pégalo en el editor.
4. Haz clic en **Run**.
5. Verifica que no aparezcan errores en la salida.
6. Intenta crear un cliente desde la UI en `http://localhost:5173/clientes`.
