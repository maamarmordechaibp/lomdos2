import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Process phone payment via Sola
 * 
 * This function:
 * 1. Processes the card payment through Sola
 * 2. If approved: records the payment, updates customer balance, announces confirmation
 * 3. If declined: offers to retry with a different card
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
    const customerId = url.searchParams.get("customer_id") || "";
    const amount = parseFloat(url.searchParams.get("amount") || "0");
    const cardNumber = url.searchParams.get("card") || "";
    const expiry = url.searchParams.get("expiry") || "";
    const cvv = url.searchParams.get("cvv") || "";
    const zip = url.searchParams.get("zip") || "";
    const callerNumber = url.searchParams.get("caller_number") || "";
    const forwardNumber = url.searchParams.get("forward_number") || "";
    const callLogId = url.searchParams.get("call_log_id") || "";
    const retry = url.searchParams.get("retry") === "true";

    // Parse any digits pressed (for retry flow)
    let digitsPressed = "";
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      digitsPressed = formData.get("Digits")?.toString() || "";
    }

    console.log(`Processing payment: $${amount} for customer ${customerId}`);

    const baseUrl = supabaseUrl.replace('https://', '').split('.')[0];
    const functionBaseUrl = `https://${baseUrl}.supabase.co/functions/v1`;

    let twiml: string;

    // If this is a retry decision
    if (retry) {
      if (digitsPressed === "1") {
        // Retry with new card
        const paymentUrl = `${functionBaseUrl}/phone-payment?caller_number=${encodeURIComponent(callerNumber)}&amp;customer_id=${customerId}&amp;forward_number=${encodeURIComponent(forwardNumber)}&amp;call_log_id=${callLogId}&amp;step=enter_card&amp;amount=${amount}`;
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect>${paymentUrl}</Redirect>
</Response>`;
        return new Response(twiml, {
          headers: { ...corsHeaders, "Content-Type": "application/xml" },
        });
      } else {
        // Return to main menu
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Returning to main menu.</Say>
  <Redirect method="POST">${functionBaseUrl}/handle-incoming-call</Redirect>
</Response>`;
        return new Response(twiml, {
          headers: { ...corsHeaders, "Content-Type": "application/xml" },
        });
      }
    }

    // Process payment via Sola
    try {
      const { data: paymentResult, error: paymentError } = await supabase.functions.invoke('process-sola-payment', {
        body: {
          amount: amount,
          cardNumber: cardNumber,
          cardExpiry: expiry,
          cardCvv: cvv,
          cardZip: zip,
          customerId: customerId,
        }
      });

      if (paymentError) {
        throw paymentError;
      }

      if (paymentResult?.success) {
        // Payment approved!
        const transactionId = paymentResult.transactionId || `TXN${Date.now()}`;
        
        // Record the payment
        await supabase.from('customer_payments').insert({
          customer_id: customerId,
          amount: amount,
          payment_method: 'card',
          transaction_id: transactionId,
          notes: 'Phone payment via IVR',
        });

        // Update customer outstanding balance
        const { data: customer } = await supabase
          .from("customers")
          .select("outstanding_balance")
          .eq("id", customerId)
          .single();
        
        const currentBalance = customer?.outstanding_balance || 0;
        const newBalance = Math.max(0, currentBalance - amount);
        
        await supabase
          .from("customers")
          .update({ outstanding_balance: newBalance })
          .eq("id", customerId);

        console.log(`Payment approved! Transaction: ${transactionId}, New balance: ${newBalance}`);

        // Announce success
        const confirmationNumber = transactionId.slice(-8);
        
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Your payment of ${formatAmount(amount)} has been approved!</Say>
  <Pause length="1"/>
  <Say voice="man" language="en-US">Your confirmation number is ${confirmationNumber.split('').join(' ')}.</Say>
  <Pause length="1"/>
  <Say voice="man" language="en-US">I repeat, ${confirmationNumber.split('').join(' ')}.</Say>
  <Pause length="1"/>
  <Say voice="man" language="en-US">Your new balance is ${formatAmount(newBalance)}.</Say>
  <Pause length="1"/>
  <Say voice="man" language="en-US">Thank you for your payment. Goodbye!</Say>
</Response>`;
      } else {
        // Payment declined
        const declineReason = paymentResult?.message || "Card declined";
        console.log(`Payment declined: ${declineReason}`);
        
        const retryUrl = `${functionBaseUrl}/phone-payment-process?customer_id=${customerId}&amp;amount=${amount}&amp;caller_number=${encodeURIComponent(callerNumber)}&amp;forward_number=${encodeURIComponent(forwardNumber)}&amp;call_log_id=${callLogId}&amp;retry=true`;
        
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">We're sorry, your card was declined.</Say>
  <Pause length="1"/>
  <Gather numDigits="1" action="${retryUrl}" timeout="10">
    <Say voice="man" language="en-US">To try a different card, press 1.</Say>
    <Say voice="man" language="en-US">To return to the main menu, press 2.</Say>
  </Gather>
  <Say voice="man" language="en-US">Returning to main menu.</Say>
  <Redirect method="POST">${functionBaseUrl}/handle-incoming-call</Redirect>
</Response>`;
      }
    } catch (error) {
      console.error("Payment processing error:", error);
      
      const retryUrl = `${functionBaseUrl}/phone-payment-process?customer_id=${customerId}&amp;amount=${amount}&amp;caller_number=${encodeURIComponent(callerNumber)}&amp;forward_number=${encodeURIComponent(forwardNumber)}&amp;call_log_id=${callLogId}&amp;retry=true`;
      
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">We encountered an error processing your payment.</Say>
  <Pause length="1"/>
  <Gather numDigits="1" action="${retryUrl}" timeout="10">
    <Say voice="man" language="en-US">To try again, press 1.</Say>
    <Say voice="man" language="en-US">To return to the main menu, press 2.</Say>
  </Gather>
  <Redirect method="POST">${functionBaseUrl}/handle-incoming-call</Redirect>
</Response>`;
    }

    return new Response(twiml, {
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  } catch (error) {
    console.error("Error in phone payment process:", error);
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const baseUrl = supabaseUrl.replace('https://', '').split('.')[0];
    const functionBaseUrl = `https://${baseUrl}.supabase.co/functions/v1`;
    
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Sorry, there was an error processing your payment. Please try again later or speak with a representative.</Say>
  <Redirect method="POST">${functionBaseUrl}/handle-incoming-call</Redirect>
</Response>`;
    
    return new Response(errorTwiml, {
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  }
});

function formatAmount(amount: number): string {
  const dollars = Math.floor(amount);
  const cents = Math.round((amount - dollars) * 100);
  
  if (cents > 0) {
    return `${dollars} dollars and ${cents} cents`;
  }
  return `${dollars} dollars`;
}
