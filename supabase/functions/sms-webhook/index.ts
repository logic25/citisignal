import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function parseFormData(req: Request): Promise<Record<string, string>> {
  const text = await req.text();
  const params = new URLSearchParams(text);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("SMS Webhook received");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const formData = await parseFormData(req);
    const from = formData.From;
    const to = formData.To;
    const body = formData.Body;
    const messageSid = formData.MessageSid;

    console.log(`Inbound SMS from ${from} to ${to}: ${body}`);

    if (!from || !body) {
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "application/xml" } }
      );
    }

    // ── VENDOR DETECTION ──
    // Check if sender is a known vendor by phone number
    const normalizedFrom = from.replace(/\D/g, "").slice(-10);
    const { data: vendorMatch } = await supabase
      .from("vendors")
      .select("id, name, phone_number")
      .not("phone_number", "is", null)
      .limit(100);

    const matchedVendor = (vendorMatch || []).find((v: any) => {
      const vPhone = (v.phone_number || "").replace(/\D/g, "").slice(-10);
      return vPhone === normalizedFrom && vPhone.length === 10;
    });

    if (matchedVendor) {
      console.log(`Vendor detected: ${matchedVendor.name} (${matchedVendor.id})`);
      return await handleVendorMessage(supabase, matchedVendor, body, messageSid, lovableApiKey);
    }

    // ── STANDARD PROPERTY-BASED AI RESPONSE ──
    return await handlePropertyMessage(supabase, from, to, body, messageSid, lovableApiKey);

  } catch (error) {
    console.error("SMS Webhook error:", error);
    const errorMessage = "Sorry, there was an error processing your message. Please try again later.";
    return twimlResponse(errorMessage);
  }
});

// Handle inbound vendor messages – extract quotes, update work orders
async function handleVendorMessage(
  supabase: any,
  vendor: { id: string; name: string },
  body: string,
  messageSid: string | undefined,
  lovableApiKey: string
) {
  // Find open/dispatched work orders for this vendor
  const { data: openWOs } = await supabase
    .from("work_orders")
    .select("id, scope, status, property_id")
    .eq("vendor_id", vendor.id)
    .in("status", ["open", "dispatched"])
    .order("created_at", { ascending: false })
    .limit(5);

  if (!openWOs || openWOs.length === 0) {
    console.log("No open work orders for vendor", vendor.name);
    return twimlResponse(`Thanks ${vendor.name}. We don't have an open work order for you right now. Your message has been noted.`);
  }

  // Use AI to extract quote amount from message
  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `Extract any dollar amount from this vendor message. Return ONLY the number (no $ sign, no commas). If no dollar amount is found, return "none". Examples: "I can do it for $2,500" -> 2500. "Need to take a look first" -> none.`,
        },
        { role: "user", content: body },
      ],
      max_tokens: 20,
    }),
  });

  let extractedAmount: number | null = null;
  if (aiResponse.ok) {
    const aiData = await aiResponse.json();
    const parsed = parseFloat(aiData.choices?.[0]?.message?.content?.trim() || "");
    if (!isNaN(parsed) && parsed > 0) {
      extractedAmount = parsed;
    }
  }

  // Update the most recent work order
  const targetWO = openWOs[0];

  // Log message to work_order_messages
  await supabase.from("work_order_messages").insert({
    work_order_id: targetWO.id,
    sender_type: "vendor",
    sender_name: vendor.name,
    channel: "sms",
    message: body,
    extracted_amount: extractedAmount,
  });

  if (extractedAmount) {
    // Update work order with quote
    await supabase.from("work_orders").update({
      quoted_amount: extractedAmount,
      status: "quoted",
    }).eq("id", targetWO.id);

    // Get property address for notification
    const { data: prop } = await supabase
      .from("properties")
      .select("address, user_id")
      .eq("id", targetWO.property_id)
      .single();

    // Notify owner via notification
    if (prop?.user_id) {
      await supabase.from("notifications").insert({
        user_id: prop.user_id,
        title: `Quote Received: $${extractedAmount.toLocaleString()}`,
        message: `${vendor.name} quoted $${extractedAmount.toLocaleString()} for work at ${prop.address || "your property"}. Review and approve in Work Orders.`,
        priority: "high",
        category: "work_orders",
        property_id: targetWO.property_id,
        entity_type: "work_order",
        entity_id: targetWO.id,
      });
    }

    console.log(`Quote extracted: $${extractedAmount} for WO ${targetWO.id}`);
    return twimlResponse(`Got it! Your quote of $${extractedAmount.toLocaleString()} for "${targetWO.scope.substring(0, 60)}" has been recorded. The owner will review and get back to you.`);
  }

  // No amount found – just log the message
  console.log("Vendor message logged, no amount extracted");
  return twimlResponse(`Thanks ${vendor.name}, your message has been noted for work order: "${targetWO.scope.substring(0, 80)}".`);
}

