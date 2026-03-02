import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
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

  // Fetch properties for all users
  const { data: allProperties } = await adminClient
    .from('properties')
    .select('id, address, borough, user_id');

  // Fetch violations for all properties (open count only)
  const propertyIds = (allProperties ?? []).map((p: any) => p.id);
  let violationCounts: Record<string, number> = {};
  let openViolationCounts: Record<string, number> = {};

  if (propertyIds.length > 0) {
    const { data: violations } = await adminClient
      .from('violations')
      .select('property_id, status')
      .in('property_id', propertyIds);

    for (const v of violations ?? []) {
      violationCounts[v.property_id] = (violationCounts[v.property_id] || 0) + 1;
      if (v.status === 'open') {
        openViolationCounts[v.property_id] = (openViolationCounts[v.property_id] || 0) + 1;
      }
    }
  }

  // Group properties by user
  const propertiesByUser: Record<string, any[]> = {};
  for (const p of allProperties ?? []) {
    if (!propertiesByUser[p.user_id]) propertiesByUser[p.user_id] = [];
    propertiesByUser[p.user_id].push({
      id: p.id,
      address: p.address,
      borough: p.borough,
      total_violations: violationCounts[p.id] || 0,
      open_violations: openViolationCounts[p.id] || 0,
    });
  }

  // Merge
  const merged = (profiles ?? []).map((p) => ({
    ...p,
    email: authMap[p.user_id]?.email ?? null,
    last_sign_in_at: authMap[p.user_id]?.last_sign_in_at ?? null,
    property_list: propertiesByUser[p.user_id] ?? [],
  }));

  return new Response(JSON.stringify({ users: merged }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
