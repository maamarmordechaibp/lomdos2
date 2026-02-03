import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to escape XML special characters
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Phone Payment Handler
 * 
 * This function handles phone-based payments:
 * 1. Looks up customer by phone number
 * 2. Announces their balance
 * 3. Offers to pay full or partial amount
 * 4. Collects card information
 * 5. Processes payment via Sola
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
    const callerNumber = url.searchParams.get("caller_number") || "";
    let customerId = url.searchParams.get("customer_id");
    const customerName = url.searchParams.get("customer_name") || "";
    const forwardNumber = url.searchParams.get("forward_number") || "";
    const callLogId = url.searchParams.get("call_log_id") || "";
    const step = url.searchParams.get("step") || "check_balance";
    const amount = url.searchParams.get("amount") || "";

    console.log(`Phone payment - Step: ${step}, Caller: ${callerNumber}, CustomerId: ${customerId}`);

    const baseUrl = supabaseUrl.replace('https://', '').split('.')[0];
    const functionBaseUrl = `https://${baseUrl}.supabase.co/functions/v1`;

    // Parse any digits entered
    let digitsPressed = "";
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      digitsPressed = formData.get("Digits")?.toString() || "";
      console.log(`Digits received: ${digitsPressed}`);
    }

    let twiml: string;

    // If no customer ID, look up by phone number
    if (!customerId && callerNumber) {
      const normalizedNumber = callerNumber.replace(/\D/g, '').slice(-10);
      
      const { data: customers } = await supabase
        .from("customers")
        .select("id, name, outstanding_balance, phone")
        .or(`phone.ilike.%${normalizedNumber}%`);
      
      if (customers && customers.length > 0) {
        customerId = customers[0].id;
      }
    }

    // Get customer balance
    let customerBalance = 0;
    let actualCustomerName = customerName;
    
    if (customerId) {
      const { data: customer } = await supabase
        .from("customers")
        .select("name, outstanding_balance")
        .eq("id", customerId)
        .single();
      
      if (customer) {
        customerBalance = customer.outstanding_balance || 0;
        actualCustomerName = customer.name;
      }
    }

    switch (step) {
      case "check_balance":
        // Announce balance and offer payment options
        if (!customerId || customerBalance <= 0) {
          // No customer found or no balance
          const mainMenuUrl = `${functionBaseUrl}/handle-incoming-call`;
          if (!customerId) {
            twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">We could not find your account. Please speak with a representative for assistance.</Say>
  <Pause length="1"/>
  <Redirect method="POST">${mainMenuUrl}</Redirect>
</Response>`;
          } else {
            twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Your current balance is zero dollars. You have no outstanding payments.</Say>
  <Pause length="1"/>
  <Redirect method="POST">${mainMenuUrl}</Redirect>
</Response>`;
          }
        } else {
          // Announce balance and offer options
          const balanceDollars = Math.floor(customerBalance);
          const balanceCents = Math.round((customerBalance - balanceDollars) * 100);
          const balanceText = balanceCents > 0 
            ? `${balanceDollars} dollars and ${balanceCents} cents`
            : `${balanceDollars} dollars`;
          
          const paymentOptionsUrl = `${functionBaseUrl}/phone-payment?caller_number=${encodeURIComponent(callerNumber)}&amp;customer_id=${customerId}&amp;customer_name=${encodeURIComponent(actualCustomerName)}&amp;forward_number=${encodeURIComponent(forwardNumber)}&amp;call_log_id=${callLogId}&amp;step=select_amount&amp;amount=${customerBalance}`;
          
          twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Hello ${escapeXml(actualCustomerName)}. Your current balance is ${balanceText}.</Say>
  <Pause length="1"/>
  <Gather input="dtmf" numDigits="1" action="${paymentOptionsUrl}" timeout="10">
    <Say voice="man" language="en-US">To pay the full amount, press 1.</Say>
    <Say voice="man" language="en-US">To enter a different amount, press 2.</Say>
    <Say voice="man" language="en-US">To return to the main menu, press 9.</Say>
  </Gather>
  <Say voice="man" language="en-US">We didn't receive your selection.</Say>
  <Redirect method="POST">${functionBaseUrl}/handle-incoming-call</Redirect>
</Response>`;
        }
        break;

      case "select_amount":
        if (digitsPressed === "1") {
          // Pay full amount - go to card entry
          const cardEntryUrl = `${functionBaseUrl}/phone-payment?caller_number=${encodeURIComponent(callerNumber)}&amp;customer_id=${customerId}&amp;customer_name=${encodeURIComponent(actualCustomerName)}&amp;forward_number=${encodeURIComponent(forwardNumber)}&amp;call_log_id=${callLogId}&amp;step=enter_card&amp;amount=${amount}`;
          
          twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect>${cardEntryUrl}</Redirect>
</Response>`;
        } else if (digitsPressed === "2") {
          // Enter custom amount
          const customAmountUrl = `${functionBaseUrl}/phone-payment?caller_number=${encodeURIComponent(callerNumber)}&amp;customer_id=${customerId}&amp;customer_name=${encodeURIComponent(actualCustomerName)}&amp;forward_number=${encodeURIComponent(forwardNumber)}&amp;call_log_id=${callLogId}&amp;step=custom_amount`;
          
          twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" numDigits="10" action="${customAmountUrl}" timeout="15" finishOnKey="#">
    <Say voice="man" language="en-US">Please enter the amount you wish to pay in cents, followed by the pound key.</Say>
    <Say voice="man" language="en-US">For example, for 25 dollars, enter 2 5 0 0, then press pound.</Say>
  </Gather>
  <Say voice="man" language="en-US">We didn't receive your entry.</Say>
  <Redirect method="POST">${functionBaseUrl}/handle-incoming-call</Redirect>
</Response>`;
        } else if (digitsPressed === "9") {
          twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect method="POST">${functionBaseUrl}/handle-incoming-call</Redirect>
</Response>`;
        } else {
          // Invalid, repeat
          const repeatUrl = `${functionBaseUrl}/phone-payment?caller_number=${encodeURIComponent(callerNumber)}&amp;customer_id=${customerId}&amp;customer_name=${encodeURIComponent(actualCustomerName)}&amp;forward_number=${encodeURIComponent(forwardNumber)}&amp;call_log_id=${callLogId}&amp;step=check_balance`;
          twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Invalid selection.</Say>
  <Redirect>${repeatUrl}</Redirect>
</Response>`;
        }
        break;

      case "custom_amount":
        // User entered custom amount in cents
        if (digitsPressed) {
          const customAmountCents = parseInt(digitsPressed);
          const customAmountDollars = customAmountCents / 100;
          
          if (customAmountCents > 0 && customAmountDollars <= customerBalance) {
            const cardEntryUrl = `${functionBaseUrl}/phone-payment?caller_number=${encodeURIComponent(callerNumber)}&amp;customer_id=${customerId}&amp;customer_name=${encodeURIComponent(actualCustomerName)}&amp;forward_number=${encodeURIComponent(forwardNumber)}&amp;call_log_id=${callLogId}&amp;step=enter_card&amp;amount=${customAmountDollars}`;
            
            const amountDollars = Math.floor(customAmountDollars);
            const amountCents = Math.round((customAmountDollars - amountDollars) * 100);
            const amountText = amountCents > 0 
              ? `${amountDollars} dollars and ${amountCents} cents`
              : `${amountDollars} dollars`;
            
            twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">You entered ${amountText}.</Say>
  <Redirect>${cardEntryUrl}</Redirect>
</Response>`;
          } else {
            const repeatUrl = `${functionBaseUrl}/phone-payment?caller_number=${encodeURIComponent(callerNumber)}&amp;customer_id=${customerId}&amp;customer_name=${encodeURIComponent(actualCustomerName)}&amp;forward_number=${encodeURIComponent(forwardNumber)}&amp;call_log_id=${callLogId}&amp;step=check_balance`;
            twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Invalid amount. Please try again.</Say>
  <Redirect>${repeatUrl}</Redirect>
</Response>`;
          }
        } else {
          const repeatUrl = `${functionBaseUrl}/phone-payment?caller_number=${encodeURIComponent(callerNumber)}&amp;customer_id=${customerId}&amp;customer_name=${encodeURIComponent(actualCustomerName)}&amp;forward_number=${encodeURIComponent(forwardNumber)}&amp;call_log_id=${callLogId}&amp;step=check_balance`;
          twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">We didn't receive your entry.</Say>
  <Redirect>${repeatUrl}</Redirect>
</Response>`;
        }
        break;

      case "enter_card":
        // Ask for card number
        const cardNumberUrl = `${functionBaseUrl}/phone-payment?caller_number=${encodeURIComponent(callerNumber)}&amp;customer_id=${customerId}&amp;customer_name=${encodeURIComponent(actualCustomerName)}&amp;forward_number=${encodeURIComponent(forwardNumber)}&amp;call_log_id=${callLogId}&amp;step=enter_expiry&amp;amount=${amount}`;
        
        const amountNum = parseFloat(amount);
        const amtDollars = Math.floor(amountNum);
        const amtCents = Math.round((amountNum - amtDollars) * 100);
        const amtText = amtCents > 0 
          ? `${amtDollars} dollars and ${amtCents} cents`
          : `${amtDollars} dollars`;
        
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">You are about to pay ${amtText}.</Say>
  <Gather input="dtmf" numDigits="19" action="${cardNumberUrl}" timeout="30" finishOnKey="#">
    <Say voice="man" language="en-US">Please enter your card number, followed by the pound key.</Say>
  </Gather>
  <Say voice="man" language="en-US">We didn't receive your card number.</Say>
  <Redirect method="POST">${functionBaseUrl}/handle-incoming-call</Redirect>
</Response>`;
        break;

      case "enter_expiry":
        // Save card number and ask for expiry
        const cardNumber = digitsPressed;
        console.log(`Card number received: ${cardNumber ? cardNumber.length + ' digits' : 'EMPTY'}`);
        
        // Validate card number (should be 13-19 digits for most cards)
        if (!cardNumber || cardNumber.length < 13) {
          const retryCardUrl = `${functionBaseUrl}/phone-payment?caller_number=${encodeURIComponent(callerNumber)}&amp;customer_id=${customerId}&amp;customer_name=${encodeURIComponent(actualCustomerName)}&amp;forward_number=${encodeURIComponent(forwardNumber)}&amp;call_log_id=${callLogId}&amp;step=enter_card&amp;amount=${amount}`;
          twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">The card number you entered appears to be invalid. Please try again.</Say>
  <Redirect>${retryCardUrl}</Redirect>
</Response>`;
          break;
        }
        
        const expiryUrl = `${functionBaseUrl}/phone-payment?caller_number=${encodeURIComponent(callerNumber)}&amp;customer_id=${customerId}&amp;customer_name=${encodeURIComponent(actualCustomerName)}&amp;forward_number=${encodeURIComponent(forwardNumber)}&amp;call_log_id=${callLogId}&amp;step=enter_cvv&amp;amount=${amount}&amp;card=${cardNumber}`;
        
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Card number received.</Say>
  <Gather input="dtmf" numDigits="4" action="${expiryUrl}" timeout="15" finishOnKey="#">
    <Say voice="man" language="en-US">Please enter the expiration date as 4 digits. Month then year. For example, 0 3 2 6 for March 2026. Then press pound.</Say>
  </Gather>
  <Say voice="man" language="en-US">We didn't receive your entry.</Say>
  <Redirect method="POST">${functionBaseUrl}/handle-incoming-call</Redirect>
