# CHECKLIST SEMANAL — MYD3000 Admin

Revisión de mantenimiento preventivo. Ejecutar una vez por semana (sugerido: lunes).

---

## Aplicación

- [ ] Abrir /configuracion/sistema → todos los bloques en OK
- [ ] Verificar que no hay errores HIGH/CRITICAL sin resolver en logs Railway
- [ ] Si hay jobs fallidos → investigar desde /configuracion/sistema → Automatizaciones

## Datos

- [ ] Obligaciones recurrentes generadas para la semana
- [ ] No hay cotizaciones olvidadas en estado "En revisión" por más de 5 días
- [ ] Proyectos con diseño pendiente → verificar estado con el equipo
- [ ] Documentos por vencer en los próximos 30 días → gestionar

## Financiero

- [ ] Cobros vencidos → gestionar con clientes
- [ ] Pagos vencidos → pagar o renegociar
- [ ] Giacomo y Giovanni → verificar que los pagos del período están registrados

## Usuarios

- [ ] No hay usuarios inactivos inesperados (revisar /configuracion/usuarios)
- [ ] Si hubo cambio de personal → desactivar/reactivar según corresponda

## Backups

- [ ] Registrar verificación de backup en Configuración → Backup & Datos si corresponde
- [ ] Si la semana tuvo mucha actividad → verificar manualmente el estado del plan Supabase

## Storage

- [ ] Si se subieron muchos PDFs → revisar integridad en Configuración → Backup & Datos → Integridad de Storage

---

*Tiempo estimado: 15-20 minutos*
