import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Supplier } from '@/types/database';
import { toast } from 'sonner';

export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Supplier[];
    },
  });
}

export function useSupplier(id: string | undefined) {
  return useQuery({
    queryKey: ['supplier', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Supplier;
    },
    enabled: !!id,
  });
}

export function useSupplierBooks(supplierId: string | undefined) {
  return useQuery({
    queryKey: ['supplier-books', supplierId],
    queryFn: async () => {
      if (!supplierId) return [];
      // Get all books that have this supplier as current_supplier OR have history with this supplier
      const { data: currentBooks, error: currentError } = await supabase
        .from('books')
        .select('*')
        .eq('current_supplier_id', supplierId)
        .order('title');
      if (currentError) throw currentError;
      
      const { data: historyBooks, error: historyError } = await supabase
        .from('book_supplier_history')
        .select('*, book:books(*)')
        .eq('supplier_id', supplierId)
        .order('last_ordered_at', { ascending: false });
      if (historyError) throw historyError;
      
      // Combine and dedupe
      const allBooks = new Map();
      currentBooks?.forEach(book => {
        allBooks.set(book.id, { book, is_current: true, last_cost: book.default_cost });
      });
      historyBooks?.forEach(item => {
        if (item.book && !allBooks.has(item.book.id)) {
          allBooks.set(item.book.id, { book: item.book, is_current: false, last_cost: item.last_cost, is_active: item.is_active });
        } else if (item.book && allBooks.has(item.book.id)) {
          // Update with history info
          const existing = allBooks.get(item.book.id);
          allBooks.set(item.book.id, { ...existing, last_cost: item.last_cost || existing.last_cost });
        }
      });
      
      return Array.from(allBooks.values());
    },
    enabled: !!supplierId,
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (supplier: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('suppliers')
        .insert(supplier)
        .select()
        .single();
      if (error) throw error;
      return data as Supplier;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Supplier created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create supplier: ' + error.message);
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Supplier> & { id: string }) => {
      const { data, error } = await supabase
        .from('suppliers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Supplier;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier', data.id] });
      toast.success('Supplier updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update supplier: ' + error.message);
    },
  });
}
