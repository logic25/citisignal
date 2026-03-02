import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("Work order follow-up check started");

  try {
    // Validate authentication - this is a scheduled/internal function
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      throw new Error("Supabase configuration missing");
    }

    // Verify the caller is authenticated
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await authClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date();
    let followUpCount = 0;

    // Security Fix 3: Scope work order queries to user's properties only
    const { data: userProperties } = await supabase
      .from("properties")
      .select("id")
      .eq("user_id", user.id);

    const userPropertyIds = (userProperties || []).map((p: any) => p.id);
    if (userPropertyIds.length === 0) {
      return new Response(JSON.stringify({ success: true, follow_ups: 0, message: "No properties found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Dispatched > 24h with no vendor response → send follow-up via Telegram
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: staleDispatched } = await supabase
      .from("work_orders")
      .select("id, scope, vendor_id, property_id, dispatched_at")
      .eq("status", "dispatched")
      .in("property_id", userPropertyIds)
      .lt("dispatched_at", twentyFourHoursAgo);

    for (const wo of staleDispatched || []) {
      if (!wo.vendor_id) continue;

      const { data: vendor } = await supabase
        .from("vendors")
        .select("name, telegram_chat_id")
        .eq("id", wo.vendor_id)
        .single();

      // Check if we already sent a follow-up recently
      const { data: recentFollowup } = await supabase
        .from("work_order_messages")
        .select("id")
        .eq("work_order_id", wo.id)
        .eq("sender_type", "system")
        .gte("created_at", twentyFourHoursAgo)
        .limit(1);

      if (recentFollowup && recentFollowup.length > 0) continue;

      const followUpMessage = `Reminder: We're still waiting on your quote for: "${wo.scope.substring(0, 100)}". Please reply with your price.`;

      if (vendor?.telegram_chat_id) {
        try {
          await supabase.functions.invoke("send-telegram", {
            body: {
              chat_id: vendor.telegram_chat_id,
              message: followUpMessage,
            },
          });

          await supabase.from("work_order_messages").insert({
            work_order_id: wo.id,
            sender_type: "system",
            sender_name: "Auto Follow-up",
            channel: "telegram",
            message: `Automatic follow-up sent to ${vendor.name} via Telegram: awaiting quote (24h+)`,
          });

          followUpCount++;
        } catch (e) {
          console.error(`Failed to follow up with ${vendor.name} via Telegram:`, e);
        }
      } else {
        // Fall back to in-app notification
        const { data: prop } = await supabase
          .from("properties")
          .select("user_id")
          .eq("id", wo.property_id)
          .single();

        if (prop?.user_id) {
          await supabase.from("notifications").insert({
            user_id: prop.user_id,
            title: "Vendor Not Responding",
            message: `${vendor?.name || "Assigned vendor"} hasn't responded to "${wo.scope.substring(0, 80)}" after 24h. No Telegram linked — contact manually.`,
            priority: "normal",
            category: "work_orders",
            property_id: wo.property_id,
            entity_type: "work_order",
            entity_id: wo.id,
          });

          await supabase.from("work_order_messages").insert({
            work_order_id: wo.id,
            sender_type: "system",
            sender_name: "Auto Follow-up",
            channel: "in_app",
            message: `No Telegram linked for ${vendor?.name}. Owner notified to follow up manually.`,
          });

          followUpCount++;
        }
      }
    }

    // 2. Approved > 48h with no status change → nudge vendor via Telegram
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const { data: staleApproved } = await supabase
      .from("work_orders")
      .select("id, scope, vendor_id, approved_at, property_id")
      .eq("status", "approved")
      .in("property_id", userPropertyIds)
      .lt("approved_at", fortyEightHoursAgo);

    for (const wo of staleApproved || []) {
      if (!wo.vendor_id) continue;

      const { data: vendor } = await supabase
        .from("vendors")
        .select("name, telegram_chat_id")
        .eq("id", wo.vendor_id)
        .single();

      const { data: recentFollowup } = await supabase
        .from("work_order_messages")
        .select("id")
        .eq("work_order_id", wo.id)
        .eq("sender_type", "system")
        .gte("created_at", fortyEightHoursAgo)
        .limit(1);

      if (recentFollowup && recentFollowup.length > 0) continue;

      const nudgeMessage = `Your quote for "${wo.scope.substring(0, 80)}" was approved. When can you start? Please update us.`;

      if (vendor?.telegram_chat_id) {
        try {
          await supabase.functions.invoke("send-telegram", {
            body: {
              chat_id: vendor.telegram_chat_id,
              message: nudgeMessage,
            },
          });

          await supabase.from("work_order_messages").insert({
            work_order_id: wo.id,
            sender_type: "system",
            sender_name: "Auto Follow-up",
            channel: "telegram",
            message: `Automatic nudge sent to ${vendor.name} via Telegram: approved 48h+ ago, no update`,
          });

          followUpCount++;
        } catch (e) {
          console.error(`Failed to nudge ${vendor.name} via Telegram:`, e);
        }
      } else {
        const { data: prop } = await supabase
          .from("properties")
          .select("user_id")
          .eq("id", wo.property_id)
          .single();

        if (prop?.user_id) {
          await supabase.from("notifications").insert({
            user_id: prop.user_id,
            title: "Vendor Not Starting Work",
            message: `${vendor?.name || "Vendor"} approved 48h+ ago for "${wo.scope.substring(0, 80)}" but no update. No Telegram linked.`,
            priority: "normal",
            category: "work_orders",
            property_id: wo.property_id,
            entity_type: "work_order",
            entity_id: wo.id,
          });
          followUpCount++;
        }
      }
    }

    // 3. In progress > 7 days → notify owner
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: staleInProgress } = await supabase
      .from("work_orders")
      .select("id, scope, property_id, updated_at")
      .eq("status", "in_progress")
      .in("property_id", userPropertyIds)
      .lt("updated_at", sevenDaysAgo);

    for (const wo of staleInProgress || []) {
      const { data: prop } = await supabase
        .from("properties")
        .select("user_id, address")
        .eq("id", wo.property_id)
        .single();

      if (!prop?.user_id) continue;

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
