import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClickToCallRequest {
  customer_id?: string;
  phone_number: string;
  customer_name?: string;
}

/**
 * Click-to-call function
 * 
 * This function initiates an outbound call:
 * 1. First calls the store owner's cell phone
 * 2. When the store owner picks up, says "Press 1 to call [customer name]"
 * 3. After pressing 1, connects to the customer's phone
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const signalwireSpaceUrl = Deno.env.get("SIGNALWIRE_SPACE_URL");
    const signalwireProjectId = Deno.env.get("SIGNALWIRE_PROJECT_ID");
    const signalwireApiToken = Deno.env.get("SIGNALWIRE_API_TOKEN");
    const signalwireFromNumber = Deno.env.get("SIGNALWIRE_FROM_NUMBER");

    if (!signalwireSpaceUrl || !signalwireProjectId || !signalwireApiToken || !signalwireFromNumber) {
      throw new Error("SignalWire not configured. Add SIGNALWIRE_* secrets in Supabase.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ClickToCallRequest = await req.json();
    const { customer_id, phone_number, customer_name } = body;

    if (!phone_number) {
      throw new Error("Phone number is required");
    }

    // Get store settings
    const { data: settings } = await supabase
      .from("global_settings")
      .select("store_name, store_cell_phone")
      .single();

    const storeCellPhone = settings?.store_cell_phone;
    const storeName = settings?.store_name || "the bookstore";

    if (!storeCellPhone) {
      throw new Error("Store cell phone not configured. Please set it in Settings.");
    }

    // Format phone numbers
    let formattedStorePhone = storeCellPhone.replace(/\D/g, '');
    if (!formattedStorePhone.startsWith('1') && formattedStorePhone.length === 10) {
      formattedStorePhone = '1' + formattedStorePhone;
    }
    if (!formattedStorePhone.startsWith('+')) {
      formattedStorePhone = '+' + formattedStorePhone;
    }

    let formattedCustomerPhone = phone_number.replace(/\D/g, '');
    if (!formattedCustomerPhone.startsWith('1') && formattedCustomerPhone.length === 10) {
      formattedCustomerPhone = '1' + formattedCustomerPhone;
    }
    if (!formattedCustomerPhone.startsWith('+')) {
      formattedCustomerPhone = '+' + formattedCustomerPhone;
    }

    // Determine customer name
    let displayName = customer_name || "the customer";
    
    // If we have customer_id, look up the name
    if (customer_id && !customer_name) {
      const { data: customer } = await supabase
        .from("customers")
        .select("name")
        .eq("id", customer_id)
        .single();
      
      if (customer?.name) {
        displayName = customer.name;
      }
    }

    // Log the outbound call
    const { data: callLog } = await supabase
      .from("call_logs")
      .insert({
        customer_id: customer_id || null,
        phone_number: phone_number,
        customer_name: displayName,
        direction: 'outbound',
        status: 'initiated',
      })
      .select()
      .single();

    console.log(`Initiating click-to-call: Store ${formattedStorePhone} -> Customer ${formattedCustomerPhone}`);

    // Build the callback URL for connecting to customer
    const baseUrl = supabaseUrl.replace('https://', '').split('.')[0];
    const functionBaseUrl = `https://${baseUrl}.supabase.co/functions/v1`;
    const connectUrl = `${functionBaseUrl}/click-to-call-connect?customer_phone=${encodeURIComponent(formattedCustomerPhone)}&customer_name=${encodeURIComponent(displayName)}&call_log_id=${callLog?.id}`;
    const statusUrl = `${functionBaseUrl}/call-status?call_log_id=${callLog?.id}`;

    // Create TwiML to call store owner first, then connect to customer
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${connectUrl}" timeout="10">
    <Say voice="man" language="en-US">Press 1 to call ${escapeXml(displayName)}.</Say>
  </Gather>
  <Say voice="man" language="en-US">No response received. Goodbye.</Say>
</Response>`;

    // Make the call to store owner's cell phone
    const url = `https://${signalwireSpaceUrl}/api/laml/2010-04-01/Accounts/${signalwireProjectId}/Calls.json`;
    const auth = btoa(`${signalwireProjectId}:${signalwireApiToken}`);

    const callBody = new URLSearchParams({
      From: signalwireFromNumber,
      To: formattedStorePhone,
      Twiml: twiml,
      StatusCallback: statusUrl,
      StatusCallbackEvent: 'completed',
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: callBody.toString(),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("SignalWire error:", result);
      
      // Update call log with failure
      if (callLog?.id) {
        await supabase
          .from("call_logs")
          .update({ status: 'failed' })
          .eq("id", callLog.id);
      }
      
      throw new Error(result.message || "Failed to initiate call");
    }

    // Update call log with call SID
    if (callLog?.id && result.sid) {
      await supabase
        .from("call_logs")
        .update({ call_sid: result.sid, status: 'ringing' })
        .eq("id", callLog.id);
    }

    console.log("Call initiated:", result.sid);

    return new Response(
      JSON.stringify({ success: true, callSid: result.sid, callLogId: callLog?.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in click-to-call:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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
