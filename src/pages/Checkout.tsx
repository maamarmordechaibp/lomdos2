import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  CreditCard, 
  Banknote, 
  DollarSign, 
  Check, 
  ShoppingCart,
  AlertCircle,
  ArrowLeft,
  Loader2,
  X,
} from 'lucide-react';
import { useCustomerOrders, useUpdateCustomerOrder } from '@/hooks/useOrders';
import { useSettings } from '@/hooks/useSettings';
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

export default function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderIds = searchParams.get('orders')?.split(',') || [];
  
  const { data: allOrders, isLoading } = useCustomerOrders();
  const updateOrder = useUpdateCustomerOrder();
  const { data: settings } = useSettings();
  
  // Filter to get selected orders
  const orders = allOrders?.filter(o => orderIds.includes(o.id)) || [];
  
  // State
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [showCardDialog, setShowCardDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Card form state
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardZip, setCardZip] = useState('');
  
  // Calculate totals
  const totalAmount = orders.reduce((sum, order) => sum + (order.final_price || 0), 0);
  const totalPaid = orders.reduce((sum, order) => sum + (order.amount_paid || 0), 0);
  const balanceDue = totalAmount - totalPaid;
  
  // Set default payment amount to balance due
  useEffect(() => {
    if (balanceDue > 0 && !paymentAmount) {
      setPaymentAmount(balanceDue.toFixed(2));
    }
  }, [balanceDue]);
  
  const amount = parseFloat(paymentAmount) || 0;
  const isFullPayment = amount >= balanceDue;
  const change = amount > balanceDue ? amount - balanceDue : 0;
  
  const handleCashPayment = async () => {
    if (amount <= 0) {
      toast.error('Please enter an amount');
      return;
    }
    
    setIsProcessing(true);
    try {
      for (const order of orders) {
        const orderBalance = (order.final_price || 0) - (order.amount_paid || 0);
        const paymentForOrder = Math.min(amount, orderBalance);
        const newAmountPaid = (order.amount_paid || 0) + paymentForOrder;
        const orderTotal = order.final_price || 0;
        const isPaidInFull = newAmountPaid >= orderTotal;
        
        await updateOrder.mutateAsync({
          id: order.id,
          payment_status: isPaidInFull ? 'paid' : 'partial',
          payment_method: order.payment_method === 'card' ? 'mixed' : 'cash',
          amount_paid: newAmountPaid,
          balance_due: orderTotal - newAmountPaid,
          status: isPaidInFull ? 'ready' : order.status,
        });
        
        // Record payment
        await supabase.from('customer_payments').insert({
          customer_id: order.customer_id,
          order_id: order.id,
          amount: paymentForOrder,
          payment_method: 'cash',
          payment_type: isPaidInFull ? 'full' : 'partial',
        });
      }
      
      if (change > 0) {
        toast.success(`Payment complete! Change: $${change.toFixed(2)}`);
      } else {
        toast.success('Payment recorded successfully!');
      }
      
      if (isFullPayment) {
        navigate('/pickups');
      } else {
        navigate('/orders');
      }
    } catch (error) {
      toast.error('Failed to process payment');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleCardPayment = async () => {
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
          amount: amount,
          cardNumber: cardNumber.replace(/\s/g, ''),
          cardExpiry: cardExpiry.replace('/', ''),
          cardCvv: cardCvv,
          cardZip: cardZip,
          orderId: orders[0]?.id,
          customerId: orders[0]?.customer_id,
        }
      });
      
      if (error) throw error;
      
      if (result.success) {
        // Update orders
        for (const order of orders) {
          const orderBalance = (order.final_price || 0) - (order.amount_paid || 0);
          const paymentForOrder = Math.min(amount, orderBalance);
          const newAmountPaid = (order.amount_paid || 0) + paymentForOrder;
          const orderTotal = order.final_price || 0;
          const isPaidInFull = newAmountPaid >= orderTotal;
          
          await updateOrder.mutateAsync({
            id: order.id,
            payment_status: isPaidInFull ? 'paid' : 'partial',
            payment_method: order.payment_method === 'cash' ? 'mixed' : 'card',
            amount_paid: newAmountPaid,
            balance_due: orderTotal - newAmountPaid,
            status: isPaidInFull ? 'ready' : order.status,
          });
          
          // Record payment
          await supabase.from('customer_payments').insert({
            customer_id: order.customer_id,
            order_id: order.id,
            amount: paymentForOrder,
            payment_method: 'card',
            payment_type: isPaidInFull ? 'full' : 'partial',
            transaction_id: result.transactionId,
          });
        }
        
        toast.success('Card payment processed successfully!');
        setShowCardDialog(false);
        
        if (isFullPayment) {
          navigate('/pickups');
        } else {
          navigate('/orders');
        }
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
  
  if (isLoading) {
    return (
      <AppLayout title="Checkout" subtitle="Process payment">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }
  
  if (orders.length === 0) {
    return (
      <AppLayout title="Checkout" subtitle="Process payment">
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg text-muted-foreground mb-4">No orders selected for checkout</p>
          <Button onClick={() => navigate('/orders')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Orders
          </Button>
        </div>
      </AppLayout>
    );
  }
  
  const customer = orders[0]?.customer;
  
  return (
    <AppLayout title="Checkout" subtitle="Process customer payment">
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        {/* Order Summary */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Order Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Customer Info */}
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-muted-foreground">Customer:</span>
              <span className="font-medium">{customer?.name}</span>
            </div>
            
            {/* Order Items */}
            <div className="space-y-2">
              {orders.map((order) => (
                <div key={order.id} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">{order.book?.title}</p>
                    <p className="text-sm text-muted-foreground">Qty: {order.quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${order.final_price?.toFixed(2) || '0.00'}</p>
                    {(order.amount_paid || 0) > 0 && (
                      <p className="text-sm text-green-600">Paid: ${order.amount_paid?.toFixed(2)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Totals */}
            <div className="pt-3 space-y-2 bg-muted/50 p-4 rounded-lg">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>${totalAmount.toFixed(2)}</span>
              </div>
              {totalPaid > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Already Paid:</span>
                  <span>-${totalPaid.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold border-t pt-2">
                <span>Balance Due:</span>
                <span className={balanceDue > 0 ? 'text-orange-600' : 'text-green-600'}>
                  ${balanceDue.toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Payment Section */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Payment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Payment Amount */}
            <div className="space-y-2">
              <Label className="text-base">Payment Amount</Label>
              <p className="text-sm text-muted-foreground">
                Enter full amount or partial deposit
              </p>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="pl-10 text-xl h-14"
                  placeholder="0.00"
                />
              </div>
              
              {/* Quick amount buttons */}
              <div className="flex gap-2 mt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => setPaymentAmount(balanceDue.toFixed(2))}
                >
                  Full (${balanceDue.toFixed(2)})
                </Button>
                {balanceDue > 20 && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setPaymentAmount('20.00')}
                  >
                    $20 Deposit
                  </Button>
                )}
                {balanceDue > 50 && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setPaymentAmount('50.00')}
                  >
                    $50 Deposit
                  </Button>
                )}
              </div>
              
              {/* Payment type indicator */}
              {amount > 0 && (
                <div className={`p-3 rounded-lg mt-3 ${
                  isFullPayment 
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                    : 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
                }`}>
                  {isFullPayment ? (
                    <p className="font-medium text-green-700 dark:text-green-400">
                      <Check className="w-4 h-4 inline mr-1" />
                      Full payment - Customer is good to go!
                    </p>
                  ) : (
                    <p className="font-medium text-orange-700 dark:text-orange-400">
                      <AlertCircle className="w-4 h-4 inline mr-1" />
                      Deposit - Remaining balance: ${(balanceDue - amount).toFixed(2)}
                    </p>
                  )}
                </div>
              )}
              
              {/* Change due */}
              {change > 0 && paymentMethod === 'cash' && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="font-medium text-blue-700 dark:text-blue-400">
                    Change Due: ${change.toFixed(2)}
                  </p>
                </div>
              )}
            </div>
            
            {/* Payment Method */}
            <div className="space-y-3">
              <Label className="text-base">Payment Method</Label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                  className={`h-20 flex flex-col gap-2 ${paymentMethod === 'cash' ? '' : ''}`}
                  onClick={() => setPaymentMethod('cash')}
                >
                  <Banknote className="w-6 h-6" />
                  Cash
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === 'card' ? 'default' : 'outline'}
                  className="h-20 flex flex-col gap-2"
                  onClick={() => setPaymentMethod('card')}
                >
                  <CreditCard className="w-6 h-6" />
                  Credit Card
                </Button>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate(-1)}
                className="flex-1"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              
              {paymentMethod === 'cash' ? (
                <Button
                  onClick={handleCashPayment}
                  disabled={isProcessing || amount <= 0}
                  className="flex-1"
                >
                  {isProcessing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                  ) : (
                    <><Check className="w-4 h-4 mr-2" /> Process Cash Payment</>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={() => setShowCardDialog(true)}
                  disabled={amount <= 0}
                  className="flex-1"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Enter Card Details
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Credit Card Dialog */}
      <Dialog open={showCardDialog} onOpenChange={setShowCardDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Enter Card Details
            </DialogTitle>
            <DialogDescription>
              Charging ${amount.toFixed(2)} to card
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Card Number */}
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
            
            {/* Expiry & CVV */}
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
            
            {/* Zip Code */}
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
            
            {/* Process Button */}
            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowCardDialog(false)}
                className="flex-1"
              >
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
                  <><Check className="w-4 h-4 mr-2" /> Charge ${amount.toFixed(2)}</>
                )}
              </Button>
            </div>
            
            {/* Security Note */}
            <p className="text-xs text-center text-muted-foreground">
              <CreditCard className="w-3 h-3 inline mr-1" />
              Secure payment processing
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
