# MYD3000 Admin

Sistema administrativo interno para MYD3000, empresa de mobiliario y fabricación. Gestiona clientes, cotizaciones, proyectos, finanzas, contratos, proveedores y documentos.

## Stack

- React 18 + TypeScript + Vite 5
- Tailwind CSS v3
- React Router v6
- Supabase (Auth + Database)
- TanStack React Query
- React Hook Form + Zod
- Lucide React (iconos)
- Sonner (notificaciones)

## Configuración local

### 1. Clonar e instalar dependencias

```bash
git clone <repo-url>
cd myd3000-admin
npm install
```

### 2. Variables de entorno

Copia `.env.example` a `.env` y completa los valores:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Obtén estos valores desde el dashboard de Supabase → Project Settings → API.

### 3. Supabase — Aplicar migraciones

```bash
# Con Supabase CLI
supabase db push

# O manualmente desde el SQL Editor de Supabase
# Copia el contenido de: supabase/migrations/20260901001_initial_schema.sql
```

### 4. Correr en desarrollo

```bash
npm run dev
```

La app estará disponible en `http://localhost:5173`.

## Build y despliegue

```bash
npm run build
```

Los archivos se generan en `dist/`.

### Railway

1. Conecta el repo a Railway.
2. Agrega las variables de entorno (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
3. Build command: `npm run build`
4. Start command: `npx serve dist`
5. Railway detecta automáticamente el puerto.

## Estructura de archivos

```
src/
├── main.tsx                  # Entrada principal
├── App.tsx                   # Router + providers
├── styles/globals.css        # Estilos globales
├── lib/supabase.ts           # Cliente Supabase
├── types/index.ts            # Tipos globales
├── contexts/AuthContext.tsx  # Autenticación
├── components/
│   ├── layout/               # AppLayout, Sidebar, Header
│   ├── dashboard/            # Componentes del dashboard
│   └── ui/                   # Componentes reutilizables
├── data/dashboard.mock.ts    # Datos mock del dashboard
├── pages/                    # Páginas por módulo
└── utils/formatters.ts       # Utilidades de formato
```

## Módulos

| Módulo        | Ruta           | Estado      |
|---------------|----------------|-------------|
| Dashboard     | /dashboard     | Activo      |
| Clientes      | /clientes      | Placeholder |
| Cotizaciones  | /cotizaciones  | Placeholder |
| Proyectos     | /proyectos     | Placeholder |
| Finanzas      | /finanzas      | Placeholder |
| Contratos     | /contratos     | Placeholder |
| Proveedores   | /proveedores   | Placeholder |
| Documentos    | /documentos    | Placeholder |
| Configuración | /configuracion | Placeholder |

## Roles de usuario

- `administrator` — Acceso total
- `administration` — Módulos financieros y administrativos
- `operations` — Proyectos y operaciones
