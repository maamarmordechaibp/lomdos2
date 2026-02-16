# Supabase Edge Functions Setup for SignalWire Phone Calls

## Overview
This setup uses Supabase Edge Functions (free tier) to handle SignalWire phone calls to customers.
The phone calls speak Hebrew (male voice) to notify customers when their books (ספרי לימוד) arrive.

## Step 1: Add Secrets in Supabase Dashboard

Go to: https://supabase.com/dashboard/project/dbpkdibyecqnlwrmqwjr/settings/functions

Click "Add new secret" and add these 4 secrets:

| Name | Value |
|------|-------|
| `SIGNALWIRE_PROJECT_ID` | `0279ca68-442b-47a8-b0ba-1602dfa78fda` |
| `SIGNALWIRE_API_TOKEN` | `PT635ee48695e0c83874f12653c429cb50c859546f69d8b187` |
| `SIGNALWIRE_SPACE_URL` | `accuinfo.signalwire.com` |
| `SIGNALWIRE_FROM_NUMBER` | `+18456048845` |

## Step 2: Run Database Migration

Go to: https://supabase.com/dashboard/project/dbpkdibyecqnlwrmqwjr/sql/new

Copy and paste the contents of `supabase/migrations/001_phone_call_logs.sql` and run it.

## Step 3: Deploy Edge Functions

### Option A: Using Supabase CLI (Recommended)

```powershell
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
cd c:\Users\congt\Downloads\books
supabase link --project-ref dbpkdibyecqnlwrmqwjr

# Deploy the functions
supabase functions deploy call-customer
supabase functions deploy signalwire-webhook
```

### Option B: Manual Deploy via Dashboard

1. Go to: https://supabase.com/dashboard/project/dbpkdibyecqnlwrmqwjr/functions

2. Click "Create a new function"

3. **Function 1: call-customer**
   - Name: `call-customer`
   - Copy code from: `supabase/functions/call-customer/index.ts`

4. **Function 2: signalwire-webhook**
   - Name: `signalwire-webhook`
   - Copy code from: `supabase/functions/signalwire-webhook/index.ts`

## Step 4: Test the Integration

After deployment, test by calling the Edge Function:

```powershell
# Test call (replace phone number)
curl -X POST 'https://dbpkdibyecqnlwrmqwjr.supabase.co/functions/v1/call-customer' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRicGtkaWJ5ZWNxbmx3cm1xd2pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MDc3MzgsImV4cCI6MjA4NDA4MzczOH0.dAnpT_JJVv71Pjg2uZM2PSg8hjrVQubBa4u5V2sWDdA' \
  -H 'Content-Type: application/json' \
  -d '{
    "customer_name": "ישראל ישראלי",
    "customer_phone": "+972501234567",
    "book_title": "ספר הלימוד למתמטיקה",
    "message_type": "book_arrival"
  }'
```

## Architecture

```
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│   Django App    │────▶│  Supabase Edge Fn   │────▶│   SignalWire    │
│                 │     │  (call-customer)    │     │   Phone API     │
└─────────────────┘     └─────────────────────┘     └────────┬────────┘
                                │                            │
                                │                            ▼
                                │                    ┌───────────────┐
                                │                    │   Customer    │
                                ▼                    │   Phone 📞    │
                        ┌───────────────┐           └───────────────┘
                        │   Supabase    │
                        │   Database    │◀─────────────────┐
                        │ (call logs)   │    Status Webhook│
                        └───────────────┘                  │
                                                           │
                                                   ┌───────────────────┐
                                                   │ signalwire-webhook│
                                                   │   Edge Function   │
                                                   └───────────────────┘
```

## Hebrew TTS Message

The system uses Google's Hebrew Wavenet voice (`Google.he-IL-Wavenet-D`) which is a male voice.

Default message:
```
שלום [שם הלקוח]. זוהי הודעה מחנות הספרים. 
רצינו להודיע לך שהספר [שם הספר] הגיע ומוכן לאיסוף. 
נשמח לראותך. תודה ויום נפלא!
```

Translation:
```
Hello [customer name]. This is a message from the bookstore.
We wanted to let you know that the book [book title] has arrived and is ready for pickup.
We look forward to seeing you. Thank you and have a great day!
```

## Troubleshooting

### Call not going through
1. Check SignalWire dashboard for call logs
2. Verify the phone number format (should be +972XXXXXXXXX for Israel)
3. Check Supabase Edge Function logs

### View Logs
```powershell
supabase functions logs call-customer
supabase functions logs signalwire-webhook
```

Or view in dashboard: https://supabase.com/dashboard/project/dbpkdibyecqnlwrmqwjr/functions
