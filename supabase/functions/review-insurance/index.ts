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

    // ── Shared AI call helper ──
    const callAI = async (systemPrompt: string, userPrompt: string, feature: string) => {
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
        if (status === 429) throw { status: 429, message: "Rate limit exceeded" };
        if (status === 402) throw { status: 402, message: "AI credits exhausted" };
        throw new Error(`AI gateway error: ${status}`);
      }

      const aiData = await aiResponse.json();
      const usage = aiData.usage;
      if (usage) {
        await serviceClient.from("ai_usage_logs").insert({
          user_id: user.id,
          feature,
          model: "google/gemini-3-flash-preview",
          prompt_tokens: usage.prompt_tokens || 0,
          completion_tokens: usage.completion_tokens || 0,
          total_tokens: usage.total_tokens || 0,
          estimated_cost_usd: ((usage.prompt_tokens || 0) * 0.15 + (usage.completion_tokens || 0) * 0.6) / 1_000_000,
        });
      }

      return aiData.choices?.[0]?.message?.content || "";
    };

    // ── MODE: extract — Parse a COI document into structured fields ──
    if (mode === "extract") {
      const { document_text, owner_entity_name } = body;
      if (!document_text || document_text.length < 50) {
        return new Response(JSON.stringify({ error: "Document text too short to parse" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const extractPrompt = `You are a commercial real estate insurance document parser. Extract structured policy data from this Certificate of Insurance (COI).

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

      try {
        let content = await callAI(extractPrompt, `Parse this COI:\n\n${document_text.slice(0, 15000)}`, "insurance_extract");
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
      } catch (e: any) {
        if (e.status) return new Response(JSON.stringify({ error: e.message }), { status: e.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw e;
      }
    }

    // ── MODE: deep_review — Full CRE compliance review of an insurance policy ──
    if (mode === "deep_review" || !mode) {
      const { policy_id, policy_data, policy_document_text } = body;
      if (!policy_id || !policy_data) {
        return new Response(JSON.stringify({ error: "Missing policy_id or policy_data" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Try to fetch extracted document text from COI or policy document
      let documentText = policy_document_text || "";

      if (!documentText && policy_data.policy_document_url) {
        const { data: docs } = await serviceClient
          .from("property_documents")
          .select("extracted_text")
          .eq("file_url", policy_data.policy_document_url)
          .limit(1);
        if (docs?.[0]?.extracted_text) documentText = docs[0].extracted_text;
      }

      if (!documentText && policy_data.certificate_url) {
        const { data: docs } = await serviceClient
          .from("property_documents")
          .select("extracted_text")
          .eq("file_url", policy_data.certificate_url)
          .limit(1);
        if (docs?.[0]?.extracted_text) documentText = docs[0].extracted_text;
      }

      const hasDocument = documentText.length > 100;
      const hasFullPolicy = !!policy_document_text || !!policy_data.policy_document_url;

      const systemPrompt = `You are a senior commercial real estate (CRE) insurance compliance analyst with deep expertise in NYC landlord/tenant insurance requirements. You are reviewing a tenant's insurance ${hasFullPolicy ? 'FULL POLICY DOCUMENT' : hasDocument ? 'Certificate of Insurance (COI)' : 'metadata'} for compliance with typical NYC commercial lease requirements.

## Your Review Checklist — evaluate EACH item as ✅ PASS, ⚠️ CONCERN, or ❌ FAIL:

### 1. COVERAGE LIMITS
- General Liability: Minimum $1M per occurrence / $2M aggregate is standard NYC CRE
- Check if the stated coverage meets or exceeds the required minimum (if provided)
- Flag any sub-limits that effectively reduce coverage

### 2. ADDITIONAL INSURED STATUS
- Is the landlord/owner entity properly named as Additional Insured?
- Check for exact entity name match — "LLC" vs "Inc" vs "Corp" mismatches matter
- Verify the AI endorsement is on a standard ISO form (CG 20 11 or CG 20 26)
- Owner entity: ${policy_data.additional_insured_entity_name || policy_data.tenant_name || 'Not specified'}

### 3. REQUIRED ENDORSEMENTS
Check for these standard CRE endorsements:
- **Waiver of Subrogation** — Must be present
- **Primary & Non-Contributory** — Must be present so tenant's policy pays first
- **Per Project/Per Location Aggregate** — Recommended for multi-tenant properties
- Flag any missing standard endorsements

### 4. EXCLUSIONS & CARVE-OUTS (Full Policy Only)
${hasFullPolicy ? `Carefully review the policy exclusions section for:
- **Mold/Fungi exclusion** — common, but problematic in older NYC buildings
- **Asbestos/Lead Paint exclusion** — critical for pre-1978 buildings
- **Terrorism exclusion** (TRIA) — important for NYC commercial
- **Assault & Battery exclusion** — relevant for restaurants/bars/nightclubs
- **Pollution/Environmental exclusion** — relevant for industrial/manufacturing
- **Contractual Liability exclusion** — would void the lease indemnification
- **Building ordinance exclusion** — problematic for code upgrade costs
- Flag any exclusion that could leave the landlord exposed` : 'Not available — no full policy document uploaded. Recommend requesting the full policy to review exclusions.'}

### 5. DEDUCTIBLE / SELF-INSURED RETENTION (SIR)
- Flag if deductible exceeds $10,000 (typical NYC CRE maximum)
- SIR is more concerning than deductible — landlord may not be protected until SIR is satisfied
- Note whether the SIR applies to defense costs

### 6. POLICY TERM & GAPS
- Is the policy currently in force?
- Any gap between prior policy expiration and current effective date?
- How many days until expiration? Flag if < 30 days

### 7. COI vs POLICY DISCREPANCIES (if both available)
${hasFullPolicy && hasDocument ? '- Cross-reference the COI summary against the actual policy terms\n- Flag any limits on the COI that differ from the policy declarations page\n- Check if endorsements listed on the COI are actually in the policy' : 'Only one document available — cannot cross-reference.'}

### 8. OVERALL RISK ASSESSMENT
Provide a brief summary:
- Overall compliance grade: A (fully compliant) / B (minor issues) / C (significant gaps) / D (non-compliant)
- Top 3 action items for the property manager

Be specific, actionable, and use the checklist format above. Flag critical issues with ❌.`;

      const userPrompt = `Review this ${policy_data.is_building_policy ? 'building' : 'tenant'} insurance policy:

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
${hasDocument ? `\n--- ${hasFullPolicy ? 'FULL POLICY DOCUMENT' : 'CERTIFICATE OF INSURANCE'} TEXT ---\n${documentText.slice(0, 20000)}` : ''}`;

      try {
        const reviewText = await callAI(systemPrompt, userPrompt, hasFullPolicy ? "insurance_deep_review" : "insurance_review");

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
      } catch (e: any) {
        if (e.status) return new Response(JSON.stringify({ error: e.message }), { status: e.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw e;
      }
    }

    return new Response(JSON.stringify({ error: "Unknown mode" }), {
      status: 400,
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
