import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Book } from '@/types/database';
import { toast } from 'sonner';

export function useBooks(searchTerm?: string) {
  return useQuery({
    queryKey: ['books', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('books')
        .select('*')
        .order('title');
      
      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,title_hebrew.ilike.%${searchTerm}%,author.ilike.%${searchTerm}%,isbn.ilike.%${searchTerm}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Book[];
    },
  });
}

export function useBook(id: string | undefined) {
  return useQuery({
    queryKey: ['book', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Book;
    },
    enabled: !!id,
  });
}

export function useCreateBook() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (book: Omit<Book, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('books')
        .insert(book)
        .select()
        .single();
      if (error) throw error;
      return data as Book;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      toast.success('Book created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create book: ' + error.message);
    },
  });
}

export function useUpdateBook() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Book> & { id: string }) => {
      const { data, error } = await supabase
        .from('books')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Book;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['book', data.id] });
      toast.success('Book updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update book: ' + error.message);
    },
  });
}
