import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifyCustomer, getNotificationLogs, getOrderNotificationLogs, NotificationType } from '@/services/notificationService';
import { toast } from 'sonner';

interface UseNotifyCustomerParams {
  customerId: string;
  customerOrderId: string;
  notificationType: NotificationType;
  customMessage?: string;
}

export function useNotifyCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ customerId, customerOrderId, notificationType, customMessage }: UseNotifyCustomerParams) => {
      const result = await notifyCustomer({
        customerId,
        customerOrderId,
        notificationType,
        customMessage,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to send notification');
      }

      return result;
    },
    onSuccess: (_, variables) => {
      toast.success('Customer notified successfully!');
      queryClient.invalidateQueries({ queryKey: ['notification-logs'] });
      queryClient.invalidateQueries({ queryKey: ['notification-logs', variables.customerId] });
      queryClient.invalidateQueries({ queryKey: ['order-notification-logs', variables.customerOrderId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to notify customer: ${error.message}`);
    },
  });
}

export function useNotificationLogs(customerId?: string) {
  return useQuery({
    queryKey: customerId ? ['notification-logs', customerId] : ['notification-logs'],
    queryFn: () => getNotificationLogs(customerId),
  });
}

export function useOrderNotificationLogs(customerOrderId: string) {
  return useQuery({
    queryKey: ['order-notification-logs', customerOrderId],
    queryFn: () => getOrderNotificationLogs(customerOrderId),
    enabled: !!customerOrderId,
  });
}
