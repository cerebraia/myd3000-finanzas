import './index.css'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  // Render config screen without importing React or Supabase at all
  const root = document.getElementById('root')!
  root.style.cssText = 'min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f6f9;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;padding:24px'
  root.innerHTML = `
    <div style="background:white;border:1px solid #e2e6ed;border-radius:16px;padding:40px;max-width:480px;width:100%;box-shadow:0 1px 4px rgba(0,0,0,.06)">
      <p style="font-size:11px;font-weight:600;color:#6b7a90;letter-spacing:.08em;text-transform:uppercase;margin:0 0 4px">MYD3000 Admin</p>
      <h1 style="font-size:20px;font-weight:700;color:#1a2332;margin:0 0 8px">Configuración requerida</h1>
      <p style="font-size:14px;color:#6b7a90;margin:0 0 24px;line-height:1.6">
        Las variables de entorno de Supabase no están configuradas. Crea el archivo <strong>.env</strong> en la raíz del proyecto:
      </p>
      <pre style="background:#1a2332;color:#a8d8a8;padding:16px;border-radius:8px;font-size:12px;line-height:1.7;margin:0 0 20px;overflow-x:auto">VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key</pre>
      <p style="font-size:13px;color:#9a3412;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px;margin:0 0 20px;line-height:1.5">
        Después de crear el .env, <strong>reinicia el servidor</strong>:<br>
        <code style="display:block;margin-top:8px;background:rgba(0,0,0,.08);padding:6px 10px;border-radius:6px">npm run dev</code>
      </p>
      <p style="font-size:12px;color:#6b7a90;margin:0">Credenciales en: <strong>Supabase → Project Settings → API</strong></p>
    </div>
  `
} else {
  // Env vars present — dynamically import React and the full app
  // This ensures supabase.ts is never imported without valid credentials
  import('./boot').then(({ boot }) => boot())
}
