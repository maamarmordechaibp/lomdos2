import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Customer, CustomerPayment, Supplier, SupplierPayment, Expense } from '@/types/database';
import { toast } from 'sonner';

// ==================== Customer Balances ====================

// Get customers with outstanding balances
export function useCustomersWithBalance() {
  return useQuery({
    queryKey: ['customers-with-balance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .gt('outstanding_balance', 0)
        .order('outstanding_balance', { ascending: false });
      if (error) throw error;
      return data as unknown as Customer[];
    },
  });
}

// Get all payments for a customer
export function useCustomerPayments(customerId?: string) {
  return useQuery({
    queryKey: ['customer-payments', customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_payments')
        .select('*, customer:customers(*), order:customer_orders(*)')
        .eq('customer_id', customerId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as CustomerPayment[];
    },
  });
}

// Get all customer payments (for search/reporting)
export function useAllCustomerPayments(filters?: { 
  startDate?: string; 
  endDate?: string;
  minAmount?: number;
}) {
  return useQuery({
    queryKey: ['all-customer-payments', filters],
    queryFn: async () => {
      let query = supabase
        .from('customer_payments')
        .select('*, customer:customers(*), order:customer_orders(*)')
        .order('created_at', { ascending: false });
      
      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate) as typeof query;
      }
      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate) as typeof query;
      }
      if (filters?.minAmount) {
        query = query.gte('amount', filters.minAmount) as typeof query;
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as CustomerPayment[];
    },
  });
}

// Create a customer payment
export function useCreateCustomerPayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (payment: {
      customer_id: string;
      order_id?: string | null;
      amount: number;
      payment_method: 'cash' | 'card' | 'check' | 'other';
      transaction_id?: string | null;
      notes?: string | null;
    }) => {
      // Create the payment - only include fields that exist in DB
      const paymentData: Record<string, any> = {
        customer_id: payment.customer_id,
        amount: payment.amount,
        payment_method: payment.payment_method,
      };
      if (payment.order_id) paymentData.order_id = payment.order_id;
      if (payment.transaction_id) paymentData.transaction_id = payment.transaction_id;
      if (payment.notes) paymentData.notes = payment.notes;
      
      const { data, error } = await supabase
        .from('customer_payments')
        .insert(paymentData)
        .select()
        .single();
      if (error) throw error;
      
      // Update customer's outstanding balance
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('outstanding_balance')
        .eq('id', payment.customer_id)
        .single();
      if (customerError) throw customerError;
      
      const newBalance = Math.max(0, (customer.outstanding_balance || 0) - payment.amount);
      const { error: updateError } = await supabase
        .from('customers')
        .update({ outstanding_balance: newBalance })
        .eq('id', payment.customer_id);
      if (updateError) throw updateError;
      
      return data as unknown as CustomerPayment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-payments'] });
      queryClient.invalidateQueries({ queryKey: ['customers-with-balance'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['all-customer-payments'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      queryClient.invalidateQueries({ queryKey: ['book-profitability'] });
      toast.success('Payment recorded successfully');
    },
    onError: (error) => {
      toast.error('Failed to record payment: ' + error.message);
    },
  });
}

// Update customer balance directly
export function useUpdateCustomerBalance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ customerId, amount, operation }: { 
      customerId: string; 
      amount: number; 
      operation: 'add' | 'set';
    }) => {
      if (operation === 'set') {
        const { error } = await supabase
          .from('customers')
          .update({ outstanding_balance: amount })
          .eq('id', customerId);
        if (error) throw error;
      } else {
        const { data: customer, error: fetchError } = await supabase
          .from('customers')
          .select('outstanding_balance')
          .eq('id', customerId)
          .single();
        if (fetchError) throw fetchError;
        
        const newBalance = (customer.outstanding_balance || 0) + amount;
        const { error } = await supabase
          .from('customers')
          .update({ outstanding_balance: newBalance })
          .eq('id', customerId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers-with-balance'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

// ==================== Supplier Balances ====================

// Get suppliers with outstanding balances
export function useSuppliersWithBalance() {
  return useQuery({
    queryKey: ['suppliers-with-balance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .gt('outstanding_balance', 0)
        .order('outstanding_balance', { ascending: false });
      if (error) throw error;
      return data as unknown as Supplier[];
    },
  });
}

// Get all payments to a supplier
export function useSupplierPayments(supplierId?: string) {
  return useQuery({
    queryKey: ['supplier-payments', supplierId],
    enabled: !!supplierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_payments')
        .select('*, supplier:suppliers(*), supplier_order:supplier_orders(*)')
        .eq('supplier_id', supplierId!)
        .order('paid_at', { ascending: false });
      if (error) throw error;
      return data as unknown as SupplierPayment[];
    },
  });
}

// Create a supplier payment
export function useCreateSupplierPayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (payment: Omit<SupplierPayment, 'id' | 'created_at' | 'supplier' | 'supplier_order'>) => {
      // Create the payment
      const { data, error } = await supabase
        .from('supplier_payments')
        .insert(payment as any)
        .select()
        .single();
      if (error) throw error;
      
      // Update supplier's outstanding balance
      const { data: supplier, error: supplierError } = await supabase
        .from('suppliers')
        .select('outstanding_balance')
        .eq('id', payment.supplier_id)
        .single();
      if (supplierError) throw supplierError;
      
      const newBalance = Math.max(0, (supplier.outstanding_balance || 0) - payment.amount);
      const { error: updateError } = await supabase
        .from('suppliers')
        .update({ outstanding_balance: newBalance })
        .eq('id', payment.supplier_id);
      if (updateError) throw updateError;
      
      // If linked to an order, update the order's amount_paid
      if (payment.supplier_order_id) {
        const { data: order, error: orderError } = await supabase
          .from('supplier_orders')
          .select('amount_paid, total_cost')
          .eq('id', payment.supplier_order_id)
          .single();
        if (orderError) throw orderError;
        
        const newAmountPaid = (order.amount_paid || 0) + payment.amount;
        const isPaid = newAmountPaid >= (order.total_cost || 0);
        
        const { error: orderUpdateError } = await supabase
          .from('supplier_orders')
          .update({ 
            amount_paid: newAmountPaid,
            is_paid: isPaid,
          })
          .eq('id', payment.supplier_order_id);
        if (orderUpdateError) throw orderUpdateError;
      }
      
      return data as unknown as SupplierPayment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers-with-balance'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-orders'] });
      toast.success('Payment recorded successfully');
    },
    onError: (error) => {
      toast.error('Failed to record payment: ' + error.message);
    },
  });
}

