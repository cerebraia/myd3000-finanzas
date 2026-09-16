# Checklist Pre-Migración — MYD3000 Admin

Completar ANTES de ejecutar cualquier SQL en producción.

---

## PREPARACIÓN

- [ ] Backup de la DB verificado (Supabase Dashboard → Settings → Backups)
- [ ] Si backup automático no disponible: ejecutar `scripts/backup-database.sh`
- [ ] Backup confirmado descargable (no asumir — verificar)

## REVISIÓN DEL SQL

- [ ] SQL revisado línea por línea
- [ ] No contiene `DROP TABLE`
- [ ] No contiene `TRUNCATE`
- [ ] No contiene `DELETE` masivo sin WHERE específico
- [ ] No contiene `DROP COLUMN` que elimine datos críticos
- [ ] No contiene `DROP POLICY` sin agregar una política de reemplazo
- [ ] No contiene `CASCADE` no intencionado
- [ ] Las RPCs con `SECURITY DEFINER` incluyen `SET search_path = public`
- [ ] Las RPCs validan `auth.uid()` y permisos

## ANÁLISIS DE IMPACTO

- [ ] Se verificó schema actual en producción antes de asumir columnas o tablas
- [ ] El SQL es idempotente donde corresponde (IF NOT EXISTS, OR REPLACE)
- [ ] Se pensó en el rollback: ¿cómo se deshace si algo falla?
- [ ] Se identificaron las tablas/funciones afectadas
- [ ] Se revisó que RLS sigue activa en tablas modificadas

## VENTANA DE MANTENIMIENTO

- [ ] El momento de ejecución tiene bajo tráfico (opcional pero recomendado)
- [ ] Jefferson está disponible o fue notificado
- [ ] Se tiene acceso a Supabase Dashboard durante la ejecución

## EJECUCIÓN

- [ ] SQL ejecutado en Supabase SQL Editor, no desde el frontend
- [ ] La query SELECT de verificación al final retorna resultados esperados
- [ ] No hubo errores durante la ejecución

## POST-MIGRACIÓN

Ver `POST_MIGRATION_CHECKLIST.md`

---

*Completado por:* _________________ *Fecha:* _________________
