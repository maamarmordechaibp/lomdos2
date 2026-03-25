import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Customer Call Whisper Handler
 * 
 * This is played to the customer when they answer an outbound call.
 * If they have a balance, they're offered the option to make a payment.
 * 
 * Flow:
 * 1. Customer answers
 * 2. They hear: "Hello, you have a balance of $X. Press 3 to make a payment now, or stay on the line to speak with a representative."
 * 3. If they press 3 -> redirect to phone-payment
 * 4. If they do nothing -> connect to store
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
    const customerId = url.searchParams.get("customer_id") || "";
    const customerName = url.searchParams.get("customer_name") || "";
    const balanceParam = url.searchParams.get("balance") || "0";
    const callerNumber = url.searchParams.get("caller_number") || "";
    const callLogId = url.searchParams.get("call_log_id") || "";

    const balance = parseFloat(balanceParam);

    // Get store settings for store name
    const { data: settings } = await supabase
      .from("global_settings")
      .select("store_name, store_cell_phone")
      .single();

    const storeName = settings?.store_name || "the bookstore";
    const forwardNumber = settings?.store_cell_phone || "";

    const baseUrl = supabaseUrl.replace('https://', '').split('.')[0];
    const functionBaseUrl = `https://${baseUrl}.supabase.co/functions/v1`;

    // Parse digits if provided
    const contentType = req.headers.get("content-type") || "";
    let digits = "";
    
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      digits = formData.get("Digits")?.toString() || "";
    }

    console.log(`Customer whisper - CustomerId: ${customerId}, Balance: ${balance}, Digits: ${digits}`);

    let twiml: string;

    if (digits === "3") {
      // Customer pressed 3 to pay - redirect to phone-payment
      const paymentUrl = `${functionBaseUrl}/phone-payment?caller_number=${encodeURIComponent(callerNumber)}&amp;customer_id=${customerId}&amp;customer_name=${encodeURIComponent(customerName)}&amp;forward_number=${encodeURIComponent(forwardNumber)}&amp;call_log_id=${callLogId}&amp;step=check_balance`;
      
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect>${paymentUrl}</Redirect>
</Response>`;
    } else if (digits) {
      // They pressed something else - just connect
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Connecting you now.</Say>
</Response>`;
    } else {
      // Initial message - announce balance and offer payment
      const balanceDollars = Math.floor(balance);
      const balanceCents = Math.round((balance - balanceDollars) * 100);
      const balanceText = balanceCents > 0 
        ? `${balanceDollars} dollars and ${balanceCents} cents`
        : `${balanceDollars} dollars`;

      const whisperActionUrl = `${functionBaseUrl}/customer-call-whisper?customer_id=${customerId}&amp;customer_name=${encodeURIComponent(customerName)}&amp;balance=${balance}&amp;caller_number=${encodeURIComponent(callerNumber)}&amp;call_log_id=${callLogId}`;

      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" numDigits="1" action="${whisperActionUrl}" timeout="5">
    <Say voice="man" language="en-US">Hello, this is ${escapeXml(storeName)}. You have an outstanding balance of ${balanceText}. Press 3 to make a payment now, or stay on the line to speak with us.</Say>
  </Gather>
  <Say voice="man" language="en-US">Connecting you now.</Say>
</Response>`;
    }

    return new Response(twiml, {
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  } catch (error) {
    console.error("Error in customer whisper:", error);
    
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Connecting you now.</Say>
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
