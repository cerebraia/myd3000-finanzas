# Checklist de Entrega — MYD3000 Admin v1.0.0

**Fecha:** 02/09/2026  
**Versión:** 1.0.0

---

## ACCESO Y USUARIOS

- [ ] Usuario administrador creado en Supabase → Authentication → Users
- [ ] Perfil actualizado: `role = 'administrator'`, `active = true`, `full_name` completo
- [ ] Credenciales de acceso entregadas al cliente de forma segura (no por email sin cifrar)
- [ ] Cliente puede iniciar sesión correctamente
- [ ] Cliente puede cerrar sesión

---

## SUPABASE

- [ ] Proyecto Supabase creado
- [ ] SQL ejecutado en orden: BASE → HITO5 → HITO6 → HITO7
- [ ] Bucket `admin-files` creado (privado)
- [ ] RLS habilitado en todas las tablas
- [ ] Site URL configurado en Authentication → URL Configuration
- [ ] Redirect URLs configuradas para el dominio de producción

---

## RAILWAY

- [ ] Proyecto Railway creado
- [ ] Repositorio GitHub conectado
- [ ] Variables de entorno configuradas:
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_ANON_KEY`
- [ ] Build command: `npm run build`
- [ ] Deploy exitoso
- [ ] URL de producción activa y accesible

---

## DOMINIO

- [ ] Dominio configurado (ej. `admin.myd3000.com`) o URL Railway compartida
- [ ] SSL/HTTPS activo
- [ ] DNS apuntando correctamente
- [ ] URL de Supabase actualizada con el dominio final

---

## DATOS DE EMPRESA

- [ ] Ir a Configuración → Empresa
- [ ] Ingresar: Nombre de empresa, RIF, teléfono, correo, dirección
- [ ] Ingresar: Representante autorizado (nombre y cargo)
- [ ] Guardar datos

---

## VERIFICACIÓN FUNCIONAL

- [ ] Login funciona
- [ ] Dashboard carga con datos
- [ ] Crear cliente de prueba
- [ ] Crear cotización de prueba
- [ ] Enviar a revisión
- [ ] Aprobar cotización (verifica creación automática de proyecto)
- [ ] Ver proyecto creado
- [ ] Registrar pago parcial
- [ ] Ver saldo actualizado
- [ ] Imprimir cotización (A4, sin sidebar, con logo)
- [ ] Subir documento de prueba
- [ ] Estado del sistema (Configuración → Estado) muestra todo OK

---

## COTIZACIONES

- [ ] Logo aparece en vista de impresión
- [ ] Datos de empresa correctos en cotizaciones
- [ ] Forma de pago 80/20 calcula correctamente
- [ ] PDF se puede guardar desde "Imprimir → Guardar como PDF"

---

## CREDENCIALES (administrar, no compartir aquí)

- [ ] Credenciales de Supabase guardadas de forma segura (no en Git)
- [ ] Credenciales de Railway guardadas de forma segura
- [ ] Contraseña del usuario administrador cambiada del valor inicial
- [ ] `.env` NO commitado en el repositorio

---

## DOCUMENTACIÓN ENTREGADA

- [ ] `MANUAL_USUARIO_MYD3000.md` — para operadores del sistema
- [ ] `MANUAL_ADMIN_MYD3000.md` — para el administrador técnico
- [ ] `DEPLOY_RAILWAY.md` — guía de despliegue
- [ ] `BACKUP_RECOVERY_MYD3000.md` — estrategia de backups

---

## BACKUPS

- [ ] Exportar CSV inicial de cada módulo (Configuración → Exportar datos)
- [ ] Verificar plan de Supabase y backups automáticos disponibles
- [ ] Documentar procedimiento de recuperación ante fallos

---

## SOPORTE

- [ ] Canal de comunicación acordado con el cliente
- [ ] Responsable de soporte técnico identificado
- [ ] Proceso de reporte de bugs definido

---

## FIRMA DE ENTREGA

Sistema entregado conforme a los requisitos acordados.

**Entregado por:** _______________________

**Recibido por:** _______________________

**Fecha:** _______________________