// ==================== Expenses ====================

export function useExpenses(filters?: { 
  startDate?: string; 
  endDate?: string;
  category?: string;
}) {
  return useQuery({
    queryKey: ['expenses', filters],
    queryFn: async () => {
      let query = supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false });
      
      if (filters?.startDate) {
        query = query.gte('expense_date', filters.startDate) as typeof query;
      }
      if (filters?.endDate) {
        query = query.lte('expense_date', filters.endDate) as typeof query;
      }
      if (filters?.category) {
        query = query.eq('category', filters.category) as typeof query;
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Expense[];
    },
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (expense: Omit<Expense, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('expenses')
        .insert(expense as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Expense;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      toast.success('Expense recorded');
    },
    onError: (error) => {
      toast.error('Failed to record expense: ' + error.message);
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Expense> & { id: string }) => {
      const { data, error } = await supabase
        .from('expenses')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Expense;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      toast.success('Expense updated');
    },
    onError: (error) => {
      toast.error('Failed to update expense: ' + error.message);
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      toast.success('Expense deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete expense: ' + error.message);
    },
  });
}

// ==================== Financial Summary ====================

export function useFinancialSummary(year?: number, month?: number) {
  return useQuery({
    queryKey: ['financial-summary', year, month],
    queryFn: async () => {
      // Build date range
      let isoStart: string | undefined;
      let isoEnd: string | undefined;
      let dateStart: string | undefined;
      let dateEnd: string | undefined;
      
      if (year && month) {
        isoStart = new Date(year, month - 1, 1).toISOString();
        isoEnd = new Date(year, month, 0, 23, 59, 59).toISOString();
        dateStart = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        dateEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      } else if (year) {
        isoStart = new Date(year, 0, 1).toISOString();
        isoEnd = new Date(year, 11, 31, 23, 59, 59).toISOString();
        dateStart = `${year}-01-01`;
        dateEnd = `${year}-12-31`;
      }

      // 1) Revenue = actual money received (from customer_payments)
      let paymentsQuery = supabase
        .from('customer_payments')
        .select('amount, created_at');
      if (isoStart && isoEnd) {
        paymentsQuery = paymentsQuery.gte('created_at', isoStart).lte('created_at', isoEnd);
      }
      const { data: payments, error: paymentsError } = await paymentsQuery;
      if (paymentsError) throw paymentsError;

      const revenue = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

      // 2) Cost = book costs from all non-cancelled orders in the period
      let ordersQuery = supabase
        .from('customer_orders')
        .select('final_price, actual_cost, created_at, amount_paid')
        .neq('status', 'cancelled');
      if (isoStart && isoEnd) {
        ordersQuery = ordersQuery.gte('created_at', isoStart).lte('created_at', isoEnd);
      }
      const { data: orders, error: ordersError } = await ordersQuery;
      if (ordersError) throw ordersError;

      const cost = orders?.reduce((sum, o) => sum + (o.actual_cost || 0), 0) || 0;
      const totalOrderValue = orders?.reduce((sum, o) => sum + (o.final_price || 0), 0) || 0;
      
      // 3) Expenses
      let expensesQuery = supabase
        .from('expenses')
        .select('amount, category, expense_date, is_tax_deductible');
      if (dateStart && dateEnd) {
        expensesQuery = expensesQuery.gte('expense_date', dateStart).lte('expense_date', dateEnd);
      }
      const { data: expenses, error: expensesError } = await expensesQuery;
      if (expensesError) throw expensesError;
      
      // Calculate totals
      const totalExpenses = expenses?.reduce((sum, e) => sum + e.amount, 0) || 0;
      const taxDeductibleExpenses = expenses?.filter(e => e.is_tax_deductible).reduce((sum, e) => sum + e.amount, 0) || 0;
      // Use order-level profit (final_price - actual_cost) for consistent accrual-basis calculation
      const grossProfit = orders?.reduce((sum, o) => sum + ((o.final_price || 0) - (o.actual_cost || 0)), 0) || 0;
      const netProfit = grossProfit - totalExpenses;
      
      // Group expenses by category
      const expensesByCategory = expenses?.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount;
        return acc;
      }, {} as Record<string, number>) || {};
      
      return {
        revenue,
        cost,
        grossProfit,
        totalExpenses,
        taxDeductibleExpenses,
        netProfit,
        orderCount: orders?.length || 0,
        totalOrderValue,
        expensesByCategory,
      };
    },
  });
}