// Handle standard property-based tenant/owner messages
async function handlePropertyMessage(
  supabase: any,
  from: string,
  to: string,
  body: string,
  messageSid: string | undefined,
  lovableApiKey: string
) {
  // Find property by assigned phone number
  let property = null;
  const { data: propertyByAssigned } = await supabase
    .from("properties")
    .select("id, address, bin, bbl, borough, stories, dwelling_units, zoning_district, year_built, owner_name, applicable_agencies")
    .eq("assigned_phone_number", to)
    .maybeSingle();

  if (propertyByAssigned) {
    property = propertyByAssigned;
  } else {
    const { data: anyProperty } = await supabase
      .from("properties")
      .select("id, address, bin, bbl, borough, stories, dwelling_units, zoning_district, year_built, owner_name, applicable_agencies")
      .eq("sms_enabled", true)
      .limit(1)
      .maybeSingle();
    property = anyProperty;
  }

  if (!property) {
    return twimlResponse("Sorry, this number is not configured for any property. Please contact your property manager.");
  }

  console.log(`Found property: ${property.address} (${property.id})`);

  // Get violations and work orders for context
  const [{ data: violations }, { data: workOrders }] = await Promise.all([
    supabase
      .from("violations")
      .select("agency, violation_number, status, issued_date, description_raw, cure_due_date")
      .eq("property_id", property.id)
      .order("issued_date", { ascending: false })
      .limit(10),
    supabase
      .from("work_orders")
      .select("scope, status, created_at")
      .eq("property_id", property.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const propertyContext = `
Property: ${property.address}
Borough: ${property.borough || "Unknown"}
Stories: ${property.stories || "Unknown"}
Units: ${property.dwelling_units || "Unknown"}
Year Built: ${property.year_built || "Unknown"}
Owner: ${property.owner_name || "Not specified"}

Recent Violations (${violations?.length || 0}):
${violations?.slice(0, 5).map((v: any) => `- ${v.agency} #${v.violation_number} (${v.status}) - ${v.description_raw?.substring(0, 80)}...`).join("\n") || "No violations on record."}

Work Orders (${workOrders?.length || 0}):
${workOrders?.slice(0, 3).map((w: any) => `- ${w.scope} (${w.status})`).join("\n") || "No active work orders."}
`.trim();

  const systemPrompt = `You are a helpful property management assistant for ${property.address}. 
You help tenants, vendors, and property managers with questions about the building.
Keep responses concise (under 160 characters if possible, max 320 for SMS).
Be professional but friendly.

${propertyContext}

If asked about something you don't have data for, suggest they contact the property manager directly.
Do not make up information. If you don't know, say so.`;

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: body },
      ],
      max_tokens: 150,
    }),
  });

  if (!aiResponse.ok) {
    const errorText = await aiResponse.text();
    console.error("AI API error:", aiResponse.status, errorText);
    throw new Error(`AI API error: ${aiResponse.status}`);
  }

  const aiData = await aiResponse.json();
  const aiMessage = aiData.choices?.[0]?.message?.content ||
    "I'm having trouble processing your request. Please try again or contact the property manager.";

  // Log conversation
  await supabase.from("property_activity_log").insert({
    property_id: property.id,
    activity_type: "sms_received",
    title: "Inbound SMS",
    description: `From ${from}: ${body.substring(0, 100)}${body.length > 100 ? "..." : ""}`,
    metadata: { from, message_sid: messageSid, message: body, ai_response: aiMessage },
  });

  return twimlResponse(aiMessage);
}

function twimlResponse(message: string) {
  const escaped = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Message>${escaped}</Message>\n</Response>`,
    { headers: { "Content-Type": "application/xml" } }
  );
}
