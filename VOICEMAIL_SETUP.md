# Voicemail Forwarding Setup for SignalWire

## Overview
This guide explains how to configure call forwarding to voicemail (Google Voice or similar) after a certain number of rings when customers call back.

## Option 1: SignalWire Call Forwarding with Timeout (Recommended)

### Step 1: Configure SignalWire Number
1. Log into SignalWire Dashboard: https://accuinfo.signalwire.com
2. Navigate to Phone Numbers
3. Select your number: `+18456048845`
4. Configure Call Forwarding:
   - **Forward To**: Your Google Voice number or desired voicemail service
   - **Ring Timeout**: 20 seconds (approximately 4-5 rings)
   - **If No Answer**: Forward to voicemail

### Step 2: Using LaML (SignalWire's Markup Language)
Create a more sophisticated forwarding flow using LaML:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <!-- Ring your number for 20 seconds (about 4-5 rings) -->
    <Dial timeout="20" action="https://dbpkdibyecqnlwrmqwjr.supabase.co/functions/v1/call-forwarding-status">
        <Number>YOUR_PHONE_NUMBER</Number>
    </Dial>
    
    <!-- If not answered, forward to voicemail -->
    <Dial>
        <Number>YOUR_GOOGLE_VOICE_NUMBER</Number>
    </Dial>
    
    <!-- Fallback message -->
    <Say language="he-IL" voice="Polly.Matan">
        סליחה, אף אחד לא זמין כרגע. אנא השאר הודעה.
    </Say>
    <Record maxLength="120" transcribe="true" transcribeCallback="https://dbpkdibyecqnlwrmqwjr.supabase.co/functions/v1/voicemail-transcription"/>
</Response>
```

### Step 3: Create Call Forwarding Webhook Handler

Create a new Supabase Edge Function for handling call forwarding status:

```typescript
// supabase/functions/call-forwarding-status/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  try {
    const formData = await req.formData()
    const dialCallStatus = formData.get('DialCallStatus') as string
    
    // If call wasn't answered, return LaML to forward to voicemail
    if (dialCallStatus === 'no-answer' || dialCallStatus === 'busy') {
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Dial>
            <Number>YOUR_GOOGLE_VOICE_NUMBER</Number>
          </Dial>
          <Say language="he-IL" voice="Polly.Matan">
            סליחה, אף אחד לא זמין כרגע. אנא השאר הודעה.
          </Say>
          <Record maxLength="120" transcribe="true"/>
        </Response>`,
        { headers: { 'Content-Type': 'application/xml' } }
      )
    }
    
    // Call was answered, no action needed
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { 'Content-Type': 'application/xml' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>',
      { headers: { 'Content-Type': 'application/xml' } }
    )
  }
})
```

## Option 2: Google Voice Integration

### Step 1: Set Up Google Voice
1. Create a Google Voice number at: https://voice.google.com
2. Configure voicemail settings:
   - Record a greeting in Hebrew
   - Enable voicemail transcription
   - Set email notifications for new voicemails

### Step 2: Forward SignalWire to Google Voice
In SignalWire dashboard:
1. Set primary forward number to your phone
2. Set secondary forward (on no answer) to Google Voice number
3. Configure timeout: 20 seconds

## Option 3: Built-in SignalWire Voicemail

### Configure Voicemail in Code
Update the call-customer function to include voicemail handling:

```typescript
// Add to call-customer/index.ts

const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="he-IL" voice="Polly.Matan">
        שלום, הספרים שלך הגיעו!
    </Say>
    <Gather action="${WEBHOOK_URL}" numDigits="1" timeout="5">
        <Say language="he-IL" voice="Polly.Matan">
            לדבר עם נציג, לחץ 1
        </Say>
    </Gather>
    
    <!-- User pressed 1, connect to you -->
    <Dial timeout="20" action="${WEBHOOK_URL}/forwarding-status">
        <Number>YOUR_PHONE_NUMBER</Number>
    </Dial>
    
    <!-- If no answer, offer voicemail -->
    <Say language="he-IL" voice="Polly.Matan">
        סליחה, אנחנו לא זמינים כרגע. אנא השאר הודעה.
    </Say>
    <Record maxLength="180" transcribe="true" playBeep="true"/>
    <Say language="he-IL" voice="Polly.Matan">
        תודה רבה. נחזור אליך בהקדם.
    </Say>
</Response>`
```

## Configuration Steps Summary

### Quick Setup (5 minutes):
1. Log into SignalWire Dashboard
2. Go to Phone Numbers → Select `+18456048845`
3. Under "Voice Settings":
   - Handler: LaML Webhooks
   - When a call comes in: `https://dbpkdibyecqnlwrmqwjr.supabase.co/functions/v1/call-customer-incoming`
4. Under "Call Forwarding":
   - Forward to: Your phone number
   - Ring timeout: 20 seconds
   - If busy/no answer: Your Google Voice number

### Environment Variables to Add

Add these to Supabase Edge Function secrets:

```bash
# Your phone number to forward to
FORWARDING_PHONE_NUMBER="+1234567890"

# Google Voice or voicemail number
VOICEMAIL_NUMBER="+1234567890"

# Ring timeout in seconds (default: 20)
RING_TIMEOUT="20"
```

## Testing

1. Call `+18456048845` from a different number
2. Don't answer for 20 seconds
3. Verify call forwards to voicemail
4. Leave a test voicemail
5. Check if voicemail is received in Google Voice or SignalWire inbox

## Monitoring

- View call logs in SignalWire Dashboard
- Check `phone_call_logs` table in Supabase for call statuses
- Review voicemail transcriptions in SignalWire or Google Voice

## Troubleshooting

**Issue**: Calls don't forward to voicemail
- Check SignalWire number configuration
- Verify forwarding number is correct
- Check timeout is set (minimum 15 seconds)

**Issue**: Voicemail doesn't record
- Ensure Record tag has proper permissions
- Check maxLength is sufficient (120-180 seconds)
- Verify transcription callback URL is correct

**Issue**: Can't hear voicemail messages
- Check SignalWire inbox for recordings
- Verify Google Voice notifications are enabled
- Check email for transcription notifications

## Next Steps

1. Deploy the call-forwarding-status function to Supabase
2. Update SignalWire number configuration
3. Test the forwarding flow
4. Configure voicemail greeting in Hebrew
5. Set up email notifications for new voicemails

---

**Note**: This configuration allows customers to:
1. Call your business number
2. Ring your phone for ~20 seconds (4-5 rings)
3. Automatically forward to voicemail if unanswered
4. Leave a message that you can retrieve later
5. Receive transcriptions via email (if enabled)