</Response>`;
        break;

      case "enter_cvv":
        // Save expiry and ask for CVV
        const cardNum = url.searchParams.get("card") || "";
        const expiry = digitsPressed;
        console.log(`Expiry received: ${expiry}, Card length: ${cardNum.length}`);
        
        if (!expiry || expiry.length < 4) {
          const retryExpiryUrl = `${functionBaseUrl}/phone-payment?caller_number=${encodeURIComponent(callerNumber)}&amp;customer_id=${customerId}&amp;customer_name=${encodeURIComponent(actualCustomerName)}&amp;forward_number=${encodeURIComponent(forwardNumber)}&amp;call_log_id=${callLogId}&amp;step=enter_expiry&amp;amount=${amount}`;
          twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Invalid expiration date. Please try again.</Say>
  <Redirect>${retryExpiryUrl}</Redirect>
</Response>`;
          break;
        }
        
        const cvvUrl = `${functionBaseUrl}/phone-payment?caller_number=${encodeURIComponent(callerNumber)}&amp;customer_id=${customerId}&amp;customer_name=${encodeURIComponent(actualCustomerName)}&amp;forward_number=${encodeURIComponent(forwardNumber)}&amp;call_log_id=${callLogId}&amp;step=enter_zip&amp;amount=${amount}&amp;card=${cardNum}&amp;expiry=${expiry}`;
        
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Expiration date received.</Say>
  <Gather input="dtmf" numDigits="4" action="${cvvUrl}" timeout="15" finishOnKey="#">
    <Say voice="man" language="en-US">Please enter the 3 or 4 digit security code from the back of your card, followed by pound.</Say>
  </Gather>
  <Say voice="man" language="en-US">We didn't receive your entry.</Say>
  <Redirect method="POST">${functionBaseUrl}/handle-incoming-call</Redirect>
