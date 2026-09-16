# Checklist Post-Migración — MYD3000 Admin

Completar DESPUÉS de ejecutar SQL en producción.

---

## VERIFICACIÓN DE DB

- [ ] `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public'` — todas con RLS = true
- [ ] Tablas nuevas creadas correctamente
- [ ] Columnas nuevas presentes
- [ ] Funciones RPC creadas (verificar en Supabase → Database → Functions)
- [ ] No hay errores en Supabase Dashboard → Logs

## VERIFICACIÓN DE APLICACIÓN

- [ ] Login funciona con usuario real
- [ ] Dashboard carga sin errores de consola
- [ ] CRUD básico de al menos una entidad (ej: crear cliente)
- [ ] Pagos: registrar cobro de prueba — verificar saldo actualizado
- [ ] Storage: abrir un documento o diseño existente (signed URL)
- [ ] Notificaciones: campana funciona

## VERIFICACIÓN DE PERMISOS

- [ ] Rol Operations NO puede ver Auditoría
- [ ] Rol Operations NO puede cambiar configuración sensible
- [ ] Usuario sin sesión NO puede acceder a datos via API

## VERIFICACIÓN DE MÓDULOS AFECTADOS POR LA MIGRACIÓN

_(marcar solo los relevantes para este SQL)_

- [ ] Clientes
- [ ] Cotizaciones
- [ ] Proyectos
- [ ] Contratos
- [ ] Cuentas por cobrar
- [ ] Cuentas por pagar
- [ ] Obligaciones
- [ ] Personal
- [ ] Proveedores
- [ ] Documentos
- [ ] Reportes
- [ ] Papelera

## RESULTADO

- [ ] PASS — Todo funciona correctamente
- [ ] FAIL — Se detectaron problemas → documentar y escalar

**Problemas detectados:** _________________________________

**Acciones tomadas:** _________________________________

---

*Verificado por:* _________________ *Fecha:* _________________
