import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { policy_id, policy_data } = await req.json();
    if (!policy_id || !policy_data) {
      return new Response(JSON.stringify({ error: "Missing policy_id or policy_data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a commercial real estate insurance compliance analyst. Review this insurance policy and provide:

1. **Coverage Assessment** — Is the coverage adequate for a NYC commercial property? Flag any gaps.
2. **Additional Insured Check** — Is the landlord properly listed? Any entity name mismatches?
3. **Endorsement Review** — Are standard CRE endorsements present? (Waiver of Subrogation, Primary & Non-Contributory, etc.)
4. **Expiration Risk** — Any timing concerns?
5. **Recommendations** — What should the landlord request from the tenant?

Be specific and actionable. Use bullet points. Flag critical issues with ⚠️.`;

    const userPrompt = `Review this insurance policy:

Policy Type: ${policy_data.policy_type}
Carrier: ${policy_data.carrier_name || 'Not specified'}
Policy Number: ${policy_data.policy_number || 'Not specified'}
Coverage Amount: ${policy_data.coverage_amount ? '$' + Number(policy_data.coverage_amount).toLocaleString() : 'Not specified'}
Per Occurrence Limit: ${policy_data.per_occurrence_limit ? '$' + Number(policy_data.per_occurrence_limit).toLocaleString() : 'Not specified'}
Aggregate Limit: ${policy_data.aggregate_limit ? '$' + Number(policy_data.aggregate_limit).toLocaleString() : 'Not specified'}
Deductible: ${policy_data.deductible ? '$' + Number(policy_data.deductible).toLocaleString() : 'Not specified'}
Required Minimum: ${policy_data.required_minimum ? '$' + Number(policy_data.required_minimum).toLocaleString() : 'Not specified'}
Effective Date: ${policy_data.effective_date || 'Not specified'}
Expiration Date: ${policy_data.expiration_date || 'Not specified'}
Additional Insured Required: ${policy_data.additional_insured_required ? 'Yes' : 'No'}
Additional Insured Listed: ${policy_data.additional_insured ? 'Yes' : 'No'}
Additional Insured Entity: ${policy_data.additional_insured_entity_name || 'Not specified'}
Endorsements: ${policy_data.endorsements || 'None listed'}
Tenant: ${policy_data.tenant_name || 'Not specified'}
Property: ${policy_data.property_address || 'Not specified'}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResponse.json();
    const reviewText = aiData.choices?.[0]?.message?.content || "No review generated.";

    // Log usage
    const usage = aiData.usage;
    if (usage) {
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      await serviceClient.from("ai_usage_logs").insert({
        user_id: user.id,
        feature: "insurance_review",
        model: "google/gemini-3-flash-preview",
        prompt_tokens: usage.prompt_tokens || 0,
        completion_tokens: usage.completion_tokens || 0,
        total_tokens: usage.total_tokens || 0,
        estimated_cost_usd: ((usage.prompt_tokens || 0) * 0.15 + (usage.completion_tokens || 0) * 0.6) / 1_000_000,
      });
    }

    // Update the policy with AI review
    const serviceClient2 = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const table = policy_data.is_building_policy ? "building_insurance_policies" : "tenant_insurance_policies";
    await serviceClient2.from(table).update({
      ai_review_status: "reviewed",
      ai_review_notes: reviewText,
      ai_reviewed_at: new Date().toISOString(),
    }).eq("id", policy_id);

    return new Response(JSON.stringify({ review: reviewText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("review-insurance error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
