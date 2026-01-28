import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CustomerOrder, SupplierOrder, PendingSupplierAssignment } from '@/types/database';
import { toast } from 'sonner';

export function useCustomerOrders(status?: string) {
  return useQuery({
    queryKey: ['customer-orders', status],
    queryFn: async () => {
      let query = supabase
        .from('customer_orders')
        .select('*, customer:customers(*), book:books(*)')
        .order('created_at', { ascending: false });
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as CustomerOrder[];
    },
  });
}

export function useCustomerOrdersByCustomer(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer-orders', 'customer', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const { data, error } = await supabase
        .from('customer_orders')
        .select('*, customer:customers(*), book:books(*)')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CustomerOrder[];
    },
    enabled: !!customerId,
  });
}

export function usePendingSupplierAssignments() {
  return useQuery({
    queryKey: ['pending-supplier-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pending_supplier_assignments')
        .select('*, book:books(*), customer_order:customer_orders(*, customer:customers(*))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PendingSupplierAssignment[];
    },
  });
}

export function useSupplierOrders(supplierId?: string) {
  return useQuery({
    queryKey: ['supplier-orders', supplierId],
    queryFn: async () => {
      let query = supabase
        .from('supplier_orders')
        .select('*, supplier:suppliers(*), items:supplier_order_items(*, book:books(*), customer_order:customer_orders(*, customer:customers(*)))')
        .order('created_at', { ascending: false });
      
      if (supplierId) {
        query = query.eq('supplier_id', supplierId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as SupplierOrder[];
    },
  });
}

export function useCreateCustomerOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (order: Omit<CustomerOrder, 'id' | 'created_at' | 'updated_at' | 'customer' | 'book'>) => {
      const { data, error } = await supabase
        .from('customer_orders')
        .insert(order)
        .select()
        .single();
      if (error) throw error;
      
      // Check if book has a supplier
      const { data: book, error: bookError } = await supabase
        .from('books')
        .select('current_supplier_id')
        .eq('id', order.book_id)
        .single();
      
      if (bookError) {
        console.error('Error fetching book for supplier check:', bookError);
      }
      
      if (!book?.current_supplier_id) {
        // Add to pending supplier assignments
        const { error: pendingError } = await supabase
          .from('pending_supplier_assignments')
          .insert({
            book_id: order.book_id,
            customer_order_id: data.id,
          });
        
        if (pendingError) {
          console.error('Error creating pending supplier assignment:', pendingError);
        } else {
          console.log('Added to pending supplier assignments:', order.book_id);
        }
      } else {
        console.log('Book has supplier, order is pending on supplier page:', book.current_supplier_id);
      }
      
      return data as CustomerOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-orders'] });
      queryClient.invalidateQueries({ queryKey: ['pending-supplier-assignments'] });
      toast.success('Order created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create order: ' + error.message);
    },
  });
}

export function useUpdateCustomerOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CustomerOrder> & { id: string }) => {
      const { data, error } = await supabase
        .from('customer_orders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as CustomerOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-orders'] });
      toast.success('Order updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update order: ' + error.message);
    },
  });
}

export function useAssignSupplier() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      bookId, 
      supplierId, 
      pendingAssignmentId 
    }: { 
      bookId: string; 
      supplierId: string; 
      pendingAssignmentId?: string;
    }) => {
      // Update book's current supplier
      await supabase
        .from('books')
        .update({ current_supplier_id: supplierId })
        .eq('id', bookId);
      
      // Add to supplier history
      await supabase
        .from('book_supplier_history')
        .upsert({
          book_id: bookId,
          supplier_id: supplierId,
          is_active: true,
          last_ordered_at: new Date().toISOString(),
        }, {
          onConflict: 'book_id,supplier_id',
        });
      
      // Remove from pending if applicable
      if (pendingAssignmentId) {
        await supabase
          .from('pending_supplier_assignments')
          .delete()
          .eq('id', pendingAssignmentId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['pending-supplier-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-books'] });
      toast.success('Supplier assigned successfully');
    },
    onError: (error) => {
      toast.error('Failed to assign supplier: ' + error.message);
    },
  });
}

export function useSupplierOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: ['supplier-order', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const { data, error } = await supabase
        .from('supplier_orders')
        .select('*, supplier:suppliers(*), items:supplier_order_items(*, book:books(*), customer_order:customer_orders(*, customer:customers(*)))')
        .eq('id', orderId)
        .single();
      if (error) throw error;
      return data as SupplierOrder;
    },
    enabled: !!orderId,
  });
}

