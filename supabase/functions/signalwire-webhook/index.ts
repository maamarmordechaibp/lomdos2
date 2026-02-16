// Supabase Edge Function: SignalWire Webhook Handler
// Receives status updates from SignalWire about call progress

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse form data from SignalWire webhook
    const formData = await req.formData()
    
    const callSid = formData.get('CallSid') as string
    const callStatus = formData.get('CallStatus') as string
    const to = formData.get('To') as string
    const from = formData.get('From') as string
    const duration = formData.get('CallDuration') as string
    const answeredBy = formData.get('AnsweredBy') as string
    const errorCode = formData.get('ErrorCode') as string
    const errorMessage = formData.get('ErrorMessage') as string

    console.log(`Call ${callSid} status: ${callStatus}`)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Update call log in database
    const updateData: Record<string, any> = {
      status: callStatus,
      updated_at: new Date().toISOString(),
    }

    if (duration) {
      updateData.duration_seconds = parseInt(duration)
    }
    if (answeredBy) {
      updateData.answered_by = answeredBy
    }
    if (errorCode) {
      updateData.error_code = errorCode
      updateData.error_message = errorMessage
    }

    // Update the call log
    const { error } = await supabase
      .from('phone_call_logs')
      .update(updateData)
      .eq('call_sid', callSid)

    if (error) {
      console.error('Error updating call log:', error)
    }

    // If call completed successfully, we could trigger additional actions
    if (callStatus === 'completed') {
      // Mark order item as customer_notified in Django
      // We'll handle this by having Django poll or use realtime subscription
      console.log(`Call ${callSid} completed successfully`)
    }

    // SignalWire expects a 200 response
    return new Response(
      JSON.stringify({ received: true, status: callStatus }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Webhook error:', error)
    // Still return 200 to prevent SignalWire retries
    return new Response(
      JSON.stringify({ received: true, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  }
})
