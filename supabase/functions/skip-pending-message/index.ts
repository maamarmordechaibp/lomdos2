import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Skip pending message and connect to store
 * 
 * This function is called when:
 * - Customer presses 2 to skip the message
 * - Customer finishes listening to the message
 * - Timeout occurs on the gather
 * 
 * It forwards the call to the store cell phone.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const callLogId = url.searchParams.get("call_log_id");
    const forwardNumber = url.searchParams.get("forward_number");
    const customerName = decodeURIComponent(url.searchParams.get("customer_name") || "Customer");
    const callerNumber = decodeURIComponent(url.searchParams.get("caller_number") || "");

    console.log(`Skip message - Forwarding to: ${forwardNumber}, Customer: ${customerName}`);

    if (!forwardNumber) {
      // No forward number, end the call
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">We're sorry, we are currently unavailable. Please try again later. Goodbye.</Say>
</Response>`;
      return new Response(twiml, {
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    // Build callback URLs
    const baseUrl = supabaseUrl.replace('https://', '').split('.')[0];
    const functionBaseUrl = `https://${baseUrl}.supabase.co/functions/v1`;
    const statusCallbackUrl = `${functionBaseUrl}/call-status?call_log_id=${callLogId}`;
    const whisperUrl = `${functionBaseUrl}/call-whisper?customer_name=${encodeURIComponent(customerName)}`;

    // Generate TwiML to connect the call to the store
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Please hold while we connect you.</Say>
  <Dial callerId="${escapeXml(callerNumber)}" timeout="30" action="${statusCallbackUrl}">
    <Number url="${whisperUrl}">${forwardNumber}</Number>
  </Dial>
  <Say voice="man" language="en-US">The call was not answered. Goodbye.</Say>
</Response>`;

    console.log("Connecting caller to store");

    return new Response(twiml, {
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  } catch (error) {
    console.error("Error in skip-pending-message:", error);
    
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Sorry, there was an error. Please try again later.</Say>
</Response>`;
    
    return new Response(errorTwiml, {
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
