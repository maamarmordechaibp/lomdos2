import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PromoCode, PromoCodeUsage } from '@/types/database';
import { toast } from 'sonner';

export function usePromoCodes() {
  return useQuery({
    queryKey: ['promo-codes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PromoCode[];
    },
  });
}

export function useActivePromoCodes() {
  return useQuery({
    queryKey: ['promo-codes', 'active'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('is_active', true)
        .or(`start_date.is.null,start_date.lte.${now}`)
        .or(`end_date.is.null,end_date.gte.${now}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PromoCode[];
    },
  });
}

export function usePromoCode(id: string | undefined) {
  return useQuery({
    queryKey: ['promo-code', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as PromoCode;
    },
    enabled: !!id,
  });
}

export function useCreatePromoCode() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (promo: Omit<PromoCode, 'id' | 'current_uses' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data, error } = await supabase
        .from('promo_codes')
        .insert(promo)
        .select()
        .single();
      if (error) throw error;
      return data as PromoCode;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] });
      toast.success('Promo code created');
    },
    onError: (error) => {
      toast.error('Failed to create promo code: ' + error.message);
    },
  });
}

export function useUpdatePromoCode() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PromoCode> & { id: string }) => {
      const { data, error } = await supabase
        .from('promo_codes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as PromoCode;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] });
      queryClient.invalidateQueries({ queryKey: ['promo-code', data.id] });
      toast.success('Promo code updated');
    },
    onError: (error) => {
      toast.error('Failed to update promo code: ' + error.message);
    },
  });
}

export function useDeletePromoCode() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('promo_codes')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] });
      toast.success('Promo code deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete promo code: ' + error.message);
    },
  });
}

// Validate and apply a promo code for a customer
export function useValidatePromoCode() {
  return useMutation({
    mutationFn: async ({ 
      code, 
      customerId, 
      orderAmount 
    }: { 
      code: string; 
      customerId: string; 
      orderAmount: number;
    }): Promise<{ valid: boolean; promo?: PromoCode; error?: string; discountAmount?: number }> => {
      // Find the promo code
      const { data: promo, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', code.toUpperCase())
        .single();
      
      if (error || !promo) {
        return { valid: false, error: 'Invalid promo code' };
      }
      
      // Check if active
      if (!promo.is_active) {
        return { valid: false, error: 'This promo code is no longer active' };
      }
      
      // Check date range
      const now = new Date();
      if (promo.start_date && new Date(promo.start_date) > now) {
        return { valid: false, error: 'This promo code is not yet active' };
      }
      if (promo.end_date && new Date(promo.end_date) < now) {
        return { valid: false, error: 'This promo code has expired' };
      }
      
      // Check max uses
      if (promo.max_uses !== null && promo.current_uses >= promo.max_uses) {
        return { valid: false, error: 'This promo code has reached its usage limit' };
      }
      
      // Check minimum order amount
      if (promo.minimum_order_amount !== null && orderAmount < promo.minimum_order_amount) {
        return { valid: false, error: `Minimum order amount is $${promo.minimum_order_amount}` };
      }
      
      // Check customer usage
      const { data: usages } = await supabase
        .from('promo_code_usage')
        .select('id')
        .eq('promo_code_id', promo.id)
        .eq('customer_id', customerId);
      
      if (usages && usages.length >= promo.max_uses_per_customer) {
        return { valid: false, error: 'You have already used this promo code' };
      }
      
      // Calculate discount
      const discountAmount = promo.discount_type === 'percentage'
        ? (orderAmount * promo.discount_value / 100)
        : Math.min(promo.discount_value, orderAmount);
      
      return { valid: true, promo: promo as PromoCode, discountAmount };
    },
  });
}

// Record promo code usage
export function useRecordPromoCodeUsage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      promoCodeId, 
      customerId, 
      orderId,
      discountApplied 
    }: { 
      promoCodeId: string; 
      customerId: string; 
      orderId?: string;
      discountApplied: number;
    }) => {
      // Record usage
      const { error: usageError } = await supabase
        .from('promo_code_usage')
        .insert({
          promo_code_id: promoCodeId,
          customer_id: customerId,
          order_id: orderId || null,
          discount_applied: discountApplied,
        });
      
      if (usageError) throw usageError;
      
      // Increment current_uses
      const { error: updateError } = await supabase
        .rpc('increment_promo_uses', { promo_id: promoCodeId });
      
      // If RPC doesn't exist, do manual update
      if (updateError) {
        const { data: promo } = await supabase
          .from('promo_codes')
          .select('current_uses')
          .eq('id', promoCodeId)
          .single();
        
        if (promo) {
          await supabase
            .from('promo_codes')
            .update({ current_uses: (promo.current_uses || 0) + 1 })
            .eq('id', promoCodeId);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] });
    },
  });
}

// Get promo code usage history
export function usePromoCodeUsage(promoCodeId: string | undefined) {
  return useQuery({
    queryKey: ['promo-code-usage', promoCodeId],
    queryFn: async () => {
      if (!promoCodeId) return [];
      const { data, error } = await supabase
        .from('promo_code_usage')
        .select('*, customer:customers(*)')
        .eq('promo_code_id', promoCodeId)
        .order('used_at', { ascending: false });
      if (error) throw error;
      return data as PromoCodeUsage[];
    },
    enabled: !!promoCodeId,
  });
}
