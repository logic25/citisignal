import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  // Verify the caller is an admin using their JWT
  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace('Bearer ', '');
  const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const userId = claimsData.claims.sub;

  // Check admin role
  const { data: roleData } = await anonClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();

  if (!roleData) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
  }

  // Use service role to read auth.users
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: { users: authUsers }, error: authError } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
  if (authError) {
    return new Response(JSON.stringify({ error: authError.message }), { status: 500, headers: corsHeaders });
  }

  // Build map: user_id -> { email, last_sign_in_at }
  const authMap: Record<string, { email: string; last_sign_in_at: string | null }> = {};
  for (const u of authUsers) {
    authMap[u.id] = { email: u.email ?? '', last_sign_in_at: u.last_sign_in_at ?? null };
  }

  // Fetch profiles
  const { data: profiles, error: profilesError } = await adminClient
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (profilesError) {
    return new Response(JSON.stringify({ error: profilesError.message }), { status: 500, headers: corsHeaders });
  }

  // Merge
  const merged = (profiles ?? []).map((p) => ({
    ...p,
    email: authMap[p.user_id]?.email ?? null,
    last_sign_in_at: authMap[p.user_id]?.last_sign_in_at ?? null,
  }));

  return new Response(JSON.stringify({ users: merged }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
