import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Call status callback handler
 * 
 * This is called by SignalWire when a call's status changes (completed, no-answer, busy, etc.)
 * Updates the call_logs table with the final status and duration.
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

    // Parse the callback data
    const contentType = req.headers.get("content-type") || "";
    let dialCallStatus = "";
    let dialCallDuration = 0;
    let answeredBy = "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      dialCallStatus = formData.get("DialCallStatus")?.toString() || formData.get("CallStatus")?.toString() || "";
      dialCallDuration = parseInt(formData.get("DialCallDuration")?.toString() || formData.get("CallDuration")?.toString() || "0");
      answeredBy = formData.get("AnsweredBy")?.toString() || "";
    } else {
      const body = await req.json();
      dialCallStatus = body.DialCallStatus || body.CallStatus || "";
      dialCallDuration = parseInt(body.DialCallDuration || body.CallDuration || "0");
      answeredBy = body.AnsweredBy || "";
    }

    console.log(`Call status update - LogId: ${callLogId}, Status: ${dialCallStatus}, Duration: ${dialCallDuration}s`);

    // Map SignalWire status to our status
    let status: string;
    switch (dialCallStatus.toLowerCase()) {
      case 'completed':
        status = 'completed';
        break;
      case 'no-answer':
        status = 'no_answer';
        break;
      case 'busy':
        status = 'busy';
        break;
      case 'failed':
        status = 'failed';
        break;
      case 'canceled':
      case 'cancelled':
        status = 'missed';
        break;
      default:
        status = dialCallStatus.toLowerCase() || 'missed';
    }

    // Update the call log
    if (callLogId) {
      const { error } = await supabase
        .from("call_logs")
        .update({
          status,
          duration_seconds: dialCallDuration,
          answered_by: answeredBy || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", callLogId);

      if (error) {
        console.error("Error updating call log:", error);
      } else {
        console.log("Call log updated successfully");
      }
    }

    // Return empty TwiML (call is ending anyway)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`;

    return new Response(twiml, {
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  } catch (error) {
    console.error("Error in status callback:", error);
    
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { headers: { ...corsHeaders, "Content-Type": "application/xml" } }
    );
  }
});
