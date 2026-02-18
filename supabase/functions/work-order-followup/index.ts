import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("Work order follow-up check started");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date();
    let followUpCount = 0;

    // 1. Dispatched > 24h with no vendor response → send follow-up SMS
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: staleDispatched } = await supabase
      .from("work_orders")
      .select("id, scope, vendor_id, property_id, dispatched_at")
      .eq("status", "dispatched")
      .lt("dispatched_at", twentyFourHoursAgo);

    for (const wo of staleDispatched || []) {
      if (!wo.vendor_id) continue;

      const { data: vendor } = await supabase
        .from("vendors")
        .select("name, phone_number")
        .eq("id", wo.vendor_id)
        .single();

      if (vendor?.phone_number) {
        // Check if we already sent a follow-up recently
        const { data: recentFollowup } = await supabase
          .from("work_order_messages")
          .select("id")
          .eq("work_order_id", wo.id)
          .eq("sender_type", "system")
          .gte("created_at", twentyFourHoursAgo)
          .limit(1);

        if (recentFollowup && recentFollowup.length > 0) continue;

        try {
          await supabase.functions.invoke("send-sms", {
            body: {
              to: vendor.phone_number,
              message: `Reminder: We're still waiting on your quote for: "${wo.scope.substring(0, 100)}". Please reply with your price.`,
            },
          });

          await supabase.from("work_order_messages").insert({
            work_order_id: wo.id,
            sender_type: "system",
            sender_name: "Auto Follow-up",
            channel: "sms",
            message: `Automatic follow-up sent to ${vendor.name}: awaiting quote (24h+)`,
          });

          followUpCount++;
        } catch (e) {
          console.error(`Failed to follow up with ${vendor.name}:`, e);
        }
      }
    }

    // 2. Approved > 48h with no status change → nudge vendor
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const { data: staleApproved } = await supabase
      .from("work_orders")
      .select("id, scope, vendor_id, approved_at")
      .eq("status", "approved")
      .lt("approved_at", fortyEightHoursAgo);

    for (const wo of staleApproved || []) {
      if (!wo.vendor_id) continue;

      const { data: vendor } = await supabase
        .from("vendors")
        .select("name, phone_number")
        .eq("id", wo.vendor_id)
        .single();

      if (vendor?.phone_number) {
        const { data: recentFollowup } = await supabase
          .from("work_order_messages")
          .select("id")
          .eq("work_order_id", wo.id)
          .eq("sender_type", "system")
          .gte("created_at", fortyEightHoursAgo)
          .limit(1);

        if (recentFollowup && recentFollowup.length > 0) continue;

        try {
          await supabase.functions.invoke("send-sms", {
            body: {
              to: vendor.phone_number,
              message: `Your quote for "${wo.scope.substring(0, 80)}" was approved. When can you start? Please update us.`,
            },
          });

          await supabase.from("work_order_messages").insert({
            work_order_id: wo.id,
            sender_type: "system",
            sender_name: "Auto Follow-up",
            channel: "sms",
            message: `Automatic nudge sent to ${vendor.name}: approved 48h+ ago, no update`,
          });

          followUpCount++;
        } catch (e) {
          console.error(`Failed to nudge ${vendor.name}:`, e);
        }
      }
    }

    // 3. In progress > 7 days → notify owner
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: staleInProgress } = await supabase
      .from("work_orders")
      .select("id, scope, property_id, updated_at")
      .eq("status", "in_progress")
      .lt("updated_at", sevenDaysAgo);

    for (const wo of staleInProgress || []) {
      const { data: prop } = await supabase
        .from("properties")
        .select("user_id, address")
        .eq("id", wo.property_id)
        .single();

      if (!prop?.user_id) continue;

      // Check if we already flagged this
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("entity_id", wo.id)
        .eq("category", "work_orders")
        .gte("created_at", sevenDaysAgo)
        .limit(1);

      if (existing && existing.length > 0) continue;

      await supabase.from("notifications").insert({
        user_id: prop.user_id,
        title: "Work Order Review Needed",
        message: `"${wo.scope.substring(0, 80)}" at ${prop.address} has been in progress for 7+ days. Check on status.`,
        priority: "normal",
        category: "work_orders",
        property_id: wo.property_id,
        entity_type: "work_order",
        entity_id: wo.id,
      });

      followUpCount++;
    }

    console.log(`Follow-up check complete: ${followUpCount} actions taken`);

    return new Response(
      JSON.stringify({ success: true, follow_ups: followUpCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Work order follow-up error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
