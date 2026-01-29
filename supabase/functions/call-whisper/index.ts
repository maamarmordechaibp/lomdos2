import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Whisper handler for incoming calls
 * 
 * This is called when the store owner's phone is connected.
 * It announces who is calling and requires pressing 1 to accept.
 * This prevents voicemail from accidentally picking up the call.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const customerName = url.searchParams.get("customer_name") || "Unknown caller";
    
    // Check if this is a digit response
    const contentType = req.headers.get("content-type") || "";
    let digits = "";
    
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      digits = formData.get("Digits")?.toString() || "";
    }

    if (digits === "1") {
      // User pressed 1, connect the call
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Connecting you now.</Say>
</Response>`;
      return new Response(twiml, {
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    // Initial whisper - announce caller and ask to press 1
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${url.origin}${url.pathname}?customer_name=${encodeURIComponent(customerName)}" timeout="10">
    <Say voice="man" language="en-US">Incoming call from ${escapeXml(customerName)}. Press 1 to accept the call.</Say>
  </Gather>
  <Say voice="man" language="en-US">No response received. Goodbye.</Say>
  <Hangup/>
</Response>`;

    return new Response(twiml, {
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  } catch (error) {
    console.error("Error in whisper handler:", error);
    
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Error processing call.</Say>
  <Hangup/>
</Response>`;
    
    return new Response(errorTwiml, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  }
});

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
