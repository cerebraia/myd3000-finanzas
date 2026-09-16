# Arquitectura de Backup — MYD3000 Admin

## Capas de protección

### CAPA 1 — Validaciones y permisos
- RLS en todas las tablas
- RBAC via profiles.role
- current_user_is_active() en RPCs críticos
- Validación de inputs (Zod + DB constraints)

### CAPA 2 — Soft delete e historial
- `archived_at / archived_by / archive_reason` en: clients, quotes, projects, contracts, employees, suppliers, recurring_obligations
- `deleted_at / deleted_by` en: documents
- `voided_at / voided_by / void_reason` en: payments_received, payments_made
- `cancelled_by / cancellation_reason / status='cancelled'` en: receivables, payables
- Versiones de cotización: `quote_versions` con snapshot JSON
- Versiones de diseño: `project_designs` múltiples con version_number
- Papelera UI: `/papelera` — solo administrator

### CAPA 3 — Backups
Ver sección "Estrategia de backup" abajo.

### CAPA 4 — Recuperación
Ver `INCIDENT_RECOVERY_PLAN.md`.

---

## Estrategia de backup

### 3.1 Base de datos (Supabase PostgreSQL)

**Automático (Supabase):**
- Requiere plan Pro o superior
- Verificar en: Supabase Dashboard → Settings → Backups
- Frecuencia: diaria
- Retención: 7 días (Pro), 30 días (Team+)
- Restauración: desde Supabase Dashboard (sin acceso a CLI en plan Free)

**Manual (pg_dump):**
- Script: `scripts/backup-database.sh`
- Requiere: PostgreSQL client, credenciales de DB en entorno seguro
- NUNCA ejecutar desde el frontend
- Frecuencia recomendada: semanal adicional
- Retención recomendada: 4 semanas locales, 12 meses en almacenamiento frío

```bash
# Configurar variables (NUNCA en código)
export SUPABASE_DB_HOST="db.your-project.supabase.co"
export SUPABASE_DB_PORT="5432"
export SUPABASE_DB_NAME="postgres"
export SUPABASE_DB_USER="postgres"
export SUPABASE_DB_PASSWORD="..."

# Ejecutar
chmod +x scripts/backup-database.sh
./scripts/backup-database.sh
```

### 3.2 Storage (Supabase Storage)

**Buckets:**
- `admin-files` — documentos, personal, comprobantes (PRIVADO)
- `project-files` — diseños de proyectos (PRIVADO)

**Estrategia:**
- Supabase Storage no tiene backup automático nativo en planes básicos
- Opción A: Script de inventario + descarga manual periódica
- Opción B (futuro): Replicación a S3/R2/Backblaze via cron server-side
- Script de inventario: `scripts/export-storage-inventory.sh`

**Almacenamiento secundario sugerido (a implementar según necesidad):**
- Cloudflare R2 (compatible S3, económico)
- Backblaze B2
- Google Drive empresarial
- AWS S3

### 3.3 Código fuente

- Repositorio: GitHub (cerebraia/myd3000-finanzas)
- Branch principal: `main`
- IMPORTANTE: GitHub NO es backup de DB ni Storage

### 3.4 CSV manual (último recurso)

Desde la app: Configuración → Exportar datos
- Clientes, Cotizaciones, Proyectos, Cobros, Pagos, Personal
- Limitado: no incluye archivos, no incluye toda la estructura
- Útil para recuperación parcial o análisis externo

---

## RPO y RTO objetivos

| Métrica | Valor objetivo | Notas |
|---------|---------------|-------|
| RPO (pérdida máxima) | 24 horas | Con backup diario de Supabase |
| RTO (tiempo de restauración) | 2-4 horas | Depende de tamaño y complejidad |

Estos valores son objetivos de política, no garantías de SLA.

---

## Retención recomendada

| Tipo | Frecuencia | Retención |
|------|-----------|-----------|
| Supabase automático | Diario | 7-30 días (según plan) |
| pg_dump manual | Semanal | 4-8 semanas |
| CSV exportados | Mensual | 6-12 meses |
| Snapshot mensual archivado | Mensual | 12 meses |

---

## Prueba de restauración

**MUY IMPORTANTE:** Un backup sin verificación de restauración no es confiable.

Procedimiento de prueba (en staging, no en producción):

1. Crear proyecto Supabase de staging separado
2. Restaurar el backup en staging
3. Verificar: login, CRUD básico, pagos, storage
4. Documentar resultado en `backup_runs`

Frecuencia recomendada: mensual o antes de cada actualización mayor.

---

## Registro de backups verificados

Usar: Configuración → Backup & Datos → Historial de backups → "Registrar verificación"

Campos: tipo, notas, fecha automática.

Tabla DB: `public.backup_runs`
