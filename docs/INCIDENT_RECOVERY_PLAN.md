# Plan de Recuperación ante Incidentes — MYD3000 Admin

## Principio general

Antes de cualquier acción de recuperación:
1. **No entrar en pánico**
2. Identificar exactamente qué ocurrió
3. Evaluar si el soft delete resuelve el problema antes de usar backup
4. Documentar lo ocurrido

---

## Caso 1: Elemento archivado accidentalmente

**Ejemplos:** Cliente archivado, Proyecto archivado, Cotización archivada

**Solución:** Papelera (no requiere backup)

```
1. Ir a /papelera (solo administrator)
2. Buscar el elemento por nombre o número
3. Hacer clic en "Restaurar"
4. Confirmar
5. Verificar que el elemento está activo y sus relaciones intactas
```

**Verificación:**
- El elemento aparece en su lista original
- Cobros, pagos, documentos asociados siguen vinculados
- Activity log muestra el evento `entity.restored`

---

## Caso 2: Pago registrado incorrectamente

**Ejemplos:** Monto equivocado, Fecha incorrecta, Doble registro

**Solución:** Anular el pago (no restaurar DB)

```
1. Ir al detalle de la cuenta (cobrar o pagar)
2. Buscar el pago incorrecto en el historial
3. Anular el pago (botón "Anular" con motivo obligatorio)
4. El saldo se recalcula automáticamente
5. Registrar el pago correcto
```

**NUNCA:** restaurar DB para corregir un pago individual.
El historial de anulación queda en `payments_received.voided_at` / `payments_made.voided_at`.

---

## Caso 3: Archivo de diseño o documento eliminado

**Paso 1:** Verificar si el registro DB está soft-deleted

```
1. Ir a /papelera
2. Buscar el documento por nombre
3. Si aparece: Restaurar
4. El storage_path sigue apuntando al archivo en Storage
```

**Paso 2:** Si el archivo de Storage fue eliminado físicamente

```
1. Verificar si existe backup de Storage
2. Restaurar el archivo desde el backup al path correcto
3. Si no hay backup: el archivo se perdió — documentar
4. Crear nuevo documento con archivo reemplazante si aplica
```

---

## Caso 4: Migración SQL fallida

**Síntomas:** Error al ejecutar SQL, tablas en estado inconsistente

```
1. DETENER — no ejecutar más SQL
2. Evaluar si la transacción fue parcial o completa
3. Verificar qué cambios se aplicaron:
   SELECT * FROM information_schema.columns WHERE table_name = 'xxx';
4. Si hay backup reciente: considerar restauración en staging primero
5. Crear SQL de rollback manualmente para deshacer cambios parciales
6. Probar en staging antes de aplicar en producción
7. Solo si necesario: restaurar backup de producción
```

**NUNCA:** continuar aplicando SQL adicional sobre un estado inconsistente.

---

## Caso 5: DB comprometida o corrupción grave

**Síntomas:** Datos faltantes masivos, errores inexplicables, acceso no autorizado

```
1. Evaluar el alcance del daño
2. Notificar a Jefferson inmediatamente
3. Suspender acceso si hay sospecha de intruso:
   - Supabase → Auth → Invalidate all tokens
4. Determinar el punto de restauración adecuado
5. Crear entorno staging con backup
6. Verificar datos en staging
7. Documentar pérdida potencial de datos
8. Restaurar producción solo con Jefferson presente
9. Verificar después de restaurar:
   - Login
   - CRUD básico
   - Pagos
   - Storage
   - RLS
```

---

## Caso 6: Cuenta de administrador comprometida

```
1. Desactivar la cuenta desde Supabase Auth:
   Dashboard → Authentication → Users → [usuario] → Disable
2. Si no hay otro admin activo: contactar Supabase support
3. Cambiar contraseña desde Supabase Dashboard
4. Revisar activity_log para ver qué acciones se realizaron
5. Revocar sesiones activas
6. Evaluar si se modificaron datos, usuarios o configuración
7. Rotar service_role key si fue expuesta
```

---

## Caso 7: Secreto filtrado

**Variables afectadas posibles:**
- `VITE_SUPABASE_ANON_KEY` (expuesta en build — menor impacto, RLS protege)
- `SUPABASE_DB_PASSWORD` (alta gravedad)
- `SUPABASE_SERVICE_ROLE_KEY` (crítico)

```
1. Rotar la credencial INMEDIATAMENTE en Supabase Dashboard
2. Actualizar Railway → Environment Variables
3. Verificar que el deploy con nueva key funciona
4. Revisar logs de Supabase para accesos sospechosos
5. Si service_role fue expuesta:
   - Auditar activity_log
   - Verificar integridad de datos
   - Verificar no se crearon usuarios no autorizados
6. Documentar el incidente
```

Ver `ENVIRONMENT_VARIABLES.md` para procedimiento de rotación de keys.

---

## Caso 8: Storage corrupto o inaccesible

```
1. Verificar si es un problema temporal de Supabase
2. Revisar Supabase Status: status.supabase.com
3. Si es permanente: restaurar archivos desde backup de Storage
4. Actualizar storage_paths en DB si los paths cambiaron
5. Verificar signed URLs funcionan tras restauración
```

---

## Checklist post-incidente

Después de cualquier recuperación:

- [ ] Verificar login con usuarios reales
- [ ] Verificar datos críticos (clientes, proyectos, pagos)
- [ ] Verificar storage (abrir un archivo de diseño, un comprobante)
- [ ] Verificar RLS (intentar acceso sin autenticación)
- [ ] Documentar el incidente en `backup_runs` o registro interno
- [ ] Identificar causa raíz para prevenir recurrencia
- [ ] Evaluar si se necesita mejorar procedimientos

---

## Contactos de emergencia

| Servicio | Canal |
|---------|-------|
| Supabase issues | support.supabase.com |
| Supabase status | status.supabase.com |
| Railway issues | help.railway.app |
| GitHub | github.com/cerebraia/myd3000-finanzas |
