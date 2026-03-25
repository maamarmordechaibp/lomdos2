import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaymentRequest {
  orderId: string;
  amount: number;
  cardToken: string;
  cvvToken: string;
  expMonth: string;
  expYear: string;
  customerName?: string;
  customerEmail?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Sola API key from secure environment variable (NOT from database)
    const solaApiKey = Deno.env.get('SOLA_API_KEY');
    
    if (!solaApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sola API key not configured. Add SOLA_API_KEY secret in Supabase.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get store info for transaction metadata
    const { data: settings } = await supabase
      .from('global_settings')
      .select('sola_software_name, sola_software_version, store_name')
      .single();

    const body: PaymentRequest = await req.json();
    const { orderId, amount, cardToken, cvvToken, expMonth, expYear, customerName, customerEmail } = body;

    if (!orderId || !amount || !cardToken || !cvvToken || !expMonth || !expYear) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Process payment with Sola/Cardknox API
    const transactionData = {
      xKey: solaApiKey, // From secure environment variable
      xVersion: '5.0.0',
      xSoftwareName: settings?.sola_software_name || 'Shelf Sorcerer',
      xSoftwareVersion: settings?.sola_software_version || '1.0.0',
      xCommand: 'cc:sale',
      xAmount: amount.toFixed(2),
      xCardNum: cardToken,
      xCVV: cvvToken,
      xExp: `${expMonth}${expYear}`,
      xInvoice: orderId.substring(0, 20), // Use order ID as invoice (truncated)
      xBillFirstName: customerName?.split(' ')[0] || '',
      xBillLastName: customerName?.split(' ').slice(1).join(' ') || '',
      xEmail: customerEmail || '',
      xDescription: `Book order - ${settings.store_name || 'Bookstore'}`,
    };

    // Send to Sola gateway
    const response = await fetch('https://x1.cardknox.com/gatewayjson', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transactionData),
    });

    const result = await response.json();

    console.log('Sola payment response:', JSON.stringify(result, null, 2));

    // Check result
    // xResult: A = Approved, D = Declined, E = Error
    if (result.xResult === 'A') {
      // Payment approved - log the transaction
      await supabase.from('payment_logs').insert({
        order_id: orderId,
        amount: amount,
        payment_method: 'card',
        transaction_id: result.xRefNum,
        status: 'approved',
        response_data: result,
      }).catch(() => {
        // Table might not exist, that's ok
      });

      return new Response(
        JSON.stringify({
          success: true,
          transactionId: result.xRefNum,
          authCode: result.xAuthCode,
          message: result.xStatus,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Payment declined or error
      return new Response(
        JSON.stringify({
          success: false,
          error: result.xError || result.xStatus || 'Payment declined',
          errorCode: result.xErrorCode,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Payment processing error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