export function usePendingSupplierOrders() {
  return useQuery({
    queryKey: ['supplier-orders', 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_orders')
        .select('*, supplier:suppliers(*), items:supplier_order_items(*, book:books(*), customer_order:customer_orders(*, customer:customers(*)))')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as SupplierOrder[];
    },
  });
}

export function useCreateSupplierOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      supplierId, 
      customerOrderIds 
    }: { 
      supplierId: string; 
      customerOrderIds: string[];
    }) => {
      // Create supplier order
      const { data: supplierOrder, error: orderError } = await supabase
        .from('supplier_orders')
        .insert({ supplier_id: supplierId })
        .select()
        .single();
      if (orderError) throw orderError;

      // Get customer orders with book info
      const { data: customerOrders } = await supabase
        .from('customer_orders')
        .select('*, book:books(*)')
        .in('id', customerOrderIds);

      // Create supplier order items
      const items = customerOrders?.map(order => ({
        supplier_order_id: supplierOrder.id,
        book_id: order.book_id,
        customer_order_id: order.id,
        quantity: order.quantity,
        cost: order.book?.default_cost,
      })) || [];

      const { error: itemsError } = await supabase
        .from('supplier_order_items')
        .insert(items);
      if (itemsError) throw itemsError;

      // Update customer orders status
      await supabase
        .from('customer_orders')
        .update({ status: 'ordered' })
        .in('id', customerOrderIds);

      return supplierOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-orders'] });
      queryClient.invalidateQueries({ queryKey: ['customer-orders'] });
      toast.success('Supplier order created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create supplier order: ' + error.message);
    },
  });
}

export function useUpdateSupplierOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SupplierOrder> & { id: string }) => {
      const { data, error } = await supabase
        .from('supplier_orders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-orders'] });
      toast.success('Supplier order updated');
    },
    onError: (error) => {
      toast.error('Failed to update supplier order: ' + error.message);
    },
  });
}

export function useUpdateSupplierOrderItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; cost?: number; quantity?: number; is_received?: boolean }) => {
      const { data, error } = await supabase
        .from('supplier_order_items')
        .update({ 
          ...updates, 
          received_at: updates.is_received ? new Date().toISOString() : null 
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-orders'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-order'] });
    },
    onError: (error) => {
      toast.error('Failed to update item: ' + error.message);
    },
  });
}

export function useDeleteSupplierOrderItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('supplier_order_items')
        .delete()
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-orders'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-order'] });
      toast.success('Item removed from order');
    },
    onError: (error) => {
      toast.error('Failed to remove item: ' + error.message);
    },
  });
}

// Get customer orders that have a supplier but haven't been added to a supplier order yet
export function useOrdersReadyForSupplier() {
  return useQuery({
    queryKey: ['orders-ready-for-supplier'],
    queryFn: async () => {
      // Get all customer order IDs that are already in supplier_order_items
      const { data: existingItems } = await supabase
        .from('supplier_order_items')
        .select('customer_order_id');
      
      const existingOrderIds = existingItems?.map(item => item.customer_order_id).filter(Boolean) || [];
      
      // Get customer orders with suppliers that are pending and NOT in supplier orders yet
      let query = supabase
        .from('customer_orders')
        .select('*, customer:customers(*), book:books(*, current_supplier:suppliers(*))')
        .eq('status', 'pending')
        .not('book.current_supplier_id', 'is', null);
      
      if (existingOrderIds.length > 0) {
        query = query.not('id', 'in', `(${existingOrderIds.join(',')})`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Filter to only orders where the book has a supplier
      return (data || []).filter(order => order.book?.current_supplier_id) as CustomerOrder[];
    },
  });
}

// Group orders by supplier for easy display
export function useOrdersGroupedBySupplier() {
  const { data: orders, isLoading } = useOrdersReadyForSupplier();
  
  const grouped = orders?.reduce((acc, order) => {
    const supplierId = order.book?.current_supplier_id;
    if (!supplierId) return acc;
    
    if (!acc[supplierId]) {
      acc[supplierId] = {
        supplier: order.book?.current_supplier,
        orders: [],
      };
    }
    acc[supplierId].orders.push(order);
    return acc;
  }, {} as Record<string, { supplier: any; orders: CustomerOrder[] }>) || {};
  
  return { data: grouped, isLoading };
}
