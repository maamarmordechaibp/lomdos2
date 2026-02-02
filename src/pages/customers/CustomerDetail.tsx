import { useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft,
  User,
  Phone,
  PhoneCall,
  Mail,
  Bell,
  DollarSign,
  Book,
  ShoppingCart,
  Edit2,
  Save,
  X,
  Printer,
  RotateCcw,
  History,
  TrendingUp,
  Package,
  CreditCard,
  Banknote,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  Trash2,
  Pencil,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Customer, CustomerOrder, CustomerPayment } from '@/types/database';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { PaymentStatusBadge } from '@/components/orders/PaymentStatusBadge';
import { useClickToCall } from '@/hooks/useCallLogs';
import { useDeleteCustomer } from '@/hooks/useCustomers';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  const clickToCall = useClickToCall();
  const deleteCustomer = useDeleteCustomer();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Customer>>({});
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'check'>('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Edit payment state
  const [editPaymentDialog, setEditPaymentDialog] = useState(false);
  const [editingPayment, setEditingPayment] = useState<CustomerPayment | null>(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState('');
  const [editPaymentReason, setEditPaymentReason] = useState('');

  // Format card number with spaces
  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(' ') : v;
  };

  // Format expiry as MM/YY
  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  // Handle opening payment dialog
  const handleOpenPaymentDialog = () => {
    setPaymentAmount(customer?.outstanding_balance?.toFixed(2) || '');
    setPaymentMethod('cash');
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');
    setPaymentNotes('');
    setPaymentDialog(true);
  };

  // Fetch customer
  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Customer;
    },
    enabled: !!id,
  });

  // Fetch all customer orders
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['customer-orders', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_orders')
        .select('*, book:books(*)')
        .eq('customer_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CustomerOrder[];
    },
    enabled: !!id,
  });

  // Fetch payment history
  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ['customer-payments', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_payments')
        .select('*, order:customer_orders(*, book:books(*))')
        .eq('customer_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CustomerPayment[];
    },
    enabled: !!id,
  });

  // Update customer mutation
  const updateCustomer = useMutation({
    mutationFn: async (updates: Partial<Customer>) => {
      const { data, error } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer updated');
      setIsEditing(false);
    },
    onError: (error) => {
      toast.error('Failed to update: ' + error.message);
    },
  });

  // Handle payment recording with card processing
  const handleRecordPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsProcessingPayment(true);
    try {
      // If card payment, process through Sola/Cardknox payment gateway
      if (paymentMethod === 'card') {
        const cleanCardNumber = cardNumber.replace(/\s/g, '');
        if (cleanCardNumber.length < 15) {
          throw new Error('Invalid card number');
        }
        if (!cardExpiry || cardExpiry.length < 5) {
          throw new Error('Invalid expiry date');
        }
        if (!cardCvv || cardCvv.length < 3) {
          throw new Error('Invalid CVV');
        }

        const { data: paymentResult, error: processError } = await supabase.functions.invoke('process-sola-payment', {
          body: {
            amount: amount,
            cardNumber: cleanCardNumber,
            cardExpiry: cardExpiry.replace('/', ''),
            cardCvv: cardCvv,
            customerId: id,
            customerName: customer?.name,
          },
        });

        if (processError || !paymentResult?.success) {
          throw new Error(paymentResult?.message || processError?.message || 'Payment processing failed');
        }

        // Payment recorded on server side, just refresh UI
        queryClient.invalidateQueries({ queryKey: ['customer', id] });
        queryClient.invalidateQueries({ queryKey: ['customer-payments', id] });
        queryClient.invalidateQueries({ queryKey: ['customers-with-balance'] });
        toast.success(`Card payment of $${amount.toFixed(2)} processed! Ref: ${paymentResult.transactionId}`);
        setPaymentDialog(false);
        setPaymentAmount('');
        setPaymentNotes('');
        setCardNumber('');
        setCardExpiry('');
        setCardCvv('');
        setIsProcessingPayment(false);
        return;
      }

      // Create payment record
      const { error: paymentError } = await supabase
        .from('customer_payments')
        .insert({
          customer_id: id,
          amount,
          payment_method: paymentMethod,
          notes: paymentNotes || null,
        });
      if (paymentError) throw paymentError;

      // Update customer balance
      const newBalance = Math.max(0, (customer?.outstanding_balance || 0) - amount);
      const { error: updateError } = await supabase
        .from('customers')
        .update({ outstanding_balance: newBalance })
        .eq('id', id);
      if (updateError) throw updateError;

      // Success
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customer-payments', id] });
      queryClient.invalidateQueries({ queryKey: ['customers-with-balance'] });
      toast.success('Payment recorded');
      setPaymentDialog(false);
      setPaymentAmount('');
      setPaymentNotes('');
      setCardNumber('');
      setCardExpiry('');
      setCardCvv('');
    } catch (error: any) {
      toast.error('Failed to record payment: ' + error.message);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Keep the old mutation for backwards compatibility but it's not used now
  const recordPayment = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(paymentAmount);
      if (!amount || amount <= 0) throw new Error('Invalid amount');
      
      // Create payment record
      const { error: paymentError } = await supabase
        .from('customer_payments')
        .insert({
          customer_id: id,
          amount,
          payment_method: paymentMethod,
          notes: paymentNotes || null,
        });
      if (paymentError) throw paymentError;
      
      // Update customer balance
      const newBalance = Math.max(0, (customer?.outstanding_balance || 0) - amount);
      const { error: updateError } = await supabase
        .from('customers')
        .update({ outstanding_balance: newBalance })
        .eq('id', id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customer-payments', id] });
      queryClient.invalidateQueries({ queryKey: ['customers-with-balance'] });
      toast.success('Payment recorded');
      setPaymentDialog(false);
      setPaymentAmount('');
      setPaymentNotes('');
    },
    onError: (error) => {
      toast.error('Failed to record payment: ' + error.message);
    },
  });

  // Calculate statistics
  const stats = orders ? {
    totalOrders: orders.length,
    totalBooks: orders.reduce((sum, o) => sum + (o.quantity || 0), 0),
    totalRevenue: orders.reduce((sum, o) => sum + (o.final_price || o.total_amount || 0), 0),
    totalCost: orders.reduce((sum, o) => sum + (o.actual_cost || 0), 0),
    totalProfit: orders.reduce((sum, o) => {
      const revenue = o.final_price || o.total_amount || 0;
      const cost = o.actual_cost || 0;
      return sum + (revenue - cost);
    }, 0),
    pendingOrders: orders.filter(o => ['pending', 'ordered', 'received', 'ready'].includes(o.status)).length,
    completedOrders: orders.filter(o => o.status === 'picked_up').length,
    unpaidOrders: orders.filter(o => o.payment_status !== 'paid').length,
  } : null;

  // Handle delete customer
  const handleDeleteCustomer = async () => {
    if (!id) return;
    try {
      await deleteCustomer.mutateAsync(id);
      navigate('/customers');
    } catch (error) {
      // Error is handled by the hook
    }
    setShowDeleteDialog(false);
  };

  // Handle edit payment (cash only)
  const handleOpenEditPayment = (payment: CustomerPayment) => {
    if (payment.payment_method === 'card') {
      toast.error('Card payments cannot be edited. Please process a refund instead.');
      return;
    }
    setEditingPayment(payment);
    setEditPaymentAmount(payment.amount.toString());
    setEditPaymentReason('');
    setEditPaymentDialog(true);
  };

  const handleEditPayment = async () => {
    if (!editingPayment || !id) return;
    
    const newAmount = parseFloat(editPaymentAmount);
    if (isNaN(newAmount) || newAmount < 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    if (!editPaymentReason.trim()) {
      toast.error('Please provide a reason for this edit');
      return;
    }
    
    const oldAmount = editingPayment.amount;
    const difference = newAmount - oldAmount;
    
    try {
      // Update the payment record
      const { error: paymentError } = await supabase
        .from('customer_payments')
        .update({
          amount: newAmount,
          is_edited: true,
          original_amount: editingPayment.original_amount || oldAmount,
          edit_reason: editPaymentReason,
          edited_at: new Date().toISOString(),
        })
        .eq('id', editingPayment.id);
      
      if (paymentError) throw paymentError;
      
      // Adjust customer balance based on difference
      // If we increase the payment amount, decrease the balance (more was paid)
      // If we decrease the payment amount, increase the balance (less was paid)
      const currentBalance = customer?.outstanding_balance || 0;
      const newBalance = Math.max(0, currentBalance - difference);
      
      const { error: balanceError } = await supabase
        .from('customers')
        .update({ outstanding_balance: newBalance })
        .eq('id', id);
      
      if (balanceError) throw balanceError;
      
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customer-payments', id] });
      queryClient.invalidateQueries({ queryKey: ['customers-with-balance'] });
      
      toast.success('Payment updated successfully');
      setEditPaymentDialog(false);
      setEditingPayment(null);
    } catch (error: any) {
      toast.error('Failed to update payment: ' + error.message);
    }
  };

  const handleEdit = () => {
    if (customer) {
      setEditForm({
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        notification_preference: customer.notification_preference,
        default_discount_type: customer.default_discount_type || 'none',
        default_discount_value: customer.default_discount_value || 0,
      });
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    updateCustomer.mutate(editForm);
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Customer Report - ${customer?.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { border-bottom: 2px solid #333; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            .stat { display: inline-block; margin: 10px 20px 10px 0; }
            .stat-value { font-size: 24px; font-weight: bold; }
            .stat-label { color: #666; }
            .balance { color: ${(customer?.outstanding_balance || 0) > 0 ? '#dc2626' : '#16a34a'}; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>Customer Report: ${customer?.name}</h1>
          <p><strong>Phone:</strong> ${customer?.phone || 'N/A'}</p>
          <p><strong>Email:</strong> ${customer?.email || 'N/A'}</p>
          <p><strong>Report Date:</strong> ${format(new Date(), 'PPpp')}</p>
          
          <h2>Summary</h2>
          <div class="stat"><div class="stat-value">${stats?.totalOrders}</div><div class="stat-label">Total Orders</div></div>
          <div class="stat"><div class="stat-value">${stats?.totalBooks}</div><div class="stat-label">Books Ordered</div></div>
          <div class="stat"><div class="stat-value">$${stats?.totalRevenue.toFixed(2)}</div><div class="stat-label">Total Revenue</div></div>
          <div class="stat"><div class="stat-value">$${stats?.totalProfit.toFixed(2)}</div><div class="stat-label">Total Profit</div></div>
          <div class="stat"><div class="stat-value balance">$${(customer?.outstanding_balance || 0).toFixed(2)}</div><div class="stat-label">Outstanding Balance</div></div>
          
          <h2>Order History</h2>
          <table>
            <tr>
              <th>Date</th>
              <th>Book</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Status</th>
              <th>Payment</th>
            </tr>
            ${orders?.map(o => `
              <tr>
                <td>${format(new Date(o.created_at), 'MM/dd/yy')}</td>
                <td>${o.book?.title || 'Unknown'}</td>
                <td>${o.quantity}</td>
                <td>$${(o.final_price || o.total_amount || 0).toFixed(2)}</td>
                <td>${o.status}</td>
                <td>${o.payment_status}</td>
              </tr>
            `).join('')}
          </table>
          
          <h2>Payment History</h2>
          <table>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Method</th>
            </tr>
            ${payments?.map(p => `
              <tr>
                <td>${format(new Date(p.created_at), 'MM/dd/yy')}</td>
                <td>$${p.amount.toFixed(2)}</td>
                <td>${p.payment_method}</td>
              </tr>
            `).join('')}
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const notificationLabels: Record<string, string> = {
    phone: 'Phone Call',
    sms: 'SMS',
    email: 'Email',
  };

  if (customerLoading) {
    return (
      <AppLayout title="Customer Details" subtitle="Loading...">
        <div className="text-center py-12">Loading...</div>
      </AppLayout>
    );
  }

  if (!customer) {
    return (
      <AppLayout title="Customer Not Found" subtitle="">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Customer not found</p>
          <Button asChild>
            <Link to="/customers">Back to Customers</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={customer.name}
      subtitle="Customer details and history"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Print Report
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/returns?customer=${id}`}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Process Return
            </Link>
          </Button>
          <Button variant="outline" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          <Button asChild variant="outline">
            <Link to="/customers">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
        </div>
      }
    >
      <div className="space-y-6" ref={printRef}>
        {/* Customer Info & Quick Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Customer Info Card */}
          <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Customer Info
              </CardTitle>
              {!isEditing ? (
                <Button variant="ghost" size="sm" onClick={handleEdit}>
                  <Edit2 className="w-4 h-4" />
                </Button>
              ) : (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleSave}>
                    <Save className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={editForm.phone || ''}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      value={editForm.email || ''}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notification Preference</Label>
                    <Select
                      value={editForm.notification_preference}
                      onValueChange={(v: any) => setEditForm({ ...editForm, notification_preference: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="phone">Phone Call</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 pt-2 border-t">
                    <Label>Default Discount (optional)</Label>
                    <div className="flex gap-2">
                      <Select
                        value={editForm.default_discount_type || 'none'}
                        onValueChange={(v: any) => setEditForm({ ...editForm, default_discount_type: v === 'none' ? null : v })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No discount</SelectItem>
                          <SelectItem value="percentage">% Off</SelectItem>
                          <SelectItem value="fixed">$ Off</SelectItem>
                        </SelectContent>
                      </Select>
                      {editForm.default_discount_type && (
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editForm.default_discount_value || ''}
                          onChange={(e) => setEditForm({ ...editForm, default_discount_value: parseFloat(e.target.value) || null })}
                          placeholder={editForm.default_discount_type === 'percentage' ? '10' : '5.00'}
                          className="flex-1"
                        />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">This discount will apply automatically at checkout</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="flex-1">{customer.phone || 'No phone'}</span>
                    {customer.phone && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => clickToCall.mutate({
                          phone_number: customer.phone,
                          customer_id: customer.id,
                          customer_name: customer.name,
                        })}
                        disabled={clickToCall.isPending}
                      >
                        <PhoneCall className="w-3 h-3 mr-1" />
                        Call
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{customer.email || 'No email'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Bell className="w-4 h-4 text-muted-foreground" />
                    <span>{notificationLabels[customer.notification_preference] || 'Phone Call'}</span>
                  </div>
                  {customer.default_discount_type && customer.default_discount_value && (
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        {customer.default_discount_type === 'percentage' 
                          ? `${customer.default_discount_value}% off` 
                          : `$${customer.default_discount_value} off`}
                      </Badge>
                      <span className="text-xs text-muted-foreground">Default discount</span>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground pt-2">
                    Customer since {format(new Date(customer.created_at), 'MMM d, yyyy')}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Outstanding Balance Card */}
          <Card className={`lg:col-span-1 ${(customer.outstanding_balance || 0) > 0 ? 'border-orange-500/50' : 'border-green-500/50'}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold mb-2 ${(customer.outstanding_balance || 0) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                ${(customer.outstanding_balance || 0).toFixed(2)}
                <span className="text-sm font-normal text-muted-foreground ml-2">owed</span>
              </div>
              {(customer.store_credit || 0) > 0 && (
                <div className="text-lg font-medium text-purple-600 mb-3">
                  ${(customer.store_credit || 0).toFixed(2)}
                  <span className="text-sm font-normal text-muted-foreground ml-2">store credit</span>
                </div>
              )}
              {(customer.outstanding_balance || 0) > 0 ? (
                <Button onClick={handleOpenPaymentDialog} className="w-full">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Record Payment
                </Button>
              ) : (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span>No outstanding balance</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats Card */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl font-bold">{stats?.totalOrders || 0}</div>
                  <div className="text-xs text-muted-foreground">Total Orders</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats?.totalBooks || 0}</div>
                  <div className="text-xs text-muted-foreground">Books Ordered</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">${stats?.totalRevenue.toFixed(2) || '0.00'}</div>
                  <div className="text-xs text-muted-foreground">Total Revenue</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">${stats?.totalProfit.toFixed(2) || '0.00'}</div>
                  <div className="text-xs text-muted-foreground">Total Profit</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">${stats?.totalCost.toFixed(2) || '0.00'}</div>
                  <div className="text-xs text-muted-foreground">Total Cost</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats?.pendingOrders || 0}</div>
                  <div className="text-xs text-muted-foreground">Pending</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Orders and Payments */}
        <Card>
          <Tabs defaultValue="orders">
            <CardHeader>
              <TabsList>
                <TabsTrigger value="orders" className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  Orders ({orders?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="payments" className="flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Payments ({payments?.length || 0})
                </TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="orders" className="m-0">
                {ordersLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading orders...</div>
                ) : orders && orders.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Book</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>Profit</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => {
                        const revenue = order.final_price || order.total_amount || 0;
                        const cost = order.actual_cost || 0;
                        const profit = revenue - cost;
                        const balance = (order.balance_due || 0);
                        
                        return (
                          <TableRow key={order.id}>
                            <TableCell className="whitespace-nowrap">
                              {format(new Date(order.created_at), 'MM/dd/yy')}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{order.book?.title || 'Unknown'}</div>
                              {order.book?.title_hebrew && (
                                <div className="text-xs text-muted-foreground" dir="rtl">{order.book.title_hebrew}</div>
                              )}
                            </TableCell>
                            <TableCell>{order.quantity}</TableCell>
                            <TableCell>${revenue.toFixed(2)}</TableCell>
                            <TableCell className="text-muted-foreground">${cost.toFixed(2)}</TableCell>
                            <TableCell className={profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                              ${profit.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <OrderStatusBadge status={order.status} />
                            </TableCell>
                            <TableCell>
                              <PaymentStatusBadge status={order.payment_status || 'unpaid'} />
                            </TableCell>
                            <TableCell className={balance > 0 ? 'text-orange-600 font-medium' : ''}>
                              {balance > 0 ? `$${balance.toFixed(2)}` : '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>No orders yet</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="payments" className="m-0">
                {paymentsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading payments...</div>
                ) : payments && payments.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Order</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(payment.created_at), 'MM/dd/yy h:mm a')}
                          </TableCell>
                          <TableCell className={`font-medium ${payment.is_refund ? 'text-red-600' : 'text-green-600'}`}>
                            {payment.is_refund ? '-' : ''}${payment.amount.toFixed(2)}
                            {payment.is_edited && (
                              <span className="ml-1 text-xs text-orange-500" title={`Original: $${payment.original_amount?.toFixed(2) || payment.amount.toFixed(2)}`}>
                                (edited)
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="capitalize">{payment.payment_method}</TableCell>
                          <TableCell>
                            {payment.order?.book?.title || '-'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {payment.notes || '-'}
                            {payment.edit_reason && (
                              <div className="text-xs text-orange-500">Edit reason: {payment.edit_reason}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            {payment.payment_method !== 'card' && !payment.is_refund && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditPayment(payment)}
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                            )}
                            {payment.payment_method === 'card' && (
                              <span className="text-xs text-muted-foreground">Card - refund only</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>No payment history</p>
                  </div>
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>

      {/* Payment Dialog */}
      <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a balance payment from {customer.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="pl-9 h-9"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Card Input Fields */}
            {paymentMethod === 'card' && (
              <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
                <div className="space-y-1">
                  <Label className="text-sm">Card Number</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={cardNumber}
                      onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                      className="pl-9 h-9"
                      placeholder="4242 4242 4242 4242"
                      maxLength={19}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-sm">Expiry</Label>
                    <Input
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                      placeholder="MM/YY"
                      maxLength={5}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">CVV</Label>
                    <Input
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="123"
                      maxLength={4}
                      type="password"
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Payment notes..."
                className="h-9"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setPaymentDialog(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={handleRecordPayment} disabled={isProcessingPayment} className="w-full sm:w-auto">
              {isProcessingPayment ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : paymentMethod === 'card' ? 'Pay by Card' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Payment Dialog (Cash only) */}
      <Dialog open={editPaymentDialog} onOpenChange={setEditPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
            <DialogDescription>
              Edit this cash payment. Card payments must be refunded through the processor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editingPayment?.original_amount && (
              <div className="p-3 bg-orange-500/10 rounded-lg text-sm">
                <span className="text-orange-600">Original amount: ${editingPayment.original_amount.toFixed(2)}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label>Current Amount</Label>
              <div className="text-lg font-medium">${editingPayment?.amount.toFixed(2)}</div>
            </div>
            <div className="space-y-2">
              <Label>New Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editPaymentAmount}
                  onChange={(e) => setEditPaymentAmount(e.target.value)}
                  className="pl-9"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason for Edit *</Label>
              <Input
                value={editPaymentReason}
                onChange={(e) => setEditPaymentReason(e.target.value)}
                placeholder="e.g., Customer gave $100, not $50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPaymentDialog(false)}>Cancel</Button>
            <Button onClick={handleEditPayment}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Customer Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{customer.name}"? This action cannot be undone.
              The customer will only be deleted if they have no pending orders or outstanding balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCustomer}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCustomer.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
