# PERMISSION MATRIX — MYD3000 Admin

Hito #14 — Roles y permisos del sistema

## Roles

| Rol | Descripción |
|-----|-------------|
| `administrator` | Acceso completo: sistema, usuarios, configuración, auditoría |
| `manager` | Control operativo completo y financiero. No administra usuarios ni configuración técnica |
| `administration` | Operaciones comerciales y financieras. Sin acceso a usuarios ni reportes gerenciales |
| `operations` | Trabajo operativo en proyectos, diseños y materiales. Sin acceso financiero |

---

## Matriz de permisos

| Permiso | Administrator | Manager | Administration | Operations |
|---------|:---:|:---:|:---:|:---:|
| **CLIENTES** |
| clients.view | ✅ | ✅ | ✅ | ✅ |
| clients.create | ✅ | ✅ | ✅ | ❌ |
| clients.edit | ✅ | ✅ | ✅ | ❌ |
| clients.archive | ✅ | ✅ | ✅ | ❌ |
| **COTIZACIONES** |
| quotes.view | ✅ | ✅ | ✅ | ✅ |
| quotes.create | ✅ | ✅ | ✅ | ❌ |
| quotes.edit | ✅ | ✅ | ✅ | ❌ |
| quotes.review | ✅ | ✅ | ✅ | ❌ |
| quotes.approve | ✅ | ✅ | ✅ | ❌ |
| quotes.reject | ✅ | ✅ | ✅ | ❌ |
| quotes.archive | ✅ | ✅ | ✅ | ❌ |
| quotes.duplicate | ✅ | ✅ | ✅ | ❌ |
| **PROYECTOS** |
| projects.view | ✅ | ✅ | ✅ | ✅ |
| projects.create | ✅ | ✅ | ✅ | ❌ |
| projects.edit | ✅ | ✅ | ✅ | ✅ |
| projects.complete | ✅ | ✅ | ❌ | ❌ |
| projects.archive | ✅ | ✅ | ✅ | ❌ |
| projects.restore | ✅ | ✅ | ✅ | ❌ |
| projects.delete | ✅ | ❌ | ❌ | ❌ |
| **CONTRATOS** |
| contracts.view | ✅ | ✅ | ✅ | ✅ |
| contracts.create | ✅ | ✅ | ✅ | ❌ |
| contracts.edit | ✅ | ✅ | ✅ | ❌ |
| contracts.archive | ✅ | ✅ | ✅ | ❌ |
| **DISEÑOS** |
| designs.view | ✅ | ✅ | ✅ | ✅ |
| designs.upload | ✅ | ✅ | ❌ | ✅ |
| designs.approve_architect | ✅ | ✅ | ❌ | ✅ |
| designs.approve_client | ✅ | ✅ | ✅ | ❌ |
| designs.archive | ✅ | ✅ | ❌ | ❌ |
| **MATERIALES** |
| materials.view | ✅ | ✅ | ✅ | ✅ |
| materials.manage | ✅ | ✅ | ❌ | ✅ |
| materials.delete | ✅ | ✅ | ❌ | ❌ |
| **FINANZAS — COBRAR** |
| receivables.view | ✅ | ✅ | ✅ | ✅ |
| receivables.create | ✅ | ✅ | ✅ | ❌ |
| receivables.edit | ✅ | ✅ | ✅ | ❌ |
| receivables.payment | ✅ | ✅ | ✅ | ❌ |
| receivables.cancel | ✅ | ✅ | ✅ | ❌ |
| **FINANZAS — PAGAR** |
| payables.view | ✅ | ✅ | ✅ | ❌ |
| payables.create | ✅ | ✅ | ✅ | ❌ |
| payables.edit | ✅ | ✅ | ✅ | ❌ |
| payables.payment | ✅ | ✅ | ✅ | ❌ |
| payables.cancel | ✅ | ✅ | ✅ | ❌ |
| **PAGOS** |
| payments.void | ✅ | ✅ | ❌ | ❌ |
| **OBLIGACIONES** |
| obligations.view | ✅ | ✅ | ✅ | ❌ |
| obligations.manage | ✅ | ✅ | ✅ | ❌ |
| obligations.archive | ✅ | ✅ | ✅ | ❌ |
| **PERSONAL** |
| employees.view | ✅ | ✅ | ✅ | ✅ |
| employees.manage | ✅ | ✅ | ✅ | ❌ |
| employees.archive | ✅ | ✅ | ✅ | ❌ |
| **PROVEEDORES** |
| suppliers.view | ✅ | ✅ | ✅ | ✅ |
| suppliers.create | ✅ | ✅ | ✅ | ❌ |
| suppliers.edit | ✅ | ✅ | ✅ | ❌ |
| suppliers.archive | ✅ | ✅ | ✅ | ❌ |
| **DOCUMENTOS** |
| documents.view | ✅ | ✅ | ✅ | ✅ |
| documents.upload | ✅ | ✅ | ✅ | ✅ |
| documents.edit | ✅ | ✅ | ✅ | ❌ |
| documents.manage | ✅ | ✅ | ❌ | ❌ |
| **REPORTES** |
| reports.financial | ✅ | ✅ | ❌ | ❌ |
| reports.projects | ✅ | ✅ | ✅ | ✅ |
| **CONFIGURACIÓN** |
| settings.view | ✅ | ✅ | ✅ | ❌ |
| settings.manage | ✅ | ❌ | ❌ | ❌ |
| **USUARIOS** |
| users.view | ✅ | ✅ | ❌ | ❌ |
| users.create | ✅ | ❌ | ❌ | ❌ |
| users.edit | ✅ | ❌ | ❌ | ❌ |
| users.disable | ✅ | ❌ | ❌ | ❌ |
| users.change_role | ✅ | ❌ | ❌ | ❌ |
| **AUDITORÍA** |
| audit.view | ✅ | ✅ | ❌ | ❌ |

---

## Notas de seguridad

1. **Frontend vs Backend**: Los permisos del frontend son solo UX. Toda acción crítica está respaldada por RLS y RPCs en la DB.
2. **Rol manager**: Puede ver usuarios pero NO crearlos, desactivarlos ni cambiar roles. Solo el administrador tiene esas capacidades.
3. **Último administrador**: `change_user_role` y `set_user_active` en DB protegen el sistema de quedarse sin administrador activo.
4. **Usuario inactivo**: `current_user_is_active()` bloquea operaciones en todos los RPCs críticos. El AuthContext también detecta `active=false` y cierra sesión.
5. **activity_log**: Solo INSERT permitido para usuarios autenticados. UPDATE y DELETE revocados explícitamente a nivel de DB.
6. **invite-user**: La Edge Function valida el JWT del llamador y que tenga rol `administrator` antes de usar el service_role key. El service_role nunca se expone al frontend.
7. **Cambio de rol propio**: Bloqueado en UI. La DB solo acepta cambios de rol via `change_user_role()` que valida `auth.uid()` del llamador.

---

## Cambios respecto a HITO #13

- `designs.approve` dividido en `designs.approve_architect` y `designs.approve_client`
- `users.manage` dividido en `users.view`, `users.create`, `users.edit`, `users.disable`, `users.change_role`
- Nuevo rol `manager` con control operativo completo
- Nuevos permisos: `reports.financial`, `reports.projects`
