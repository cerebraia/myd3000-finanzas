# Variables de Entorno — MYD3000 Admin

**IMPORTANTE:** Este archivo documenta los nombres de las variables.
NUNCA incluir valores reales en este archivo. NUNCA commitear valores secretos.

---

## Frontend (Vite / React)

Variables con prefijo `VITE_` son accesibles en el navegador.
Solo usar variables públicas (anon key, no service_role).

| Variable | Descripción | Dónde obtenerla |
|----------|-------------|-----------------|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Llave pública anon (publishable) | Supabase → Project Settings → API → anon key |

**Archivo local:** `.env` (no se commitea — está en .gitignore)

**Ejemplo de `.env.example`:**
```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## Scripts de backup (SOLO entorno administrativo seguro)

Estas variables se configuran temporalmente en el shell. NUNCA en archivos del repo.

| Variable | Descripción | Dónde obtenerla |
|----------|-------------|-----------------|
| `SUPABASE_DB_HOST` | Host de la DB PostgreSQL | Supabase → Project Settings → Database → Host |
| `SUPABASE_DB_PORT` | Puerto (normalmente 5432) | Supabase → Project Settings → Database |
| `SUPABASE_DB_NAME` | Nombre de la DB (normalmente `postgres`) | Supabase → Project Settings → Database |
| `SUPABASE_DB_USER` | Usuario de la DB (normalmente `postgres`) | Supabase → Project Settings → Database |
| `SUPABASE_DB_PASSWORD` | Contraseña de la DB | Supabase → Project Settings → Database → Database password |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (NUNCA en frontend) | Supabase → Project Settings → API → service_role key |
| `SUPABASE_URL` | URL del proyecto (mismo que VITE_SUPABASE_URL) | Supabase → Project Settings → API |

---

## Railway (producción)

Configuradas en Railway → Project → Variables:

| Variable | Descripción |
|----------|-------------|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Llave anon de Supabase |

---

## Dónde guardar los secretos reales

| Secreto | Almacenamiento recomendado |
|---------|---------------------------|
| VITE_SUPABASE_ANON_KEY | Railway environment variables |
| VITE_SUPABASE_URL | Railway environment variables |
| DB password | Gestor de contraseñas (1Password, Bitwarden) |
| Service role key | Gestor de contraseñas — NUNCA en código |
| DB connection string | Gestor de contraseñas |

---

## Si una key se filtra — Procedimiento

1. **Rotarla inmediatamente** en Supabase Dashboard
2. **Actualizar** Railway → Variables con la nueva key
3. **Verificar** que el servicio funciona después del cambio
4. **Revisar logs** de Supabase para accesos sospechosos
5. **Invalidar** sesiones si se comprometió el JWT secret
6. **Documentar** el incidente en el log interno

---

## Checklist de seguridad de variables

- [ ] `.env` está en `.gitignore`
- [ ] `.env.local` está en `.gitignore`
- [ ] `VITE_SUPABASE_ANON_KEY` es solo la anon key (no service_role)
- [ ] No hay `service_role` en ningún archivo del repo
- [ ] Railway tiene las variables correctas configuradas
- [ ] Credenciales en gestor de contraseñas
