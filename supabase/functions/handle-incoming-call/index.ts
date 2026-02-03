import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Handle incoming calls webhook from SignalWire
 * 
 * This function:
 * 1. Receives the incoming call from SignalWire
 * 2. Looks up the caller's phone number to find the customer name
 * 3. Logs the call in the call_logs table
 * 4. Announces the customer name and asks to press 1 to accept
 * 5. Forwards the call to the store cell phone
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const signalwireSpaceUrl = Deno.env.get("SIGNALWIRE_SPACE_URL");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the request - SignalWire sends form data
    const contentType = req.headers.get("content-type") || "";
    let callerNumber = "";
    let callSid = "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      callerNumber = formData.get("From")?.toString() || "";
      callSid = formData.get("CallSid")?.toString() || "";
    } else {
      const body = await req.json();
      callerNumber = body.From || body.from || body.caller || "";
      callSid = body.CallSid || body.call_sid || "";
    }

    console.log(`Incoming call from: ${callerNumber}, CallSid: ${callSid}`);

    // Normalize phone number for lookup (remove +1 prefix for US numbers)
    let normalizedNumber = callerNumber.replace(/\D/g, '');
    if (normalizedNumber.startsWith('1') && normalizedNumber.length === 11) {
      normalizedNumber = normalizedNumber.substring(1); // Remove leading 1
    }

    // Look up customer by phone number
    let customerName = "Unknown caller";
    let customerId: string | null = null;

    // Try multiple phone formats to find the customer
    const { data: customers } = await supabase
      .from("customers")
      .select("id, name, phone")
      .or(`phone.ilike.%${normalizedNumber}%,phone.ilike.%${callerNumber}%`);

    if (customers && customers.length > 0) {
      customerName = customers[0].name;
      customerId = customers[0].id;
      console.log(`Found customer: ${customerName} (ID: ${customerId})`);
    } else {
      console.log(`No customer found for phone: ${callerNumber}`);
    }

    // Check for pending messages for this caller
    // Build multiple phone number formats to check
    const digitsOnly = callerNumber.replace(/\D/g, '');
    const last10Digits = digitsOnly.slice(-10); // Get last 10 digits regardless of country code
    
    // Create all possible formats
    const phoneFormats = [
      callerNumber,                      // Original: +18453762437
      `+${digitsOnly}`,                  // +18453762437
      `+1${last10Digits}`,               // +18453762437
      digitsOnly,                        // 18453762437
      last10Digits,                      // 8453762437
    ];
    
    console.log(`Looking for pending messages with phone formats: ${phoneFormats.join(', ')}`);
    
    // First, let's see all pending messages to debug
    const { data: allPending } = await supabase
      .from("pending_messages")
      .select("id, phone_number, is_played, created_at")
      .eq("is_played", false)
      .order("created_at", { ascending: false })
      .limit(10);
    
    console.log(`All unplayed pending messages: ${JSON.stringify(allPending)}`);

    const { data: pendingMessages, error: pendingError } = await supabase
      .from("pending_messages")
      .select("id, message, notification_type, created_at, phone_number")
      .eq("is_played", false)
      .or(phoneFormats.map(p => `phone_number.ilike.%${last10Digits}%`).join(','))
      .order("created_at", { ascending: false })
      .limit(1);

    if (pendingError) {
      console.error("Error querying pending messages:", pendingError);
    }

    const hasPendingMessage = pendingMessages && pendingMessages.length > 0;
    const pendingMessage = hasPendingMessage ? pendingMessages[0] : null;

    console.log(`Pending messages for caller ${callerNumber}: ${hasPendingMessage ? 'YES' : 'NO'}`);
    if (pendingMessage) {
      console.log(`Found pending message - ID: ${pendingMessage.id}, Phone: ${pendingMessage.phone_number}, Type: ${pendingMessage.notification_type}`);
    }

    // Get store settings for the forwarding number
    const { data: settings } = await supabase
      .from("global_settings")
      .select("store_name, store_cell_phone")
      .single();

    const storeName = settings?.store_name || "the bookstore";
    const forwardToNumber = settings?.store_cell_phone;

    if (!forwardToNumber) {
      console.error("No store cell phone configured for call forwarding");
      // Return TwiML that says the store is unavailable
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Thank you for calling ${escapeXml(storeName)}. We are currently unavailable. Please try again later.</Say>
</Response>`;
      return new Response(twiml, {
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    // Format forwarding number
    let formattedForwardNumber = forwardToNumber.replace(/\D/g, '');
    if (!formattedForwardNumber.startsWith('1') && formattedForwardNumber.length === 10) {
      formattedForwardNumber = '1' + formattedForwardNumber;
    }
    if (!formattedForwardNumber.startsWith('+')) {
      formattedForwardNumber = '+' + formattedForwardNumber;
    }

    // Log the incoming call
    const { data: callLog, error: logError } = await supabase
      .from("call_logs")
      .insert({
        customer_id: customerId,
        phone_number: callerNumber,
        customer_name: customerName,
        direction: 'inbound',
        status: 'ringing',
        call_sid: callSid,
      })
      .select()
      .single();

    if (logError) {
      console.error("Error logging call:", logError);
    } else {
      console.log("Call logged:", callLog?.id);
    }

    // Build the callback URL for when the store owner answers
    const baseUrl = supabaseUrl.replace('https://', '').split('.')[0];
    const functionBaseUrl = `https://${baseUrl}.supabase.co/functions/v1`;
    const statusCallbackUrl = `${functionBaseUrl}/call-status?call_log_id=${callLog?.id}`;
    const whisperUrl = `${functionBaseUrl}/call-whisper?customer_name=${encodeURIComponent(customerName)}`;

    // Generate TwiML response
    // Always show the main menu with 3 options
    let twiml: string;
    
    // Build menu URLs with proper XML escaping (& as &amp;)
    const playMessageUrl = pendingMessage 
      ? `${functionBaseUrl}/play-pending-message?pending_message_id=${pendingMessage.id}&amp;call_log_id=${callLog?.id}&amp;forward_number=${encodeURIComponent(formattedForwardNumber)}&amp;customer_name=${encodeURIComponent(customerName)}&amp;caller_number=${encodeURIComponent(callerNumber)}`
      : `${functionBaseUrl}/no-pending-message?call_log_id=${callLog?.id}&amp;forward_number=${encodeURIComponent(formattedForwardNumber)}&amp;customer_name=${encodeURIComponent(customerName)}&amp;caller_number=${encodeURIComponent(callerNumber)}`;
    
    const connectUrl = `${functionBaseUrl}/skip-pending-message?call_log_id=${callLog?.id}&amp;forward_number=${encodeURIComponent(formattedForwardNumber)}&amp;customer_name=${encodeURIComponent(customerName)}&amp;caller_number=${encodeURIComponent(callerNumber)}`;
    
    const paymentUrl = `${functionBaseUrl}/phone-payment?caller_number=${encodeURIComponent(callerNumber)}&amp;customer_id=${customerId || ''}&amp;customer_name=${encodeURIComponent(customerName)}`;
    
    // Build main menu action URL
    const menuActionUrl = `${functionBaseUrl}/phone-menu-handler?pending_message_id=${pendingMessage?.id || ''}&amp;call_log_id=${callLog?.id}&amp;forward_number=${encodeURIComponent(formattedForwardNumber)}&amp;customer_name=${encodeURIComponent(customerName)}&amp;caller_number=${encodeURIComponent(callerNumber)}&amp;customer_id=${customerId || ''}`;
    
    // Message option text
    const messageOption = pendingMessage 
      ? "Press 1 to listen to your message."
      : "Press 1 for any previous messages.";
    
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Welcome to ${escapeXml(storeName)}.</Say>
  <Pause length="1"/>
  <Gather numDigits="1" action="${menuActionUrl}" timeout="10">
    <Say voice="man" language="en-US">${messageOption}</Say>
    <Say voice="man" language="en-US">Press 2 to speak with a representative.</Say>
    <Say voice="man" language="en-US">Press 3 to pay for your books.</Say>
  </Gather>
  <Say voice="man" language="en-US">We didn't receive your selection. Goodbye.</Say>
</Response>`;

    console.log("Returning TwiML:", twiml);

    return new Response(twiml, {
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  } catch (error) {
    console.error("Error handling incoming call:", error);
    
    // Return error TwiML
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Sorry, we are experiencing technical difficulties. Please try again later.</Say>
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
