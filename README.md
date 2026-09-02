# MYD3000 Admin

Sistema administrativo interno para MYD3000. Automatiza procesos comerciales, financieros y operativos: cotizaciones, proyectos, clientes, finanzas, contratos y documentos.

## Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Estilos**: Tailwind CSS
- **Autenticación y Base de datos**: Supabase (Auth + PostgreSQL)
- **Estado del servidor**: TanStack Query
- **Formularios**: React Hook Form + Zod
- **Routing**: React Router v7
- **Íconos**: Lucide Icons

## Instalación

```bash
git clone <repo-url>
cd myd-intranet
npm install
```

## Variables de entorno

Copia `.env.example` a `.env` y completa los valores:

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

> Nunca confirmes el archivo `.env` en el repositorio. Está incluido en `.gitignore`.

## Comandos

```bash
npm run dev      # Servidor de desarrollo (localhost:5173)
npm run build    # Build de producción
npm run preview  # Vista previa del build
```

## Configuración de Supabase

### 1. Crear proyecto en Supabase

Entra a [supabase.com](https://supabase.com) y crea un proyecto nuevo.

### 2. Ejecutar migración

En el **SQL Editor** de Supabase, ejecuta el contenido del archivo:

```
supabase/migrations/20260901000000_create_profiles.sql
```

Esto crea:
- Tabla `profiles` con RLS habilitado
- Trigger automático para crear perfil al registrar usuario
- Políticas de lectura y edición por usuario

### 3. Crear el primer usuario

En **Authentication → Users** de Supabase, crea el primer usuario administrador con email y contraseña.

Luego en el **SQL Editor**, actualiza su rol:

```sql
update public.profiles
set full_name = 'Tu Nombre', role = 'administrator'
where id = 'uuid-del-usuario';
```

### 4. Copiar credenciales

En **Project Settings → API**, copia:
- `Project URL` → `VITE_SUPABASE_URL`
- `anon public` key → `VITE_SUPABASE_ANON_KEY`

## Ejecución local

```bash
npm install
# Configura .env con tus credenciales de Supabase
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173). El sistema redirige automáticamente a `/login` si no hay sesión activa.

## Deploy en Railway

1. Conecta tu repositorio de GitHub en Railway.
2. Configura las variables de entorno en Railway:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. El build command: `npm run build`
4. El start command / output directory: `dist`

Si usas un servidor estático en Railway, configura la reescritura de rutas para SPA:
```
/* -> /index.html
```

## Estructura del proyecto

```
src/
  components/
    layout/       # AppLayout, Sidebar, Header, ProtectedRoute
    dashboard/    # Componentes específicos del dashboard
    ui/           # Componentes genéricos reutilizables
  contexts/       # AuthContext
  lib/            # supabase.ts
  pages/
    Login/
    Dashboard/    # Con mock data centralizado
    Clients/
    Quotes/
    Projects/
    Finance/
    Contracts/
    Suppliers/
    Documents/
    Settings/
  types/          # Tipos TypeScript globales

supabase/
  migrations/     # SQL de migraciones por orden cronológico
```

## Roles de usuario

| Rol             | Descripción                        |
|-----------------|------------------------------------|
| `administrator` | Acceso total al sistema            |
| `administration`| Gestión administrativa y financiera|
| `operations`    | Gestión operativa de proyectos     |
