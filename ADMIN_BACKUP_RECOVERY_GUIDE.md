# Guía de Backup y Recuperación para el Administrador — MYD3000

Este documento explica, en lenguaje sencillo, cómo proteger y recuperar información en MYD3000 Admin.

---

## ¿Cómo recuperar un registro archivado?

Si archivaste accidentalmente un cliente, proyecto, cotización, empleado, proveedor o documento:

1. Ve a **Configuración → Backup & Datos → Ver papelera**
2. Busca el elemento por nombre o número
3. Haz clic en **Restaurar**
4. Confirma la acción

El elemento vuelve a estar activo. Todas sus relaciones (cobros, pagos, documentos) permanecen intactas.

---

## ¿Qué hacer si un pago fue registrado incorrectamente?

1. Ve al detalle de la cuenta (por cobrar o por pagar)
2. Encuentra el pago incorrecto en el historial
3. Anúlalo con el botón **Anular** (requiere motivo)
4. El saldo se recalcula solo
5. Registra el pago correcto

El pago anulado no desaparece — queda en el historial de auditoría.

---

## ¿Cómo verificar que los backups están funcionando?

1. Ve a **Supabase Dashboard → Settings → Backups**
2. Verifica que aparezcan backups recientes
3. Registra la verificación en **Configuración → Backup & Datos → "Registrar verificación"**

Si no aparecen backups: revisa el plan de Supabase (requiere plan Pro o superior para backups automáticos).

---

## ¿Qué información se respalda automáticamente?

| Componente | Backup automático | Soft delete |
|-----------|------------------|-------------|
| Base de datos (Supabase) | Sí (si plan Pro+) | Sí — papelera |
| Diseños PDF | No automático | Sí — versiones |
| Documentos | No automático | Sí — papelera |
| Comprobantes de pago | No automático | No (no se borran) |
| Código fuente | GitHub | — |

---

## ¿Cómo hacer un backup manual de la base de datos?

Solo desde un entorno seguro (no desde el navegador):

```bash
# 1. Configurar credenciales (obtenerlas de Supabase → Project Settings → Database)
export SUPABASE_DB_HOST="db.tu-proyecto.supabase.co"
export SUPABASE_DB_PASSWORD="tu-contraseña"
# ... (ver ENVIRONMENT_VARIABLES.md)

# 2. Ejecutar el script
./scripts/backup-database.sh
```

El archivo se guarda en `./backups/` comprimido como `.sql.gz`.

**Guarda una copia en un lugar seguro, separado del servidor.**

---

## ¿Qué hacer ante un incidente grave?

Ver `INCIDENT_RECOVERY_PLAN.md` para cada caso específico:
- Elemento archivado → Papelera
- Pago incorrecto → Anulación
- Archivo eliminado → Papelera + backup Storage
- Migración fallida → Detener, evaluar, rollback
- DB comprometida → Restaurar backup en staging primero
- Cuenta hackeada → Desactivar usuario, cambiar contraseña
- Secreto filtrado → Rotar key inmediatamente

---

## Antes de ejecutar una migración SQL

1. Completar `PRE_MIGRATION_CHECKLIST.md`
2. Confirmar que hay backup reciente
3. Revisar el SQL — sin DROP TABLE, sin TRUNCATE
4. Ejecutar en Supabase SQL Editor
5. Completar `POST_MIGRATION_CHECKLIST.md`

---

## Contactos importantes

- **Supabase soporte:** support.supabase.com
- **Supabase estado:** status.supabase.com
- **Railway soporte:** help.railway.app
- **Código fuente:** github.com/cerebraia/myd3000-finanzas
