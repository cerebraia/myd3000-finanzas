# Manual del Administrador — MYD3000 Admin

**Versión:** 1.0.0  
**Rol requerido:** `administrator`

---

## Roles del sistema

| Rol | Acceso |
|-----|--------|
| `administrator` | Acceso total. Auditoría. Gestión de usuarios. |
| `administration` | Cotizaciones, proyectos, finanzas, documentos, personal. Sin auditoría ni gestión de usuarios. |
| `operations` | Proyectos, personal, documentos. Sin finanzas. |

Los roles se asignan directamente en Supabase → Authentication → Users.

---

## Gestión de usuarios

Los usuarios se crean desde Supabase Dashboard:

1. Ir a Supabase → Authentication → Users
2. Hacer clic en **Invite user** o **Create user**
3. Ingresar correo y contraseña temporal
4. Después del primer login, el sistema crea automáticamente el perfil en `public.profiles`

### Asignar rol

```sql
-- Asignar rol administrator
UPDATE public.profiles SET role = 'administrator' WHERE email = 'usuario@ejemplo.com';

-- Asignar rol administration
UPDATE public.profiles SET role = 'administration' WHERE email = 'usuario@ejemplo.com';

-- Asignar rol operations
UPDATE public.profiles SET role = 'operations' WHERE email = 'usuario@ejemplo.com';
```

### Desactivar usuario

```sql
-- Desactivar perfil (el usuario pierde acceso al sistema)
UPDATE public.profiles SET active = false WHERE email = 'usuario@ejemplo.com';
```

Para eliminar completamente, hacerlo desde Supabase → Authentication → Users.

---

## Configuración del sistema

Desde **Configuración** (menú lateral):

### Tab: Empresa
- Datos de la empresa: nombre, RIF, teléfono, correo, dirección
- Representante autorizado: nombre y cargo
- Estos datos se usan en cotizaciones y documentos

### Tab: Categorías de gastos
- Categorías para organizar cuentas por pagar y obligaciones
- Ejemplos: Nómina, Servicios, Alquiler, Materiales
- Se pueden activar/desactivar

### Tab: Categorías de documentos
- Categorías para documentos administrativos
- Ejemplos: Contratos, Seguros, Permisos, Facturas

### Tab: Métodos de pago
- Opciones disponibles al registrar pagos
- Ejemplos: Zelle, Transferencia, Efectivo, Pago Móvil

### Tab: Exportar datos
- Exporta CSV de: Clientes, Cotizaciones, Proyectos, Cuentas por cobrar/pagar, Personal
- Codificación UTF-8 con BOM (compatible con Excel)

### Tab: Estado del sistema
- Verifica: conexión Supabase, autenticación, bucket de storage, versión
- Usar para diagnóstico rápido

---

## Auditoría

La sección **Auditoría** solo está visible para usuarios con rol `administrator`.

Registra automáticamente:
- Creación, edición y eliminación de: clientes, cotizaciones, proyectos, contratos
- Cambios de estado en cotizaciones y proyectos
- Pagos registrados
- Acciones sobre documentos y empleados

Filtros disponibles:
- Por fecha (desde/hasta)
- Por tipo de entidad
- Por acción
- Por usuario

El historial es de solo lectura — no se puede modificar desde la app.

---

## Configuración de Supabase

### Row Level Security (RLS)
El acceso a la base de datos está protegido por RLS. Las políticas se definen en `supa_base/HITO5_SUPABASE.sql`.

Reglas principales:
- Solo usuarios autenticados pueden acceder
- `administrator` y `administration` tienen acceso de escritura completo
- `operations` tiene acceso limitado (sin módulos financieros)
- Los logs de auditoría solo son legibles por `administrator`

### Funciones RPC
Las operaciones críticas usan transacciones atómicas via RPC:

| Función | Uso |
|---------|-----|
| `create_quote_with_items` | Crear cotización + partidas |
| `update_quote_with_items` | Editar cotización + partidas |
| `update_quote_status` | Cambiar estado + log de auditoría |
| `create_project_from_quote` | Aprobar cotización → crear proyecto + contrato + receivables |
| `register_receivable_payment` | Registrar cobro parcial/total |
| `register_payable_payment` | Registrar pago parcial/total |
| `generate_payable_from_obligation` | Generar cuenta por pagar desde obligación |

---

## Storage

El bucket `admin-files` debe existir en Supabase Storage con las siguientes características:
- **Tipo:** Privado (no público)
- **Acceso:** Via signed URLs generadas por el servidor

Para verificar: Configuración → Estado del sistema → Bucket admin-files.

Si el bucket no existe, crearlo desde Supabase → Storage → New bucket → nombre: `admin-files`.

---

## Backups

Ver documento `BACKUP_RECOVERY_MYD3000.md` para instrucciones completas.

Resumen:
- Supabase hace backups automáticos diarios (plan Pro)
- Exportar CSV desde Configuración → Exportar datos regularmente
- Ejecutar SQL de migración solo después de tomar snapshot

---

## Migraciones SQL

Orden de ejecución (solo si se instala desde cero):

1. `SUPABASE_BASE_PRE_HITO5_V3.sql`
2. `HITO5_SUPABASE.sql`
3. `HITO6_SUPABASE.sql`

Los scripts son idempotentes (seguros de re-ejecutar con `IF NOT EXISTS` y `ON CONFLICT DO NOTHING`).

Nunca ejecutar `DROP TABLE` en producción sin tener un backup confirmado.

---

## Solución de problemas comunes

### El usuario no puede iniciar sesión
- Verificar en Supabase → Authentication → Users que el correo esté confirmado
- Verificar que el perfil en `public.profiles` tenga `active = true`

### Las notificaciones no aparecen
- Verificar que existan registros en `public.notifications` para ese usuario
- Revisar RLS en la tabla `notifications`

### El storage no carga archivos
- Ir a Configuración → Estado del sistema → verificar bucket
- Confirmar que el bucket `admin-files` existe y tiene las políticas RLS correctas

### Error "Permission denied" en alguna acción
- El rol del usuario no tiene permiso para esa operación
- Revisar las políticas RLS en Supabase → Database → Policies

---

*Para soporte técnico avanzado, revisar los logs en Supabase → Database → Logs.*
