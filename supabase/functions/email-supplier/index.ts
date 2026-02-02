import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Standard request (for supplier_orders)
interface EmailSupplierRequest {
  supplier_id: string;
  supplier_order_id: string;
  email_type: "new_order" | "order_update" | "custom";
  custom_subject?: string;
  custom_message?: string;
}

// Direct request (for stock_orders or direct emails)
interface DirectEmailRequest {
  supplierEmail: string;
  supplierName: string;
  items: Array<{
    bookTitle: string;
    quantity: number;
    cost?: number;
  }>;
  notes?: string;
  isStockOrder: boolean;
}

interface OrderItem {
  book: {
    id: string;
    title: string;
    title_hebrew?: string;
    isbn?: string;
    author?: string;
    category?: string;
  };
  quantity: number;
  cost?: number;
}

// Consolidate items with the same book into single entries with combined quantities
function consolidateItems(items: OrderItem[]): OrderItem[] {
  const bookMap = new Map<string, OrderItem>();
  
  for (const item of items) {
    const bookId = item.book.id;
    if (bookMap.has(bookId)) {
      const existing = bookMap.get(bookId)!;
      existing.quantity += item.quantity;
    } else {
      bookMap.set(bookId, { ...item, quantity: item.quantity });
    }
  }
  
  return Array.from(bookMap.values());
}

