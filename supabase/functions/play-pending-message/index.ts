import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Play pending message to customer who is calling back
 * 
 * This function:
 * 1. Retrieves the pending message from the database
 * 2. Plays it to the caller using TTS
 * 3. Marks the message as played
 * 4. Then connects them to the store
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

    // Parse digits pressed (if this was called from a Gather)
    let digitsPressed = "";
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      digitsPressed = formData.get("Digits")?.toString() || "";
    }

    console.log(`Play pending message - ID: ${pendingMessageId}, Digits: ${digitsPressed}`);

    // If user pressed 2, skip to speaking with representative
    if (digitsPressed === "2") {
      return redirectToCall(supabaseUrl, callLogId, forwardNumber, customerName, callerNumber);
    }

    // Get the pending message
    if (!pendingMessageId) {
      console.error("No pending_message_id provided");
      return redirectToCall(supabaseUrl, callLogId, forwardNumber, customerName, callerNumber);
    }

    const { data: pendingMessage, error } = await supabase
      .from("pending_messages")
      .select("*")
      .eq("id", pendingMessageId)
      .single();

    if (error || !pendingMessage) {
      console.error("Pending message not found:", error);
      return redirectToCall(supabaseUrl, callLogId, forwardNumber, customerName, callerNumber);
    }

    // Mark the message as played
    await supabase
      .from("pending_messages")
      .update({ 
        is_played: true, 
        played_at: new Date().toISOString() 
      })
      .eq("id", pendingMessageId);

    console.log("Playing message to caller:", pendingMessage.message);

    // Build URL for after message is played
    // Note: & must be escaped as &amp; in XML
    const baseUrl = supabaseUrl.replace('https://', '').split('.')[0];
    const functionBaseUrl = `https://${baseUrl}.supabase.co/functions/v1`;
    const afterMessageUrl = `${functionBaseUrl}/skip-pending-message?call_log_id=${callLogId}&amp;forward_number=${encodeURIComponent(forwardNumber || '')}&amp;customer_name=${encodeURIComponent(customerName)}&amp;caller_number=${encodeURIComponent(callerNumber)}`;

    // Play the message and then offer to connect
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Here is your message:</Say>
  <Pause length="1"/>
  <Say voice="man" language="en-US">${escapeXml(pendingMessage.message)}</Say>
  <Pause length="2"/>
  <Gather numDigits="1" action="${afterMessageUrl}" timeout="5">
    <Say voice="man" language="en-US">Press any key to speak with a representative, or hang up if you're done.</Say>
  </Gather>
  <Redirect>${afterMessageUrl}</Redirect>
</Response>`;

    return new Response(twiml, {
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  } catch (error) {
    console.error("Error playing pending message:", error);
    
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Sorry, there was an error. Please hold while we connect you.</Say>
</Response>`;
    
    return new Response(errorTwiml, {
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  }
});

function redirectToCall(supabaseUrl: string, callLogId: string | null, forwardNumber: string | null, customerName: string, callerNumber: string): Response {
  const baseUrl = supabaseUrl.replace('https://', '').split('.')[0];
  const functionBaseUrl = `https://${baseUrl}.supabase.co/functions/v1`;
  // Note: & must be escaped as &amp; in XML
  const skipUrl = `${functionBaseUrl}/skip-pending-message?call_log_id=${callLogId}&amp;forward_number=${encodeURIComponent(forwardNumber || '')}&amp;customer_name=${encodeURIComponent(customerName)}&amp;caller_number=${encodeURIComponent(callerNumber)}`;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect>${skipUrl}</Redirect>
</Response>`;

  return new Response(twiml, {
    headers: { 
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Content-Type": "application/xml" 
    },
  });
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
