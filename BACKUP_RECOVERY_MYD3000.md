# Backup y Recuperación — MYD3000 Admin

## Estrategia general

El sistema MYD3000 Admin tiene tres componentes que respaldar:

1. **Base de datos** (Supabase PostgreSQL)
2. **Archivos** (Supabase Storage — bucket `admin-files`)
3. **Código fuente** (GitHub)

---

## 1. Base de datos (Supabase)

### Backup automático
Supabase incluye backups automáticos diarios en planes pagos (Pro o superior). Se conservan los últimos 7 días.

Verificar en: Supabase Dashboard → Settings → Backups

### Backup manual (exportar)
Desde Supabase → SQL Editor, ejecutar para exportar datos críticos:

```sql
-- Exportar clientes
SELECT * FROM public.clients ORDER BY created_at;

-- Exportar cotizaciones
SELECT * FROM public.quotes ORDER BY created_at;

-- Exportar proyectos
SELECT * FROM public.projects ORDER BY created_at;

-- Exportar cuentas por cobrar
SELECT * FROM public.receivables ORDER BY created_at;

-- Exportar cuentas por pagar
SELECT * FROM public.payables ORDER BY created_at;
```

También disponible desde la app: Configuración → Exportar datos → CSV.

### Antes de una migración grande

1. Descargar CSV de todos los módulos desde Configuración → Exportar datos
2. En Supabase → Database → Backups → crear backup manual si el plan lo permite
3. Anotar la fecha y versión del SQL ejecutado
4. Ejecutar la migración SQL solo en Supabase SQL Editor
5. Verificar con Configuración → Estado del sistema

---

## 2. Storage (archivos)

El bucket `admin-files` contiene:
- Fotos de empleados
- Hojas de vida y hoja de servicio
- Documentos administrativos
- Comprobantes de pago

### Exportar archivos manualmente
Desde Supabase → Storage → admin-files:
- Navegar por carpetas y descargar individualmente
- Supabase no ofrece descarga masiva en el dashboard actualmente

### Estructura de carpetas
```
admin-files/
  employees/{uuid}/photo/
  employees/{uuid}/resume/
  employees/{uuid}/service-record/
  documents/
  payables/{uuid}/receipts/
```

---

## 3. Código fuente

El repositorio está en GitHub: `cerebraia/myd3000-finanzas`

Siempre hay al menos dos copias:
- Local (máquina de desarrollo)
- GitHub (remoto, rama `main`)

No se requiere acción especial — git garantiza el historial completo.

---

## Recuperación ante fallo

### Escenario 1: Error en migración SQL

1. No ejecutar más SQL
2. Revisar el error en Supabase → SQL Editor (historial)
3. Si es posible, revertir con el SQL inverso (restaurar columnas eliminadas, etc.)
4. Si no es reversible, restaurar desde el backup automático de Supabase
5. Re-ejecutar solo el SQL corregido

### Escenario 2: Datos borrados accidentalmente

1. Verificar si el registro tiene `deleted_at` (soft delete) — documentos usan este mecanismo
2. Si tiene soft delete: `UPDATE documents SET deleted_at = NULL WHERE id = '...'`
3. Si fue un hard delete: restaurar desde backup de Supabase (requiere plan Pro)

### Escenario 3: Fallo total del servicio Railway

1. Railway tiene rollback automático si el build falla
2. Si el servicio no responde, reiniciar desde Railway Dashboard → Deployments → Redeploy
3. La base de datos no se ve afectada (Supabase es independiente)

### Escenario 4: Pérdida de credenciales Supabase

1. Las claves se regeneran en Supabase → Settings → API
2. Después de regenerar, actualizar en Railway → Variables de entorno
3. Los usuarios no son afectados — solo las conexiones del sistema

---

## Notas importantes

- **Nunca** compartir la `service_role` key. Solo la `anon` key va al frontend.
- Los usuarios de Supabase Auth son independientes de la base de datos — se gestionan desde Supabase → Authentication
- En caso de dudas, contactar soporte de Supabase antes de ejecutar operaciones destructivas
