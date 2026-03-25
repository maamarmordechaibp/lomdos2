import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  RotateCcw, 
  Plus,
  Book,
  Truck,
  Search,
  User,
  Package,
  CheckCircle,
  ArrowRight,
  DollarSign,
  CreditCard,
  Banknote,
  Gift,
  Loader2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Return, Customer, CustomerOrder } from '@/types/database';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBooks } from '@/hooks/useBooks';
import { useSuppliers } from '@/hooks/useSuppliers';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { CustomerSearch } from '@/components/customers/CustomerSearch';
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group';

const reasonLabels: Record<string, string> = {
  damaged: 'Damaged',
  wrong_item: 'Wrong Item',
  customer_return: 'Customer Return',
  other: 'Other',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  sent: 'Sent',
  completed: 'Completed',
};

const supplierReturnReasons: Record<string, string> = {
  damaged: 'Damaged/Defective',
  wrong_item: 'Wrong Item Received',
  not_ordered: 'Not Ordered',
  quality_issue: 'Quality Issue',
  other: 'Other',
};

export default function Returns() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [newReturn, setNewReturn] = useState({
    book_id: '',
    supplier_id: '',
    reason: 'customer_return' as const,
    reason_details: '',
    quantity: 1,
    customer_order_id: '',
    refund_type: 'store_credit' as 'cash' | 'card' | 'store_credit',
    refund_amount: 0,
    return_to_supplier: false,
    supplier_return_reason: '' as string,
  });

  const [searchParams] = useSearchParams();
  const { data: books } = useBooks();
  const { data: suppliers } = useSuppliers();

  // Pre-fetch customer if passed via URL
  const preselectedCustomerId = searchParams.get('customer');
  const { data: preselectedCustomer } = useQuery({
    queryKey: ['customer', preselectedCustomerId],
    queryFn: async () => {
      if (!preselectedCustomerId) return null;
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', preselectedCustomerId)
        .single();
      if (error) return null;
      return data as Customer;
    },
    enabled: !!preselectedCustomerId,
  });

  // Auto-select customer from URL on mount
  useEffect(() => {
    if (preselectedCustomer && !selectedCustomer) {
      setSelectedCustomer(preselectedCustomer);
      setIsOpen(true);
    }
  }, [preselectedCustomer]);

  // Query customer orders when a customer is selected
  const { data: customerOrders, isLoading: loadingOrders } = useQuery({
    queryKey: ['customer-orders', selectedCustomer?.id],
    queryFn: async () => {
      if (!selectedCustomer) return [];
      const { data, error } = await supabase
        .from('customer_orders')
        .select('*, book:books(*, current_supplier:suppliers(*))')
        .eq('customer_id', selectedCustomer.id)
        .in('status', ['completed', 'ready', 'ordered', 'picked_up', 'received']) // Orders that can be returned
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CustomerOrder[];
    },
    enabled: !!selectedCustomer,
  });

  const { data: returns, isLoading } = useQuery({
    queryKey: ['returns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('returns')
        .select('*, book:books(*), supplier:suppliers(*), customer_order:customer_orders(*, customer:customers(*))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Return[];
    },
  });

  // Calculate refund amount when order is selected
  useEffect(() => {
    if (selectedOrder) {
      const unitPrice = selectedOrder.final_price || selectedOrder.total_amount || 0;
      const refundAmount = (unitPrice / selectedOrder.quantity) * newReturn.quantity;
      setNewReturn(prev => ({ ...prev, refund_amount: refundAmount }));
    }
  }, [selectedOrder, newReturn.quantity]);

  // Process the return with refund
  const handleProcessReturn = async () => {
    if (!newReturn.book_id) {
      toast.error('Please select a book or order to return');
      return;
    }
    if (!newReturn.supplier_id) {
      toast.error('Please select a supplier to return to');
      return;
    }

    setIsProcessing(true);
    try {
      const originalPaymentMethod = selectedOrder?.payment_method;
      
      // If original payment was card and refund type is card, process card refund
      if (newReturn.refund_type === 'card' && originalPaymentMethod === 'card') {
        // For card refunds, we would call the Sola/Cardknox refund endpoint
        // This requires the original transaction ID
        const { data: originalPayment } = await supabase
          .from('customer_payments')
          .select('transaction_id')
          .eq('order_id', selectedOrder?.id)
          .eq('payment_method', 'card')
          .single();
        
        if (!originalPayment?.transaction_id) {
          toast.error('Cannot find original card transaction for refund. Please process as cash refund or store credit.');
          setIsProcessing(false);
          return;
        }

        // Call refund endpoint (would need to create this edge function)
        const { data: refundResult, error: refundError } = await supabase.functions.invoke('process-sola-payment', {
          body: {
            amount: newReturn.refund_amount,
            isRefund: true,
            originalTransactionId: originalPayment.transaction_id,
            customerId: selectedCustomer?.id,
          }
        });

        if (refundError || !refundResult?.success) {
          toast.error(refundResult?.message || 'Card refund failed. Please try cash refund or store credit.');
          setIsProcessing(false);
          return;
        }
      }

      // Create return record
      const { data: returnRecord, error: returnError } = await supabase
        .from('returns')
        .insert({
          book_id: newReturn.book_id,
          supplier_id: newReturn.supplier_id,
          reason: newReturn.reason,
          reason_details: newReturn.reason_details,
          quantity: newReturn.quantity,
          customer_order_id: newReturn.customer_order_id || null,
          status: 'pending',
          refund_type: newReturn.refund_type,
          refund_amount: newReturn.refund_amount,
          original_payment_method: originalPaymentMethod || null,
          refunded_at: new Date().toISOString(),
          return_to_supplier: newReturn.return_to_supplier,
          supplier_return_reason: newReturn.supplier_return_reason || null,
          supplier_return_status: newReturn.return_to_supplier ? 'pending' : null,
        })
        .select()
        .single();
      
      if (returnError) throw returnError;
      
      // If book needs to be returned to supplier, create supplier return item
      if (newReturn.return_to_supplier && newReturn.supplier_id) {
        await supabase.from('supplier_return_items').insert({
          return_id: returnRecord.id,
          book_id: newReturn.book_id,
          supplier_id: newReturn.supplier_id,
          quantity: newReturn.quantity,
          reason: newReturn.supplier_return_reason || newReturn.reason,
          reason_details: newReturn.reason_details,
          status: 'pending',
        });
      }

      // Update the customer order status to 'returned' if linked
      if (newReturn.customer_order_id) {
        await supabase
          .from('customer_orders')
          .update({ status: 'returned' })
          .eq('id', newReturn.customer_order_id);
      }

      // Handle refund based on type
      if (selectedCustomer && newReturn.refund_amount > 0) {
        if (newReturn.refund_type === 'store_credit') {
          // Add to customer's store credit
          const currentCredit = selectedCustomer.store_credit || 0;
          await supabase
            .from('customers')
            .update({ store_credit: currentCredit + newReturn.refund_amount })
            .eq('id', selectedCustomer.id);
          
          toast.success(`Return processed. $${newReturn.refund_amount.toFixed(2)} added to store credit.`);
        } else if (newReturn.refund_type === 'cash' || newReturn.refund_type === 'card') {
          // Create negative payment record to track the refund
          await supabase.from('customer_payments').insert({
            customer_id: selectedCustomer.id,
            order_id: selectedOrder?.id || null,
            amount: newReturn.refund_amount,
            payment_method: newReturn.refund_type,
            is_refund: true,
            return_id: returnRecord.id,
            notes: `Refund for return - ${reasonLabels[newReturn.reason]}`,
          });
          
          // Update customer balance if they had outstanding balance
          const currentBalance = selectedCustomer.outstanding_balance || 0;
          if (currentBalance > 0) {
            const newBalance = Math.max(0, currentBalance - newReturn.refund_amount);
            await supabase
              .from('customers')
              .update({ outstanding_balance: newBalance })
              .eq('id', selectedCustomer.id);
          }
          
          toast.success(`Return processed. $${newReturn.refund_amount.toFixed(2)} refunded via ${newReturn.refund_type}.`);
        }
      }

      // Update inventory (add book back to stock)
      const book = books?.find(b => b.id === newReturn.book_id);
      if (book) {
        await supabase
          .from('books')
          .update({ quantity_in_stock: (book.quantity_in_stock || 0) + newReturn.quantity })
          .eq('id', newReturn.book_id);
      }

      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['customer-orders'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', selectedCustomer?.id] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      
      setIsOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error('Failed to process return: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const createReturn = useMutation({
    mutationFn: async (returnData: typeof newReturn) => {
      const { data, error } = await supabase
        .from('returns')
        .insert({
          book_id: returnData.book_id,
          supplier_id: returnData.supplier_id,
          reason: returnData.reason,
          reason_details: returnData.reason_details,
          quantity: returnData.quantity,
          customer_order_id: returnData.customer_order_id || null,
          status: 'pending',
        })
        .select()
        .single();
      if (error) throw error;
      
      // Update the customer order status to 'returned' if linked
      if (returnData.customer_order_id) {
        await supabase
          .from('customer_orders')
          .update({ status: 'returned' })
          .eq('id', returnData.customer_order_id);
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['customer-orders'] });
      toast.success('Return created successfully');
      setIsOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to create return: ' + error.message);
    },
  });

  const updateReturnStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('returns')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      toast.success('Return updated');
    },
  });

  const resetForm = () => {
    setSelectedCustomer(null);
    setSelectedOrder(null);
    setNewReturn({ 
      book_id: '', 
      supplier_id: '', 
      reason: 'customer_return', 
      reason_details: '', 
      quantity: 1,
      customer_order_id: '',
      refund_type: 'store_credit',
      refund_amount: 0,
      return_to_supplier: false,
      supplier_return_reason: '',
    });
  };

  const handleSelectOrder = (order: CustomerOrder) => {
    setSelectedOrder(order);
    // Get supplier from book's current_supplier
    const supplierId = order.book?.current_supplier?.id || order.book?.current_supplier_id || '';
    // Determine default refund type based on original payment method
    const defaultRefundType = order.payment_method === 'card' ? 'card' : 'cash';
    const unitPrice = order.final_price || order.total_amount || 0;
    const refundAmount = (unitPrice / order.quantity) * order.quantity;
    
    setNewReturn({
      ...newReturn,
      book_id: order.book_id,
      supplier_id: supplierId,
      customer_order_id: order.id,
      quantity: order.quantity,
      refund_type: defaultRefundType as 'cash' | 'card' | 'store_credit',
      refund_amount: refundAmount,
    });
  };

  const handleCreate = () => {
    if (!newReturn.book_id) {
      toast.error('Please select a book or order to return');
      return;
    }
    if (!newReturn.supplier_id) {
      toast.error('Please select a supplier to return to');
      return;
    }
    createReturn.mutate(newReturn);
  };

  return (
    <AppLayout 
      title="Returns" 
      subtitle="Process customer returns and send books back to suppliers"
      actions={
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Return
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Process Return</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 mt-4">
              {/* Step 1: Search Customer */}
              <div className="space-y-3">
                <Label className="text-base font-medium flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">1</span>
                  Find Customer
                </Label>
                <CustomerSearch 
                  onSelect={(customer) => {
                    setSelectedCustomer(customer);
                    setSelectedOrder(null);
                    setNewReturn({ ...newReturn, book_id: '', supplier_id: '', customer_order_id: '' });
                  }}
                  selectedCustomer={selectedCustomer}
                />
              </div>

              {/* Step 2: Select Order */}
              {selectedCustomer && (
                <div className="space-y-3">
                  <Label className="text-base font-medium flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">2</span>
                    Select Order to Return
                  </Label>
                  
                  {loadingOrders ? (
                    <p className="text-sm text-muted-foreground">Loading orders...</p>
                  ) : customerOrders && customerOrders.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {customerOrders.map((order) => (
                        <Card 
                          key={order.id} 
                          className={`cursor-pointer transition-all ${
                            selectedOrder?.id === order.id 
                              ? 'ring-2 ring-primary bg-primary/5' 
                              : 'hover:bg-secondary/50'
                          }`}
                          onClick={() => handleSelectOrder(order)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-accent/10 flex items-center justify-center">
                                  <Book className="w-4 h-4 text-accent" />
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{order.book?.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Qty: {order.quantity} • {new Date(order.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {order.status}
                                </Badge>
                                {selectedOrder?.id === order.id && (
                                  <CheckCircle className="w-5 h-5 text-primary" />
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card className="bg-muted/50">
                      <CardContent className="py-6 text-center">
                        <Package className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No returnable orders found</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Step 3: Return Details */}
              {(selectedOrder || !selectedCustomer) && (
                <div className="space-y-3">
                  <Label className="text-base font-medium flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">
                      {selectedCustomer ? '3' : '2'}
                    </span>
                    Return Details
                  </Label>
                  
                  {!selectedCustomer && (
                    <>
                      <div className="space-y-2">
                        <Label>Book *</Label>
                        <Select value={newReturn.book_id} onValueChange={(v) => setNewReturn({ ...newReturn, book_id: v })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select book" />
                          </SelectTrigger>
                          <SelectContent>
                            {books?.map((book) => (
                              <SelectItem key={book.id} value={book.id}>
                                {book.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                  
                  {/* Only show supplier dropdown if no order selected (manual return) */}
                  {!selectedOrder ? (
                    <div className="space-y-2">
                      <Label>Return to Supplier *</Label>
                      <Select value={newReturn.supplier_id} onValueChange={(v) => setNewReturn({ ...newReturn, supplier_id: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers?.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Return to Supplier</Label>
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                        <Truck className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">
                          {selectedOrder.book?.current_supplier?.name || 'Unknown supplier'}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Reason</Label>
                    <Select value={newReturn.reason} onValueChange={(v: any) => setNewReturn({ ...newReturn, reason: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer_return">Customer Return</SelectItem>
                        <SelectItem value="damaged">Damaged</SelectItem>
                        <SelectItem value="wrong_item">Wrong Item</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      max={selectedOrder?.quantity || 100}
                      value={newReturn.quantity}
                      onChange={(e) => setNewReturn({ ...newReturn, quantity: parseInt(e.target.value) || 1 })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Details</Label>
                    <Textarea
                      value={newReturn.reason_details}
                      onChange={(e) => setNewReturn({ ...newReturn, reason_details: e.target.value })}
                      placeholder="Additional details about the return..."
                      rows={3}
                    />
                  </div>

                  {/* Refund Section - Only show for customer returns with an order */}
                  {selectedOrder && selectedCustomer && (
                    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                      <Label className="text-base font-medium flex items-center gap-2">
                        <DollarSign className="w-5 h-5" />
                        Refund Options
                      </Label>
                      
                      <div className="space-y-2">
                        <Label>Refund Amount</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={newReturn.refund_amount}
                            onChange={(e) => setNewReturn({ ...newReturn, refund_amount: parseFloat(e.target.value) || 0 })}
                            className="pl-9"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label>Refund Method</Label>
                        <RadioGroup 
                          value={newReturn.refund_type}
                          onValueChange={(value: 'cash' | 'card' | 'store_credit') => setNewReturn({ ...newReturn, refund_type: value })}
                          className="grid grid-cols-1 gap-2"
                        >
                          {selectedOrder.payment_method === 'card' && (
                            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                              <RadioGroupItem value="card" id="refund-card" />
                              <Label htmlFor="refund-card" className="flex items-center gap-2 cursor-pointer flex-1">
                                <CreditCard className="w-4 h-4 text-blue-500" />
                                <div>
                                  <div className="font-medium">Refund to Card</div>
                                  <div className="text-xs text-muted-foreground">Process refund back to original card</div>
                                </div>
                              </Label>
                            </div>
                          )}
                          
                          <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                            <RadioGroupItem value="cash" id="refund-cash" />
                            <Label htmlFor="refund-cash" className="flex items-center gap-2 cursor-pointer flex-1">
                              <Banknote className="w-4 h-4 text-green-500" />
                              <div>
                                <div className="font-medium">Cash Refund</div>
                                <div className="text-xs text-muted-foreground">Give cash back to customer</div>
                              </div>
                            </Label>
                          </div>
                          
                          <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                            <RadioGroupItem value="store_credit" id="refund-credit" />
                            <Label htmlFor="refund-credit" className="flex items-center gap-2 cursor-pointer flex-1">
                              <Gift className="w-4 h-4 text-purple-500" />
                              <div>
                                <div className="font-medium">Store Credit</div>
                                <div className="text-xs text-muted-foreground">Add to customer's store credit balance</div>
                              </div>
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>

                      {selectedOrder.payment_method === 'card' && newReturn.refund_type !== 'card' && (
                        <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                          <p className="text-sm text-orange-600">
                            ⚠️ Original payment was by card. Are you sure you want to give a {newReturn.refund_type} refund instead?
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Return to Supplier Section */}
                  <div className="space-y-4 p-4 border rounded-lg bg-blue-50/50 dark:bg-blue-900/10">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium flex items-center gap-2">
                        <Truck className="w-5 h-5 text-blue-500" />
                        Return Book to Supplier?
                      </Label>
                      <input
                        type="checkbox"
                        checked={newReturn.return_to_supplier}
                        onChange={(e) => setNewReturn({ ...newReturn, return_to_supplier: e.target.checked })}
                        className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      If enabled, this book will be included in the next order to the supplier as a return
                    </p>
                    
                    {newReturn.return_to_supplier && (
                      <div className="space-y-3 mt-3 pt-3 border-t">
                        <div className="space-y-2">
                          <Label>Reason for Supplier Return</Label>
                          <Select 
                            value={newReturn.supplier_return_reason} 
                            onValueChange={(v) => setNewReturn({ ...newReturn, supplier_return_reason: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select reason" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="damaged">Damaged/Defective</SelectItem>
                              <SelectItem value="wrong_item">Wrong Item Received</SelectItem>
                              <SelectItem value="not_ordered">Not Ordered</SelectItem>
                              <SelectItem value="quality_issue">Quality Issue</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="p-3 bg-blue-100/50 dark:bg-blue-900/20 rounded-lg">
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            📦 This book will appear in "Pending Returns" and will be included when you next send an order to {selectedOrder?.book?.current_supplier?.name || 'the supplier'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <Button 
                    onClick={handleProcessReturn} 
                    className="w-full"
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Process Return
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="space-y-6 animate-fade-in">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading returns...</div>
        ) : returns && returns.length > 0 ? (
          <div className="space-y-3">
            {returns.map((ret) => (
              <Card key={ret.id} className="shadow-soft">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                        <RotateCcw className="w-5 h-5 text-destructive" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Book className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{ret.book?.title}</span>
                        </div>
                        {ret.customer_order?.customer && (
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <User className="w-3.5 h-3.5" />
                            <span>Customer: {ret.customer_order.customer.name}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <Truck className="w-3.5 h-3.5" />
                          <span>Return to: {ret.supplier?.name}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-sm">
                          <span className="px-2 py-0.5 bg-secondary rounded-full">
                            {reasonLabels[ret.reason]}
                          </span>
                          <span>Qty: {ret.quantity}</span>
                          <span className="text-muted-foreground">
                            {new Date(ret.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {ret.reason_details && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            {ret.reason_details}
                          </p>
                        )}
                        {/* Show refund info */}
                        {ret.refund_amount && ret.refund_amount > 0 && (
                          <div className="mt-2 flex items-center gap-2">
                            <Badge variant={ret.refund_type === 'store_credit' ? 'secondary' : 'outline'} className="flex items-center gap-1">
                              {ret.refund_type === 'card' && <CreditCard className="w-3 h-3" />}
                              {ret.refund_type === 'cash' && <Banknote className="w-3 h-3" />}
                              {ret.refund_type === 'store_credit' && <Gift className="w-3 h-3" />}
                              ${ret.refund_amount.toFixed(2)} {ret.refund_type?.replace('_', ' ')}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                    <Select 
                      value={ret.status} 
                      onValueChange={(v) => updateReturnStatus.mutate({ id: ret.id, status: v })}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="shadow-soft">
            <CardContent className="py-12 text-center">
              <RotateCcw className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground">No returns recorded</p>
              <Button onClick={() => setIsOpen(true)} className="mt-4">
                Process a return
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
