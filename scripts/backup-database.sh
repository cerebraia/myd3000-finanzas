#!/bin/bash
# ================================================================
# backup-database.sh — MYD3000 Admin
# Exporta la base de datos de Supabase via pg_dump
#
# PREREQUISITOS:
#   - pg_dump instalado (PostgreSQL client tools)
#   - Variables de entorno configuradas (ver abajo)
#
# USO:
#   chmod +x scripts/backup-database.sh
#   ./scripts/backup-database.sh
#
# NUNCA ejecutar con credenciales hardcodeadas.
# NUNCA ejecutar desde el frontend.
# Solo desde entorno administrativo seguro.
# ================================================================

set -euo pipefail

# ─── Verificar variables de entorno ────────────────────────────
# Configurar estas variables en tu entorno antes de ejecutar:
#
# export SUPABASE_DB_HOST="db.your-project-ref.supabase.co"
# export SUPABASE_DB_PORT="5432"
# export SUPABASE_DB_NAME="postgres"
# export SUPABASE_DB_USER="postgres"
# export SUPABASE_DB_PASSWORD="your-database-password"  # Supabase → Project Settings → Database
#
# Estas variables NUNCA deben estar en el código fuente.

REQUIRED_VARS=("SUPABASE_DB_HOST" "SUPABASE_DB_PORT" "SUPABASE_DB_NAME" "SUPABASE_DB_USER" "SUPABASE_DB_PASSWORD")

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: Variable de entorno $var no está configurada."
    echo "Configura todas las variables requeridas antes de ejecutar."
    exit 1
  fi
done

# ─── Configuración ──────────────────────────────────────────────
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_FILE="${BACKUP_DIR}/myd3000_backup_${TIMESTAMP}.sql"
COMPRESSED_FILE="${BACKUP_FILE}.gz"

mkdir -p "$BACKUP_DIR"

echo "======================================================"
echo " MYD3000 Admin — Backup de base de datos"
echo " Timestamp: $TIMESTAMP"
echo " Destino: $COMPRESSED_FILE"
echo "======================================================"

# ─── Ejecutar pg_dump ───────────────────────────────────────────
echo "[1/3] Ejecutando pg_dump..."

PGPASSWORD="$SUPABASE_DB_PASSWORD" pg_dump \
  --host="$SUPABASE_DB_HOST" \
  --port="$SUPABASE_DB_PORT" \
  --username="$SUPABASE_DB_USER" \
  --dbname="$SUPABASE_DB_NAME" \
  --schema=public \
  --no-owner \
  --no-acl \
  --format=plain \
  --file="$BACKUP_FILE"

echo "[2/3] Comprimiendo..."
gzip "$BACKUP_FILE"

# ─── Verificación básica ─────────────────────────────────────────
FILE_SIZE=$(du -sh "$COMPRESSED_FILE" | cut -f1)
echo "[3/3] Backup completado."
echo ""
echo "Archivo: $COMPRESSED_FILE"
echo "Tamaño:  $FILE_SIZE"
echo ""
echo "IMPORTANTE:"
echo "  - Almacena este archivo en un lugar seguro y separado."
echo "  - No guardes el archivo en el mismo servidor que la DB."
echo "  - Prueba la restauración periódicamente en un entorno de staging."
echo ""
echo "Para restaurar (solo en emergencia o staging):"
echo "  gunzip $COMPRESSED_FILE"
echo "  PGPASSWORD=password psql -h host -U user -d dbname -f $BACKUP_FILE"
echo "======================================================"
