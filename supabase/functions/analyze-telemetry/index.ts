import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const MODEL = "google/gemini-3-flash-preview";

async function callLovableAI(systemPrompt: string, userMessage: string) {
  const response = await fetch("https://api.lovable.dev/api/ai/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`AI call failed: ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  const usage = data.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  return { content, usage };
}

async function logUsage(
  supabase: ReturnType<typeof createClient>,
  feature: string,
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number },
  userId: string | null,
  metadata: Record<string, unknown> = {}
) {
  const estimatedCost = (usage.total_tokens / 1_000_000) * 0.15;
  await supabase.from("ai_usage_logs").insert({
    user_id: userId,
    feature,
    model: MODEL,
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    total_tokens: usage.total_tokens,
    estimated_cost_usd: estimatedCost,
    metadata,
  });
}

function extractJSON(text: string) {
  // Try to parse directly first
  try {
    const parsed = JSON.parse(text.trim());
    return Array.isArray(parsed) ? parsed[0] : parsed;
  } catch {
    // Try to find JSON in the response
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1].trim());
        return Array.isArray(parsed) ? parsed[0] : parsed;
      } catch {
        // ignore
      }
    }
    // Try to find raw JSON object
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]);
      } catch {
        // ignore
      }
    }
    throw new Error("Could not parse AI response as JSON");
  }
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { mode } = body;

    // Get user_id from auth header if present
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await anonClient.auth.getUser();
      userId = user?.id ?? null;
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (mode === "idea") {
      const { raw_idea, existing_items = [] } = body as {
        raw_idea: string;
        existing_items?: string[];
      };

      if (!raw_idea?.trim()) {
        return new Response(JSON.stringify({ error: "raw_idea is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const systemPrompt = `You are a senior product analyst. Stress-test product ideas and return ONLY valid JSON — no markdown, no explanation, no extra text.

Return a single JSON object (not an array) with exactly these fields:
{
  "title": "refined concise title",
  "description": "1-2 sentence refined description",
  "category": "one of: billing | projects | integrations | operations | general",
  "priority": "high | medium | low",
  "evidence": "1-2 sentences explaining why this matters and the evidence for the priority",
  "duplicate_warning": "null or a string naming a similar existing item",
  "challenges": [
    {"problem": "specific risk or challenge", "solution": "concrete mitigation"}
  ]
}

Rules:
- category MUST be one of: billing, projects, integrations, operations, general
- priority MUST be one of: high, medium, low
- challenges array must have 2-4 items
- duplicate_warning must be null (not the string "null") if no duplicate, or a string if one exists
- Return ONLY the JSON object, nothing else`;

      const existingContext = existing_items.length > 0
        ? `\n\nExisting roadmap items to check for duplicates:\n${existing_items.map((t, i) => `${i + 1}. ${t}`).join("\n")}`
        : "";

      const { content, usage } = await callLovableAI(systemPrompt, raw_idea + existingContext);

      let result;
      try {
        result = extractJSON(content);
      } catch {
        return new Response(
          JSON.stringify({ error: "AI returned unparseable response", raw: content }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Log usage
      await logUsage(serviceClient, "stress_test", usage, userId, { raw_idea: raw_idea.slice(0, 200) });

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "telemetry") {
      // Check if telemetry_events table exists
      const { data: telemetryData, error: telemetryError } = await serviceClient
        .from("telemetry_events" as any)
        .select("event_name, count")
        .limit(50);

      let userMessage: string;

      if (telemetryError || !telemetryData || telemetryData.length === 0) {
        userMessage = "No telemetry events have been recorded yet. Suggest 5 common UX friction points for a property management compliance dashboard app with features like violations tracking, work orders, tenant management, and compliance reporting.";
      } else {
        userMessage = `Here are the telemetry events from our app:\n${JSON.stringify(telemetryData, null, 2)}\n\nIdentify up to 5 friction points or drop-off patterns.`;
      }

      const systemPrompt = `You are a UX analyst. Analyze app usage patterns and identify friction points. Return ONLY a JSON array of up to 5 objects:
[
  {
    "title": "short friction point title",
    "description": "what users struggle with and why",
    "suggestion": "concrete fix or improvement"
  }
]
Return ONLY the JSON array, nothing else.`;

      const { content, usage } = await callLovableAI(systemPrompt, userMessage);

      let suggestions;
      try {
        suggestions = JSON.parse(content.trim());
        if (!Array.isArray(suggestions)) suggestions = [suggestions];
      } catch {
        // Try extracting array
        const match = content.match(/\[[\s\S]*\]/);
        if (match) {
          try {
            suggestions = JSON.parse(match[0]);
          } catch {
            suggestions = [{ title: "Analysis unavailable", description: content.slice(0, 200), suggestion: "Try again" }];
          }
        } else {
          suggestions = [{ title: "Analysis unavailable", description: content.slice(0, 200), suggestion: "Try again" }];
        }
      }

      // Log usage
      await logUsage(serviceClient, "telemetry_analysis", usage, userId, {});

      return new Response(JSON.stringify({ suggestions }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid mode. Use 'idea' or 'telemetry'" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("analyze-telemetry error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
