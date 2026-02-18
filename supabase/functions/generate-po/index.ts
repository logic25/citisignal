import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { work_order_id, terms_override } = await req.json();
    if (!work_order_id) {
      return new Response(JSON.stringify({ error: "work_order_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch work order with relations
    const { data: wo, error: woErr } = await supabase
      .from("work_orders")
      .select(`
        *,
        property:properties(id, address, user_id, borough, owner_name),
        vendor:vendors(id, name, phone_number, email, address, telegram_chat_id, license_number)
      `)
      .eq("id", work_order_id)
      .single();

    if (woErr || !wo) {
      return new Response(JSON.stringify({ error: "Work order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (wo.status !== "approved") {
      return new Response(JSON.stringify({ error: "Work order must be approved first" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch owner's default PO terms
    let terms = terms_override || null;
    if (!terms && wo.property?.user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("po_terms_and_conditions")
        .eq("user_id", wo.property.user_id)
        .single();
      terms = profile?.po_terms_and_conditions || null;
    }

    // Generate PO number
    const { data: seqData } = await supabase.rpc("nextval_po_number");
    const poNumber = `PO-${String(seqData || Date.now()).padStart(5, "0")}`;

    // Create PO record
    const { data: po, error: poErr } = await supabase
      .from("purchase_orders")
      .insert({
        work_order_id: wo.id,
        property_id: wo.property_id,
        vendor_id: wo.vendor_id,
        user_id: wo.property?.user_id,
        po_number: poNumber,
        amount: wo.approved_amount,
        scope: wo.scope,
        status: "pending_vendor_signature",
        owner_signed_at: new Date().toISOString(),
        terms_and_conditions: terms,
      })
      .select("*")
      .single();

    if (poErr) {
      console.error("PO creation error:", poErr);
      return new Response(JSON.stringify({ error: "Failed to create PO" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Link PO to work order
    await supabase
      .from("work_orders")
      .update({ po_id: po.id })
      .eq("id", wo.id);

    // Notify vendor via Telegram if they have chat_id
    const vendor = wo.vendor as any;
    if (vendor?.telegram_chat_id) {
      const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
      if (TELEGRAM_BOT_TOKEN) {
        const appUrl = Deno.env.get("APP_URL") || "https://id-preview--9d9b6494-36da-4c50-a4c2-79428913d706.lovable.app";
        const vendorSignUrl = `${appUrl}/sign-po/${po.vendor_sign_token}`;

        const telegramText = `📋 *Purchase Order ${poNumber}*\n\n` +
          `You've been approved for work at *${wo.property?.address}*\n\n` +
          `💰 Amount: *$${wo.approved_amount?.toLocaleString()}*\n` +
          `📝 Scope: ${wo.scope.substring(0, 200)}\n\n` +
          `Please review and sign the PO:\n${vendorSignUrl}\n\n` +
          `Or reply "ACCEPT ${poNumber}" to sign via Telegram.`;

        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: vendor.telegram_chat_id,
            text: telegramText,
            parse_mode: "Markdown",
          }),
        });
      }
    }

    // Create notification for the owner
    await supabase.from("notifications").insert({
      user_id: wo.property?.user_id,
      title: `PO ${poNumber} Created`,
      message: `Purchase order for $${wo.approved_amount?.toLocaleString()} sent to ${vendor?.name} for signing.`,
      priority: "normal",
      category: "work_orders",
      property_id: wo.property_id,
      entity_type: "purchase_order",
      entity_id: po.id,
    });

    return new Response(JSON.stringify({ po }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Generate PO error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
