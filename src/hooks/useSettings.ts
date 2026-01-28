import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GlobalSettings } from '@/types/database';
import { toast } from 'sonner';

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_settings')
        .select('*')
        .single();
      if (error) throw error;
      return data as GlobalSettings;
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (updates: Partial<GlobalSettings>) => {
      const { data: existing } = await supabase
        .from('global_settings')
        .select('id')
        .single();
      
      const { data, error } = await supabase
        .from('global_settings')
        .update(updates)
        .eq('id', existing?.id)
        .select()
        .single();
      if (error) throw error;
      return data as GlobalSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Settings updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update settings: ' + error.message);
    },
  });
}
