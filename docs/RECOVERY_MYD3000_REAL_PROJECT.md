# MYD3000 — REAL PROJECT RECOVERY
Fecha: 2026-09-15

---

## SITUACIÓN DE DIVERGENCIA

El repo GitHub `cerebraia/myd3000-finanzas` tiene actualmente HEAD en `18c09bd`
(commits de fixes de Railway desde `myd3000-admin`).

`myd-intranet` está **1 commit detrás** de origin/main (su HEAD local es `f47bf83`)
pero tiene 1 commit de preservación (`0f89e8f`) encima de ese punto.

```
GitHub/Railway: 96bd11f → 2025ff5 → 3a40f2e → f47bf83 → 31c43a5 → 16c37d0 → d8a4585 → e775ea0 → 18c09bd
myd-intranet:   96bd11f → 2025ff5 → 3a40f2e → f47bf83 → [0f89e8f preservation]
```

Los commits `31c43a5..18c09bd` (scaffold fixes, Railway auth diagnosis) están
en GitHub pero NO en myd-intranet. Son 5 commits sobre archivos que myd-intranet
ya reemplazó completamente con código más avanzado.

**Estrategia correcta: push desde myd-intranet con `--force` autorizado.**

El código de `myd-intranet` es la versión real y completa. Los commits de
`myd3000-admin` son parches sobre un scaffold desechable.

---

## ESTADO FINAL

```
LOCAL HEAD (myd-intranet):  0f89e8f ← preservation commit
ORIGIN/MAIN:                18c09bd ← commits de scaffold/fixes Railway
COMMON ANCESTOR:            f47bf83
DIVERGED:                   YES (1 commit ahead, 5 commits behind)
SAFE NORMAL PUSH:           NO — requiere --force o merge estratégico
```

---

## TRABAJO PRESERVADO

**PRESERVATION COMMIT:**  `0f89e8f`
**Estado working tree:**   LIMPIO
**Archivos commiteados:**  247 archivos, 44,954 inserciones

---

## MÓDULOS

| Módulo | Local | Commit | Estado |
|---|---|---|---|
| Dashboard | YES | YES | Real, con datos Supabase |
| Clients | YES | YES | CRUD completo |
| Quotes | YES | YES | Full flow + print + versiones |
| Projects | YES | YES | 1,465 líneas, CRUD completo |
| Contracts | YES | YES | 322 líneas |
| Receivables | YES | YES | 363 líneas |
| Payables | YES | YES | Con detalle |
| Suppliers | YES | YES | CRUD + form |
| Employees | YES | YES | Con detalle |
| Reportes | YES | YES | 9 reportes completos |
| Users | YES | YES | Gestión de usuarios |
| Notifications | YES | YES | |
| Tareas | YES | YES | |
| Compromisos | YES | YES | |
| Calendario | YES | YES | |
| Audit | YES | YES | |
| SystemHealth | YES | YES | |

---

## SECRETOS

- `.env` → NO trackeado (en .gitignore)
- `service_role` → solo comentario en supa_base/HITO5 (no credencial)
- `.env.example` → solo nombres, sin valores
- **SECRET SCAN: PASS**

---

## BUILD

```
npm run build → PASS
tsc -b → PASS (0 errores)
vite build → PASS (90+ chunks con code splitting)
```

---

## MIGRACIONES AUDITADAS

| Migración | Tabla(s) / Función(s) | Idempotente | RLS | Dependencias |
|---|---|---|---|---|
| 000008_projects | projects | IF NOT EXISTS | YES | clients, quotes |
| 000009_contracts | contracts | IF NOT EXISTS | YES | projects, clients, quotes |
| 000010_receivables | receivables | IF NOT EXISTS | YES | projects, clients, quotes |
| 000011_payments_received | payments_received | IF NOT EXISTS | YES | receivables, projects, clients |
| 000012_project_rpc | create_project_from_quote(), update_contract_status(), update_project_status() | CREATE OR REPLACE | — | projects, contracts |
| 000013_payment_rpc | register_receivable_payment() | CREATE OR REPLACE | — | receivables |

**Orden requerido:** 008 → 009 → 010 → 011 → 012 → 013

**DATABASE MIGRATIONS EXECUTED:** NO (pendiente de ejecución en Supabase remoto)

---

## PRÓXIMA ACCIÓN

Se requiere autorización para:

```
git push --force origin main
```

desde `/Proyectos/myd-intranet`.

Esto reemplazará en GitHub los 5 commits de scaffold (`myd3000-admin`) con
el commit de preservación que contiene el sistema real completo.

Railway detectará el nuevo commit y desplegará el sistema completo.

**IMPORTANTE:** Después del push, ejecutar las migraciones 000003–000013
en Supabase remoto (en orden) para que los módulos de Proyectos, Contratos
y Cuentas por Cobrar funcionen en producción.
