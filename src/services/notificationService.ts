import { supabase } from '@/integrations/supabase/client';

export type NotificationType = 'order_ready' | 'order_received' | 'custom';

interface NotifyCustomerParams {
  customerId: string;
  customerOrderId: string;
  notificationType: NotificationType;
  customMessage?: string;
}

interface NotificationLog {
  id: string;
  customer_id: string;
  customer_order_id: string | null;
  notification_type: NotificationType;
  notification_method: 'phone' | 'sms' | 'email';
  message: string;
  status: 'pending' | 'sent' | 'failed' | 'delivered';
  response: any;
  created_at: string;
}

export async function notifyCustomer({
  customerId,
  customerOrderId,
  notificationType,
  customMessage,
}: NotifyCustomerParams): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('notify-customer', {
      body: {
        customer_id: customerId,
        customer_order_id: customerOrderId,
        notification_type: notificationType,
        custom_message: customMessage,
      },
    });

    if (error) {
      throw error;
    }

    return { success: true, result: data };
  } catch (error: any) {
    console.error('Failed to notify customer:', error);
    return { success: false, error: error.message || 'Failed to send notification' };
  }
}

export async function getNotificationLogs(customerId?: string): Promise<NotificationLog[]> {
  let query = supabase
    .from('notification_logs')
    .select('*')
    .order('created_at', { ascending: false });

  if (customerId) {
    query = query.eq('customer_id', customerId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch notification logs:', error);
    return [];
  }

  return data as NotificationLog[];
}

export async function getOrderNotificationLogs(customerOrderId: string): Promise<NotificationLog[]> {
  const { data, error } = await supabase
    .from('notification_logs')
    .select('*')
    .eq('customer_order_id', customerOrderId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch order notification logs:', error);
    return [];
  }

  return data as NotificationLog[];
}
