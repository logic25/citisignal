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

    const body = await req.json();
    const { mode } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ── MODE: extract — Parse a COI document into structured fields ──
    if (mode === "extract") {
      const { document_text, owner_entity_name } = body;
      if (!document_text || document_text.length < 50) {
        return new Response(JSON.stringify({ error: "Document text too short to parse" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const extractPrompt = `You are a commercial real estate insurance document parser. Extract structured policy data from this Certificate of Insurance (COI) or insurance policy document.

Return a JSON object with these fields (use null for any field you cannot find):
{
  "policy_type": "general_liability" | "workers_comp" | "property_contents" | "umbrella" | "auto" | "professional_liability" | "liquor_liability" | "cyber_liability" | "environmental" | "other",
  "carrier_name": "string",
  "policy_number": "string",
  "coverage_amount": number (the general aggregate or total coverage in dollars),
  "per_occurrence_limit": number,
  "aggregate_limit": number,
  "deductible": number,
  "effective_date": "YYYY-MM-DD",
  "expiration_date": "YYYY-MM-DD",
  "additional_insured": boolean (true if any additional insured entity is listed),
  "additional_insured_entity_name": "string" (the name of the additional insured if listed),
  "endorsements": "string" (comma-separated list of endorsements found, e.g. Waiver of Subrogation, Primary & Non-Contributory),
  "compliance_notes": "string" (brief assessment: is ${owner_entity_name || 'the landlord/owner'} properly named as additional insured? Any red flags?)
}

IMPORTANT: Return ONLY valid JSON, no markdown fences, no explanation text outside the JSON.`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: extractPrompt },
            { role: "user", content: `Parse this insurance document:\n\n${document_text.slice(0, 15000)}` },
          ],
        }),
      });

      if (!aiResponse.ok) {
        const status = aiResponse.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI gateway error: ${status}`);
      }

      const aiData = await aiResponse.json();
      let content = aiData.choices?.[0]?.message?.content || "";

      // Log usage
      const usage = aiData.usage;
      if (usage) {
        await serviceClient.from("ai_usage_logs").insert({
          user_id: user.id,
          feature: "insurance_extract",
          model: "google/gemini-3-flash-preview",
          prompt_tokens: usage.prompt_tokens || 0,
          completion_tokens: usage.completion_tokens || 0,
          total_tokens: usage.total_tokens || 0,
          estimated_cost_usd: ((usage.prompt_tokens || 0) * 0.15 + (usage.completion_tokens || 0) * 0.6) / 1_000_000,
        });
      }

      // Clean markdown fences if present
      content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        return new Response(JSON.stringify({ error: "AI returned unparseable response", raw: content.slice(0, 500) }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ extracted: parsed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── MODE: review (default) — Full compliance review of an existing policy ──
    const { policy_id, policy_data } = body;
    if (!policy_id || !policy_data) {
      return new Response(JSON.stringify({ error: "Missing policy_id or policy_data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try to fetch extracted document text if a certificate was uploaded
    let documentText = "";

    if (policy_data.certificate_url) {
      const { data: docs } = await serviceClient
        .from("property_documents")
        .select("extracted_text")
        .eq("file_url", policy_data.certificate_url)
        .limit(1);

      if (docs && docs.length > 0 && docs[0].extracted_text) {
        documentText = docs[0].extracted_text;
      }
    }

    const hasDocument = documentText.length > 100;

    const systemPrompt = `You are a commercial real estate insurance compliance analyst. Review this insurance policy and provide:

1. **Coverage Assessment** — Is the coverage adequate for a NYC commercial property? Flag any gaps.
2. **Additional Insured Check** — Is the landlord properly listed? Any entity name mismatches?
3. **Endorsement Review** — Are standard CRE endorsements present? (Waiver of Subrogation, Primary & Non-Contributory, etc.)
4. **Expiration Risk** — Any timing concerns?
5. **Recommendations** — What should the landlord request from the tenant?

Be specific and actionable. Use bullet points. Flag critical issues with ⚠️.
${hasDocument ? '\nYou have the actual certificate/policy document text below. Cross-reference the document text against the metadata for discrepancies.' : '\nNote: No certificate document was uploaded. This review is based on manually entered metadata only. Recommend requesting the actual COI for a complete review.'}`;

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
Property: ${policy_data.property_address || 'Not specified'}
${hasDocument ? `\n--- CERTIFICATE / POLICY DOCUMENT TEXT ---\n${documentText.slice(0, 12000)}` : ''}`;

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
    const table = policy_data.is_building_policy ? "building_insurance_policies" : "tenant_insurance_policies";
    await serviceClient.from(table).update({
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
