# CHECKLIST MENSUAL — MYD3000 Admin

Revisión de mantenimiento al cierre de cada mes.

---

## Cierre financiero

- [ ] Ejecutar Reportes → Cierre mensual para el mes que cierra
- [ ] Revisar checklist de calidad del cierre: pagos sin comprobante, proyectos sin monto
- [ ] Confirmar que todos los cobros del mes están registrados
- [ ] Confirmar que todos los pagos del mes están registrados
- [ ] Imprimir/guardar el cierre mensual en PDF si es requerido

## Obligaciones

- [ ] Verificar que todas las obligaciones recurrentes del mes fueron generadas
- [ ] No hay cuentas por pagar del mes anteriror sin gestión
- [ ] Giacomo y Giovanni: saldos correctos y al día

## Backups

- [ ] Confirmar que Supabase tiene backups automáticos activos (Dashboard → Settings → Backups)
- [ ] Registrar una verificación manual en Configuración → Backup & Datos
- [ ] Documentar en BACKUP_RECOVERY_MYD3000.md si hubo algún cambio de infraestructura

## Sistema

- [ ] /configuracion/sistema → todos OK
- [ ] Railway → revisar uso de CPU/RAM del mes (no debe haber spikes anómalos)
- [ ] Supabase → revisar uso de DB y Storage (Control → Usage)
- [ ] Verificar que el plan de Supabase es suficiente para el volumen actual

## Seguridad

- [ ] Revisar usuarios activos → ¿hay accesos que ya no corresponden?
- [ ] Verificar que ningún usuario Operations tiene acceso a módulos que no debería
- [ ] MFA activo para administrator: sí / no / pendiente

## Dependencias (trim./cuando corresponda)

- [ ] `npm outdated` → identificar dependencias desactualizadas
- [ ] `npm audit` → 0 vulnerabilidades críticas
- [ ] Si hay vulnerabilidades críticas → aplicar parches en el siguiente ciclo de deploy

## Costos estimados (documentar)

| Servicio | Plan | Costo mensual |
|---------|------|--------------|
| Railway | — | — |
| Supabase | — | — |
| Dominio | — | — |

---

*Tiempo estimado: 45-60 minutos*
