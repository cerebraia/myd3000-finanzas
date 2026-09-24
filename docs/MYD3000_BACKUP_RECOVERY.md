# MYD3000 — Plan de Respaldo y Recuperación Pre-Bootstrap

**Fecha:** 2026-09-23  
**Contexto:** Respaldo requerido antes de ejecutar `SUPABASE_PROJECTS_BOOTSTRAP_INCREMENTAL.sql`

---

## ESTADO ACTUAL (antes del respaldo)

```
SUPABASE PROJECT REF : bxmuuphzcruyewbergqd
GIT HEAD             : 1b36f98
TABLAS CON DATOS     : profiles, clients, quotes, quote_items,
                       quote_payment_terms, activity_log
BOOTSTRAP EJECUTADO  : NO
```

---

## HERRAMIENTAS DISPONIBLES

| Herramienta | Estado | Notas |
|-------------|--------|-------|
| `npx supabase` v2.117.0 | Disponible — sin autenticar | Método recomendado |
| `pg_dump` | No instalado | Requiere PostgreSQL client |
| `brew` | No instalado | No disponible para instalar pg tools |
| Supabase Dashboard Backups | Siempre disponible | Fallback manual |

---

## MÉTODO RECOMENDADO — Supabase CLI

### Paso 1: Obtener la contraseña de la base de datos

1. Abrir: Supabase Dashboard → Proyecto → **Settings → Database**
2. Sección "Connection string" o "Database password"
3. Copiar la contraseña (NO pegarla en el chat ni en código)

### Paso 2: Autenticar el CLI

Escribir en el chat (o en la terminal):

```
! npx supabase login
```

Esto abre el navegador para autenticación OAuth. **No requiere pegar ningún secreto en el chat.**

### Paso 3: Crear el respaldo

Una vez autenticado, ejecutar en la terminal:

```bash
export SUPABASE_DB_PASSWORD="tu-password-aqui"
bash ~/Documents/MYD3000-Backups/run_backup_supabase_cli.sh
```

Esto genera en `~/Documents/MYD3000-Backups/`:
- `MYD3000_PRE_BOOTSTRAP_YYYYMMDD_HHMMSS_schema.sql` — esquema completo
- `MYD3000_PRE_BOOTSTRAP_YYYYMMDD_HHMMSS.sql` — datos completos

### Paso 4: Verificar el respaldo

```bash
bash ~/Documents/MYD3000-Backups/verify_backup.sh
```

---

## MÉTODO ALTERNATIVO — Dashboard manual

Si el CLI no está disponible:

