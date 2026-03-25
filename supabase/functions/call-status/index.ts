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
    const voicemailEnabled = url.searchParams.get("voicemail") === "1";
    const callerNumber = url.searchParams.get("caller_number") || "";
    const customerName = url.searchParams.get("customer_name") || "Customer";

    // Parse the callback data
    const contentType = req.headers.get("content-type") || "";
    let dialCallStatus = "";
    let dialCallDuration = 0;
    let answeredBy = "";
    let recordingUrl = "";
    let recordingDuration = 0;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      dialCallStatus = formData.get("DialCallStatus")?.toString() || formData.get("CallStatus")?.toString() || "";
      dialCallDuration = parseInt(formData.get("DialCallDuration")?.toString() || formData.get("CallDuration")?.toString() || "0");
      answeredBy = formData.get("AnsweredBy")?.toString() || "";
      recordingUrl = formData.get("RecordingUrl")?.toString() || "";
      recordingDuration = parseInt(formData.get("RecordingDuration")?.toString() || "0");
    } else {
      const body = await req.json();
      dialCallStatus = body.DialCallStatus || body.CallStatus || "";
      dialCallDuration = parseInt(body.DialCallDuration || body.CallDuration || "0");
      answeredBy = body.AnsweredBy || "";
      recordingUrl = body.RecordingUrl || "";
      recordingDuration = parseInt(body.RecordingDuration || "0");
    }

    // Recording callback from <Record action="..."> - save voicemail and finish
    if (recordingUrl) {
      if (callLogId) {
        const { error: recordingError } = await supabase
          .from("call_logs")
          .update({
            status: 'completed',
            recording_url: recordingUrl,
            notes: `Voicemail left (${recordingDuration}s) by ${customerName}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", callLogId);

        if (recordingError) {
          console.error("Error saving voicemail recording:", recordingError);
        }
      }

      const completeTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Thank you. Your message has been recorded. Goodbye.</Say>
</Response>`;

      return new Response(completeTwiml, {
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
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

    // If representative did not answer, offer voicemail fallback
    const shouldOfferVoicemail = voicemailEnabled && ['no_answer', 'busy', 'failed', 'missed'].includes(status);

    if (shouldOfferVoicemail) {
      const baseUrl = supabaseUrl.replace('https://', '').split('.')[0];
      const functionBaseUrl = `https://${baseUrl}.supabase.co/functions/v1`;
      const recordActionUrl = `${functionBaseUrl}/call-status?call_log_id=${callLogId}&amp;voicemail=1&amp;caller_number=${encodeURIComponent(callerNumber)}&amp;customer_name=${encodeURIComponent(customerName)}`;

      const voicemailTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">We couldn't connect you right now. Please leave a message after the beep.</Say>
  <Record maxLength="120" playBeep="true" action="${recordActionUrl}" method="POST" />
  <Say voice="man" language="en-US">No recording received. Goodbye.</Say>
</Response>`;

      return new Response(voicemailTwiml, {
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
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
