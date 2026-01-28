import { useMutation, useQueryClient } from '@tanstack/react-query';
import { emailSupplier, SupplierEmailType } from '@/services/supplierEmailService';
import { toast } from 'sonner';

interface UseEmailSupplierParams {
  supplierId: string;
  supplierOrderId: string;
  emailType: SupplierEmailType;
  customSubject?: string;
  customMessage?: string;
}

export function useEmailSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ supplierId, supplierOrderId, emailType, customSubject, customMessage }: UseEmailSupplierParams) => {
      const result = await emailSupplier({
        supplierId,
        supplierOrderId,
        emailType,
        customSubject,
        customMessage,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to send email');
      }

      return result;
    },
    onSuccess: () => {
      toast.success('Email sent to supplier successfully!');
      queryClient.invalidateQueries({ queryKey: ['supplier-orders'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to email supplier: ${error.message}`);
    },
  });
}
