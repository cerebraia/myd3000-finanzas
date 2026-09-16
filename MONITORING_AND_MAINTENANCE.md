# MONITORING AND MAINTENANCE — MYD3000 Admin

Referencia técnica del sistema de monitoreo y mantenimiento operativo.

---

## Herramientas de monitoreo disponibles

### 1. Estado del sistema (/configuracion/sistema)
**Quién:** Administrator, Manager  
**Qué muestra:**
- Versión de la aplicación y entorno
- Conectividad a Supabase DB
- Estado de la sesión Auth
- Buckets de Storage (admin-files, project-files)
- Historial de automatizaciones (job_runs)
- Estado del último backup

**Acciones disponibles:**
- Generar obligaciones pendientes (idempotente)

### 2. Auditoría (/auditoria)
**Quién:** Administrator, Manager  
**Qué muestra:** Todos los eventos de negocio con actor, entidad, antes/después  
**Filtros:** Usuario, tipo de entidad, acción, fecha

### 3. Railway Logs
**Dónde:** Railway Dashboard → tu servicio → Logs  
**Qué revisar:**
- Errores de build
- Errores de runtime (unhandled exceptions del frontend llevan a ErrorBoundary, no a Railway)
- Métricas de CPU/RAM

### 4. Supabase Dashboard
**Módulos relevantes:**
- **Auth** → Logs: intentos de login, errores JWT
- **Database** → Logs: queries lentas, errores SQL (planes Pro+)
- **Edge Functions** → Logs: ejecuciones de invite-user
- **Storage** → Logs: accesos, errores
- **Usage** → Uso de DB, Storage, Auth MAU, Bandwidth

### 5. Configuración → Backup & Datos
**Quién:** Administrator, Manager  
**Qué ofrece:**
- Integridad de Storage (DB vs archivos reales)
- Historial de verificaciones de backup manuales

---

## Observabilidad de automatizaciones

### generate_due_recurring_obligations / run_obligations_job
- Se puede ejecutar manualmente desde /configuracion/sistema
- Resultado se registra en la tabla `job_runs`
- Es idempotente: usa `period_key` para evitar duplicados
- Frecuencia recomendada: diaria (manual) o via cron externo

### Notificaciones
- Se generan automáticamente desde triggers y RPCs
- Deduplicadas por `dedupe_key`
- Revisar en /notificaciones

---

## Tablas de monitoreo

| Tabla | Propósito | Quién puede leer |
|-------|-----------|-----------------|
| `job_runs` | Historial de ejecuciones de automatizaciones | Administrator, Manager |
| `backup_runs` | Historial de verificaciones de backup | Administrator, Manager |
| `activity_log` | Todos los eventos de negocio | Administrator, Manager |
| `notifications` | Notificaciones para usuarios | Cada usuario ve las suyas |

---

## Gestión de errores en el frontend

El error handling centralizado está en `src/utils/errors.ts`:

- **mapSupabaseError(err)** → traduce error Supabase a mensaje legible
- **getErrorMessage(err)** → versión simplificada para toast

Categorías de error:
- `permission` → "No tienes permiso para realizar esta acción."
- `duplicate` → "Ya existe un registro con esos datos."
- `not_found` → "El registro solicitado no existe."
- `network` → "Error de conexión. Verifica tu red e intenta de nuevo."
- `validation` → "Los datos ingresados no son válidos."
- `database` / `unknown` → "Ha ocurrido un error inesperado."

**ErrorBoundary** captura errores no controlados en React y muestra un mensaje genérico sin stack técnico.

---

## Protecciones contra doble submit

Los RPCs de pago en Supabase son transaccionales y validan el saldo antes de insertar:
- `register_receivable_payment` → valida que el monto no supera el pendiente
- `register_payable_payment` → igual
- En ambos casos, si se hace doble click antes de que el primero complete, el segundo puede fallar por condición de carrera pero no puede crear un pago mayor al saldo

**Protección adicional recomendada:** usar `disabled={isPending}` en botones de pago — ya implementado en todos los formularios de pago.

---

## SPA Routing

El servidor `serve dist -s` maneja el fallback: cualquier ruta que no sea un archivo existente en `dist/` → `index.html`. Esto permite que React Router funcione correctamente con `history` routing.

**Rutas estáticas accesibles sin autenticación:**
- `/health` → página de salud mínima (SPA)
- `/health.json` → JSON estático con versión
- `/login` → formulario de login

---

## Performance

**Bundle sizes actuales:**
- boot.js (vendor/react): ~595KB / ~170KB gzip
- Módulos por página: 10-50KB cada uno (lazy loaded)

**Estrategia:** Todas las rutas usan `React.lazy` con `Suspense`. El primer load descarga el boot.js + la ruta actual. Las demás páginas se descargan bajo demanda.

**Consultas críticas:** El dashboard usa 2-3 RPCs (`get_dashboard_summary`, `get_pending_items`, `getDashboardStats`). Con TanStack Query y `staleTime: 5min`, no se repiten en cada render.

---

## Notas sobre MFA

**Estado actual:** PENDIENTE  
Supabase soporta TOTP MFA. Para activar:
1. Supabase Dashboard → Authentication → Multi-Factor Authentication → Enable TOTP
2. Los usuarios deben configurar su MFA en su próximo login (o forzar desde la URL)
3. Se recomienda MFA obligatorio para role `administrator`

---

## Recursos y límites a monitorear

| Recurso | Dónde ver | Señal de alerta |
|---------|-----------|-----------------|
| DB size | Supabase → Usage | > 80% del límite del plan |
| Storage | Supabase → Usage | > 80% del límite |
| Auth MAU | Supabase → Usage | Acercarse al límite del plan |
| Railway CPU | Railway → Metrics | Picos sostenidos |
| Railway RAM | Railway → Metrics | Reinicios por OOM |