1. Ir a [Supabase Dashboard](https://app.supabase.com) → Proyecto MYD3000
2. Verificar si hay backups automáticos: **Settings → Backups**
   - Plan Free: backups diarios PITR por 7 días
   - Plan Pro: backups con mayor retención y PITR
3. Hacer un snapshot manual si el plan lo permite
4. Guardar en `~/Documents/MYD3000-Backups/` con nombre descriptivo

---

## ALCANCE DEL RESPALDO

### Incluido en el dump de PostgreSQL
```
✓ Esquema completo del schema public
✓ Datos de todas las tablas
✓ Funciones y RPCs
✓ Triggers y procedimientos almacenados
✓ Constraints (PK, FK, CHECK, UNIQUE)
✓ Índices
✓ Políticas RLS
✓ Secuencias y sus valores actuales
✓ Tipos personalizados
```

### NO incluido en el dump de PostgreSQL
```
✗ Archivos en Supabase Storage (admin-files, project-files)
✗ Configuración de Supabase Auth (providers, URLs, tokens)
✗ Variables de entorno de Railway
✗ Edge Functions desplegadas
✗ Configuración de realtime
✗ Datos de auth.users (schema auth, no public)
```

### Nota sobre Storage
Los buckets `admin-files` y `project-files` no existen aún en remoto (el bootstrap aún no se ha ejecutado). No hay archivos de Storage que respaldar en este momento.

### Nota sobre Auth
El dump de PostgreSQL no incluye el schema `auth`. Las cuentas de usuario (auth.users) son gestionadas por Supabase internamente y tienen su propio mecanismo de backup en el dashboard.

---

## PLAN DE RECUPERACIÓN ANTE FALLO DEL BOOTSTRAP

Si el bootstrap falla y deja el schema en estado inconsistente:

### Opción A: Restaurar desde el dump SQL (Supabase CLI)

```bash
# Reemplazar [PROJECT_REF] con bxmuuphzcruyewbergqd
# Reemplazar [DB_PASSWORD] con la contraseña de la BD
export SUPABASE_DB_PASSWORD="[DB_PASSWORD]"

npx supabase db push \
  --project-ref bxmuuphzcruyewbergqd \
  --linked \
  < ~/Documents/MYD3000-Backups/MYD3000_PRE_BOOTSTRAP_YYYYMMDD_HHMMSS_schema.sql

# ADVERTENCIA: esto requiere que el schema no tenga conflictos
# Ejecutar SOLO si el estado remoto es recuperable
```

### Opción B: Restaurar desde PITR del Dashboard

1. Supabase Dashboard → Proyecto → Settings → Backups
2. Seleccionar el punto antes de ejecutar el bootstrap
3. Restaurar (disponible en planes Pro y superiores)

### Opción C: Revertir tablas afectadas manualmente

Si solo algunas tablas fueron alteradas incorrectamente:

```sql
-- Para deshacer ALTER TABLE ADD COLUMN en caso de error
-- (solo si la columna fue agregada incorrectamente)
-- Ejemplo — NO ejecutar sin verificar primero:
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS active;
```

### Opción D: Contactar soporte de Supabase

Para proyectos en planes pagos, Supabase tiene soporte de restauración de emergencia.

---

## VERIFICACIÓN DE INTEGRIDAD DEL RESPALDO

Después de crear el respaldo, confirmar:

```bash
bash ~/Documents/MYD3000-Backups/verify_backup.sh
```

Criterios de aprobación:
- [ ] Archivo existe y tamaño > 0
- [ ] SHA-256 registrado
- [ ] Tablas críticas presentes en el dump
- [ ] Contiene definiciones de funciones
- [ ] Contiene políticas RLS

---

## UBICACIÓN DEL RESPALDO

```
Directorio : ~/Documents/MYD3000-Backups/
             (FUERA del repositorio Git — NO agregar a .gitignore)

Scripts    : run_backup.sh              (pg_dump — si disponible)
             run_backup_supabase_cli.sh (Supabase CLI — método actual)
             verify_backup.sh           (verificación)

Archivos   : MYD3000_PRE_BOOTSTRAP_YYYYMMDD_HHMMSS_schema.sql
             MYD3000_PRE_BOOTSTRAP_YYYYMMDD_HHMMSS.sql
             MYD3000_PRE_BOOTSTRAP_YYYYMMDD_HHMMSS.log
             MYD3000_PRE_BOOTSTRAP_YYYYMMDD_HHMMSS.meta
```

**IMPORTANTE:** Este directorio NO está en Git. No commitear los archivos .sql, .dump ni .meta. Guardar el respaldo en almacenamiento privado adicional (Google Drive, disco externo).

---

## RIESGOS Y LIMITACIONES

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Dump incompleto | Sin recovery total | Verificar con verify_backup.sh |
| Password incorrecta | Dump falla | Obtener password desde Dashboard |
| Plan Free sin PITR | Sin restauración puntual | Dump manual es la única opción |
| Storage no respaldado | Archivos de Storage perdidos | Sin archivos aún — riesgo cero actual |
| Auth.users no incluido | Cuentas requieren recreación | Backup separado desde Supabase Auth |
| Restore test no realizado | Recuperabilidad no confirmada | Probar en proyecto de staging si disponible |
