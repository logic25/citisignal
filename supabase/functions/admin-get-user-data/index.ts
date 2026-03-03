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

  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userError } = await anonClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  // Check admin role
  const { data: roleData } = await anonClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();

  if (!roleData) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
  }

  const { userId } = await req.json();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers: corsHeaders });
  }

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Get user's properties
  const { data: properties } = await adminClient
    .from('properties')
    .select('id, address, borough')
    .eq('user_id', userId);

  const propertyIds = (properties || []).map((p: any) => p.id);

  // Parallel fetches using service role (bypasses RLS)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    violationsRes,
    complianceRes,
    tenantsRes,
    documentsRes,
    workOrdersRes,
    emailPrefsRes,
    telegramRes,
    aiConversationsRes,
  ] = await Promise.all([
    propertyIds.length > 0
      ? adminClient.from('violations').select('id, agency, violation_number, status, severity, issued_date, hearing_date, penalty_amount, property_id, description_raw').in('property_id', propertyIds).order('issued_date', { ascending: false }).limit(500)
      : Promise.resolve({ data: [] }),
    propertyIds.length > 0
      ? adminClient.from('compliance_requirements').select('id, local_law, requirement_name, status, due_date, property_id').in('property_id', propertyIds)
      : Promise.resolve({ data: [] }),
    propertyIds.length > 0
      ? adminClient.from('tenants').select('id, company_name, unit_number, lease_end_date, monthly_rent, status, property_id').in('property_id', propertyIds)
      : Promise.resolve({ data: [] }),
    propertyIds.length > 0
      ? adminClient.from('property_documents').select('id, document_name, document_type, expiration_date, created_at, extracted_text, property_id').in('property_id', propertyIds)
      : Promise.resolve({ data: [] }),
    propertyIds.length > 0
      ? adminClient.from('work_orders').select('id, scope, status, priority, quoted_amount, due_date, property_id, created_at').in('property_id', propertyIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    adminClient.from('email_preferences').select('*').eq('user_id', userId).maybeSingle(),
    adminClient.from('telegram_users').select('*').eq('user_id', userId).eq('is_active', true).maybeSingle(),
    adminClient.from('property_ai_conversations').select('id, property_id, title, updated_at').eq('user_id', userId).order('updated_at', { ascending: false }).limit(10),
  ]);

  // Get AI message count for last 30 days
  const conversationIds = (aiConversationsRes.data || []).map((c: any) => c.id);
  let aiQuestionCount = 0;
  if (conversationIds.length > 0) {
    const { count } = await adminClient
      .from('property_ai_messages')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'user')
      .in('conversation_id', conversationIds)
      .gte('created_at', thirtyDaysAgo);
    aiQuestionCount = count || 0;
  }

  // Build property address map
  const addressMap: Record<string, string> = {};
  for (const p of properties || []) {
    addressMap[p.id] = p.address;
  }

  return new Response(JSON.stringify({
    violations: violationsRes.data || [],
    compliance: complianceRes.data || [],
    tenants: tenantsRes.data || [],
    documents: documentsRes.data || [],
    workOrders: workOrdersRes.data || [],
    emailPreferences: emailPrefsRes.data || null,
    telegram: telegramRes.data || null,
    aiConversations: aiConversationsRes.data || [],
    aiQuestionCount,
    addressMap,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
