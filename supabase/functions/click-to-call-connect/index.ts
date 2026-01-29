import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Click-to-call connect handler
 * 
 * This is called after the store owner presses 1 to accept the outbound call.
 * It connects the call to the customer's phone number.
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
    const customerPhone = url.searchParams.get("customer_phone");
    const customerName = url.searchParams.get("customer_name") || "the customer";
    const callLogId = url.searchParams.get("call_log_id");

    // Parse digits if provided
    const contentType = req.headers.get("content-type") || "";
    let digits = "";
    
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      digits = formData.get("Digits")?.toString() || "";
    }

    console.log(`Connect handler - CustomerPhone: ${customerPhone}, Digits: ${digits}, CallLogId: ${callLogId}`);

    // If user didn't press 1, hang up
    if (digits !== "1") {
      // Update call log
      if (callLogId) {
        await supabase
          .from("call_logs")
          .update({ status: 'failed', notes: 'User did not press 1 to connect' })
          .eq("id", callLogId);
      }

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Call cancelled. Goodbye.</Say>
  <Hangup/>
</Response>`;
      return new Response(twiml, {
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    if (!customerPhone) {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Error: No customer phone number provided. Goodbye.</Say>
  <Hangup/>
</Response>`;
      return new Response(twiml, {
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    // Update call log to in_progress
    if (callLogId) {
      await supabase
        .from("call_logs")
        .update({ status: 'in_progress' })
        .eq("id", callLogId);
    }

    // Build status callback URL
    const baseUrl = supabaseUrl.replace('https://', '').split('.')[0];
    const statusUrl = `https://${baseUrl}.supabase.co/functions/v1/call-status?call_log_id=${callLogId}`;

    // Generate TwiML to dial the customer
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Connecting you to ${escapeXml(customerName)} now.</Say>
  <Dial action="${statusUrl}" timeout="45">
    <Number>${customerPhone}</Number>
  </Dial>
  <Say voice="man" language="en-US">The call has ended. Goodbye.</Say>
</Response>`;

    console.log("Connecting to customer:", customerPhone);

    return new Response(twiml, {
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  } catch (error) {
    console.error("Error in connect handler:", error);
    
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Sorry, there was an error connecting your call.</Say>
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
