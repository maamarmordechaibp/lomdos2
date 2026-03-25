import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Handle main menu selection
 * 1 = Listen to message
 * 2 = Speak with representative
 * 3 = Pay for books
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
    const pendingMessageId = url.searchParams.get("pending_message_id");
    const callLogId = url.searchParams.get("call_log_id");
    const forwardNumber = url.searchParams.get("forward_number");
    const customerName = url.searchParams.get("customer_name") || "Customer";
    const callerNumber = url.searchParams.get("caller_number") || "";
    const customerId = url.searchParams.get("customer_id");

    // Parse digits pressed
    let digitsPressed = "";
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      digitsPressed = formData.get("Digits")?.toString() || "";
    }

    console.log(`Menu selection: ${digitsPressed}, Customer: ${customerName}`);

    const baseUrl = supabaseUrl.replace('https://', '').split('.')[0];
    const functionBaseUrl = `https://${baseUrl}.supabase.co/functions/v1`;

    let twiml: string;

    switch (digitsPressed) {
      case "1":
        // Play pending message
        if (pendingMessageId) {
          const playUrl = `${functionBaseUrl}/play-pending-message?pending_message_id=${pendingMessageId}&amp;call_log_id=${callLogId}&amp;forward_number=${encodeURIComponent(forwardNumber || '')}&amp;customer_name=${encodeURIComponent(customerName)}&amp;caller_number=${encodeURIComponent(callerNumber)}`;
          twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect>${playUrl}</Redirect>
</Response>`;
        } else {
          // No pending message
          const mainMenuUrl = `${functionBaseUrl}/handle-incoming-call`;
          twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">You have no pending messages.</Say>
  <Pause length="1"/>
  <Redirect method="POST">${mainMenuUrl}</Redirect>
</Response>`;
        }
        break;

      case "2":
        // Connect to representative
        const connectUrl = `${functionBaseUrl}/skip-pending-message?call_log_id=${callLogId}&amp;forward_number=${encodeURIComponent(forwardNumber || '')}&amp;customer_name=${encodeURIComponent(customerName)}&amp;caller_number=${encodeURIComponent(callerNumber)}`;
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect>${connectUrl}</Redirect>
</Response>`;
        break;

      case "3":
        // Pay for books
        const paymentUrl = `${functionBaseUrl}/phone-payment?caller_number=${encodeURIComponent(callerNumber)}&amp;customer_id=${customerId || ''}&amp;customer_name=${encodeURIComponent(customerName)}&amp;forward_number=${encodeURIComponent(forwardNumber || '')}&amp;call_log_id=${callLogId}`;
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect>${paymentUrl}</Redirect>
</Response>`;
        break;

      default:
        // Invalid selection, repeat menu
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Invalid selection. Please try again.</Say>
  <Redirect method="POST">${functionBaseUrl}/handle-incoming-call</Redirect>
</Response>`;
    }

    return new Response(twiml, {
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  } catch (error) {
    console.error("Error in menu handler:", error);
    
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Sorry, there was an error. Please try again later.</Say>
</Response>`;
    
    return new Response(errorTwiml, {
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  }
});
