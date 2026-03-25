import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Book, StockOrder } from '@/types/database';
import { toast } from 'sonner';

// Get books that are low on stock
export function useLowStockBooks() {
  return useQuery({
    queryKey: ['low-stock-books'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('books')
        .select('*, current_supplier:suppliers(*)')
        .order('quantity_in_stock', { ascending: true });
      
      if (error) throw error;
      
      // Filter books where stock is at or below threshold
      return (data as unknown as Book[]).filter(b => b.quantity_in_stock <= b.low_stock_threshold);
    },
  });
}

// Get all books with stock info
export function useBooksWithStock() {
  return useQuery({
    queryKey: ['books-with-stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('books')
        .select('*, current_supplier:suppliers(*)')
        .order('title', { ascending: true });
      if (error) throw error;
      return data as unknown as Book[];
    },
  });
}

// Get stock orders
export function useStockOrders(status?: string) {
  return useQuery({
    queryKey: ['stock-orders', status],
    queryFn: async () => {
      let query = supabase
        .from('stock_orders')
        .select('*, book:books(*), supplier:suppliers(*)')
        .order('created_at', { ascending: false });
      
      if (status) {
        query = query.eq('status', status) as typeof query;
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as StockOrder[];
    },
  });
}

// Create stock order
export function useCreateStockOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (order: Omit<StockOrder, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('stock_orders')
        .insert(order as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as StockOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-orders'] });
      toast.success('Stock order created');
    },
    onError: (error) => {
      toast.error('Failed to create stock order: ' + error.message);
    },
  });
}

// Update stock order
export function useUpdateStockOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<StockOrder> & { id: string }) => {
      const { data, error } = await supabase
        .from('stock_orders')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as StockOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-orders'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['books-with-stock'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock-books'] });
    },
    onError: (error) => {
      toast.error('Failed to update stock order: ' + error.message);
    },
  });
}

// Update book stock
export function useUpdateBookStock() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      bookId, 
      quantityChange,
      newQuantity 
    }: { 
      bookId: string; 
      quantityChange?: number;
      newQuantity?: number;
    }) => {
      if (newQuantity !== undefined) {
        // Set absolute quantity
        const { error } = await supabase
          .from('books')
          .update({ quantity_in_stock: newQuantity })
          .eq('id', bookId);
        if (error) throw error;
      } else if (quantityChange !== undefined) {
        // Increment/decrement quantity
        const { data: book, error: fetchError } = await supabase
          .from('books')
          .select('quantity_in_stock')
          .eq('id', bookId)
          .single();
        if (fetchError) throw fetchError;
        
        const newQty = Math.max(0, (book.quantity_in_stock || 0) + quantityChange);
        const { error } = await supabase
          .from('books')
          .update({ quantity_in_stock: newQty })
          .eq('id', bookId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['books-with-stock'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock-books'] });
    },
    onError: (error) => {
      toast.error('Failed to update stock: ' + error.message);
    },
  });
}

// Receive stock order and update inventory
export function useReceiveStockOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      orderId, 
      costPerUnit 
    }: { 
      orderId: string; 
      costPerUnit?: number;
    }) => {
      // Get the stock order
      const { data: order, error: orderError } = await supabase
        .from('stock_orders')
        .select('*')
        .eq('id', orderId)
        .single();
      if (orderError) throw orderError;
      
      // Update the order status
      const updates: any = {
        status: 'received',
        received_at: new Date().toISOString(),
      };
      if (costPerUnit !== undefined) {
        updates.cost_per_unit = costPerUnit;
        updates.total_cost = costPerUnit * order.quantity;
      }
      
      const { error: updateError } = await supabase
        .from('stock_orders')
        .update(updates)
        .eq('id', orderId);
      if (updateError) throw updateError;
      
      // Update book stock
      const { data: book, error: bookError } = await supabase
        .from('books')
        .select('quantity_in_stock')
        .eq('id', order.book_id)
        .single();
      if (bookError) throw bookError;
      
      const newQty = (book.quantity_in_stock || 0) + order.quantity;
      const { error: stockError } = await supabase
        .from('books')
        .update({ quantity_in_stock: newQty })
        .eq('id', order.book_id);
      if (stockError) throw stockError;
      
      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-orders'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['books-with-stock'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock-books'] });
      toast.success('Stock received and inventory updated!');
    },
    onError: (error) => {
      toast.error('Failed to receive stock: ' + error.message);
    },
  });
}

// Use stock for a customer order
export function useFromStock() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      bookId, 
      quantity = 1 
    }: { 
      bookId: string; 
      quantity?: number;
    }) => {
      // Get current stock
      const { data: book, error: bookError } = await supabase
        .from('books')
        .select('quantity_in_stock, title')
        .eq('id', bookId)
        .single();
      if (bookError) throw bookError;
      
      if (book.quantity_in_stock < quantity) {
        throw new Error(`Not enough stock. Only ${book.quantity_in_stock} available.`);
      }
      
      // Decrement stock
      const { error } = await supabase
        .from('books')
        .update({ quantity_in_stock: book.quantity_in_stock - quantity })
        .eq('id', bookId);
      if (error) throw error;
      
      return book;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['books-with-stock'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock-books'] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
