# INCIDENT RUNBOOK — MYD3000 Admin

Guía de respuesta a incidentes en producción. No improvisar ante emergencias — seguir este documento.

---

## Clasificación de severidad

| Severidad | Definición | Tiempo de respuesta |
|-----------|-----------|---------------------|
| CRITICAL | Pérdida de datos, pago duplicado, login roto, DB inaccesible | Inmediato |
| HIGH | Función core bloqueada (cotizaciones, cobros, PDF) | < 2 horas |
| MEDIUM | Función secundaria degradada (filtros, export CSV) | < 24 horas |
| LOW | Problema visual menor | Próximo ciclo de deploy |

---

## Flujo de respuesta a incidentes

```
1. DETECTAR   → ¿Qué está fallando?
2. CLASIFICAR → CRITICAL / HIGH / MEDIUM / LOW
3. CONTENER   → ¿Puedo limitar el impacto ahora?
4. DIAGNOSTICAR → ¿Cuál es la causa raíz?
5. CORREGIR   → Aplicar fix validado
6. VALIDAR    → Confirmar que el incidente está resuelto
7. DOCUMENTAR → Registrar en INCIDENT_LOG
```

---

## CASO: App caída / no carga

**Síntoma:** La URL de producción no responde o muestra pantalla en blanco.

1. Verificar Railway → Deployments → ¿el último deploy fue exitoso?
2. Si el deploy falló → hacer rollback: Railway → Deployments → Seleccionar deploy anterior → Redeploy
3. Si el deploy fue exitoso pero la app no carga → revisar Railway Logs por errores de runtime
4. Verificar que las variables de entorno están configuradas (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
5. Si el error es de variables → agregar/corregir en Railway → Variables → Trigger redeploy

---

## CASO: DB inaccesible

**Síntoma:** El dashboard no carga datos; "Error de conexión" en la UI.

1. Ir a /configuracion/sistema → bloque "Base de datos" → ¿status ERROR?
2. Verificar en Supabase Dashboard → que el proyecto esté activo (no en pausa)
3. Supabase en pausa por inactividad → ir a Dashboard → Resume project
4. Si Supabase tiene incidente → revisar status.supabase.com
5. Si `VITE_SUPABASE_URL` es incorrecto → corregir en Railway → redeploy

---

## CASO: Login roto

**Síntoma:** Los usuarios no pueden iniciar sesión.

1. Verificar que la URL de producción está en Supabase Auth → URL Configuration → Site URL
2. Verificar que el dominio está en Redirect URLs
3. Si cambió el dominio de Railway → actualizar Site URL en Supabase Auth
4. Revisar en Supabase → Auth → Users → ¿el usuario existe y no está deshabilitado?
5. Si el usuario no existe → crearlo en Supabase Auth → luego actualizar profiles

---

## CASO: Storage inaccesible / PDF no se puede subir

**Síntoma:** Error al subir o ver archivos.

1. /configuracion/sistema → bloque "Storage" → ¿algún bucket falta?
2. Si falta un bucket → crearlo en Supabase → Storage → New bucket (PRIVADO)
3. Si el bucket existe pero falla al subir → verificar políticas RLS del bucket
4. Los signed URLs tienen vencimiento → si un link ya no funciona, pedir uno nuevo desde la UI

---

## CASO: Pago duplicado

**Síntoma:** Se registró el mismo pago dos veces.

1. NO borrar ningún registro
2. Identificar el pago duplicado (por fecha, monto, referencia)
3. Usar la acción "Anular pago" en el pago duplicado con el motivo "Pago duplicado accidental"
4. Verificar que el saldo de la cuenta fue recalculado correctamente
5. Registrar en INCIDENT_LOG con detalles del pago duplicado y la anulación
6. Investigar cómo ocurrió (doble click, retry de browser) para prevenir

---

## CASO: Obligaciones recurrentes no generadas

**Síntoma:** Las cuentas por pagar del período no aparecen.

1. Ir a /configuracion/sistema → Automatizaciones → Ejecutar "Generar obligaciones pendientes"
2. Si el botón falla → revisar Railway Logs
3. La generación es idempotente: ejecutar múltiples veces es seguro
4. Si aún no aparecen → verificar que las obligaciones recurrentes están activas en /obligaciones
5. Verificar que tienen monto y período correctamente configurados

---

## CASO: Deploy fallido

**Síntoma:** Railway muestra el deploy como fallido.

1. Railway → Logs → identificar el error específico
2. Error de build TypeScript → corregir en código, nuevo push
3. Error de dependencias → verificar `package-lock.json` está committeado
4. Mientras se corrige → el deploy anterior sigue activo (Railway no interrumpe el servicio)
5. Una vez corregido → push → nuevo deploy automático

---

## CASO: Permiso incorrecto

**Síntoma:** Un usuario ve o puede hacer algo que no debería.

1. Verificar el rol del usuario en /configuracion/usuarios
2. Si el rol es incorrecto → cambiar rol (solo administrator puede hacerlo)
3. Si el rol es correcto pero el permiso persiste → verificar en permissions.ts si el rol tiene ese permiso
4. Si la seguridad es crítica → DETENER el acceso del usuario (desactivar temporalmente)
5. Para permisos de DB (RLS) → verificar en Supabase → SQL Editor → revisar policies

---

## CASO: Reportes con montos incorrectos

**Síntoma:** El reporte muestra números que no coinciden con los registros.

1. NO es un error de DB salvo que se confirme
2. Verificar timezone → debe ser America/Caracas en company_settings
3. Verificar que los filtros de fecha del reporte son correctos
4. Comparar manualmente: el reporte de flujo de caja usa `payments_received` y `payments_made` (no cotizaciones)
5. Si el problema persiste → revisar las RPCs de reportes en Supabase con los mismos parámetros

---

## CASO: Archivo no disponible

**Síntoma:** Un PDF de diseño o documento no se puede abrir.

1. Los archivos usan signed URLs con vencimiento → recargar la página para obtener nuevo URL
2. Si el archivo no existe en Storage → verificar integridad en Configuración → Backup & Datos
3. Si el registro apunta a un archivo que no existe → actualizar el registro con la ruta correcta o subir de nuevo
4. NO borrar registros de DB aunque el archivo no exista

---

## NO HACER ante un incidente

- No ejecutar SQL improvisado sobre tablas de pagos o cotizaciones
- No borrar registros de activity_log
- No hacer git reset --hard sin respaldo
- No desconectar el Storage bucket
- No resetear contraseñas de producción sin coordinar con los afectados
- No marcar como resuelto sin haber validado que el problema no persiste
