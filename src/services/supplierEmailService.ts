import { supabase } from '@/integrations/supabase/client';

export type SupplierEmailType = 'new_order' | 'order_update' | 'custom';

interface EmailSupplierParams {
  supplierId: string;
  supplierOrderId: string;
  emailType: SupplierEmailType;
  customSubject?: string;
  customMessage?: string;
}

export async function emailSupplier({
  supplierId,
  supplierOrderId,
  emailType,
  customSubject,
  customMessage,
}: EmailSupplierParams): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    // Check if we have a valid session before calling the Edge Function
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn('No active session, cannot send email to supplier');
      return { success: false, error: 'Not authenticated. Please log in again.' };
    }

    const { data, error } = await supabase.functions.invoke('email-supplier', {
      body: {
        supplier_id: supplierId,
        supplier_order_id: supplierOrderId,
        email_type: emailType,
        custom_subject: customSubject,
        custom_message: customMessage,
      },
    });

    if (error) {
      // Handle specific error cases
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        console.warn('Email function unauthorized - session may have expired');
        return { success: false, error: 'Session expired. Please refresh and try again.' };
      }
      throw error;
    }

    return { success: true, result: data };
  } catch (error: any) {
    console.error('Failed to email supplier:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}
