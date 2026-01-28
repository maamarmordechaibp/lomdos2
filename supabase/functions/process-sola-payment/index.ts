import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaymentRequest {
  amount: number;
  cardNumber: string;
  cardExpiry: string; // MMYY format
  cardCvv: string;
  cardZip?: string;
  orderId?: string;
  customerId?: string;
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

    // Get Sola API key from secure environment variable
    const solaApiKey = Deno.env.get('SOLA_API_KEY');
    
    if (!solaApiKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Payment gateway not configured. Please add SOLA_API_KEY in Supabase Edge Function secrets.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get store info for transaction metadata
    const { data: settings } = await supabase
      .from('global_settings')
      .select('sola_software_name, sola_software_version, store_name')
      .single();

    const body: PaymentRequest = await req.json();
    const { amount, cardNumber, cardExpiry, cardCvv, cardZip, orderId, customerId, customerName, customerEmail } = body;

    // Validate required fields
    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid amount' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    if (!cardNumber || cardNumber.length < 15) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid card number' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    if (!cardExpiry || cardExpiry.length < 4) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid expiry date' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    if (!cardCvv || cardCvv.length < 3) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid CVV' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Format expiry: convert MMYY to the format expected by Cardknox
    const expFormatted = cardExpiry.length === 4 ? cardExpiry : cardExpiry.replace('/', '');

    // Build transaction data for Cardknox
    const transactionData: Record<string, string> = {
      xKey: solaApiKey,
      xVersion: '5.0.0',
      xSoftwareName: settings?.sola_software_name || 'Shelf Sorcerer POS',
      xSoftwareVersion: settings?.sola_software_version || '1.0.0',
      xCommand: 'cc:sale',
      xAmount: amount.toFixed(2),
      xCardNum: cardNumber,
      xCVV: cardCvv,
      xExp: expFormatted,
      xDescription: `POS Sale - ${settings?.store_name || 'Bookstore'}`,
    };

    // Add optional fields
    if (orderId) {
      transactionData.xInvoice = orderId.substring(0, 20);
    }
    if (cardZip) {
      transactionData.xZip = cardZip;
    }
    if (customerName) {
      const names = customerName.split(' ');
      transactionData.xBillFirstName = names[0] || '';
      transactionData.xBillLastName = names.slice(1).join(' ') || '';
    }
    if (customerEmail) {
      transactionData.xEmail = customerEmail;
    }
    if (customerId) {
      transactionData.xCustom01 = customerId;
    }

    console.log('Processing payment for amount:', amount);

    // Send to Cardknox gateway
    const response = await fetch('https://x1.cardknox.com/gatewayjson', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transactionData),
    });

    const result = await response.json();

    console.log('Cardknox response status:', result.xResult);

    // Check result
    // xResult: A = Approved, D = Declined, E = Error
    if (result.xResult === 'A') {
      // Payment approved
      console.log('Payment approved, transaction ID:', result.xRefNum);
      
      // Record the payment in database if customerId is provided
      if (customerId) {
        try {
          // Insert payment record
          const { error: paymentError } = await supabase
            .from('customer_payments')
            .insert({
              customer_id: customerId,
              order_id: orderId || null,
              amount: amount,
              payment_method: 'card',
              payment_type: 'balance',
              transaction_id: result.xRefNum,
              notes: `Card payment - Ref: ${result.xRefNum}`,
            });
          
          if (paymentError) {
            console.error('Failed to record payment:', paymentError);
          } else {
            // Update customer balance
            const { data: customer } = await supabase
              .from('customers')
              .select('outstanding_balance')
              .eq('id', customerId)
              .single();
            
            if (customer) {
              const newBalance = Math.max(0, (customer.outstanding_balance || 0) - amount);
              await supabase
                .from('customers')
                .update({ outstanding_balance: newBalance })
                .eq('id', customerId);
            }
          }
        } catch (dbError) {
          console.error('Database error:', dbError);
          // Don't fail the response - payment was already processed
        }
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          transactionId: result.xRefNum,
          authCode: result.xAuthCode,
          message: 'Payment approved',
          maskedCard: result.xMaskedCardNumber,
          recorded: !!customerId,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (result.xResult === 'D') {
      // Payment declined
      console.log('Payment declined:', result.xError);
      
      return new Response(
        JSON.stringify({
          success: false,
          message: result.xError || 'Card declined',
          errorCode: result.xErrorCode,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Error
      console.log('Payment error:', result.xError);
      
      return new Response(
        JSON.stringify({
          success: false,
          message: result.xError || 'Payment processing error',
          errorCode: result.xErrorCode,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Payment processing error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
