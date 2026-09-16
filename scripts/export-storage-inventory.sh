#!/bin/bash
# ================================================================
# export-storage-inventory.sh — MYD3000 Admin
# Genera inventario de archivos en Supabase Storage
# usando la API de administración de Supabase
#
# PREREQUISITOS:
#   - curl instalado
#   - Variables de entorno configuradas
#
# USO:
#   export SUPABASE_URL="https://your-project.supabase.co"
#   export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
#   chmod +x scripts/export-storage-inventory.sh
#   ./scripts/export-storage-inventory.sh
#
# SEGURIDAD:
#   - El service_role key NUNCA debe estar en el código.
#   - Solo usar en entorno administrativo seguro.
#   - NUNCA exponer en frontend.
# ================================================================

set -euo pipefail

REQUIRED_VARS=("SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY")
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: Variable $var no está configurada."
    exit 1
  fi
done

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="./backups/storage_inventory_${TIMESTAMP}.json"
mkdir -p ./backups

BUCKETS=("admin-files" "project-files")

echo "======================================================"
echo " MYD3000 Admin — Inventario de Storage"
echo " Timestamp: $TIMESTAMP"
echo "======================================================"

echo '{"timestamp": "'"$TIMESTAMP"'", "buckets": [' > "$OUTPUT_FILE"
FIRST_BUCKET=true

for BUCKET in "${BUCKETS[@]}"; do
  if [ "$FIRST_BUCKET" = false ]; then
    echo ',' >> "$OUTPUT_FILE"
  fi
  FIRST_BUCKET=false

  echo "Listando bucket: $BUCKET..."

  # Supabase Storage API — listar archivos
  RESPONSE=$(curl -s \
    -X POST \
    "${SUPABASE_URL}/storage/v1/object/list/${BUCKET}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"prefix": "", "limit": 10000, "offset": 0}')

  echo '{"bucket": "'"$BUCKET"'", "files": '"$RESPONSE"'}' >> "$OUTPUT_FILE"
done

echo ']}' >> "$OUTPUT_FILE"

echo ""
echo "Inventario guardado en: $OUTPUT_FILE"
echo "Revisa el archivo para detectar archivos huérfanos."
echo "NO borrar archivos automáticamente — solo reportar."
echo "======================================================"
