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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let scheduleType = "nightly";
    try {
      const body = await req.json();
      scheduleType = body.schedule_type || "nightly";
    } catch { /* empty */ }

    console.log(`Running scheduled sync: ${scheduleType}`);

    // Get all NYC properties with BIN
    const { data: properties, error: propError } = await supabase
      .from("properties")
      .select("id, bin, applicable_agencies, address, sms_enabled, owner_phone, user_id")
      .eq("jurisdiction", "NYC")
      .not("bin", "is", null);

    if (propError) throw propError;

    console.log(`Found ${properties?.length || 0} NYC properties to sync`);

    const results = {
      total_properties: properties?.length || 0,
      synced: 0,
      errors: 0,
      new_violations: 0,
      changes_detected: 0,
      schedule_type: scheduleType,
    };

    const agenciesToSync = scheduleType === "dob_quick" ? ["DOB"] : undefined;

    for (const property of properties || []) {
      try {
        console.log(`Syncing property: ${property.address} (BIN: ${property.bin})`);

        // --- Snapshot existing violations & applications BEFORE sync ---
        const [existingViolations, existingApplications] = await Promise.all([
          supabase.from("violations").select("id, violation_number, status, description_raw, agency").eq("property_id", property.id),
          supabase.from("applications").select("id, application_number, status, application_type, agency, source").eq("property_id", property.id),
        ]);

        const violationsBefore = new Map((existingViolations.data || []).map((v: any) => [v.violation_number, v]));
        const appsBefore = new Map((existingApplications.data || []).map((a: any) => [a.application_number, a]));

        // --- Run sync ---
        const response = await fetch(`${supabaseUrl}/functions/v1/fetch-nyc-violations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            bin: property.bin,
            property_id: property.id,
            applicable_agencies: agenciesToSync || property.applicable_agencies,
            send_sms_alert: property.sms_enabled && property.owner_phone,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          results.synced++;
          results.new_violations += result.new_violations || 0;

          // --- Detect changes AFTER sync ---
          const [afterViolations, afterApplications] = await Promise.all([
            supabase.from("violations").select("id, violation_number, status, description_raw, agency").eq("property_id", property.id),
            supabase.from("applications").select("id, application_number, status, application_type, agency, source").eq("property_id", property.id),
          ]);

          const changes: any[] = [];

          // Check for new/changed violations
          for (const v of (afterViolations.data || [])) {
            const before = violationsBefore.get(v.violation_number);
            if (!before) {
              changes.push({
                user_id: property.user_id,
                property_id: property.id,
                entity_type: "violation",
                entity_id: v.id,
                change_type: "new",
                new_value: v.status,
                entity_label: v.violation_number,
                description: `New ${v.agency} violation ${v.violation_number}: ${(v.description_raw || "").substring(0, 100)}`,
              });
            } else if (before.status !== v.status) {
              changes.push({
                user_id: property.user_id,
                property_id: property.id,
                entity_type: "violation",
                entity_id: v.id,
                change_type: "status_change",
                previous_value: before.status,
                new_value: v.status,
                entity_label: v.violation_number,
                description: `${v.agency} violation ${v.violation_number} status changed: ${before.status} → ${v.status}`,
              });
            }
          }

          // Check for new/changed applications
          for (const a of (afterApplications.data || [])) {
            const before = appsBefore.get(a.application_number);
            if (!before) {
              changes.push({
                user_id: property.user_id,
                property_id: property.id,
                entity_type: "application",
                entity_id: a.id,
                change_type: "new",
                new_value: a.status,
                entity_label: a.application_number,
                description: `New ${a.agency} application ${a.application_number}: ${a.application_type}`,
              });
            } else if (before.status !== a.status) {
              changes.push({
                user_id: property.user_id,
                property_id: property.id,
                entity_type: "application",
                entity_id: a.id,
                change_type: "status_change",
                previous_value: before.status,
                new_value: a.status,
                entity_label: a.application_number,
                description: `${a.agency} application ${a.application_number} status: ${before.status} → ${a.status}`,
              });
            }
          }

          // Insert changes
          if (changes.length > 0) {
            const { error: changeError } = await supabase.from("change_log").insert(changes);
            if (changeError) console.error("Error logging changes:", changeError);
            else results.changes_detected += changes.length;
            console.log(`  -> ${changes.length} changes detected`);
          }

          console.log(`  -> Found ${result.new_violations} new violations`);
        } else {
          results.errors++;
          console.error(`  -> Sync failed: ${response.status}`);
        }

        // --- Apply age-based suppression ---
        try {
          const { data: openViolations } = await supabase
            .from("violations")
            .select("id, agency, issued_date, status, suppressed")
            .eq("property_id", property.id)
            .eq("status", "open")
            .eq("suppressed", false);

          if (openViolations && openViolations.length > 0) {
            const AGING_RULES: Record<string, number> = { ECB: 730, DOB: 1095, HPD: 1095 };
            let suppressedCount = 0;

            for (const v of openViolations) {
              const rule = AGING_RULES[v.agency];
              if (!rule) continue;
              const daysSince = Math.floor((Date.now() - new Date(v.issued_date).getTime()) / (1000 * 60 * 60 * 24));
              if (daysSince > rule) {
                const years = Math.floor(daysSince / 365);
                await supabase.from("violations").update({
                  suppressed: true,
                  suppression_reason: `${v.agency} violation open >${Math.floor(rule / 365)} years likely resolved but not updated (${years} year${years !== 1 ? 's' : ''} old)`,
                }).eq("id", v.id);
                suppressedCount++;
              }
            }
            if (suppressedCount > 0) console.log(`  -> Suppressed ${suppressedCount} stale violations`);
          }
        } catch (suppressErr) {
          console.error("Suppression error:", suppressErr);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        results.errors++;
        console.error(`Error syncing property ${property.id}:`, error);
      }
    }

    // --- If nightly sync, trigger daily summary emails (disabled during testing) ---
    if (scheduleType === "nightly" && results.changes_detected > 0) {
      try {
        console.log("Triggering daily change summary emails...");
        const summaryRes = await fetch(`${supabaseUrl}/functions/v1/send-change-summary`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({}),
        });
        if (summaryRes.ok) {
          const summaryResult = await summaryRes.json();
          console.log("Change summary emails sent:", summaryResult);
        } else {
          console.error("Failed to send change summaries:", summaryRes.status);
        }
      } catch (e) {
        console.error("Error sending change summaries:", e);
      }
    }

    // Generate deadline reminder notifications (7/3/1 days before)
    try {
      const { error: reminderError } = await supabase.rpc('generate_deadline_reminders');
      if (reminderError) {
        console.error("Error generating deadline reminders:", reminderError);
      } else {
        console.log("Deadline reminders generated successfully");
      }
    } catch (e) {
      console.error("Error calling generate_deadline_reminders:", e);
    }

    // Check insurance policies expiring within 30 days and auto-expire past-due policies
    try {
      const today = new Date().toISOString().split("T")[0];
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      // Find already-expired policies still marked active and auto-expire them
      const { data: expiredPolicies } = await supabase
        .from("tenant_insurance_policies")
        .select("id, policy_type, expiration_date, property_id, properties!inner(address, user_id), tenants(company_name, contact_email)")
        .lt("expiration_date", today)
        .eq("status", "active");

      const notifications: any[] = [];

      for (const policy of (expiredPolicies || [])) {
        const prop = policy.properties as any;
        const tenant = (policy as any).tenants;

        await supabase
          .from("tenant_insurance_policies")
          .update({ status: "expired" })
          .eq("id", policy.id);

        notifications.push({
          user_id: prop.user_id,
          title: "Insurance policy expired",
          message: `${tenant?.company_name || "Tenant"}'s ${policy.policy_type?.replace(/_/g, " ")} policy at ${prop.address} has expired (${policy.expiration_date}).`,
          priority: "critical",
          category: "insurance",
          entity_id: policy.id,
          entity_type: "insurance_policy",
          property_id: policy.property_id,
        });
      }

      // Find policies expiring in the next 30 days — only notify at 30/14/7/3/1 day marks
      const { data: expiringPolicies } = await supabase
        .from("tenant_insurance_policies")
        .select("id, policy_type, carrier_name, expiration_date, property_id, properties!inner(address, user_id), tenants(company_name, contact_email)")
        .gte("expiration_date", today)
        .lte("expiration_date", thirtyDaysFromNow)
        .eq("status", "active");

      for (const policy of (expiringPolicies || [])) {
        const prop = policy.properties as any;
        const tenant = (policy as any).tenants;
        const daysLeft = Math.ceil((new Date(policy.expiration_date!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

        if (![30, 14, 7, 3, 1].includes(daysLeft)) continue;

        // Check if this specific interval notification already exists
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("entity_id", policy.id)
          .eq("entity_type", "insurance_policy")
          .eq("category", "insurance")
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .limit(1);

        if (existing && existing.length > 0) continue;

        notifications.push({
          user_id: prop.user_id,
          title: `Insurance expiring in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
          message: `${tenant?.company_name || "Tenant"}'s ${policy.policy_type?.replace(/_/g, " ")} policy (${policy.carrier_name || "Unknown carrier"}) at ${prop.address} expires ${policy.expiration_date}.`,
          priority: daysLeft <= 7 ? "high" : "normal",
          category: "insurance",
          entity_id: policy.id,
          entity_type: "insurance_policy",
          property_id: policy.property_id,
        });

        // Send courtesy email to tenant at 14 and 3 days
        if ([14, 3].includes(daysLeft) && tenant?.contact_email) {
          try {
            const resendApiKey = Deno.env.get("RESEND_API_KEY");
            const fromAddress = Deno.env.get("RESEND_FROM_ADDRESS") || "CitiSignal <notifications@citisignal.com>";
            if (resendApiKey) {
              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
                body: JSON.stringify({
                  from: fromAddress,
                  to: [tenant.contact_email],
                  subject: `Insurance renewal reminder — ${prop.address}`,
                  html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
                    <h2 style="color:#0f172a;">Insurance Renewal Reminder</h2>
                    <p>Hi ${tenant.company_name || "Tenant"},</p>
                    <p>Your <strong>${policy.policy_type?.replace(/_/g, " ")}</strong> insurance policy for <strong>${prop.address}</strong> expires in <strong>${daysLeft} days</strong> (${policy.expiration_date}).</p>
                    <p>Please provide an updated Certificate of Insurance (COI) to your property manager at your earliest convenience.</p>
                    <p style="color:#64748b;font-size:13px;margin-top:24px;">— CitiSignal Compliance Alerts</p>
                  </div>`,
                }),
              });
              console.log(`  -> Sent insurance reminder email to ${tenant.contact_email}`);
            }
          } catch (emailErr) {
            console.error("Error sending tenant insurance email:", emailErr);
          }
        }
      }

      if (notifications.length > 0) {
        const { error: notifError } = await supabase.from("notifications").insert(notifications);
        if (notifError) console.error("Error creating insurance notifications:", notifError);
        else console.log(`Created ${notifications.length} insurance notifications`);
      }
    } catch (e) {
      console.error("Error checking insurance expirations:", e);
    }

    // Check tax records due within 30 days and create notifications
    try {
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const today = new Date().toISOString().split("T")[0];
      
      const { data: upcomingTaxes } = await supabase
        .from("property_taxes")
        .select("id, tax_year, tax_amount, due_date, payment_status, property_id, properties!inner(address, user_id)")
        .gte("due_date", today)
        .lte("due_date", thirtyDaysFromNow)
        .in("payment_status", ["unpaid", "partial"]);
      
      if (upcomingTaxes && upcomingTaxes.length > 0) {
        const notifications = [];
        for (const tax of upcomingTaxes) {
          const prop = tax.properties as any;
          const daysLeft = Math.ceil((new Date(tax.due_date!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          
          const { data: existing } = await supabase
            .from("notifications")
            .select("id")
            .eq("entity_id", tax.id)
            .eq("entity_type", "property_tax")
            .eq("category", "tax")
            .limit(1);
          
          if (!existing || existing.length === 0) {
            notifications.push({
              user_id: prop.user_id,
              title: `Property Tax Due Soon`,
              message: `${tax.tax_year} property tax of $${Number(tax.tax_amount).toLocaleString()} for ${prop.address} is due in ${daysLeft} days (${tax.due_date}).`,
              priority: 'high' as const,
              category: 'tax',
              entity_id: tax.id,
              entity_type: 'property_tax',
              property_id: tax.property_id,
            });
          }
        }
        
        if (notifications.length > 0) {
          const { error: notifError } = await supabase.from("notifications").insert(notifications);
          if (notifError) console.error("Error creating tax notifications:", notifError);
          else console.log(`Created ${notifications.length} tax deadline notifications`);
        }
      }
    } catch (e) {
      console.error("Error checking tax deadlines:", e);
    }

    console.log(`Scheduled sync complete: ${results.synced} synced, ${results.errors} errors, ${results.new_violations} new violations, ${results.changes_detected} changes detected`);

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Scheduled sync error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
