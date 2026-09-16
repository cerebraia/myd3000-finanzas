# CHECKLIST DEMO MYD3000

Verificar ESTA NOCHE antes de dormir, y de nuevo MAÑANA 30 min antes.

---

## 🔴 PASO CRÍTICO — EJECUTAR ESTA NOCHE

### 1. Bootstrap de base de datos (OBLIGATORIO)

Abrir Supabase Dashboard → SQL Editor → pegar y ejecutar cada archivo en orden:

| Orden | Archivo | Qué hace |
|-------|---------|---------|
| 1 | `supa_base/SUPABASE_BASE_PRE_HITO5_V3.sql` | Crea 17 tablas + RPCs core |
| 2 | `supa_base/HITO5_SUPABASE.sql` | Permisos avanzados |
| 3 | `supa_base/HITO6_SUPABASE.sql` | Config empresa |
| 4 | `supa_base/HITO7_SUPABASE.sql` | Soft delete + void |
| 5 | `supa_base/HITO8_SUPABASE.sql` | Proyectos manuales |
| 6 | `supa_base/HITO9_SUPABASE.sql` | Proveedores |
| 7 | `supa_base/HITO10_PROYECTOS_PAGOS_SUPABASE.sql` | Giacomo/Giovanni + dashboard RPCs |
| 8 | `supa_base/HITO11_AUTOMATION_SUPABASE.sql` | Tareas |
| 9 | `supa_base/HITO14_USERS_PERMISSIONS_SUPABASE.sql` | Usuarios |

**Verificación después de paso 1:**
La query al final del archivo debe devolver 20 tablas y 11+ funciones.

### 2. Crear buckets en Supabase Storage (OBLIGATORIO para PDF)

- Storage → New bucket → `project-files` → Private ✓
- Storage → New bucket → `admin-files` → Private ✓

### 3. Verificar usuario demo

Confirmar en Supabase Auth que el usuario administrador tiene:
- `email`: el que se usará para login
- `active = true` en tabla profiles
- `role = 'administrator'`

---

## ✅ CHECKLIST TÉCNICO

### Internet y entorno
- [ ] WiFi estable (probar antes con video call)
- [ ] URL de la app: `http://localhost:5173` (dev) o URL de Railway si está deployada
- [ ] Supabase project activo y respondiendo
- [ ] `.env` con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY correctos

### Aplicación
- [ ] `npm run dev` ejecutado y respondiendo sin errores en consola
- [ ] Login funciona (ingresar credenciales, ir a Dashboard, esperar 30s, seguir autenticado)
- [ ] F5 en Dashboard → sigue autenticado
- [ ] Cliente puede crearse (probar creación de "Marylin Sabino")
- [ ] Cotización puede crearse (probar nueva cotización, agregar items, guardar)
- [ ] Proyecto puede crearse (probar nuevo proyecto manual)
- [ ] Dashboard muestra KPIs (aunque sean $0 si no hay datos)

### Browser
- [ ] Resolución: 1440 × 900 o 1366 × 768
- [ ] Chrome o Edge — pestaña limpia
- [ ] Console cerrada (DevTools cerrado)
- [ ] No otras pestañas visibles durante demo
- [ ] Zoom del browser al 100%

### Data de demo
- [ ] Marylin Sabino existe como cliente (o se creará en vivo)
- [ ] Al menos 1 cotización de prueba visible (si hay tiempo de crearla antes)
- [ ] Al menos 1 proyecto de prueba visible (si hay tiempo)
- [ ] No datos de "test", "asdf", "prueba123" visibles

### Seguridad de demo
- [ ] No mostrar VITE_SUPABASE_ANON_KEY en pantalla
- [ ] No abrir Supabase dashboard durante demo (salvo que se pida arquitectura)
- [ ] No mostrar terminal

---

## ✅ CHECKLIST DÍA DE DEMO (30 min antes)

- [ ] Recargar app y verificar login
- [ ] Navegar: Dashboard → Clientes → Cotizaciones → Proyectos
- [ ] Verificar que no hay errores rojos en pantalla
- [ ] Tener guión DEMO_MYD3000_MAÑANA.md abierto en celular
- [ ] Agua y silencio en el espacio de presentación

---

## 📋 RESUMEN DE ESTADO ACTUAL

| Módulo | Estado | Requiere |
|--------|--------|---------|
| Login / Auth | ✅ LISTO | Nada |
| Dashboard | ✅ LISTO | Solo data real |
| Clientes — Lista | ✅ LISTO (fallback) | Nada |
| Clientes — Crear | ✅ LISTO | Nada |
| Cotizaciones — Lista | ✅ LISTO (fallback) | Nada |
| Cotizaciones — Crear | ⚠️ REQUIERE DB | Paso 1 de esta noche |
| Proyectos — Lista | ⚠️ REQUIERE DB | Paso 1 de esta noche |
| Proyectos — Crear manual | ⚠️ REQUIERE DB | Pasos 1+5 |
| Proyecto / Diseño (UI) | ✅ LISTO | Nada (aunque subir PDF requiere Storage) |
| PDF upload | ⚠️ REQUIERE STORAGE | Paso 2 de esta noche |
| Finanzas (CxC/CxP) | ⚠️ REQUIERE DB | Paso 1 |
| Giacomo/Giovanni | ⚠️ REQUIERE DB | Pasos 1+7 |
| Reportes | ⚠️ REQUIERE DB | Pasos 1+8 |
