// Supabase Edge Function: Call Customer with Hebrew TTS
// This function calls customers to notify them about book arrivals
// Uses SignalWire for phone calls with Hebrew text-to-speech

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CallRequest {
  customer_name: string
  customer_phone: string
  book_title: string
  order_id?: number
  message_type?: 'book_arrival' | 'custom'
  custom_message?: string
}

// Hebrew message templates
function getHebrewMessage(data: CallRequest): string {
  const customerName = data.customer_name || 'לקוח יקר'
  const bookTitle = data.book_title || 'הספר שהזמנת'
  
  if (data.message_type === 'custom' && data.custom_message) {
    return data.custom_message
  }
  
  // Default: Book arrival notification
  // "Hello [name], this is a message from the bookstore. 
  //  We wanted to let you know that your book [title] has arrived and is ready for pickup.
  //  We look forward to seeing you. Thank you and have a great day!"
  return `שלום ${customerName}. זוהי הודעה מחנות הספרים. ` +
    `רצינו להודיע לך שהספר ${bookTitle} הגיע ומוכן לאיסוף. ` +
    `נשמח לראותך. תודה ויום נפלא!`
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get SignalWire credentials from environment
    const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')
    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')
    const fromNumber = Deno.env.get('SIGNALWIRE_FROM_NUMBER')

    if (!projectId || !apiToken || !spaceUrl || !fromNumber) {
      throw new Error('SignalWire credentials not configured')
    }

    // Parse request body
    const data: CallRequest = await req.json()
    
    if (!data.customer_phone) {
      throw new Error('Customer phone number is required')
    }

    // Format phone number (ensure it starts with +)
    let phoneNumber = data.customer_phone.replace(/\D/g, '')
    if (!phoneNumber.startsWith('+')) {
      // Assume Israeli number if no country code
      if (phoneNumber.startsWith('0')) {
        phoneNumber = '+972' + phoneNumber.substring(1)
      } else if (!phoneNumber.startsWith('972')) {
        phoneNumber = '+972' + phoneNumber
      } else {
        phoneNumber = '+' + phoneNumber
      }
    }

    // Get Hebrew message
    const hebrewMessage = getHebrewMessage(data)

    // Create TwiML for the call with Hebrew TTS
    // Using Google's Hebrew voice (he-IL)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Google.he-IL-Wavenet-D" language="he-IL">${hebrewMessage}</Say>
  <Pause length="1"/>
  <Say voice="Google.he-IL-Wavenet-D" language="he-IL">תודה רבה. להתראות!</Say>
</Response>`

    // SignalWire API endpoint
    const signalwireUrl = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Calls.json`

    // Create base64 auth
    const auth = btoa(`${projectId}:${apiToken}`)

    // Get the webhook URL for status callbacks (our other Edge Function)
    const webhookUrl = `https://dbpkdibyecqnlwrmqwjr.supabase.co/functions/v1/signalwire-webhook`

    // Make the call using SignalWire REST API
    const formData = new URLSearchParams()
    formData.append('To', phoneNumber)
    formData.append('From', fromNumber)
    formData.append('Twiml', twiml)
    formData.append('StatusCallback', webhookUrl)
    formData.append('StatusCallbackEvent', 'initiated ringing answered completed')
    formData.append('StatusCallbackMethod', 'POST')

    const response = await fetch(signalwireUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('SignalWire error:', result)
      throw new Error(result.message || 'Failed to initiate call')
    }

    // Log the call to database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (supabaseUrl && supabaseKey) {
      await fetch(`${supabaseUrl}/rest/v1/phone_call_logs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          call_sid: result.sid,
          customer_phone: phoneNumber,
          customer_name: data.customer_name,
          book_title: data.book_title,
          order_id: data.order_id,
          message: hebrewMessage,
          status: 'initiated',
          created_at: new Date().toISOString(),
        }),
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        call_sid: result.sid,
        status: result.status,
        message: 'Call initiated successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