</Response>`;
        break;

      case "enter_zip":
        // Save CVV and ask for ZIP
        const card = url.searchParams.get("card") || "";
        const exp = url.searchParams.get("expiry") || "";
        const cvv = digitsPressed;
        console.log(`CVV received: ${cvv ? cvv.length + ' digits' : 'EMPTY'}, Card: ${card.length} digits, Expiry: ${exp}`);
        
        if (!cvv || cvv.length < 3 || cvv.length > 4) {
          const retryCvvUrl = `${functionBaseUrl}/phone-payment?caller_number=${encodeURIComponent(callerNumber)}&amp;customer_id=${customerId}&amp;customer_name=${encodeURIComponent(actualCustomerName)}&amp;forward_number=${encodeURIComponent(forwardNumber)}&amp;call_log_id=${callLogId}&amp;step=enter_cvv&amp;amount=${amount}&amp;card=${card}&amp;expiry=${exp}`;
          twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Invalid security code. Please try again.</Say>
  <Redirect>${retryCvvUrl}</Redirect>
</Response>`;
          break;
        }
        
        const processUrl = `${functionBaseUrl}/phone-payment?caller_number=${encodeURIComponent(callerNumber)}&amp;customer_id=${customerId}&amp;customer_name=${encodeURIComponent(actualCustomerName)}&amp;forward_number=${encodeURIComponent(forwardNumber)}&amp;call_log_id=${callLogId}&amp;step=process_payment&amp;amount=${amount}&amp;card=${card}&amp;expiry=${exp}&amp;cvv=${cvv}`;
        
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Security code received.</Say>
  <Gather input="dtmf" numDigits="5" action="${processUrl}" timeout="15" finishOnKey="#">
    <Say voice="man" language="en-US">Please enter your 5 digit billing zip code, followed by pound.</Say>
  </Gather>
  <Say voice="man" language="en-US">We didn't receive your entry.</Say>
  <Redirect method="POST">${functionBaseUrl}/handle-incoming-call</Redirect>
