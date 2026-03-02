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

  // Verify caller is admin
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

  const callerId = claimsData.claims.sub;

  const { data: roleData } = await anonClient
    .from('user_roles')
    .select('role')
    .eq('user_id', callerId)
    .eq('role', 'admin')
    .maybeSingle();

  if (!roleData) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
  }

  const { targetUserId } = await req.json();
  if (!targetUserId) {
    return new Response(JSON.stringify({ error: 'targetUserId is required' }), { status: 400, headers: corsHeaders });
  }

  // Prevent self-deletion
  if (targetUserId === callerId) {
    return new Response(JSON.stringify({ error: 'Cannot delete your own account' }), { status: 400, headers: corsHeaders });
  }

  // Use service role to delete from auth
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId);
  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
