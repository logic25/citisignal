import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
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

    // Security Fix 19: Atomic increment BEFORE creating user to prevent race conditions
    const { data: updatedCode, error: updateErr } = await supabaseAdmin
      .from('invite_codes')
      .update({ use_count: code.use_count + 1 })
      .eq('id', code.id)
      .lt('use_count', code.max_uses)
      .select()
      .single();

    if (updateErr || !updatedCode) {
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

    let userId: string;

    if (authError) {
      // Check if user already exists (e.g. from Google OAuth)
      if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
        // Look up the existing user
        const { data: existingUsers, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === email);

        if (!existingUser || listErr) {
          // Rollback
          await supabaseAdmin
            .from('invite_codes')
            .update({ use_count: updatedCode.use_count - 1 })
            .eq('id', code.id);
          return new Response(
            JSON.stringify({ error: 'This email is already registered. Please sign in instead.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if user already has an org (already fully onboarded)
        const { data: existingProfile } = await supabaseAdmin
          .from('profiles')
          .select('organization_id')
          .eq('user_id', existingUser.id)
          .maybeSingle();

        if (existingProfile?.organization_id) {
          // Rollback — user is already fully set up
          await supabaseAdmin
            .from('invite_codes')
            .update({ use_count: updatedCode.use_count - 1 })
            .eq('id', code.id);
          return new Response(
            JSON.stringify({ error: 'This email is already registered. Please sign in instead.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // User exists but has no org — link them to the invite code org
        userId = existingUser.id;

        // Update password so they can also sign in with email/password
        await supabaseAdmin.auth.admin.updateUserById(userId, { password });
      } else {
        // Rollback for other errors
        await supabaseAdmin
          .from('invite_codes')
          .update({ use_count: updatedCode.use_count - 1 })
          .eq('id', code.id);
        return new Response(
          JSON.stringify({ error: authError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      userId = authData.user!.id;
    }

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
      // Poll for the profile row created by the trigger instead of a fixed timeout
      let profileFound = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data: profileRow } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();
        if (profileRow) {
          profileFound = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      if (!profileFound) {
        console.error('Profile not created after signup for user:', userId);
      }

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
