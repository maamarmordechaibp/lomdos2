import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CallLog } from '@/types/database';
import { toast } from 'sonner';

export function useCallLogs(limit = 50) {
  return useQuery({
    queryKey: ['call-logs', limit],
    queryFn: async () => {
      // Use type assertion since call_logs table may not be in generated types yet
      const { data, error } = await (supabase as any)
        .from('call_logs')
        .select(`
          *,
          customer:customers(id, name, phone)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return (data || []) as (CallLog & { customer?: { id: string; name: string; phone: string } })[];
    },
  });
}

export function useClickToCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      phone_number, 
      customer_id, 
      customer_name 
    }: { 
      phone_number: string; 
      customer_id?: string; 
      customer_name?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('click-to-call', {
        body: { phone_number, customer_id, customer_name },
        headers: session?.access_token ? {
          Authorization: `Bearer ${session.access_token}`,
        } : undefined,
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to initiate call');
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-logs'] });
      toast.success('Call initiated! Your phone will ring shortly.');
    },
    onError: (error) => {
      toast.error('Failed to initiate call: ' + error.message);
    },
  });
}

export function useUpdateCallLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      notes 
    }: { 
      id: string; 
      notes: string;
    }) => {
      // Use type assertion since call_logs table may not be in generated types yet
      const { data, error } = await (supabase as any)
        .from('call_logs')
        .update({ notes, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-logs'] });
      toast.success('Note saved');
    },
    onError: (error) => {
      toast.error('Failed to save note: ' + error.message);
    },
  });
}
