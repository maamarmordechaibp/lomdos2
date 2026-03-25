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
  Percent,
  Tag,
  Gift,
  Search,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'gift_card'>('cash');
  const [showCardDialog, setShowCardDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Gift card state
  const [giftCardNumber, setGiftCardNumber] = useState('');
  const [giftCardData, setGiftCardData] = useState<{ id: string; card_number: string; balance: number; holder_name: string | null } | null>(null);
  const [giftCardLookupLoading, setGiftCardLookupLoading] = useState(false);
  
  // Discount state
  const [discountType, setDiscountType] = useState<'none' | 'percentage' | 'fixed'>('none');
  const [discountValue, setDiscountValue] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  
  // Card form state
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardZip, setCardZip] = useState('');
  
  const customer = orders[0]?.customer;
  
  // Apply customer default discount on load
  useEffect(() => {
    if (customer?.default_discount_type && customer.default_discount_type !== 'none' && customer.default_discount_value) {
      setDiscountType(customer.default_discount_type as 'percentage' | 'fixed');
      setDiscountValue(customer.default_discount_value.toString());
      setDiscountReason('Customer default discount');
    }
  }, [customer]);
  
  // Calculate totals
  const subtotal = orders.reduce((sum, order) => sum + (order.final_price || 0), 0);
  const totalPaid = orders.reduce((sum, order) => sum + (order.amount_paid || 0), 0);
  
  // Calculate discount amount
  const discountAmount = discountType === 'none' || !discountValue 
    ? 0 
    : discountType === 'percentage' 
      ? (subtotal * parseFloat(discountValue) / 100)
      : parseFloat(discountValue);
  
  const totalAmount = Math.max(0, subtotal - discountAmount);
  const balanceDue = Math.max(0, totalAmount - totalPaid);
  
  // Set default payment amount to balance due
  useEffect(() => {
    if (balanceDue > 0 && !paymentAmount) {
      setPaymentAmount(balanceDue.toFixed(2));
    }
  }, [balanceDue]);
  
  const amount = parseFloat(paymentAmount) || 0;
  const isFullPayment = amount >= balanceDue;
  const change = amount > balanceDue ? amount - balanceDue : 0;
  
  // Gift card lookup
  const lookupGiftCard = async () => {
    if (!giftCardNumber.trim()) {
      toast.error('Please enter a gift card number');
      return;
    }
    setGiftCardLookupLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('gift_cards')
        .select('id, card_number, balance, holder_name, is_active')
        .eq('card_number', giftCardNumber.trim())
        .single();
      if (error || !data) {
        toast.error('Gift card not found');
        setGiftCardData(null);
        return;
      }
      if (!data.is_active) {
        toast.error('This gift card is inactive');
        setGiftCardData(null);
        return;
      }
      if ((data.balance || 0) <= 0) {
        toast.error('This gift card has no balance');
        setGiftCardData(null);
        return;
      }
      setGiftCardData(data);
      // Auto-set payment amount to min of balance and balance due
      const maxFromCard = Math.min(data.balance, balanceDue);
      setPaymentAmount(maxFromCard.toFixed(2));
      toast.success(`Gift card found: $${Number(data.balance).toFixed(2)} available`);
    } catch {
      toast.error('Failed to look up gift card');
      setGiftCardData(null);
    } finally {
      setGiftCardLookupLoading(false);
    }
  };
  
  // Gift card payment handler
  const handleGiftCardPayment = async () => {
    if (!giftCardData) {
      toast.error('Please look up a gift card first');
      return;
    }
    if (amount <= 0) {
      toast.error('Please enter an amount');
      return;
    }
    if (amount > giftCardData.balance) {
      toast.error(`Gift card only has $${Number(giftCardData.balance).toFixed(2)} — reduce the amount`);
      return;
    }
    
    setIsProcessing(true);
    try {
      const discountPerOrder = discountAmount / orders.length;
      let remainingPayment = amount;
      
      for (const order of orders) {
        const originalPrice = order.final_price || 0;
        const orderFinalPrice = discountAmount > 0
          ? Math.max(0, originalPrice - discountPerOrder)
          : originalPrice;
        
        const orderBalance = orderFinalPrice - (order.amount_paid || 0);
        const paymentForOrder = Math.min(remainingPayment, Math.max(0, orderBalance));
        remainingPayment = Math.max(0, remainingPayment - paymentForOrder);
        const newAmountPaid = (order.amount_paid || 0) + paymentForOrder;
        const isPaidInFull = newAmountPaid >= (orderFinalPrice - 0.01);
        
        const updateData: any = {
          id: order.id,
          payment_status: isPaidInFull ? 'paid' : 'partial',
          payment_method: order.payment_method && order.payment_method !== 'gift_card' ? 'mixed' : 'cash',
          amount_paid: newAmountPaid,
          balance_due: Math.max(0, orderFinalPrice - newAmountPaid),
          status: isPaidInFull ? 'ready' : order.status,
        };
        
        if (discountAmount > 0) {
          updateData.original_price = originalPrice;
          updateData.final_price = orderFinalPrice;
          updateData.discount_type = discountType;
          updateData.discount_value = parseFloat(discountValue);
          updateData.discount_reason = discountReason || null;
        }
        
        await updateOrder.mutateAsync(updateData);
        
        if (paymentForOrder > 0) {
          await supabase.from('customer_payments').insert({
            customer_id: order.customer_id,
            order_id: order.id,
            amount: paymentForOrder,
            payment_method: 'other',
            notes: `Gift card ${giftCardData.card_number}`,
          });
        }
      }
      
      // Record gift card redemption transaction
      await (supabase as any).from('gift_card_transactions').insert({
        gift_card_id: giftCardData.id,
        transaction_type: 'redeem',
        amount: amount,
        reference: `Order payment for ${customer?.name || 'customer'}`,
        notes: orders.map(o => o.book?.title).filter(Boolean).join(', '),
      });
      
      toast.success(`$${amount.toFixed(2)} redeemed from gift card ${giftCardData.card_number}`);
      
      if (isFullPayment) {
        navigate('/pickups');
      } else {
        navigate('/orders');
      }
    } catch (error) {
      toast.error('Failed to process gift card payment');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleCashPayment = async () => {
    if (amount <= 0) {
      toast.error('Please enter an amount');
      return;
    }
    
    setIsProcessing(true);
    try {
      // Calculate the discount per order (proportionally)
      const discountPerOrder = discountAmount / orders.length;
      let remainingPayment = amount;
      
      for (const order of orders) {
        // Apply discount to order if any
        const originalPrice = order.final_price || 0;
        const orderFinalPrice = discountAmount > 0 
          ? Math.max(0, originalPrice - discountPerOrder)
          : originalPrice;
        
        const orderBalance = orderFinalPrice - (order.amount_paid || 0);
        const paymentForOrder = Math.min(remainingPayment, Math.max(0, orderBalance));
        remainingPayment = Math.max(0, remainingPayment - paymentForOrder);
        const newAmountPaid = (order.amount_paid || 0) + paymentForOrder;
        const isPaidInFull = newAmountPaid >= (orderFinalPrice - 0.01);
        
        const updateData: any = {
          id: order.id,
          payment_status: isPaidInFull ? 'paid' : 'partial',
          payment_method: order.payment_method === 'card' ? 'mixed' : 'cash',
          amount_paid: newAmountPaid,
          balance_due: Math.max(0, orderFinalPrice - newAmountPaid),
          status: isPaidInFull ? 'ready' : order.status,
        };
        
        // Add discount info if discount applied
        if (discountAmount > 0) {
          updateData.original_price = originalPrice;
          updateData.final_price = orderFinalPrice;
          updateData.discount_type = discountType;
          updateData.discount_value = parseFloat(discountValue);
          updateData.discount_reason = discountReason || null;
        }
        
        await updateOrder.mutateAsync(updateData);
        
        // Record payment
        if (paymentForOrder > 0) {
          await supabase.from('customer_payments').insert({
            customer_id: order.customer_id,
            order_id: order.id,
            amount: paymentForOrder,
            payment_method: 'cash',
          });
        }
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
        // Calculate the discount per order (proportionally)
        const discountPerOrder = discountAmount / orders.length;
        let remainingPayment = amount;
        
        // Update orders
        for (const order of orders) {
          // Apply discount to order if any
          const originalPrice = order.final_price || 0;
          const orderFinalPrice = discountAmount > 0 
            ? Math.max(0, originalPrice - discountPerOrder)
            : originalPrice;
          
          const orderBalance = orderFinalPrice - (order.amount_paid || 0);
          const paymentForOrder = Math.min(remainingPayment, Math.max(0, orderBalance));
          remainingPayment = Math.max(0, remainingPayment - paymentForOrder);
          const newAmountPaid = (order.amount_paid || 0) + paymentForOrder;
          const isPaidInFull = newAmountPaid >= (orderFinalPrice - 0.01);
          
          const updateData: any = {
            id: order.id,
            payment_status: isPaidInFull ? 'paid' : 'partial',
            payment_method: order.payment_method === 'cash' ? 'mixed' : 'card',
            amount_paid: newAmountPaid,
            balance_due: Math.max(0, orderFinalPrice - newAmountPaid),
            status: isPaidInFull ? 'ready' : order.status,
          };
          
          // Add discount info if discount applied
          if (discountAmount > 0) {
            updateData.original_price = originalPrice;
            updateData.final_price = orderFinalPrice;
            updateData.discount_type = discountType;
            updateData.discount_value = parseFloat(discountValue);
            updateData.discount_reason = discountReason || null;
          }
          
          await updateOrder.mutateAsync(updateData);
          
          // Record payment
          if (paymentForOrder > 0) {
            await supabase.from('customer_payments').insert({
              customer_id: order.customer_id,
              order_id: order.id,
              amount: paymentForOrder,
              payment_method: 'card',
              transaction_id: result.transactionId,
            });
          }
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
  
  return (
    <AppLayout title="Checkout" subtitle="Process customer payment">
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-8">
        {/* Customer Info Header */}
        <Card className="shadow-card bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xl font-bold text-primary">{customer?.name?.charAt(0) || '?'}</span>
                </div>
                <div>
                  <p className="font-semibold text-lg">{customer?.name}</p>
                  <p className="text-sm text-muted-foreground">{customer?.phone}</p>
                </div>
              </div>
              {customer?.default_discount_type && customer?.default_discount_value && (
                <div className="px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-full text-green-700 dark:text-green-400 text-sm font-medium">
                  {customer.default_discount_type === 'percentage' 
                    ? `${customer.default_discount_value}% off` 
                    : `$${customer.default_discount_value} off`} applied
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Column - Order Summary */}
          <div className="space-y-6">
            {/* Order Summary */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Order Items */}
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div key={order.id} className="flex justify-between items-start py-3 border-b last:border-0">
                      <div className="flex-1">
                        <p className="font-medium text-base">{order.book?.title}</p>
                        <p className="text-sm text-muted-foreground">Qty: {order.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-lg">${order.final_price?.toFixed(2) || '0.00'}</p>
                        {(order.amount_paid || 0) > 0 && (
                          <p className="text-sm text-green-600">Paid: ${order.amount_paid?.toFixed(2)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
            
                {/* Totals */}
                <div className="pt-4 space-y-3 bg-muted/50 p-4 rounded-lg">
                  <div className="flex justify-between text-base">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">${subtotal.toFixed(2)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount ({discountType === 'percentage' ? `${discountValue}%` : `$${discountValue}`}):</span>
                      <span className="font-medium">-${discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {totalPaid > 0 && (
                    <div className="flex justify-between text-blue-600">
                      <span>Already Paid:</span>
                      <span className="font-medium">-${totalPaid.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-2xl font-bold border-t pt-3 mt-2">
                    <span>Balance Due:</span>
                    <span className={balanceDue > 0 ? 'text-orange-600' : 'text-green-600'}>
                      ${balanceDue.toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Discount Section */}
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="font-display flex items-center gap-2 text-base">
                  <Tag className="w-4 h-4" />
                  Apply Discount
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm">Type</Label>
                    <Select 
                      value={discountType} 
                      onValueChange={(v) => setDiscountType(v as 'none' | 'percentage' | 'fixed')}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Discount</SelectItem>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                        <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {discountType !== 'none' && (
                    <div className="space-y-1">
                      <Label className="text-sm">{discountType === 'percentage' ? 'Percent' : 'Amount'}</Label>
                      <div className="relative">
                        {discountType === 'percentage' ? (
                          <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        ) : (
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        )}
                        <Input
                          type="number"
                          min="0"
                          step={discountType === 'percentage' ? '1' : '0.01'}
                          max={discountType === 'percentage' ? '100' : undefined}
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                          className="pl-9 h-10"
                          placeholder={discountType === 'percentage' ? '10' : '5.00'}
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                {discountType !== 'none' && (
                  <div className="space-y-1">
                    <Label className="text-sm">Reason (optional)</Label>
                    <Input
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                      placeholder="e.g., Promo code, loyalty"
                      className="h-10"
                    />
                  </div>
                )}
                
                {discountAmount > 0 && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex justify-between items-center">
                    <span className="text-green-700 dark:text-green-400 font-medium">Saving:</span>
                    <span className="text-green-700 dark:text-green-400 font-bold text-lg">-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Right Column - Payment */}
          <div className="space-y-6">
            {/* Payment Section */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Payment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Payment Amount */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Payment Amount</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="pl-12 text-2xl h-16 font-bold"
                      placeholder="0.00"
                    />
                  </div>
                  
                  {/* Quick amount buttons */}
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="default"
                      onClick={() => setPaymentAmount(balanceDue.toFixed(2))}
                      className="flex-1"
                    >
                      Full (${balanceDue.toFixed(2)})
                    </Button>
                    {balanceDue > 20 && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="default"
                        onClick={() => setPaymentAmount('20.00')}
                      >
                        $20
                      </Button>
                    )}
                    {balanceDue > 50 && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="default"
                        onClick={() => setPaymentAmount('50.00')}
                      >
                        $50
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Payment type indicator */}
                {amount > 0 && (
                  <div className={`p-4 rounded-lg ${
                    isFullPayment 
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                      : 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
                  }`}>
                    {isFullPayment ? (
                      <p className="font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
                        <Check className="w-5 h-5" />
                        Full payment - Ready for pickup!
                      </p>
                    ) : (
                      <p className="font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        Deposit - Remaining: ${(balanceDue - amount).toFixed(2)}
                      </p>
                    )}
                  </div>
                )}
                
                {/* Change due */}
                {change > 0 && paymentMethod === 'cash' && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="font-semibold text-blue-700 dark:text-blue-400 text-lg">
                      Change Due: ${change.toFixed(2)}
                    </p>
                  </div>
                )}
                
                {/* Payment Method */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Payment Method</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <Button
                      type="button"
                      variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                      className="h-16 flex flex-col gap-1"
                      onClick={() => setPaymentMethod('cash')}
                    >
                      <Banknote className="w-6 h-6" />
                      <span>Cash</span>
                    </Button>
                    <Button
                      type="button"
                      variant={paymentMethod === 'card' ? 'default' : 'outline'}
                      className="h-16 flex flex-col gap-1"
                      onClick={() => setPaymentMethod('card')}
                    >
                      <CreditCard className="w-6 h-6" />
                      <span>Card</span>
                    </Button>
                    <Button
                      type="button"
                      variant={paymentMethod === 'gift_card' ? 'default' : 'outline'}
                      className="h-16 flex flex-col gap-1"
                      onClick={() => setPaymentMethod('gift_card')}
                    >
                      <Gift className="w-6 h-6" />
                      <span>Gift Card</span>
                    </Button>
                  </div>
                </div>
                
                {/* Gift Card Lookup */}
                {paymentMethod === 'gift_card' && (
                  <div className="space-y-3 p-4 border rounded-lg bg-purple-50 dark:bg-purple-900/20">
                    <Label className="text-sm font-medium">Gift Card Number</Label>
                    <div className="flex gap-2">
                      <Input
                        value={giftCardNumber}
                        onChange={(e) => setGiftCardNumber(e.target.value)}
                        placeholder="GC-12345678"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={lookupGiftCard}
                        disabled={giftCardLookupLoading}
                      >
                        {giftCardLookupLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    {giftCardData && (
                      <div className="p-3 bg-white dark:bg-background rounded-lg border border-purple-200 dark:border-purple-800">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-sm">{giftCardData.card_number}</p>
                            {giftCardData.holder_name && (
                              <p className="text-xs text-muted-foreground">{giftCardData.holder_name}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-purple-600">${Number(giftCardData.balance).toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">available</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => navigate(-1)}
                    size="lg"
                    className="flex-1"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  
                  {paymentMethod === 'cash' ? (
                    <Button
                      onClick={handleCashPayment}
                      disabled={isProcessing || amount <= 0}
                      size="lg"
                      className="flex-1"
                    >
                      {isProcessing ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                      ) : (
                        <><Check className="w-4 h-4 mr-2" /> Pay Cash</>
                      )}
                    </Button>
                  ) : paymentMethod === 'card' ? (
                    <Button
                      onClick={() => setShowCardDialog(true)}
                      disabled={amount <= 0}
                      size="lg"
                      className="flex-1"
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Enter Card
                    </Button>
                  ) : (
                    <Button
                      onClick={handleGiftCardPayment}
                      disabled={isProcessing || amount <= 0 || !giftCardData}
                      size="lg"
                      className="flex-1"
                    >
                      {isProcessing ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                      ) : (
                        <><Gift className="w-4 h-4 mr-2" /> Redeem Gift Card</>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
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
