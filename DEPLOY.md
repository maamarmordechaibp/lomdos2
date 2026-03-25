# Deployment Guide for Shelf Sorcerer Suite

## Prerequisites
1. Disable Geder content filter temporarily (it's blocking api.supabase.com)
2. Have your Supabase access token ready (from https://supabase.com/dashboard/account/tokens)

## Step 1: Login to Supabase CLI
```bash
npx supabase login
```
When prompted, enter your access token.

## Step 2: Link to your project
```bash
npx supabase link --project-ref dbpkdibyecqnlwrmqwjr
```

## Step 3: Run Database Migrations
You can either run migrations via CLI or via Supabase Dashboard SQL Editor.

### Option A: Via CLI
```bash
npx supabase db push
```

### Option B: Via SQL Editor (if CLI doesn't work)
Go to https://supabase.com/dashboard/project/dbpkdibyecqnlwrmqwjr/sql/new

Copy and paste the contents of:
1. `supabase/migrations/20260119160110_6cc89f27-5889-4c02-bc3d-a0aae9b2a0d3.sql`
2. `supabase/migrations/20260119170000_notification_logs.sql`

## Step 4: Deploy Edge Functions

### Deploy notify-customer function
```bash
npx supabase functions deploy notify-customer
```

### Deploy email-supplier function
```bash
npx supabase functions deploy email-supplier
```

## Step 5: Set Environment Secrets

### Resend API Key (for emails)
```bash
npx supabase secrets set RESEND_API_KEY=re_VzHEBiA5_651zgdXp1sz1ibTkVejHs5fM
```

### SignalWire Credentials (for phone calls & SMS)
```bash
npx supabase secrets set SIGNALWIRE_SPACE_URL=accuinfo.signalwire.com
npx supabase secrets set SIGNALWIRE_PROJECT_ID=0279ca68-442b-47a8-b0ba-1602dfa78fda
npx supabase secrets set SIGNALWIRE_API_TOKEN=PT635ee48695e0c83874f12653c429cb50c859546f69d8b187
npx supabase secrets set SIGNALWIRE_FROM_NUMBER=+18456048845
```

## Step 6: Verify Deployment

### Check functions are deployed
```bash
npx supabase functions list
```

### Check secrets are set
```bash
npx supabase secrets list
```

---

## Manual Deployment via Supabase Dashboard

If CLI doesn't work, you can deploy Edge Functions manually:

1. Go to https://supabase.com/dashboard/project/dbpkdibyecqnlwrmqwjr/functions
2. Click "Create a new function"
3. Name it `notify-customer`
4. Copy the code from `supabase/functions/notify-customer/index.ts`
5. Repeat for `email-supplier`

### Set Secrets via Dashboard
1. Go to Edge Functions page
2. Click "Manage secrets" 
3. Add each secret manually

---

## Summary of What Gets Deployed

### Edge Functions
| Function | Purpose |
|----------|---------|
| `notify-customer` | Send phone calls, SMS, or emails to customers |
| `email-supplier` | Send order emails to suppliers |
| `handle-incoming-call` | Handle incoming calls, lookup customer, forward to cell |
| `call-whisper` | Announce caller name, require press 1 to accept |
| `call-status` | Update call log when call completes |
| `click-to-call` | Initiate outbound call from app |
| `click-to-call-connect` | Connect outbound call to customer |

### Database Tables (via migrations)
| Table | Purpose |
|-------|---------|
| `books` | Book catalog with cover images and subcategories |
| `suppliers` | Supplier information |
| `customers` | Customer information with notification preferences |
| `customer_orders` | Orders from customers |
| `supplier_orders` | Orders sent to suppliers |
| `supplier_order_items` | Individual items in supplier orders |
| `returns` | Book returns to suppliers |
| `notification_logs` | Track all notifications sent |
| `call_logs` | Track all incoming and outgoing calls |
| `settings` | App settings |

### Environment Secrets
| Secret | Purpose |
|--------|---------|
| `RESEND_API_KEY` | For sending emails via Resend |
| `SIGNALWIRE_SPACE_URL` | SignalWire space URL |
| `SIGNALWIRE_PROJECT_ID` | SignalWire project ID |
| `SIGNALWIRE_API_TOKEN` | SignalWire API token |
| `SIGNALWIRE_FROM_NUMBER` | Phone number to call/text from |

### SignalWire Webhook Setup
To receive incoming calls with caller ID lookup:
1. Go to your SignalWire Dashboard → Phone Numbers
2. Edit your phone number's settings
3. Set "When a call comes in" webhook to:
   `https://YOUR-PROJECT.supabase.co/functions/v1/handle-incoming-call`
4. Save the settings
