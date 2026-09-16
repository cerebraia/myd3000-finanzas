# Reporte de Integridad de Storage — MYD3000 Admin

## Cómo generar el reporte

**Desde la app:** Configuración → Backup & Datos → Integridad de Storage → Verificar

**Vía RPC (Supabase SQL Editor):**
```sql
SELECT public.get_storage_integrity();
```

---

## Qué muestra el reporte

| Campo | Descripción |
|-------|-------------|
| `project_designs` | Diseños de proyectos con archivo en Storage |
| `documents` | Documentos con archivo registrado |
| `employees_photos` | Empleados con foto cargada |
| `employees_resumes` | Empleados con CV cargado |
| `payments_receipts` | Pagos con comprobante |
| `payments_no_receipt` | Pagos sin comprobante (advertencia) |
| `payments_voided` | Pagos anulados (historial, no problema) |
| `designs_archived` | Versiones de diseño archivadas |
| `documents_soft_deleted_with_file` | Docs eliminados que aún tienen archivo en Storage |

---

## Inventario manual de Storage

Para listar físicamente los archivos en los buckets:

```bash
# Configurar variables (ver ENVIRONMENT_VARIABLES.md)
export SUPABASE_URL="https://tu-proyecto.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="tu-service-role-key"

chmod +x scripts/export-storage-inventory.sh
./scripts/export-storage-inventory.sh
```

El inventario se guarda en `./backups/storage_inventory_TIMESTAMP.json`

---

## Archivos huérfanos

Un archivo huérfano es un archivo en Storage sin registro correspondiente en la DB.

**Causas posibles:**
- Error durante upload (archivo subió pero registro no se creó)
- Migración incompleta
- Registro eliminado físicamente (no debería ocurrir con soft delete)

**Política:** NO borrar archivos automáticamente. Solo reportar.

Para detectar huérfanos manualmente:
1. Obtener lista de paths desde DB:
   ```sql
   SELECT storage_path FROM public.project_designs WHERE storage_path IS NOT NULL
   UNION
   SELECT storage_path FROM public.documents WHERE storage_path IS NOT NULL
   UNION
   SELECT photo_storage_path FROM public.employees WHERE photo_storage_path IS NOT NULL;
   ```
2. Comparar con el inventario del script `export-storage-inventory.sh`
3. Archivos en Storage que no aparecen en DB = potenciales huérfanos
4. Verificar manualmente antes de cualquier acción

---

## Política de retención de archivos

**V1 (actual):**
- Archivos de Storage: retención indefinida (no se eliminan automáticamente)
- Registros archivados: retención indefinida
- Pagos anulados: retención indefinida

**Futura política de purga:**
- Solo eliminar archivos de Storage asociados a registros archivados si:
  1. Han pasado más de 12 meses del archivo
  2. Administrator confirmó la purga manualmente
  3. Existe backup verificado del archivo
- Nunca purga automática sin supervisión