// Get book-level profitability
export function useBookProfitability(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['book-profitability', startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('customer_orders')
        .select('book_id, book:books(title), final_price, actual_cost, quantity, amount_paid')
        .neq('status', 'cancelled');
      
      if (startDate) {
        query = query.gte('created_at', startDate) as typeof query;
      }
      if (endDate) {
        query = query.lte('created_at', endDate) as typeof query;
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Group by book
      const bookStats = (data || []).reduce((acc, order) => {
        const bookId = order.book_id;
        if (!acc[bookId]) {
          acc[bookId] = {
            bookId,
            bookTitle: (order.book as any)?.title || 'Unknown',
            totalRevenue: 0,
            totalCost: 0,
            totalQuantity: 0,
            profit: 0,
          };
        }
        acc[bookId].totalRevenue += order.final_price || 0;
        acc[bookId].totalCost += order.actual_cost || 0;
        acc[bookId].totalQuantity += order.quantity || 1;
        acc[bookId].profit = acc[bookId].totalRevenue - acc[bookId].totalCost;
        return acc;
      }, {} as Record<string, { bookId: string; bookTitle: string; totalRevenue: number; totalCost: number; totalQuantity: number; profit: number }>);
      
      return Object.values(bookStats).sort((a, b) => b.profit - a.profit);
    },
  });
}
