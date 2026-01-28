import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  ShoppingBag, 
  Book,
  User,
  DollarSign,
  Phone,
  Check,
  Search,
  Loader2,
  CreditCard,
  Banknote,
} from 'lucide-react';
import { useCustomerOrders, useUpdateCustomerOrder } from '@/hooks/useOrders';
import { Badge } from '@/components/ui/badge';
import { PaymentStatusBadge } from '@/components/orders/PaymentStatusBadge';
import { CustomerOrder } from '@/types/database';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function Pickups() {
  const navigate = useNavigate();
  const { data: readyOrders, isLoading, refetch } = useCustomerOrders('ready');
  const updateOrder = useUpdateCustomerOrder();
  
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);
  const [cashReceived, setCashReceived] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Card form state
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardZip, setCardZip] = useState('');

  const filteredOrders = readyOrders?.filter(order => 
    order.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
    order.customer?.phone?.includes(search) ||
    order.book?.title?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const getBalanceDue = (order: CustomerOrder) => {
    return (order.final_price || 0) - (order.amount_paid || 0);
  };

  const handleSelectOrder = (order: CustomerOrder) => {
    setSelectedOrder(order);
    setCashReceived(getBalanceDue(order).toFixed(2));
    setPaymentMethod('cash');
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');
    setCardZip('');
  };

  const handleCashPayment = async () => {
    if (!selectedOrder) return;
    
    const amount = parseFloat(cashReceived) || 0;
    const balanceDue = getBalanceDue(selectedOrder);
    const newAmountPaid = (selectedOrder.amount_paid || 0) + amount;
    const newBalanceDue = (selectedOrder.final_price || 0) - newAmountPaid;
    const isFullyPaid = newBalanceDue <= 0;
    
    setIsProcessing(true);
    try {
      await updateOrder.mutateAsync({
        id: selectedOrder.id,
        status: 'picked_up',
        payment_status: isFullyPaid ? 'paid' : (newAmountPaid > 0 ? 'partial' : 'unpaid'),
        payment_method: 'cash',
        amount_paid: newAmountPaid,
        balance_due: Math.max(0, newBalanceDue),
        picked_up_at: new Date().toISOString(),
      });

      if (amount > 0) {
        await supabase.from('customer_payments').insert({
          customer_id: selectedOrder.customer_id,
          order_id: selectedOrder.id,
          amount: amount,
          payment_method: 'cash',
        });
      }
      
      // Update customer's outstanding balance if there's remaining balance
      if (newBalanceDue > 0) {
        const { data: customer } = await supabase
          .from('customers')
          .select('outstanding_balance')
          .eq('id', selectedOrder.customer_id)
          .single();
        
        const currentBalance = customer?.outstanding_balance || 0;
        await supabase
          .from('customers')
          .update({ outstanding_balance: currentBalance + newBalanceDue })
          .eq('id', selectedOrder.customer_id);
      }
      
      const change = amount - balanceDue;
      if (change > 0) {
        toast.success(`Picked up! Change: $${change.toFixed(2)}`);
      } else if (newBalanceDue > 0) {
        toast.success(`Picked up! Remaining balance: $${newBalanceDue.toFixed(2)} added to customer account`);
      } else {
        toast.success('Order picked up!');
      }
      
      setSelectedOrder(null);
      setCashReceived('');
      refetch();
    } catch (error) {
      toast.error('Failed to process');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkPickedUp = async () => {
    if (!selectedOrder) return;
    
    setIsProcessing(true);
    try {
      await updateOrder.mutateAsync({
        id: selectedOrder.id,
        status: 'picked_up',
        picked_up_at: new Date().toISOString(),
      });
      
      toast.success('Order marked as picked up');
      setSelectedOrder(null);
      refetch();
    } catch (error) {
      toast.error('Failed to update');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCardPayment = async () => {
    if (!selectedOrder) return;
    
    const balanceDue = getBalanceDue(selectedOrder);
    
    // Validate card fields
    if (!cardNumber || cardNumber.replace(/\s/g, '').length < 15) {
      toast.error('Please enter a valid card number');
      return;
    }
    if (!cardExpiry || cardExpiry.length < 4) {
      toast.error('Please enter card expiry (MMYY)');
      return;
    }
    if (!cardCvv || cardCvv.length < 3) {
      toast.error('Please enter CVV');
      return;
    }
    
    setIsProcessing(true);
    try {
      // Call the Sola/Cardknox edge function
      const { data: result, error } = await supabase.functions.invoke('process-sola-payment', {
        body: {
          amount: balanceDue,
          cardNumber: cardNumber.replace(/\s/g, ''),
          cardExpiry: cardExpiry.replace('/', ''),
          cardCvv: cardCvv,
          cardZip: cardZip,
          orderId: selectedOrder.id,
          customerId: selectedOrder.customer_id,
        }
      });
      
      if (error) throw error;
      
      if (result.success) {
        await updateOrder.mutateAsync({
          id: selectedOrder.id,
          status: 'picked_up',
          payment_status: 'paid',
          payment_method: 'card',
          amount_paid: selectedOrder.final_price || 0,
          picked_up_at: new Date().toISOString(),
        });

        await supabase.from('customer_payments').insert({
          customer_id: selectedOrder.customer_id,
          order_id: selectedOrder.id,
          amount: balanceDue,
          payment_method: 'card',
          transaction_id: result.transactionId,
        });
        
        toast.success('Card payment processed! Order picked up.');
        setSelectedOrder(null);
        refetch();
      } else {
        toast.error(result.message || 'Payment failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to process card payment');
    } finally {
      setIsProcessing(false);
    }
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
    const v = value.replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  return (
    <AppLayout 
      title="Pickups" 
      subtitle="Process customer pickups"
    >
      <div className="space-y-6 animate-fade-in">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer name, phone, or book..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Ready Orders */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              Ready for Pickup
              {filteredOrders.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {filteredOrders.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : filteredOrders.length > 0 ? (
              <div className="space-y-3">
                {filteredOrders.map((order) => {
                  const balanceDue = getBalanceDue(order);
                  const isPaid = order.payment_status === 'paid';
                  
                  return (
                    <div 
                      key={order.id}
                      onClick={() => handleSelectOrder(order)}
                      className={`flex items-center justify-between p-4 rounded-lg cursor-pointer transition-colors hover:bg-secondary/50 ${
                        isPaid 
                          ? 'bg-green-500/5 border border-green-500/20' 
                          : 'bg-orange-500/5 border border-orange-500/20'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          isPaid ? 'bg-green-500/10' : 'bg-orange-500/10'
                        }`}>
                          <Book className={`w-6 h-6 ${isPaid ? 'text-green-600' : 'text-orange-600'}`} />
                        </div>
                        <div>
                          <p className="font-medium">{order.book?.title}</p>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5" />
                              {order.customer?.name}
                            </span>
                            <span className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5" />
                              {order.customer?.phone}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        {isPaid ? (
                          <div>
                            <p className="text-lg font-bold text-green-600">PAID</p>
                            <p className="text-xs text-muted-foreground">${order.final_price?.toFixed(2)}</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-2xl font-bold text-orange-600">${balanceDue.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">Balance Due</p>
                          </div>
                        )}
                        <PaymentStatusBadge status={order.payment_status || 'unpaid'} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Check className="w-12 h-12 mx-auto mb-2 text-green-500 opacity-50" />
                No orders waiting for pickup
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Process Pickup</DialogTitle>
            <DialogDescription>
              {selectedOrder?.customer?.name} - {selectedOrder?.book?.title}
            </DialogDescription>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4">
              {/* Order Summary */}
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Book:</span>
                  <span className="font-medium">{selectedOrder.book?.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price:</span>
                  <span>${selectedOrder.final_price?.toFixed(2) || '0.00'}</span>
                </div>
                {(selectedOrder.amount_paid || 0) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Already Paid:</span>
                    <span>-${selectedOrder.amount_paid?.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Balance Due:</span>
                  <span className={getBalanceDue(selectedOrder) > 0 ? 'text-orange-600' : 'text-green-600'}>
                    ${getBalanceDue(selectedOrder).toFixed(2)}
                  </span>
                </div>
              </div>

              {getBalanceDue(selectedOrder) > 0 ? (
                <div className="space-y-4">
                  {/* Payment Method Toggle */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                      className="h-12"
                      onClick={() => setPaymentMethod('cash')}
                    >
                      <Banknote className="w-4 h-4 mr-2" />
                      Cash
                    </Button>
                    <Button
                      type="button"
                      variant={paymentMethod === 'card' ? 'default' : 'outline'}
                      className="h-12"
                      onClick={() => setPaymentMethod('card')}
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Card
                    </Button>
                  </div>
                  
                  {paymentMethod === 'cash' ? (
                    <>
                      <div className="space-y-2">
                        <Label>Payment Amount</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={cashReceived}
                            onChange={(e) => setCashReceived(e.target.value)}
                            className="pl-9 text-lg"
                            placeholder="0.00"
                            autoFocus
                          />
                        </div>
                        {/* Quick amount buttons */}
                        <div className="flex gap-1 flex-wrap">
                          <Button 
                            type="button"
                            variant="outline" 
                            size="sm" 
                            className="text-xs h-7"
                            onClick={() => setCashReceived(getBalanceDue(selectedOrder).toFixed(2))}
                          >
                            Full ${getBalanceDue(selectedOrder).toFixed(2)}
                          </Button>
                          <Button 
                            type="button"
                            variant="outline" 
                            size="sm" 
                            className="text-xs h-7"
                            onClick={() => setCashReceived('0')}
                          >
                            $0 (Balance)
                          </Button>
                          {getBalanceDue(selectedOrder) > 10 && (
                            <Button 
                              type="button"
                              variant="outline" 
                              size="sm" 
                              className="text-xs h-7"
                              onClick={() => setCashReceived('10.00')}
                            >
                              $10
                            </Button>
                          )}
                          {getBalanceDue(selectedOrder) > 20 && (
                            <Button 
                              type="button"
                              variant="outline" 
                              size="sm" 
                              className="text-xs h-7"
                              onClick={() => setCashReceived('20.00')}
                            >
                              $20
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {parseFloat(cashReceived || '0') > getBalanceDue(selectedOrder) && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                          <p className="text-green-700 dark:text-green-400 font-medium">
                            Change: ${(parseFloat(cashReceived) - getBalanceDue(selectedOrder)).toFixed(2)}
                          </p>
                        </div>
                      )}
                      
                      {parseFloat(cashReceived || '0') < getBalanceDue(selectedOrder) && (
                        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                          <p className="text-orange-700 dark:text-orange-400 font-medium">
                            Remaining Balance: ${(getBalanceDue(selectedOrder) - parseFloat(cashReceived || '0')).toFixed(2)}
                          </p>
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setSelectedOrder(null)} className="flex-1">
                          Cancel
                        </Button>
                        <Button
                          onClick={handleCashPayment}
                          disabled={isProcessing}
                          className="flex-1"
                        >
                          {isProcessing ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                          ) : parseFloat(cashReceived || '0') === 0 ? (
                            <><Check className="w-4 h-4 mr-2" /> Pickup (No Payment)</>
                          ) : (
                            <><Check className="w-4 h-4 mr-2" /> Complete Pickup</>
                          )}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label>Card Number</Label>
                          <Input
                            type="text"
                            value={cardNumber}
                            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                            placeholder="1234 5678 9012 3456"
                            maxLength={19}
                            className="font-mono"
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Expiry (MM/YY)</Label>
                            <Input
                              type="text"
                              value={cardExpiry}
                              onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                              placeholder="MM/YY"
                              maxLength={5}
                              className="font-mono"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>CVV</Label>
                            <Input
                              type="text"
                              value={cardCvv}
                              onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                              placeholder="123"
                              maxLength={4}
                              className="font-mono"
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Billing Zip Code</Label>
                          <Input
                            type="text"
                            value={cardZip}
                            onChange={(e) => setCardZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                            placeholder="12345"
                            maxLength={5}
                            className="font-mono"
                          />
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setSelectedOrder(null)} className="flex-1">
                          Cancel
                        </Button>
                        <Button
                          onClick={handleCardPayment}
                          disabled={isProcessing}
                          className="flex-1"
                        >
                          {isProcessing ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                          ) : (
                            <><CreditCard className="w-4 h-4 mr-2" /> Charge ${getBalanceDue(selectedOrder).toFixed(2)}</>
                          )}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-center">
                    <Check className="w-8 h-8 mx-auto text-green-600 mb-2" />
                    <p className="font-medium text-green-700 dark:text-green-400">Already Paid</p>
                    <p className="text-sm text-green-600 dark:text-green-500">Just confirm the pickup</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setSelectedOrder(null)} className="flex-1">
                      Cancel
                    </Button>
                    <Button onClick={handleMarkPickedUp} disabled={isProcessing} className="flex-1">
                      {isProcessing ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                      ) : (
                        <><Check className="w-4 h-4 mr-2" /> Confirm Pickup</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
