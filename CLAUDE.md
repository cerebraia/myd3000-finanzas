# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Dev server (Vite, hot reload)
npm run build     # Production build: tsc -b && vite build
npm run preview   # Preview production build locally
npm start         # Production server: serve dist -s -l $PORT (used by Railway)
```

There is no test suite. `npm run lint` exists but has no eslint.config.js (ESLint v9 mismatch — pre-existing, non-blocking). Use `npm run build` as the primary correctness check; it runs `tsc -b` first and fails on any TypeScript error.

## Architecture

**MYD3000 Admin** is a React 18 SPA backed entirely by Supabase (PostgreSQL + Auth + Storage). There is no custom server — Railway just serves the `dist/` folder with `serve`.

### Frontend structure

```
src/
  App.tsx              All routes defined here (lazy-loaded modules)
  boot.tsx / main.tsx  Entry points
  components/
    layout/            AppLayout, Sidebar, Header, ProtectedRoute
    ui/                Modal, ConfirmModal, Toast, EmptyState, etc.
  config/
    permissions.ts     ROLE_PERMISSIONS map — controls every can() call
  contexts/
    AuthContext.tsx     Session + Profile + inactive-user redirect
    ToastContext.tsx    Global toast state
    NotificationsContext.tsx
  hooks/
    usePermissions.ts  can(), canAny(), canAll() — reads from AuthContext
  lib/
    supabase.ts        Supabase client (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY)
    queryKeys.ts       All TanStack Query cache keys — import from here, never create ad-hoc keys
  pages/               One folder per module; index.tsx is the list/main view
  services/            All Supabase calls live here, never in components
  types/index.ts       All shared types; extend this file, never define types inline
  utils/
    formatters.ts      formatCurrency, formatDate, formatProjectNumber, formatQuoteNumber, formatClientNumber
    errors.ts          Supabase error code → human-readable Spanish messages
```

### Data flow pattern

Every module follows the same pattern — no exceptions:

```
Page component
  → useQuery(queryKey, serviceFn)   for reads
  → useMutation(serviceFn)          for writes
  → service function                calls supabase.rpc() or supabase.from()
  → Supabase (RPC or table)
```

**Services** are thin wrappers: one function per operation, typed return values. No business logic in services. Error handling: either `throw error` and let the mutation's `onError` display a toast, or return a graceful fallback for missing tables/RPCs (pattern: `if (isRpcMissing(error)) return []`).

**RPCs** are used for any write that involves multiple tables or requires server-side permission validation. Direct table reads (`.from().select()`) are used for simple reads where RLS is sufficient.

### Auth & permissions

- `AuthContext` provides `session`, `user`, `profile` (from `public.profiles`).
- `profile.active = false` triggers automatic sign-out in `AuthContext`.
- Permission check: `const { can } = usePermissions()` → `can('quotes.create')`.
- All permissions are in `src/config/permissions.ts` as `ROLE_PERMISSIONS[role][]`. Adding a new permission requires: (1) add to the `Permission` union type, (2) add to relevant roles in `ROLE_PERMISSIONS`.
- Four roles: `administrator > manager > administration > operations`.

### Database key facts

- **25 business tables** + 3 system tables in `public` schema.
- **RLS is enabled on all tables**. Never disable it to fix a bug. Never use `service_role` in frontend code.
- **Soft delete strategy by table type:**
  - `archived_at` / `archived_by` — clients, quotes, projects, employees, suppliers, obligations, designs
  - `cancelled_at` / `cancel_reason` — receivables, payables
  - `voided_at` / `void_reason` — payments_received, payments_made (recalculates balance)
  - `deleted_at` — documents
  - Hard delete: quote_items, project_materials only
  - Never delete: activity_log, any payment records
- **`activity_log`** is immutable — `UPDATE` and `DELETE` are revoked for `authenticated`. Insert-only.
- **`SECURITY DEFINER` functions** must always include `SET search_path = public`.
- **`handle_new_user` trigger** fires on `auth.users` INSERT and creates the `profiles` row automatically.

### Key RPCs (Supabase functions)

Complex writes go through RPCs. The most critical ones:

| RPC | Purpose |
|-----|---------|
| `create_quote_with_items` / `update_quote_with_items` | Atomic quote save with items + payment terms |
| `approve_quote(p_quote_id)` | Creates project + contract + receivables atomically; returns `{project_id, project_number, contract_id, contract_number}` |
| `send_quote_to_review` / `reject_quote` | Quote state transitions |
| `create_project_manual` / `update_project_fields` | Project CRUD |
| `delete_project_if_clean` | Returns `'deleted'` or `'archived'` depending on relations |
| `register_receivable_payment` | Partial/full payment with balance recalculation; returns `{payment_id, new_paid_amount, new_status, remaining}` |
| `register_payable_payment` / `void_made_payment` | Payables equivalent |
| `get_dashboard_summary` / `get_pending_items` | Dashboard data |
| `get_user_list` / `change_user_role` / `set_user_active` | User management (admin-only) |
| `archive_*` / `restore_*` | Archive/restore pattern for all major entities |

### SQL migrations

Migrations are in `supa_base/` (legacy hito files) and `sql/` (incremental production files). They are executed **manually** via Supabase SQL Editor — never auto-applied. All production SQL files must:
- Start with `BEGIN;`, end with `COMMIT;`
- Use `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`
- Never use `DROP TABLE`, `TRUNCATE`, or mass `DELETE`
- Have `SECURITY DEFINER SET search_path = public` on all functions
- Include read-only verification queries at the end

**Production-applied SQL** (in order):
1. `sql/MYD3000_CORE_FUNCTIONAL_FINAL.sql` — core tables + 23 RPCs (baseline 317d5e0)
2. `sql/MYD3000_USERS_MODULE.sql` — user management RPCs + profiles columns

### Edge Functions

One Edge Function: `supabase/functions/invite-user/index.ts`

- Called by the frontend with the user's JWT in the `Authorization` header
- Validates the caller's `profiles.role = 'administrator'` server-side
- Uses `SUPABASE_SERVICE_ROLE_KEY` (auto-injected by Supabase, no manual secret needed) to call `auth.admin.inviteUserByEmail()`
- Deploy: `npx supabase functions deploy invite-user --project-ref bxmuuphzcruyewbergqd --no-verify-jwt`
- Production URL in `ALLOWED_ORIGINS`: `https://myd3000-finanzas-production.up.railway.app`

### Storage

Two private buckets: `admin-files` (employees, documents) and `project-files` (designs). Access only via signed URLs — no public URLs.

### Environment

```
VITE_SUPABASE_URL=https://bxmuuphzcruyewbergqd.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

These must be set in Railway for production builds (Vite bakes them in at build time).

### UI conventions

- Path alias `@/` maps to `src/`
- CSS custom properties for brand colors: `--myd-blue`, `--myd-text`, `--myd-muted`, `--myd-border`, `--myd-bg`, `--myd-surface`
- Modals: always use `<Modal>` or `<ConfirmModal>` from `src/components/ui/`
- Toasts: `const toast = useToast()` → `toast.success()` / `toast.error()`
- Loading states: `disabled={mutation.isPending}` on submit buttons; show spinner or text change
- All pages use TanStack Query — invalidate relevant `queryKeys.*` keys on mutation success
- All routes are lazy-loaded via `React.lazy`; Login is eager (entry point)
