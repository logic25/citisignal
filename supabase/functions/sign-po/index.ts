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
    const { token, action } = await req.json();

    if (!token || typeof token !== "string" || token.length < 10) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action && action !== "view" && action !== "sign") {
      return new Response(
        JSON.stringify({ error: "Invalid action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch PO by token
    const { data: po, error: poErr } = await supabase
      .from("purchase_orders")
      .select(`
        *,
        property:properties(address, borough),
        vendor:vendors(name, phone_number, email)
      `)
      .eq("vendor_sign_token", token)
      .maybeSingle();

    if (poErr || !po) {
      return new Response(
        JSON.stringify({ error: "Purchase order not found or link expired." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // View action — return PO data (sanitized)
    if (!action || action === "view") {
      return new Response(
        JSON.stringify({
          po: {
            id: po.id,
            po_number: po.po_number,
            amount: po.amount,
            scope: po.scope,
            status: po.status,
            terms_and_conditions: po.terms_and_conditions,
            owner_signed_at: po.owner_signed_at,
            vendor_signed_at: po.vendor_signed_at,
            created_at: po.created_at,
            work_order_id: po.work_order_id,
            property: po.property,
            vendor: po.vendor,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sign action
    if (po.vendor_signed_at) {
      return new Response(
        JSON.stringify({ error: "Already signed", po: { vendor_signed_at: po.vendor_signed_at, status: po.status } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (po.status !== "pending_vendor_signature") {
      return new Response(
        JSON.stringify({ error: "This purchase order cannot be signed in its current status." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Execute signing
    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from("purchase_orders")
      .update({
        vendor_signed_at: now,
        status: "fully_executed",
      })
      .eq("id", po.id)
      .eq("vendor_sign_token", token);

    if (updateErr) {
      console.error("PO sign error:", updateErr);
      return new Response(
        JSON.stringify({ error: "Failed to sign purchase order" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update work order status
    if (po.work_order_id) {
      await supabase
        .from("work_orders")
        .update({ status: "in_progress" })
        .eq("id", po.work_order_id);
    }

    // Notify owner
    if (po.user_id) {
      const vendorName = (po.vendor as any)?.name || "Vendor";
      await supabase.from("notifications").insert({
        user_id: po.user_id,
        title: `PO ${po.po_number} Signed`,
        message: `${vendorName} has signed the purchase order for $${po.amount?.toLocaleString()}.`,
        priority: "high",
        category: "work_orders",
        property_id: po.property_id,
        entity_type: "purchase_order",
        entity_id: po.id,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        po: {
          id: po.id,
          po_number: po.po_number,
          status: "fully_executed",
          vendor_signed_at: now,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sign PO error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
