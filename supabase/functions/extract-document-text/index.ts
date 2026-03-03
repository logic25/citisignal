import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

// Simple PDF text extractor - extracts text streams from PDF without heavy libraries
async function extractTextFromPdf(pdfBytes: Uint8Array): Promise<string> {
  const decoder = new TextDecoder('latin1');
  const content = decoder.decode(pdfBytes);
  
  const textParts: string[] = [];
  
  // Method 1: Extract text between BT and ET markers
  const btEtPattern = /BT\s*([\s\S]*?)\s*ET/g;
  let match;
  
  while ((match = btEtPattern.exec(content)) !== null) {
    const textBlock = match[1];
    const literalPattern = /\(([^)]*)\)/g;
    let literalMatch;
    while ((literalMatch = literalPattern.exec(textBlock)) !== null) {
      let text = literalMatch[1]
        .replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
        .replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '\\');
      if (text.trim()) textParts.push(text);
    }
    
    const hexPattern = /<([0-9A-Fa-f]+)>/g;
    let hexMatch;
    while ((hexMatch = hexPattern.exec(textBlock)) !== null) {
      const hex = hexMatch[1];
      let text = '';
      for (let i = 0; i < hex.length; i += 2) {
        const charCode = parseInt(hex.substr(i, 2), 16);
        if (charCode >= 32 && charCode < 127) text += String.fromCharCode(charCode);
      }
      if (text.trim()) textParts.push(text);
    }
  }
  
  // Method 2: Look for stream content with text operators
  const streamPattern = /stream\s*([\s\S]*?)\s*endstream/g;
  while ((match = streamPattern.exec(content)) !== null) {
    const streamContent = match[1];
    if (streamContent.includes('Tj') || streamContent.includes('TJ')) {
      const tjPattern = /\(([^)]+)\)\s*Tj/g;
      let tjMatch;
      while ((tjMatch = tjPattern.exec(streamContent)) !== null) {
        const text = tjMatch[1].replace(/\\./g, '');
        if (text.trim() && text.length > 1) textParts.push(text);
      }
    }
  }
  
  return textParts.join(' ').replace(/\s+/g, ' ').replace(/\n\s+/g, '\n').trim();
}

// AI-powered extraction using vision model for full document fidelity
async function extractTextWithAI(pdfBytes: Uint8Array, LOVABLE_API_KEY: string): Promise<string> {
  const chunkSize = 8192;
  let binaryString = '';
  for (let i = 0; i < pdfBytes.length; i += chunkSize) {
    const chunk = pdfBytes.subarray(i, Math.min(i + chunkSize, pdfBytes.length));
    binaryString += String.fromCharCode.apply(null, Array.from(chunk));
  }
  const base64File = btoa(binaryString);

  // For documents under 5MB base64
  const maxBase64Length = 5 * 1024 * 1024;
  const truncatedBase64 = base64File.length > maxBase64Length
    ? base64File.substring(0, maxBase64Length)
    : base64File;

  const extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract ALL text from this PDF document completely and faithfully. Preserve the document structure including:
- Page numbers (mark as [Page 1], [Page 2], etc.)
- Section headers and article numbers
- Paragraph structure
- Table contents (format as readable text)
- All footnotes and exhibits

Output ONLY the extracted text. Do not summarize or skip any content. Every word matters for legal documents.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:application/pdf;base64,${truncatedBase64}`,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!extractResponse.ok) {
    console.error("AI extraction failed:", extractResponse.status);
    return "";
  }

  const result = await extractResponse.json();
  return result.choices?.[0]?.message?.content || "";
}

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { documentId, fileUrl } = await req.json();

    if (!documentId || !fileUrl) {
      return new Response(JSON.stringify({ error: "documentId and fileUrl are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user owns this document's property
    const { data: doc, error: docErr } = await supabaseAdmin
      .from('property_documents')
      .select('id, property_id, properties!inner(user_id)')
      .eq('id', documentId)
      .single();

    if (docErr || !doc || (doc as any).properties?.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Extracting text from document:", documentId);

    // Extract storage path from URL
    const urlParts = fileUrl.split('/property-documents/');
    if (urlParts.length !== 2) {
      throw new Error("Invalid file URL format");
    }
    const storagePath = urlParts[1];

    // Download the PDF
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('property-documents')
      .download(storagePath);

    if (downloadError) {
      console.error("Storage download error:", downloadError);
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    if (!fileData) {
      throw new Error("No file data received");
    }

    const fileBuffer = await fileData.arrayBuffer();
    const pdfBytes = new Uint8Array(fileBuffer);
    console.log("Downloaded PDF:", pdfBytes.length, "bytes");

    // Try regex parser first (fast, works for simple PDFs)
    let extractedText = await extractTextFromPdf(pdfBytes);
    console.log("Regex extraction got:", extractedText.length, "chars");

    // Always try AI extraction for better quality (especially for commercial leases)
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY) {
      console.log("Running AI extraction for full document fidelity...");
      const aiText = await extractTextWithAI(pdfBytes, LOVABLE_API_KEY);
      console.log("AI extraction got:", aiText.length, "chars");

      // Use whichever got more content
      if (aiText.length > extractedText.length) {
        extractedText = aiText;
        console.log("Using AI extraction (better coverage)");
      } else {
        console.log("Using regex extraction (sufficient coverage)");
      }
    }

    if (!extractedText || extractedText.length < 10) {
      throw new Error("Could not extract text from document");
    }

    // Sanitize text
    extractedText = extractedText
      .replace(/\u0000/g, '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
    
    console.log("Sanitized text length:", extractedText.length);

    // Save extracted text
    const { error: updateError } = await supabaseClient
      .from('property_documents')
      .update({ extracted_text: extractedText })
      .eq('id', documentId);

    if (updateError) {
      console.error("Error saving extracted text:", updateError);
      throw updateError;
    }

    console.log("Successfully extracted", extractedText.length, "characters");

    return new Response(
      JSON.stringify({ 
        success: true, 
        charactersExtracted: extractedText.length,
        preview: extractedText.substring(0, 500) + (extractedText.length > 500 ? '...' : '')
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Document extraction error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