// Sort items by category, then by title
function sortItemsByCategoryAndTitle(items: OrderItem[]): OrderItem[] {
  return items.sort((a, b) => {
    const catA = a.book.category || 'Uncategorized';
    const catB = b.book.category || 'Uncategorized';
    
    // First sort by category
    if (catA !== catB) {
      // Put "Uncategorized" at the end
      if (catA === 'Uncategorized') return 1;
      if (catB === 'Uncategorized') return -1;
      return catA.localeCompare(catB);
    }
    
    // Then sort by title within category
    return (a.book.title || '').localeCompare(b.book.title || '');
  });
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // Check for required environment variables
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Email service not configured. Please set RESEND_API_KEY." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch store settings for branding
    const { data: settings } = await supabase
      .from("global_settings")
      .select("store_name, store_logo_url")
      .single();
    
    const storeName = settings?.store_name || "New Square Bookstore";
    const storeLogoUrl = settings?.store_logo_url || null;

    const body = await req.json();

    // Check if this is a direct/stock order request
    if (body.isStockOrder) {
      const { supplierEmail, supplierName, items, notes } = body as DirectEmailRequest;
      
      if (!supplierEmail) {
        throw new Error("Supplier email is required");
      }

      const subject = `Stock Order Request - ${items.length} item(s)`;
      const messageContent = generateStockOrderEmail(supplierName, items, notes, storeName);

      const result = await sendEmail({
        resendApiKey,
        to: supplierEmail,
        subject,
        htmlContent: generateSupplierEmailHtml(subject, messageContent, supplierName, storeName, storeLogoUrl),
        textContent: messageContent,
        storeName,
      });

      return new Response(
        JSON.stringify({ success: true, result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Standard supplier order request
    const { 
      supplier_id, 
      supplier_order_id, 
      email_type, 
      custom_subject, 
      custom_message 
    }: EmailSupplierRequest = body;

    // Get supplier details
    const { data: supplier, error: supplierError } = await supabase
      .from("suppliers")
      .select("*")
      .eq("id", supplier_id)
      .single();

    if (supplierError || !supplier) {
      throw new Error("Supplier not found");
    }

    if (!supplier.email) {
      throw new Error("Supplier does not have an email address");
    }

    // Get order details with items
    const { data: order, error: orderError } = await supabase
      .from("supplier_orders")
      .select(`
        *,
        items:supplier_order_items(
          *,
          book:books(*)
        )
      `)
      .eq("id", supplier_order_id)
      .single();

    if (orderError || !order) {
      throw new Error("Supplier order not found");
    }

    // Generate email content
    let subject = custom_subject || "";
    let messageContent = custom_message || "";

    switch (email_type) {
      case "new_order":
        subject = subject || `New Order Request - Order #${supplier_order_id.slice(0, 8)}`;
        messageContent = generateNewOrderEmail(supplier.name, order.items || [], storeName);
        break;
      case "order_update":
        subject = subject || `Order Update - Order #${supplier_order_id.slice(0, 8)}`;
        messageContent = generateOrderUpdateEmail(supplier.name, order, storeName);
        break;
      case "custom":
        if (!subject || !messageContent) {
          throw new Error("Subject and message are required for custom email type");
        }
        break;
    }

    // Send email via Resend
    const result = await sendEmail({
      resendApiKey,
      to: supplier.email,
      subject,
      htmlContent: generateSupplierEmailHtml(subject, messageContent, supplier.name, storeName, storeLogoUrl),
      textContent: messageContent,
      storeName,
    });

    // Update supplier order status if it was a new order email
    if (email_type === "new_order") {
      await supabase
        .from("supplier_orders")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", supplier_order_id);
    }

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

function generateNewOrderEmail(supplierName: string, items: OrderItem[], storeName: string): string {
  // Consolidate duplicate books and sort by category then title
  const consolidatedItems = consolidateItems(items);
  const sortedItems = sortItemsByCategoryAndTitle(consolidatedItems);
  
  // Group by category
  const categorizedItems = new Map<string, OrderItem[]>();
  for (const item of sortedItems) {
    const category = item.book.category || 'Uncategorized';
    if (!categorizedItems.has(category)) {
      categorizedItems.set(category, []);
    }
    categorizedItems.get(category)!.push(item);
  }
  
  // Generate formatted list organized by category
  let itemNumber = 1;
  const sections: string[] = [];
  
  for (const [category, categoryItems] of categorizedItems) {
    const categorySection = [`📁 ${category.toUpperCase()}`, '─'.repeat(30)];
    
    for (const item of categoryItems) {
      const book = item.book;
      categorySection.push(`${itemNumber}. ${book.title}${book.title_hebrew ? ` / ${book.title_hebrew}` : ''}
   - Author: ${book.author || 'N/A'}
   - ISBN: ${book.isbn || 'N/A'}
   - Quantity: ${item.quantity}`);
      itemNumber++;
    }
    
    sections.push(categorySection.join('\n'));
  }
  
  const itemsList = sections.join('\n\n');
  const totalQuantity = sortedItems.reduce((sum, item) => sum + item.quantity, 0);

  return `Dear ${supplierName},

We would like to place the following order:

TOTAL: ${sortedItems.length} unique book(s), ${totalQuantity} total pieces

${itemsList}

Please confirm receipt of this order and provide an estimated delivery date.

Thank you for your continued partnership.

Best regards,
${storeName}`;
}

function generateStockOrderEmail(
  supplierName: string, 
  items: Array<{ bookTitle: string; quantity: number; cost?: number; category?: string }>,
  notes: string | undefined,
  storeName: string
): string {
  // Consolidate duplicate book titles
  const bookMap = new Map<string, { bookTitle: string; quantity: number; cost?: number; category?: string }>();
  
  for (const item of items) {
    const key = item.bookTitle.toLowerCase();
    if (bookMap.has(key)) {
      const existing = bookMap.get(key)!;
      existing.quantity += item.quantity;
    } else {
      bookMap.set(key, { ...item });
    }
  }
  
  // Sort consolidated items by category then title
  const consolidatedItems = Array.from(bookMap.values()).sort((a, b) => {
    const catA = a.category || 'Uncategorized';
    const catB = b.category || 'Uncategorized';
    if (catA !== catB) {
      if (catA === 'Uncategorized') return 1;
      if (catB === 'Uncategorized') return -1;
      return catA.localeCompare(catB);
    }
    return a.bookTitle.localeCompare(b.bookTitle);
  });
  
  // Group by category
  const categorizedItems = new Map<string, typeof consolidatedItems>();
  for (const item of consolidatedItems) {
    const category = item.category || 'Uncategorized';
    if (!categorizedItems.has(category)) {
      categorizedItems.set(category, []);
    }
    categorizedItems.get(category)!.push(item);
  }
  
  // Generate formatted list
  let itemNumber = 1;
  const sections: string[] = [];
  
  for (const [category, categoryItems] of categorizedItems) {
    const categorySection = [`📁 ${category.toUpperCase()}`, '─'.repeat(30)];
    
    for (const item of categoryItems) {
      categorySection.push(`${itemNumber}. ${item.bookTitle}
   - Quantity: ${item.quantity}`);
      itemNumber++;
    }
    
    sections.push(categorySection.join('\n'));
  }
  
  const itemsList = sections.join('\n\n');
  const totalQuantity = consolidatedItems.reduce((sum, item) => sum + item.quantity, 0);

  return `Dear ${supplierName},

We would like to place the following stock order:

TOTAL: ${consolidatedItems.length} unique book(s), ${totalQuantity} total pieces

${itemsList}
${notes ? `\nNotes: ${notes}` : ''}

Please confirm receipt of this order and provide an estimated delivery date.

Thank you for your continued partnership.

Best regards,
${storeName}`;
}

function generateOrderUpdateEmail(supplierName: string, order: any, storeName: string): string {
  return `Dear ${supplierName},

This is an update regarding Order #${order.id.slice(0, 8)}.

Current Status: ${order.status.toUpperCase()}
${order.notes ? `\nNotes: ${order.notes}` : ''}

Please let us know if you have any questions.

Best regards,
${storeName}`;
}

function generateSupplierEmailHtml(subject: string, content: string, supplierName: string, storeName: string, storeLogoUrl: string | null): string {
  const formattedContent = content.replace(/\n/g, '<br>');
  // Build logo HTML if URL is provided
  const logoHtml = storeLogoUrl 
    ? `<img src="${storeLogoUrl}" alt="${storeName}" style="max-height: 60px; max-width: 200px; margin-bottom: 10px; object-fit: contain;">`
    : '';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        ${logoHtml}
        <h1 style="color: white; margin: 0; font-size: 24px;">${storeName}</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Supplier Order Communication</p>
      </div>
      <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <div style="background: white; padding: 25px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 15px; white-space: pre-line;">${formattedContent}</p>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="font-size: 12px; color: #9ca3af; margin: 0; text-align: center;">
          ${storeName}<br>
          This is an automated message from our order management system.
        </p>
      </div>
    </body>
    </html>
  `;
}

async function sendEmail({
  resendApiKey,
  to,
  subject,
  htmlContent,
  textContent,
  storeName,
}: {
  resendApiKey: string;
  to: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  storeName: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${storeName} <orders@maamarmordechai.com>`,
      to: [to],
      subject: subject,
      html: htmlContent,
      text: textContent,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("Resend email error:", result);
    // Provide more helpful error message for common Resend issues
    if (result.message?.includes("can only send testing emails")) {
      throw new Error(`Resend free tier can only send to verified email addresses. To send to ${to}, you need to verify a domain in Resend.`);
    }
    throw new Error(result.message || "Failed to send email");
  }

  return result;
}
