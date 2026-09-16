import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://myd3000.up.railway.app',
  'http://localhost:5173',
  'http://localhost:4173',
]

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function getCorsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return { ...CORS_HEADERS, 'Access-Control-Allow-Origin': allowed }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    // Validate caller auth
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Verify caller using their JWT (anon client with user's token)
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: callerUser }, error: callerError } = await callerClient.auth.getUser()
    if (callerError || !callerUser) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify caller has administrator role and is active
    const { data: callerProfile, error: profileError } = await callerClient
      .from('profiles')
      .select('role, active')
      .eq('id', callerUser.id)
      .single()

    if (profileError || !callerProfile) {
      return new Response(JSON.stringify({ error: 'Perfil no encontrado' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (callerProfile.role !== 'administrator' || !callerProfile.active) {
      return new Response(JSON.stringify({ error: 'Solo administradores pueden invitar usuarios' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse body
    const body = await req.json() as { email?: string; full_name?: string; role?: string; position?: string }
    const { email, full_name, role = 'operations', position } = body

    if (!email || !full_name) {
      return new Response(JSON.stringify({ error: 'email y full_name son requeridos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const validRoles = ['administrator', 'manager', 'administration', 'operations']
    if (!validRoles.includes(role)) {
      return new Response(JSON.stringify({ error: 'Rol inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Admin client — service role (NEVER exposed to frontend)
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Invite via email (sends magic link to set password)
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name, role },
    })

    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Update profile with correct role and position (trigger creates it with defaults)
    if (inviteData.user) {
      await adminClient.from('profiles').upsert({
        id: inviteData.user.id,
        full_name,
        role,
        position: position ?? null,
        active: true,
      })

      // Audit
      await adminClient.from('activity_log').insert({
        user_id: callerUser.id,
        entity_type: 'user',
        entity_id: inviteData.user.id,
        action: 'created',
        new_data: { email, full_name, role },
        metadata: {},
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
