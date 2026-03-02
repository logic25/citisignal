import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

function generatePOHtml(data: {
  poNumber: string;
  date: string;
  propertyAddress: string;
  vendorName: string;
  vendorPhone: string;
  vendorEmail: string;
  vendorLicense: string;
  ownerName: string;
  scope: string;
  amount: number | null;
  terms: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Purchase Order ${data.poNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; color: #1e293b; }
    .header { text-align: center; border-bottom: 3px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { font-size: 28px; font-weight: 800; margin: 0; }
    .header .subtitle { color: #64748b; font-size: 14px; margin-top: 4px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 30px; }
    .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
    .info-box h3 { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px; margin: 0 0 8px; }
    .info-box p { margin: 4px 0; font-size: 14px; }
    .section { margin-bottom: 24px; }
    .section h2 { font-size: 14px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
    .amount { font-size: 32px; font-weight: 800; color: #0f172a; text-align: center; padding: 20px; background: #f0fdf4; border: 2px solid #22c55e; border-radius: 8px; margin: 20px 0; }
    .scope { white-space: pre-line; line-height: 1.6; font-size: 14px; }
    .terms { font-size: 12px; color: #64748b; line-height: 1.6; white-space: pre-line; }
    .signature-section { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
    .sig-line { border-top: 1px solid #1e293b; padding-top: 8px; margin-top: 60px; }
    .sig-line p { margin: 2px 0; font-size: 12px; color: #64748b; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>📡 CitiSignal</h1>
    <div class="subtitle">Purchase Order</div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h3>Purchase Order</h3>
      <p><strong>${data.poNumber}</strong></p>
      <p>Date: ${data.date}</p>
      <p>Property: ${data.propertyAddress}</p>
    </div>
    <div class="info-box">
      <h3>Vendor</h3>
      <p><strong>${data.vendorName}</strong></p>
      <p>Phone: ${data.vendorPhone}</p>
      <p>Email: ${data.vendorEmail}</p>
      ${data.vendorLicense !== 'N/A' ? `<p>License: ${data.vendorLicense}</p>` : ''}
    </div>
  </div>

  <div class="amount">$${(data.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>

  <div class="section">
    <h2>Scope of Work</h2>
    <div class="scope">${data.scope}</div>
  </div>

  <div class="section">
    <h2>Terms & Conditions</h2>
    <div class="terms">${data.terms}</div>
  </div>

  <div class="signature-section">
    <div>
      <div class="sig-line">
        <p><strong>Owner / Authorized Representative</strong></p>
        <p>${data.ownerName}</p>
        <p>Date: ${data.date}</p>
      </div>
    </div>
    <div>
      <div class="sig-line">
        <p><strong>Vendor Signature</strong></p>
        <p>${data.vendorName}</p>
        <p>Date: _______________</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Security Fix 22: Validate required environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const { work_order_id, terms_override } = await req.json();
    if (!work_order_id || typeof work_order_id !== "string") {
      return new Response(JSON.stringify({ error: "work_order_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      supabaseUrl,
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

    // Security Fix 2: Verify the authenticated user owns this work order's property
    if (wo.property?.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden — you do not own this property" }), {
        status: 403,
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

    // Generate PO HTML document and store as PDF-ready content
    const poHtml = generatePOHtml({
      poNumber,
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      propertyAddress: wo.property?.address || 'N/A',
      vendorName: vendor?.name || 'N/A',
      vendorPhone: vendor?.phone_number || 'N/A',
      vendorEmail: vendor?.email || 'N/A',
      vendorLicense: vendor?.license_number || 'N/A',
      ownerName: wo.property?.owner_name || 'N/A',
      scope: wo.scope || '',
      amount: wo.approved_amount,
      terms: terms || 'Standard terms apply.',
    });

    // Upload HTML as document to storage
    const fileName = `po/${po.id}/${poNumber}.html`;
    const { error: uploadErr } = await supabase.storage
      .from('property-documents')
      .upload(fileName, new Blob([poHtml], { type: 'text/html' }), {
        contentType: 'text/html',
        upsert: true,
      });

    if (!uploadErr) {
      const { data: urlData } = supabase.storage
        .from('property-documents')
        .getPublicUrl(fileName);

      // Update PO with PDF URL
      await supabase
        .from('purchase_orders')
        .update({ pdf_url: urlData.publicUrl })
        .eq('id', po.id);
    } else {
      console.error('PO upload error:', uploadErr);
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
        const appUrl = Deno.env.get("APP_URL") || "https://app.citisignal.com";
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
