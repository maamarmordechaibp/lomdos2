import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyRequest {
  // Order notification fields
  customer_id?: string;
  customer_order_id?: string;
  notification_type?: "order_ready" | "order_received" | "custom" | "payment_reminder";
  custom_message?: string;
  // Balance reminder fields (alternative format)
  customerId?: string;
  type?: string;
  method?: 'phone' | 'sms' | 'email';
  phone?: string;
  customerName?: string;
  message?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Get SignalWire credentials from environment (set via Supabase secrets)
    const signalwireSpaceUrl = Deno.env.get("SIGNALWIRE_SPACE_URL");
    const signalwireProjectId = Deno.env.get("SIGNALWIRE_PROJECT_ID");
    const signalwireApiToken = Deno.env.get("SIGNALWIRE_API_TOKEN");
    const signalwireFromNumber = Deno.env.get("SIGNALWIRE_FROM_NUMBER");
    
    // Get Resend API key for emails
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: NotifyRequest = await req.json();
    
    // Handle balance reminder format (customerId, type, method, phone, message)
    if (body.type === 'payment_reminder' || body.customerId) {
      const customerId = body.customerId || body.customer_id;
      const phone = body.phone;
      const message = body.message;
      const method = body.method || 'phone';
      
      if (!customerId) {
        throw new Error("Customer ID is required");
      }
      if (!message) {
        throw new Error("Message is required");
      }
      
      // Format phone number
      let formattedPhone = phone?.replace(/\D/g, '') || '';
      if (formattedPhone && !formattedPhone.startsWith('1') && formattedPhone.length === 10) {
        formattedPhone = '1' + formattedPhone;
      }
      if (formattedPhone && !formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }
      
      if (!formattedPhone) {
        throw new Error("Valid phone number is required");
      }
      
      if (!signalwireSpaceUrl || !signalwireProjectId || !signalwireApiToken || !signalwireFromNumber) {
        throw new Error("SignalWire not configured. Add SIGNALWIRE_* secrets in Supabase.");
      }
      
      console.log(`Sending ${method} reminder to ${formattedPhone}`);
      
      let result: any = null;
      if (method === 'phone') {
        result = await makePhoneCall({
          signalwireSpaceUrl,
          signalwireProjectId,
          signalwireApiToken,
          fromNumber: signalwireFromNumber,
          toNumber: formattedPhone,
          message,
        });
      } else {
        result = await sendSMS({
          signalwireSpaceUrl,
          signalwireProjectId,
          signalwireApiToken,
          fromNumber: signalwireFromNumber,
          toNumber: formattedPhone,
          message,
        });
      }
      
      console.log("Result:", JSON.stringify(result));
      
      return new Response(
        JSON.stringify({ success: true, result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Original order notification flow
    const { customer_id, customer_order_id, notification_type, custom_message } = body;

    // Get store settings
    const { data: settings, error: settingsError } = await supabase
      .from("global_settings")
      .select("*")
      .single();
    
    const storeName = settings?.store_name || "New Square Bookstore";

    // Get customer details
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customer_id)
      .single();

    if (customerError || !customer) {
      throw new Error("Customer not found");
    }

    // Get order details with book info
    const { data: order, error: orderError } = await supabase
      .from("customer_orders")
      .select("*, book:books(*)")
      .eq("id", customer_order_id)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found");
    }

    // Generate message based on notification type
    let message = custom_message || "";
    const bookTitle = order.book?.title || "your book";
    const finalPrice = order.final_price || 0;
    const depositAmount = order.deposit_amount || 0;
    const balanceDue = finalPrice - depositAmount;

    switch (notification_type) {
      case "order_ready":
        // Build detailed message for phone/sms
        let priceMessage = `The total price is $${finalPrice.toFixed(2)}.`;
        if (depositAmount > 0) {
          priceMessage = `Your remaining balance is $${balanceDue.toFixed(2)}.`;
        }
        message = message || `This is a call from ${storeName}. Hello ${customer.name}. Your book, ${bookTitle}, is ready for pickup. ${priceMessage} Please bring the exact amount. Thank you for your business!`;
        break;
      case "order_received":
        message = message || `This is a call from ${storeName}. Hello ${customer.name}. We've received "${bookTitle}" and it's being processed. We'll notify you when it's ready for pickup.`;
        break;
      case "custom":
        if (!message) throw new Error("Custom message is required for custom notification type");
        break;
    }

    let result: any = null;

    // Format phone number to E.164 format (e.g., +1234567890)
    let formattedPhone = customer.phone?.replace(/\D/g, '') || '';
    if (formattedPhone && !formattedPhone.startsWith('1') && formattedPhone.length === 10) {
      formattedPhone = '1' + formattedPhone; // Add US country code
    }
    if (formattedPhone && !formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }

    console.log(`Notification request: type=${notification_type}, method=${customer.notification_preference}, phone=${formattedPhone}, email=${customer.email}`);

    // Validate SignalWire credentials for phone/sms
    if ((customer.notification_preference === "phone" || customer.notification_preference === "sms") && 
        (!signalwireSpaceUrl || !signalwireProjectId || !signalwireApiToken || !signalwireFromNumber)) {
      throw new Error("SignalWire not configured. Add SIGNALWIRE_* secrets in Supabase.");
    }

    // Send notification based on customer preference
    if (customer.notification_preference === "phone") {
      if (!formattedPhone) {
        throw new Error("Customer does not have a valid phone number");
      }
      
      // Pre-create pending message record (will be deleted if call is answered)
      const { data: pendingMessage } = await supabase
        .from("pending_messages")
        .insert({
          customer_id: customer_id,
          phone_number: formattedPhone,
          message: message,
          notification_type: notification_type,
          customer_order_id: customer_order_id || null,
        })
        .select()
        .single();
      
      // Build status callback URL to handle no-answer scenarios
      const baseUrl = supabaseUrl.replace('https://', '').split('.')[0];
      const functionBaseUrl = `https://${baseUrl}.supabase.co/functions/v1`;
      const statusCallbackUrl = pendingMessage 
        ? `${functionBaseUrl}/notification-status?pending_message_id=${pendingMessage.id}`
        : undefined;
      
      // Make phone call using SignalWire
      console.log(`Making phone call to ${formattedPhone}`);
      result = await makePhoneCall({
        signalwireSpaceUrl: signalwireSpaceUrl!,
        signalwireProjectId: signalwireProjectId!,
        signalwireApiToken: signalwireApiToken!,
        fromNumber: signalwireFromNumber!,
        toNumber: formattedPhone,
        message,
        statusCallbackUrl,
      });
      
      // Update pending message with call SID for tracking
      if (pendingMessage && result?.sid) {
        await supabase
          .from("pending_messages")
          .update({ call_sid: result.sid })
          .eq("id", pendingMessage.id);
      }
      
      console.log("Phone call result:", JSON.stringify(result));
    } else if (customer.notification_preference === "sms") {
      if (!formattedPhone) {
        throw new Error("Customer does not have a valid phone number");
      }
      // Send SMS using SignalWire
      console.log(`Sending SMS to ${formattedPhone}`);
      result = await sendSMS({
        signalwireSpaceUrl: signalwireSpaceUrl!,
        signalwireProjectId: signalwireProjectId!,
        signalwireApiToken: signalwireApiToken!,
        fromNumber: signalwireFromNumber!,
        toNumber: formattedPhone,
        message,
      });
      console.log("SMS result:", JSON.stringify(result));
    } else if (customer.notification_preference === "email") {
      // Send email using Resend
      if (!customer.email) {
        throw new Error("Customer does not have an email address");
      }
      if (!resendApiKey) {
        throw new Error("Resend API key not configured. Add RESEND_API_KEY secret in Supabase.");
      }
      console.log(`Sending email to ${customer.email}`);
      result = await sendEmail({
        resendApiKey,
        to: customer.email,
        subject: getEmailSubject(notification_type!, bookTitle),
        message,
        customerName: customer.name,
      });
      console.log("Email result:", JSON.stringify(result));
    } else {
      throw new Error(`Unknown notification preference: ${customer.notification_preference}`);
    }

    // Log the notification
    await supabase.from("notification_logs").insert({
      customer_id,
      customer_order_id,
      notification_type,
      notification_method: customer.notification_preference,
      message,
      status: result?.id || result?.sid ? "sent" : "failed",
      response: result,
    }).catch(() => {}); // Don't fail if logging fails

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getEmailSubject(notificationType: string, bookTitle: string): string {
  switch (notificationType) {
    case "order_ready":
      return `Your order is ready for pickup - ${bookTitle}`;
    case "order_received":
      return `Order received - ${bookTitle}`;
    case "custom":
      return "Message from New Square Bookstore";
    default:
      return "Notification from New Square Bookstore";
  }
}

async function makePhoneCall({
  signalwireSpaceUrl,
  signalwireProjectId,
  signalwireApiToken,
  fromNumber,
  toNumber,
  message,
  statusCallbackUrl,
}: {
  signalwireSpaceUrl: string;
  signalwireProjectId: string;
  signalwireApiToken: string;
  fromNumber: string;
  toNumber: string;
  message: string;
  statusCallbackUrl?: string;
}) {
  // Create TwiML for text-to-speech with male voice (man)
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man" language="en-US">${escapeXml(message)}</Say>
  <Pause length="2"/>
  <Say voice="man" language="en-US">Goodbye!</Say>
</Response>`;

  const url = `https://${signalwireSpaceUrl}/api/laml/2010-04-01/Accounts/${signalwireProjectId}/Calls.json`;
  
  const auth = btoa(`${signalwireProjectId}:${signalwireApiToken}`);
  
  const bodyParams: Record<string, string> = {
    From: fromNumber,
    To: toNumber,
    Twiml: twiml,
  };
  
  // Add status callback if provided (for tracking no-answer to save pending message)
  if (statusCallbackUrl) {
    bodyParams.StatusCallback = statusCallbackUrl;
    bodyParams.StatusCallbackEvent = 'completed';
  }
  
  const body = new URLSearchParams(bodyParams);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const result = await response.json();
  
  if (!response.ok) {
    console.error("SignalWire call error:", result);
    throw new Error(result.message || "Failed to make phone call");
  }

  return result;
}

async function sendSMS({
  signalwireSpaceUrl,
  signalwireProjectId,
  signalwireApiToken,
  fromNumber,
  toNumber,
  message,
}: {
  signalwireSpaceUrl: string;
  signalwireProjectId: string;
  signalwireApiToken: string;
  fromNumber: string;
  toNumber: string;
  message: string;
}) {
  const url = `https://${signalwireSpaceUrl}/api/laml/2010-04-01/Accounts/${signalwireProjectId}/Messages.json`;
  
  const auth = btoa(`${signalwireProjectId}:${signalwireApiToken}`);
  
  const body = new URLSearchParams({
    From: fromNumber,
    To: toNumber,
    Body: message,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const result = await response.json();
  
  if (!response.ok) {
    console.error("SignalWire SMS error:", result);
    throw new Error(result.message || "Failed to send SMS");
  }

  return result;
}

async function sendEmail({
  resendApiKey,
  to,
  subject,
  message,
  customerName,
}: {
  resendApiKey: string;
  to: string;
  subject: string;
  message: string;
  customerName: string;
}) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">New Square Bookstore</h1>
      </div>
      <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; margin-bottom: 20px;">Dear ${customerName},</p>
        <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea;">
          <p style="margin: 0; font-size: 15px;">${message}</p>
        </div>
        <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
          Thank you for choosing New Square Bookstore!
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="font-size: 12px; color: #9ca3af; margin: 0;">
          This is an automated message. Please do not reply to this email.
        </p>
      </div>
    </body>
    </html>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "New Square Bookstore <orders@maamarmordechai.com>",
      to: [to],
      subject: subject,
      html: htmlContent,
      text: message,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("Resend email error:", result);
    throw new Error(result.message || "Failed to send email");
  }

  return result;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
