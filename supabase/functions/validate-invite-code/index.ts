import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, inviteCode } = await req.json();

    if (!email || !password || !inviteCode) {
      return new Response(
        JSON.stringify({ error: 'email, password, and inviteCode are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Validate invite code (case-insensitive)
    const normalizedCode = inviteCode.trim().toUpperCase();
    const { data: code, error: codeError } = await supabaseAdmin
      .from('invite_codes')
      .select('id, code, max_uses, use_count, expires_at, is_active, org_name')
      .eq('code', normalizedCode)
      .single();

    if (codeError || !code) {
      return new Response(
        JSON.stringify({ error: 'Invalid invite code. Please check the code and try again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!code.is_active) {
      return new Response(
        JSON.stringify({ error: 'This invite code has been deactivated.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (code.expires_at && new Date(code.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'This invite code has expired.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (code.use_count >= code.max_uses) {
      return new Response(
        JSON.stringify({ error: 'This invite code has already been fully redeemed.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the user account
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
        return new Response(
          JSON.stringify({ error: 'This email is already registered. Please sign in instead.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authData.user!.id;

    // Increment the use count
    await supabaseAdmin
      .from('invite_codes')
      .update({ use_count: code.use_count + 1 })
      .eq('id', code.id);

    // === Organization logic ===
    let organizationId: string | null = null;
    let organizationName: string | null = null;
    let orgRole = 'member';

    // Check if an organization already exists for this invite code
    const { data: existingOrg } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .eq('invite_code_id', code.id)
      .maybeSingle();

    if (existingOrg) {
      // Join existing org as member
      organizationId = existingOrg.id;
      organizationName = existingOrg.name;
      orgRole = 'member';
    } else if (code.org_name) {
      // First user with this code — create the org
      const { data: newOrg, error: orgError } = await supabaseAdmin
        .from('organizations')
        .insert({
          name: code.org_name,
          invite_code_id: code.id,
          created_by: userId,
        })
        .select('id, name')
        .single();

      if (!orgError && newOrg) {
        organizationId = newOrg.id;
        organizationName = newOrg.name;
        orgRole = 'owner';
      }
    }

    // Update the user's profile with org info (the trigger creates the profile row)
    if (organizationId) {
      // Wait briefly for the trigger to create the profile
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await supabaseAdmin
        .from('profiles')
        .update({
          organization_id: organizationId,
          org_role: orgRole,
        })
        .eq('user_id', userId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Account created! Check your email to confirm your account.',
        organization: organizationName ? { name: organizationName, role: orgRole } : null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('validate-invite-code error:', err);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