</Response>`;
        break;

      case "process_payment":
        // Process the payment
        const cardFinal = url.searchParams.get("card") || "";
        const expiryFinal = url.searchParams.get("expiry") || "";
        const cvvFinal = url.searchParams.get("cvv") || "";
        const zipFinal = digitsPressed;
        const paymentAmount = parseFloat(amount);
        
        console.log(`Processing payment: $${paymentAmount} for customer ${customerId}`);
        console.log(`Card: ${cardFinal.length} digits, Expiry: ${expiryFinal}, CVV: ${cvvFinal.length} digits, ZIP: ${zipFinal}`);
        
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Please wait while we process your payment.</Say>
  <Pause length="2"/>
  <Redirect>${functionBaseUrl}/phone-payment-process?customer_id=${customerId}&amp;amount=${paymentAmount}&amp;card=${cardFinal}&amp;expiry=${expiryFinal}&amp;cvv=${cvvFinal}&amp;zip=${zipFinal}&amp;caller_number=${encodeURIComponent(callerNumber)}&amp;forward_number=${encodeURIComponent(forwardNumber)}&amp;call_log_id=${callLogId}</Redirect>
</Response>`;
        break;

      default:
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">An error occurred. Please try again.</Say>
  <Redirect method="POST">${functionBaseUrl}/handle-incoming-call</Redirect>
</Response>`;
    }

    return new Response(twiml, {
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  } catch (error) {
    console.error("Error in phone payment:", error);
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const baseUrl = supabaseUrl.replace('https://', '').split('.')[0];
    const functionBaseUrl = `https://${baseUrl}.supabase.co/functions/v1`;
    
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">Sorry, there was an error processing your request. Please try again later.</Say>
  <Redirect method="POST">${functionBaseUrl}/handle-incoming-call</Redirect>
</Response>`;
    
    return new Response(errorTwiml, {
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  }
});
