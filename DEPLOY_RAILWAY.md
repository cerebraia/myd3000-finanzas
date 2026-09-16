# Despliegue en Railway — MYD3000 Admin

## Requisitos previos

- Cuenta en [Railway](https://railway.app)
- Proyecto en Supabase activo con la base de datos configurada (ejecutar todos los SQL de `supa_base/` en orden)
- Repositorio conectado a GitHub

---

## Variables de entorno

En Railway → tu servicio → Variables, agregar:

| Variable | Descripción |
|----------|-------------|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase (ej: `https://xyz.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Clave anon pública de Supabase |

No usar la `service_role` key. Solo la `anon` key es segura en el frontend.

---

## Comandos de build

En Railway → Settings → Build:

```
Build Command:   npm run build
Start Command:   npm run preview -- --host 0.0.0.0 --port $PORT
```

O si usas `serve` (recomendado para producción estable):

```
Build Command:   npm install && npm run build
Start Command:   npx serve dist -s -l $PORT
```

---

## SPA Routing

Esta es una Single Page Application con React Router. Para que las rutas funcionen en producción, Railway debe servir `index.html` para cualquier ruta no encontrada.

Si usas `vite preview`, ya maneja esto correctamente.

Si usas Nginx u otro servidor, agregar rewrite rule:
```nginx
try_files $uri $uri/ /index.html;
```

---

## Configuración Supabase

Antes de desplegar, verificar en Supabase → Authentication → URL Configuration:

- **Site URL**: URL de tu dominio Railway (ej: `https://myd3000.up.railway.app`)
- **Redirect URLs**: agregar la misma URL

---

## Dominio personalizado

En Railway → tu servicio → Settings → Networking:
1. Agregar dominio personalizado
2. Configurar DNS en tu proveedor (registro CNAME o A)
3. Railway gestiona el certificado SSL automáticamente

---

## Orden de ejecución SQL (Supabase)

Ejecutar en este orden en Supabase → SQL Editor:

1. `supa_base/SUPABASE_BASE_PRE_HITO5_V3.sql`
2. `supa_base/HITO5_SUPABASE.sql`
3. `supa_base/HITO6_SUPABASE.sql`

---

## Verificación post-deploy

Después de desplegar:
1. Abrir la URL de Railway
2. Iniciar sesión
3. Ir a Configuración → Estado del sistema → Verificar estado
4. Confirmar: Supabase conectado, autenticación OK, bucket disponible

---

## Notas

- El build de Vite genera estáticos en `dist/`
- No hay servidor backend propio — toda la lógica es Supabase
- Las variables `VITE_*` se incluyen en el bundle del cliente. Solo usar variables públicas.
