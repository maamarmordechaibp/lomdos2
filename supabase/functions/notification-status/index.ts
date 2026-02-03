import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Notification status callback handler
 * 
 * This is called by SignalWire when an outbound notification call's status changes.
 * - If the call was completed/answered, we delete the pending message
 * - If the call was not answered (no-answer, busy, failed), we keep the pending message
 *   so the customer can hear it when they call back
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

    if (!pendingMessageId) {
      console.log("No pending_message_id provided, nothing to update");
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
        { headers: { ...corsHeaders, "Content-Type": "application/xml" } }
      );
    }

    // Parse the callback data from SignalWire
    const contentType = req.headers.get("content-type") || "";
    let callStatus = "";
    let callDuration = 0;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      callStatus = formData.get("CallStatus")?.toString() || "";
      callDuration = parseInt(formData.get("CallDuration")?.toString() || "0");
    } else {
      const body = await req.json();
      callStatus = body.CallStatus || "";
      callDuration = parseInt(body.CallDuration || "0");
    }

    console.log(`Notification status - PendingMessageId: ${pendingMessageId}, Status: ${callStatus}, Duration: ${callDuration}s`);

    // Determine if the call was answered
    // If completed with duration > 0, the customer heard the message
    const wasAnswered = callStatus.toLowerCase() === 'completed' && callDuration > 5;

    if (wasAnswered) {
      // Customer answered and heard the message, delete the pending message
      console.log("Call was answered, deleting pending message");
      const { error } = await supabase
        .from("pending_messages")
        .delete()
        .eq("id", pendingMessageId);

      if (error) {
        console.error("Error deleting pending message:", error);
      } else {
        console.log("Pending message deleted successfully");
      }
    } else {
      // Call was not answered, keep the pending message so customer can hear it on callback
      console.log(`Call not answered (status: ${callStatus}), keeping pending message for callback playback`);
      
      // Optionally update the pending message with the call status
      await supabase
        .from("pending_messages")
        .update({ 
          // We could add a call_status field if needed
        })
        .eq("id", pendingMessageId);
    }

    // Return empty TwiML
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { headers: { ...corsHeaders, "Content-Type": "application/xml" } }
    );
  } catch (error) {
    console.error("Error in notification status callback:", error);
    
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/xml" } }
    );
  }
});
