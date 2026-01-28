import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DollarSign, 
  Search, 
  Phone, 
  Mail,
  AlertTriangle,
  User,
  CreditCard,
  History,
  Send,
  Loader2,
  Filter,
} from 'lucide-react';
import { useCustomersWithBalance, useCreateCustomerPayment, useAllCustomerPayments } from '@/hooks/useBalances';
import { useCustomers } from '@/hooks/useCustomers';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
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
import { Badge } from '@/components/ui/badge';
import { Customer, CustomerPayment } from '@/types/database';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useQueryClient } from '@tanstack/react-query';

export default function Balances() {
  const queryClient = useQueryClient();
  const { data: customersWithBalance, isLoading } = useCustomersWithBalance();
  const { data: allCustomers } = useCustomers();
  const { data: recentPayments } = useAllCustomerPayments();
  const createPayment = useCreateCustomerPayment();
  
  const [search, setSearch] = useState('');
  const [paymentDialog, setPaymentDialog] = useState<{ open: boolean; customer: Customer | null }>({ open: false, customer: null });
  const [historyDialog, setHistoryDialog] = useState<{ open: boolean; customer: Customer | null }>({ open: false, customer: null });
  const [reminderDialog, setReminderDialog] = useState({ open: false });
  
  const [paymentForm, setPaymentForm] = useState({ 
    amount: '', 
    method: 'cash' as 'cash' | 'card' | 'check' | 'other', 
    notes: '',
    cardNumber: '',
    cardExpiry: '',
    cardCvv: '',
  });
  const [processingCard, setProcessingCard] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Reminder filter state
  const [reminderFilter, setReminderFilter] = useState<'all' | '30' | '60' | '90'>('all');
  const [selectedForReminder, setSelectedForReminder] = useState<Set<string>>(new Set());
  const [sendingIndividual, setSendingIndividual] = useState<string | null>(null);

  const totalOwed = customersWithBalance?.reduce((sum, c) => sum + (c.outstanding_balance || 0), 0) || 0;
  
  const filteredCustomers = customersWithBalance?.filter(customer => 
    customer.name?.toLowerCase().includes(search.toLowerCase()) ||
    customer.phone?.includes(search) ||
    customer.email?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  // Filter customers by days with balance
  const getCustomersForReminder = () => {
    if (!customersWithBalance) return [];
    
    const today = new Date();
    return customersWithBalance.filter(customer => {
      if (reminderFilter === 'all') return true;
      
      const daysWithBalance = differenceInDays(today, new Date(customer.created_at));
      const filterDays = parseInt(reminderFilter);
      return daysWithBalance >= filterDays;
    });
  };

  const customersForReminder = getCustomersForReminder();

  const handleOpenPaymentDialog = (customer: Customer) => {
    setPaymentForm({ 
      amount: customer.outstanding_balance.toString(), 
      method: 'cash', 
      notes: '',
      cardNumber: '',
      cardExpiry: '',
      cardCvv: '',
    });
    setPaymentDialog({ open: true, customer });
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(' ') : value;
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  const handleRecordPayment = async () => {
    if (!paymentDialog.customer || !paymentForm.amount) return;
    
    const amount = parseFloat(paymentForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    // If card payment, process the card first
    if (paymentForm.method === 'card') {
      const cleanCard = paymentForm.cardNumber.replace(/\s/g, '');
      if (cleanCard.length < 15) {
        toast.error('Please enter a valid card number');
        return;
      }
      if (paymentForm.cardExpiry.length < 4) {
        toast.error('Please enter expiry (MM/YY)');
        return;
      }
      if (paymentForm.cardCvv.length < 3) {
        toast.error('Please enter CVV');
        return;
      }

      setProcessingCard(true);
      try {
        // Process card payment via Sola/Cardknox
        const { data, error } = await supabase.functions.invoke('process-sola-payment', {
          body: {
            amount,
            cardNumber: cleanCard,
            cardExpiry: paymentForm.cardExpiry.replace('/', ''),
            cardCvv: paymentForm.cardCvv,
            customerId: paymentDialog.customer.id,
            customerName: paymentDialog.customer.name,
          },
        });

        if (error || !data?.success) {
          toast.error(data?.message || 'Card payment failed');
          setProcessingCard(false);
          return;
        }

        // Payment processed and recorded on server side
        // Just invalidate queries to refresh the UI
        queryClient.invalidateQueries({ queryKey: ['customer-payments'] });
        queryClient.invalidateQueries({ queryKey: ['customers-with-balance'] });
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        queryClient.invalidateQueries({ queryKey: ['all-customer-payments'] });

        toast.success(`Card payment of $${amount.toFixed(2)} processed! Ref: ${data.transactionId}`);
        setProcessingCard(false);
        setPaymentDialog({ open: false, customer: null });
        setPaymentForm({ amount: '', method: 'cash', notes: '', cardNumber: '', cardExpiry: '', cardCvv: '' });
      } catch (err: any) {
        toast.error('Payment failed: ' + err.message);
        setProcessingCard(false);
      }
    } else {
      // Cash/Check/Other - just record the payment
      await createPayment.mutateAsync({
        customer_id: paymentDialog.customer.id,
        order_id: null,
        amount,
        payment_method: paymentForm.method,
        payment_type: 'balance',
        transaction_id: null,
        notes: paymentForm.notes || null,
      });
      
      setPaymentDialog({ open: false, customer: null });
    }
  };

  const handleOpenHistory = async (customer: Customer) => {
    setHistoryDialog({ open: true, customer });
    setLoadingHistory(true);
    
    try {
      const { data, error } = await supabase
        .from('customer_payments')
        .select('*')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setCustomerPayments(data as unknown as CustomerPayment[]);
    } catch (error) {
      console.error('Error loading payment history:', error);
      toast.error('Failed to load payment history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSendSingleReminder = async (customer: Customer) => {
    if (!customer.phone) {
      toast.error('Customer has no phone number');
      return;
    }

    setSendingIndividual(customer.id);
    try {
      const { data: settings } = await supabase
        .from('global_settings')
        .select('store_name')
        .single();
      
      const storeName = settings?.store_name || 'Our Store';
      const message = `This is ${storeName}. You have an outstanding balance of $${customer.outstanding_balance.toFixed(2)}. Please pay at your earliest convenience. Thank you!`;
      
      const { error } = await supabase.functions.invoke('notify-customer', {
        body: {
          customerId: customer.id,
          type: 'payment_reminder',
          method: 'phone', // Always phone call for reminders
          phone: customer.phone,
          customerName: customer.name,
          message,
        },
      });

      if (error) throw error;
      toast.success(`Phone call reminder sent to ${customer.name}`);
    } catch (error: any) {
      console.error('Error sending reminder:', error);
      toast.error('Failed to send reminder: ' + error.message);
    } finally {
      setSendingIndividual(null);
    }
  };

  const handleSendReminders = async () => {
    const toSend = customersForReminder.filter(c => 
      selectedForReminder.size === 0 || selectedForReminder.has(c.id)
    ).filter(c => c.phone); // Only send to customers with phone

    if (toSend.length === 0) {
      toast.error('No customers with phone numbers to send reminders to');
      return;
    }
    
    setSendingReminders(true);
    let successCount = 0;
    let failCount = 0;

    const { data: settings } = await supabase
      .from('global_settings')
      .select('store_name')
      .single();
    
    const storeName = settings?.store_name || 'Our Store';
    
    for (const customer of toSend) {
      try {
        const message = `This is ${storeName}. You have an outstanding balance of $${customer.outstanding_balance.toFixed(2)}. Please pay at your earliest convenience. Thank you!`;
        
        // Always use phone call for reminders
        const { error } = await supabase.functions.invoke('notify-customer', {
          body: {
            customerId: customer.id,
            type: 'payment_reminder',
            method: 'phone',
            phone: customer.phone,
            customerName: customer.name,
            message,
          },
        });

        if (!error) successCount++;
        else failCount++;
      } catch (error) {
        console.error(`Error sending reminder to ${customer.name}:`, error);
        failCount++;
      }
    }
    
    setSendingReminders(false);
    setReminderDialog({ open: false });
    setSelectedForReminder(new Set());
    
    if (successCount > 0) {
      toast.success(`Sent ${successCount} phone call reminders`);
    }
    if (failCount > 0) {
      toast.error(`Failed to send ${failCount} reminders`);
    }
  };

  const toggleSelectAll = () => {
    if (selectedForReminder.size === customersForReminder.length) {
      setSelectedForReminder(new Set());
    } else {
      setSelectedForReminder(new Set(customersForReminder.map(c => c.id)));
    }
  };

  return (
    <AppLayout 
      title="Customer Balances" 
      subtitle="Track outstanding balances and payments"
    >
      <div className="space-y-6 animate-fade-in">
        {/* Summary Card */}
        <Card className="shadow-card border-red-500/20 bg-red-500/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Outstanding</p>
                  <p className="text-3xl font-bold text-red-600">${totalOwed.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">{customersWithBalance?.length || 0} customers with balance</p>
                </div>
              </div>
              <Button 
                onClick={() => setReminderDialog({ open: true })}
                disabled={!customersWithBalance || customersWithBalance.length === 0}
                className="bg-red-600 hover:bg-red-700"
              >
                <Phone className="w-4 h-4 mr-2" />
                Send Phone Reminders
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="balances" className="w-full">
          <TabsList>
            <TabsTrigger value="balances">
              Outstanding Balances
              {(customersWithBalance?.length || 0) > 0 && (
                <Badge variant="secondary" className="ml-2 bg-red-500/10 text-red-600">{customersWithBalance?.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="payments">
              Recent Payments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="balances" className="mt-4">
            {/* Search */}
            <div className="relative max-w-md mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Customers with Outstanding Balances
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : filteredCustomers.length > 0 ? (
                  <div className="space-y-3">
                    {filteredCustomers.map((customer) => (
                      <div 
                        key={customer.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-red-500/10"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                            <User className="w-5 h-5 text-red-600" />
                          </div>
                          <div>
                            <p className="font-medium">{customer.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {customer.phone}
                              {customer.email && ` • ${customer.email}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-lg font-bold text-red-600">
                              ${customer.outstanding_balance.toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">owed</p>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleSendSingleReminder(customer)}
                              disabled={sendingIndividual === customer.id || !customer.phone}
                              title={customer.phone ? 'Send phone reminder' : 'No phone number'}
                            >
                              {sendingIndividual === customer.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Phone className="w-4 h-4" />
                              )}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleOpenHistory(customer)}
                            >
                              <History className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="sm"
                              onClick={() => handleOpenPaymentDialog(customer)}
                            >
                              <CreditCard className="w-4 h-4 mr-1" />
                              Record Payment
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No outstanding balances</p>
                    <p className="text-sm">All customers are paid up!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="mt-4">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Recent Payments
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentPayments && recentPayments.length > 0 ? (
                  <div className="space-y-2">
                    {recentPayments.slice(0, 20).map((payment) => (
                      <div 
                        key={payment.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium">{payment.customer?.name || 'Unknown'}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(payment.created_at), 'MMM d, yyyy h:mm a')}
                              {payment.payment_method && ` • ${payment.payment_method}`}
                            </p>
                          </div>
                        </div>
                        <p className="font-bold text-green-600">+${payment.amount.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No payments recorded yet
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Record Payment Dialog */}
      <Dialog open={paymentDialog.open} onOpenChange={(open) => !open && setPaymentDialog({ open: false, customer: null })}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a payment from {paymentDialog.customer?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Outstanding Balance</Label>
              <p className="text-2xl font-bold text-red-600">
                ${paymentDialog.customer?.outstanding_balance.toFixed(2)}
              </p>
            </div>
            <div>
              <Label htmlFor="amount">Payment Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="method">Payment Method</Label>
              <Select
                value={paymentForm.method}
                onValueChange={(value: any) => setPaymentForm({ ...paymentForm, method: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="card">Credit Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Card Input Fields */}
            {paymentForm.method === 'card' && (
              <div className="space-y-2 p-3 bg-secondary/30 rounded-lg">
                <div>
                  <Label htmlFor="cardNumber" className="text-sm">Card Number</Label>
                  <Input
                    id="cardNumber"
                    value={paymentForm.cardNumber}
                    onChange={(e) => setPaymentForm({ ...paymentForm, cardNumber: formatCardNumber(e.target.value) })}
                    placeholder="1234 5678 9012 3456"
                    maxLength={19}
                    className="h-9"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="cardExpiry" className="text-sm">Expiry</Label>
                    <Input
                      id="cardExpiry"
                      value={paymentForm.cardExpiry}
                      onChange={(e) => setPaymentForm({ ...paymentForm, cardExpiry: formatExpiry(e.target.value) })}
                      placeholder="MM/YY"
                      maxLength={5}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cardCvv" className="text-sm">CVV</Label>
                    <Input
                      id="cardCvv"
                      type="password"
                      value={paymentForm.cardCvv}
                      onChange={(e) => setPaymentForm({ ...paymentForm, cardCvv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                      placeholder="123"
                      maxLength={4}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                placeholder="Any notes about this payment..."
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setPaymentDialog({ open: false, customer: null })} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button 
              onClick={handleRecordPayment} 
              disabled={createPayment.isPending || processingCard || !paymentForm.amount}
              className="w-full sm:w-auto"
            >
              {processingCard ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : createPayment.isPending ? (
                'Recording...'
              ) : paymentForm.method === 'card' ? (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Pay by Card
                </>
              ) : (
                'Record Payment'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={historyDialog.open} onOpenChange={(open) => !open && setHistoryDialog({ open: false, customer: null })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment History - {historyDialog.customer?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {loadingHistory ? (
              <div className="text-center py-8">Loading...</div>
            ) : customerPayments.length > 0 ? (
              customerPayments.map((payment) => (
                <div 
                  key={payment.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                >
                  <div>
                    <p className="font-medium">${payment.amount.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(payment.created_at), 'MMM d, yyyy h:mm a')}
                      {payment.payment_method && ` • ${payment.payment_method}`}
                    </p>
                    {payment.notes && (
                      <p className="text-sm text-muted-foreground mt-1">{payment.notes}</p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No payment history
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Reminders Dialog */}
      <Dialog open={reminderDialog.open} onOpenChange={(open) => setReminderDialog({ open })}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Send Phone Call Reminders
            </DialogTitle>
            <DialogDescription>
              Send automated phone call reminders to customers with outstanding balances.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Filter by days */}
            <div className="flex items-center gap-4">
              <Label className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filter by:
              </Label>
              <Select value={reminderFilter} onValueChange={(v: any) => {
                setReminderFilter(v);
                setSelectedForReminder(new Set());
              }}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  <SelectItem value="30">30+ Days Outstanding</SelectItem>
                  <SelectItem value="60">60+ Days Outstanding</SelectItem>
                  <SelectItem value="90">90+ Days Outstanding</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Customer list */}
            <div className="border rounded-lg overflow-hidden flex-1 overflow-y-auto">
              <div className="p-3 bg-muted/50 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedForReminder.size === customersForReminder.length && customersForReminder.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span className="text-sm font-medium">
                    {customersForReminder.length} customers
                    {selectedForReminder.size > 0 && ` (${selectedForReminder.size} selected)`}
                  </span>
                </div>
                <Badge variant="secondary">
                  Total: ${customersForReminder.reduce((sum, c) => sum + c.outstanding_balance, 0).toFixed(2)}
                </Badge>
              </div>
              
              <div className="max-h-64 overflow-y-auto">
                {customersForReminder.length > 0 ? (
                  customersForReminder.map((customer) => (
                    <div 
                      key={customer.id}
                      className="flex items-center justify-between p-3 border-b last:border-0 hover:bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedForReminder.has(customer.id)}
                          onCheckedChange={(checked) => {
                            const newSet = new Set(selectedForReminder);
                            if (checked) newSet.add(customer.id);
                            else newSet.delete(customer.id);
                            setSelectedForReminder(newSet);
                          }}
                        />
                        <div>
                          <p className="font-medium">{customer.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {customer.phone || 'No phone'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-600">${customer.outstanding_balance.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">
                          {differenceInDays(new Date(), new Date(customer.created_at))} days
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    No customers match the selected filter
                  </div>
                )}
              </div>
            </div>

            <div className="bg-secondary/30 p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">Message Preview:</p>
              <p className="text-sm text-muted-foreground italic">
                "This is [Store Name]. You have an outstanding balance of $[amount]. Please pay at your earliest convenience. Thank you!"
              </p>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setReminderDialog({ open: false })}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendReminders} 
              disabled={sendingReminders || customersForReminder.filter(c => c.phone).length === 0}
              className="bg-red-600 hover:bg-red-700"
            >
              {sendingReminders ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4 mr-2" />
                  Send {selectedForReminder.size > 0 ? selectedForReminder.size : customersForReminder.filter(c => c.phone).length} Reminders
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
