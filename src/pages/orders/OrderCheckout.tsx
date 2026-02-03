import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { CustomerSearch } from '@/components/customers/CustomerSearch';
import { useCreateCustomerOrder } from '@/hooks/useOrders';
import { useFromStock } from '@/hooks/useInventory';
import { useSettings } from '@/hooks/useSettings';
import { useValidatePromoCode, useRecordPromoCodeUsage } from '@/hooks/usePromoCodes';
import { Customer, Book, PromoCode } from '@/types/database';
import { 
  ShoppingCart, 
  Trash2, 
  DollarSign,
  CreditCard,
  Banknote,
  Check,
  Loader2,
  X,
  User,
  Tag,
  Percent,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Package,
  Minus,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CartItem {
  book: Book;
  quantity: number;
  price: number;
  wantsBinding?: boolean;
}

const BINDING_FEE = 5.00;

export default function OrderCheckout() {
  const navigate = useNavigate();
  const location = useLocation();
  const createOrder = useCreateCustomerOrder();
  const fromStock = useFromStock();
  const { data: settings } = useSettings();
  const validatePromoCode = useValidatePromoCode();
  const recordPromoCodeUsage = useRecordPromoCodeUsage();
  
  // Get cart from navigation state
  const initialCart = (location.state?.cart as CartItem[]) || [];
  
  const [cart, setCart] = useState<CartItem[]>(initialCart);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [showCardDialog, setShowCardDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Promo code state
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromoCode, setAppliedPromoCode] = useState<PromoCode | null>(null);
  const [promoCodeError, setPromoCodeError] = useState<string | null>(null);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  
  // Customer discount toggle - defaults to true when customer has discount
  const [applyCustomerDiscount, setApplyCustomerDiscount] = useState(true);
  
  // Card form
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardZip, setCardZip] = useState('');
  
  // Redirect if no cart
  useEffect(() => {
    if (initialCart.length === 0) {
      navigate('/orders/new');
    }
  }, []);
  
  // Reset customer discount toggle when customer changes
  useEffect(() => {
    setApplyCustomerDiscount(true);
  }, [customer?.id]);
  
  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalBindingFees = cart.reduce((sum, item) => sum + (item.wantsBinding ? BINDING_FEE * item.quantity : 0), 0);
  const subtotalWithBinding = subtotal + totalBindingFees;
  
  // Calculate customer discount (only if toggle is on)
  let customerDiscountAmount = 0;
  let customerDiscountLabel = '';
  const hasCustomerDiscount = customer?.default_discount_type && customer?.default_discount_value && customer.default_discount_value > 0;
  if (hasCustomerDiscount && applyCustomerDiscount) {
    if (customer.default_discount_type === 'percentage') {
      customerDiscountAmount = subtotalWithBinding * (customer.default_discount_value / 100);
      customerDiscountLabel = `${customer.default_discount_value}%`;
    } else {
      customerDiscountAmount = Math.min(customer.default_discount_value, subtotalWithBinding);
      customerDiscountLabel = `$${customer.default_discount_value}`;
    }
  }
  
  // Promo code discount
  let promoDiscountAmount = 0;
  if (appliedPromoCode) {
    const amountAfterCustomerDiscount = subtotalWithBinding - customerDiscountAmount;
    if (appliedPromoCode.discount_type === 'percentage') {
      promoDiscountAmount = amountAfterCustomerDiscount * (appliedPromoCode.discount_value / 100);
    } else {
      promoDiscountAmount = Math.min(appliedPromoCode.discount_value, amountAfterCustomerDiscount);
    }
  }
  
  const totalDiscount = customerDiscountAmount + promoDiscountAmount;
  const finalTotal = Math.max(0, subtotalWithBinding - totalDiscount);
  
  const amount = parseFloat(paymentAmount) || 0;
  const change = amount > finalTotal ? amount - finalTotal : 0;
  const balanceDue = finalTotal > amount ? finalTotal - amount : 0;
  const isFullPayment = amount >= finalTotal && finalTotal > 0;
  
  // Cart functions
  const updateQuantity = (bookId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.book.id === bookId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };
  
  const removeFromCart = (bookId: string) => {
    setCart(prev => prev.filter(item => item.book.id !== bookId));
    if (cart.length === 1) {
      navigate('/orders/new');
    }
  };
  
  const toggleBinding = (bookId: string) => {
    setCart(prev => prev.map(item => 
      item.book.id === bookId ? { ...item, wantsBinding: !item.wantsBinding } : item
    ));
  };
  
  // Promo code functions
  const handleApplyPromoCode = async () => {
    if (!promoCodeInput.trim()) return;
    
    setIsValidatingPromo(true);
    setPromoCodeError(null);
    
    try {
      const result = await validatePromoCode.mutateAsync({
        code: promoCodeInput.trim().toUpperCase(),
        orderTotal: subtotal - customerDiscountAmount,
        customerId: customer?.id,
      });
      
      if (result.valid && result.promoCode) {
        setAppliedPromoCode(result.promoCode);
        setPromoCodeInput('');
        toast.success('Promo code applied!');
      } else {
        setPromoCodeError(result.error || 'Invalid promo code');
      }
    } catch (error: any) {
      setPromoCodeError(error.message || 'Failed to validate promo code');
    } finally {
      setIsValidatingPromo(false);
    }
  };
  
  // Payment functions
  const processPayment = async (method: 'cash' | 'card', transactionId?: string) => {
    if (!customer) {
      toast.error('Please select a customer');
      return;
    }
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    
    setIsProcessing(true);
    try {
      let totalBalanceDue = 0;
      const discountRatio = totalDiscount > 0 ? totalDiscount / subtotalWithBinding : 0;
      
      for (const item of cart) {
        const hasStock = item.book.quantity_in_stock >= item.quantity;
        const itemBindingFee = item.wantsBinding ? BINDING_FEE * item.quantity : 0;
        const itemSubtotal = item.price * item.quantity + itemBindingFee;
        const itemDiscount = itemSubtotal * discountRatio;
        const itemTotal = itemSubtotal - itemDiscount;
        const itemBalanceDue = isFullPayment ? 0 : itemTotal - Math.min(amount, itemTotal);
        totalBalanceDue += itemBalanceDue;
        
        if (hasStock) {
          await fromStock.mutateAsync({ bookId: item.book.id, quantity: item.quantity });
        }
        
        const order = await createOrder.mutateAsync({
          customer_id: customer.id,
          book_id: item.book.id,
          quantity: item.quantity,
          status: hasStock ? 'picked_up' : 'pending',
          payment_status: isFullPayment ? 'paid' : (amount > 0 ? 'partial' : 'unpaid'),
          payment_method: method,
          deposit_amount: isFullPayment ? 0 : amount,
          final_price: itemTotal,
          actual_cost: item.book.default_cost,
          is_bill: false,
          amount_paid: isFullPayment ? itemTotal : Math.min(amount, itemTotal),
          balance_due: itemBalanceDue,
          total_amount: itemTotal,
          picked_up_at: hasStock ? new Date().toISOString() : null,
          wants_binding: item.wantsBinding || false,
          binding_fee: item.wantsBinding ? BINDING_FEE : 0,
          binding_fee_applied: itemBindingFee,
          notes: hasStock 
            ? `[POS - From Stock]${totalDiscount > 0 ? ` | Discount: $${itemDiscount.toFixed(2)}` : ''}${item.wantsBinding ? ' | Needs Binding' : ''}` 
            : `[POS - Will Order]${totalDiscount > 0 ? ` | Discount: $${itemDiscount.toFixed(2)}` : ''}${item.wantsBinding ? ' | Needs Binding' : ''}`,
        });
        
        if (amount > 0) {
          await supabase.from('customer_payments').insert({
            customer_id: customer.id,
            order_id: order.id,
            amount: isFullPayment ? itemTotal : Math.min(amount, itemTotal),
            payment_method: method,
            transaction_id: transactionId || null,
          });
        }
      }
      
      // Record promo code usage
      if (appliedPromoCode && customer) {
        await recordPromoCodeUsage.mutateAsync({
          promoCodeId: appliedPromoCode.id,
          customerId: customer.id,
          discountAmount: promoDiscountAmount,
        });
      }
      
      // Update customer outstanding balance
      if (totalBalanceDue > 0) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('outstanding_balance')
          .eq('id', customer.id)
          .single();
        
        const currentBalance = customerData?.outstanding_balance || 0;
        await supabase
          .from('customers')
          .update({ outstanding_balance: currentBalance + totalBalanceDue })
          .eq('id', customer.id);
      }
      
      if (change > 0 && method === 'cash') {
        toast.success(`Done! Change: $${change.toFixed(2)}`, { duration: 5000 });
      } else if (amount === 0) {
        toast.success(`Order created! Balance due: $${finalTotal.toFixed(2)}`);
      } else if (!isFullPayment && amount > 0) {
        toast.success(`Deposit recorded! Balance: $${(finalTotal - amount).toFixed(2)}`);
      } else {
        toast.success('Order complete!');
      }
      
      navigate('/orders/new');
    } catch (error: any) {
      toast.error(error.message || 'Failed to process order');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleCashPayment = () => processPayment('cash');
  
  const handleCardPayment = async () => {
    if (cardNumber.replace(/\s/g, '').length < 15) {
      toast.error('Please enter a valid card number');
      return;
    }
    
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-sola-payment', {
        body: {
          amount: amount,
          cardNumber: cardNumber.replace(/\s/g, ''),
          cardExpiry: cardExpiry.replace('/', ''),
          cardCvv: cardCvv,
          cardZip: cardZip,
          customerId: customer?.id,
        }
      });
      
      if (error) throw error;
      
      if (data?.success) {
        setShowCardDialog(false);
        await processPayment('card', data.transactionId);
      } else {
        toast.error(data?.message || 'Card declined');
      }
    } catch (error: any) {
      toast.error(error.message || 'Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const formatCardNumber = (value: string) => {
    const v = value.replace(/\D/g, '').slice(0, 16);
    const parts = v.match(/.{1,4}/g) || [];
    return parts.join(' ');
  };
  
  const formatExpiry = (value: string) => {
    const v = value.replace(/\D/g, '').slice(0, 4);
    if (v.length >= 2) {
      return v.slice(0, 2) + '/' + v.slice(2);
    }
    return v;
  };

  return (
    <AppLayout title="Checkout" subtitle="Complete your order">
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate('/orders/new', { state: { cart } })}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Books
        </Button>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Cart & Customer */}
          <div className="space-y-6">
            {/* Cart Items */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Your Cart ({cart.length} items)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {cart.map((item) => (
                  <div key={item.book.id} className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.book.title_hebrew || item.book.title}</p>
                        <p className="text-sm text-muted-foreground">${item.price.toFixed(2)} each</p>
                        {item.book.quantity_in_stock < item.quantity && (
                          <Badge variant="outline" className="text-orange-600 border-orange-300">
                            <Package className="w-3 h-3 mr-1" /> Will Order
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.book.id, -1)}>
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="w-8 text-center font-bold text-lg">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.book.id, 1)}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">${(item.price * item.quantity + (item.wantsBinding ? BINDING_FEE * item.quantity : 0)).toFixed(2)}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeFromCart(item.book.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    {/* Binding Option */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input 
                          type="checkbox" 
                          checked={item.wantsBinding || false}
                          onChange={() => toggleBinding(item.book.id)}
                          className="rounded border-gray-300"
                        />
                        <span className={item.wantsBinding ? 'text-primary font-medium' : 'text-muted-foreground'}>
                          Bind this book (+${BINDING_FEE.toFixed(2)}/book)
                        </span>
                      </label>
                      {item.wantsBinding && (
                        <span className="text-sm text-primary font-medium">+${(BINDING_FEE * item.quantity).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            
            {/* Customer Selection */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Customer
                </CardTitle>
              </CardHeader>
              <CardContent>
                {customer ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium text-lg">{customer.name}</p>
                        <p className="text-sm text-muted-foreground">{customer.phone}</p>
                      </div>
                      <Button variant="ghost" onClick={() => setCustomer(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    {/* Customer Discount Toggle */}
                    {hasCustomerDiscount && (
                      <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2">
                          <Percent className="w-4 h-4 text-green-600" />
                          <div>
                            <p className="font-medium text-green-700">Customer Discount</p>
                            <p className="text-sm text-green-600">
                              {customer.default_discount_type === 'percentage' 
                                ? `${customer.default_discount_value}% off` 
                                : `$${customer.default_discount_value} off`}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={applyCustomerDiscount}
                          onCheckedChange={setApplyCustomerDiscount}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <CustomerSearch onSelect={setCustomer} selectedCustomer={customer} />
                )}
              </CardContent>
            </Card>
            
            {/* Promo Code */}
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Tag className="w-4 h-4" />
                  Promo Code
                </CardTitle>
              </CardHeader>
              <CardContent>
                {appliedPromoCode ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span className="font-mono font-bold">{appliedPromoCode.code}</span>
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        {appliedPromoCode.discount_type === 'percentage' 
                          ? `${appliedPromoCode.discount_value}% off` 
                          : `$${appliedPromoCode.discount_value} off`}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setAppliedPromoCode(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={promoCodeInput}
                      onChange={(e) => {
                        setPromoCodeInput(e.target.value.toUpperCase());
                        setPromoCodeError(null);
                      }}
                      placeholder="Enter promo code"
                      className={`uppercase ${promoCodeError ? 'border-destructive' : ''}`}
                      onKeyDown={(e) => e.key === 'Enter' && handleApplyPromoCode()}
                    />
                    <Button onClick={handleApplyPromoCode} disabled={!promoCodeInput.trim() || isValidatingPromo}>
                      {isValidatingPromo ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                    </Button>
                  </div>
                )}
                {promoCodeError && (
                  <p className="text-sm text-destructive flex items-center gap-1 mt-2">
                    <AlertCircle className="w-4 h-4" />
                    {promoCodeError}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Right Column: Payment */}
          <div>
            <Card className="shadow-card sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Payment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Order Summary */}
                <div className="space-y-3 pb-4 border-b">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  
                  {totalBindingFees > 0 && (
                    <div className="flex justify-between text-primary">
                      <span>Binding Fees</span>
                      <span>+${totalBindingFees.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {customerDiscountAmount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Customer Discount ({customerDiscountLabel})</span>
                      <span>-${customerDiscountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {promoDiscountAmount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Promo Discount</span>
                      <span>-${promoDiscountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center pt-3 border-t">
                    <span className="text-xl font-bold">Total</span>
                    <div className="text-right">
                      {totalDiscount > 0 && (
                        <span className="text-sm text-muted-foreground line-through mr-2">
                          ${subtotalWithBinding.toFixed(2)}
                        </span>
                      )}
                      <span className="text-3xl font-bold text-primary">${finalTotal.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  {totalDiscount > 0 && (
                    <div className="text-center">
                      <Badge className="bg-green-100 text-green-700">
                        You save ${totalDiscount.toFixed(2)}!
                      </Badge>
                    </div>
                  )}
                </div>
                
                {/* Payment Amount */}
                <div className="space-y-3">
                  <Label className="text-lg font-medium">Payment Amount</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
                    <Input
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="pl-12 text-3xl h-16 font-bold"
                      placeholder="0.00"
                    />
                  </div>
                  
                  {/* Quick Amount Buttons */}
                  <div className="grid grid-cols-4 gap-2">
                    <Button variant="outline" onClick={() => setPaymentAmount(finalTotal.toFixed(2))}>
                      Full
                    </Button>
                    {finalTotal >= 10 && (
                      <Button variant="outline" onClick={() => setPaymentAmount('10')}>$10</Button>
                    )}
                    {finalTotal >= 20 && (
                      <Button variant="outline" onClick={() => setPaymentAmount('20')}>$20</Button>
                    )}
                    <Button variant="outline" onClick={() => setPaymentAmount('0')}>$0</Button>
                  </div>
                </div>
                
                {/* Payment Status */}
                {finalTotal > 0 && amount > 0 && (
                  <div className={`p-4 rounded-lg text-center ${
                    change > 0 || isFullPayment
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700'
                      : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700'
                  }`}>
                    {change > 0 ? (
                      <span className="text-xl font-bold">Change: ${change.toFixed(2)}</span>
                    ) : balanceDue > 0 ? (
                      <span className="text-lg">Deposit - Balance: <strong>${balanceDue.toFixed(2)}</strong></span>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-6 h-6" />
                        <span className="text-lg font-bold">Full Payment</span>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Payment Buttons */}
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-20 text-xl flex flex-col gap-2"
                    onClick={handleCashPayment}
                    disabled={!customer || cart.length === 0 || isProcessing}
                  >
                    {isProcessing ? <Loader2 className="w-8 h-8 animate-spin" /> : <Banknote className="w-8 h-8" />}
                    <span>{amount > 0 ? 'Cash' : 'Order Only'}</span>
                  </Button>
                  <Button
                    size="lg"
                    className="h-20 text-xl flex flex-col gap-2"
                    onClick={() => setShowCardDialog(true)}
                    disabled={!customer || cart.length === 0 || amount <= 0 || isProcessing}
                  >
                    <CreditCard className="w-8 h-8" />
                    <span>Card</span>
                  </Button>
                </div>
                
                {!customer && (
                  <p className="text-center text-muted-foreground text-sm">
                    Please select a customer to continue
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Card Payment Dialog */}
      <Dialog open={showCardDialog} onOpenChange={setShowCardDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <CreditCard className="w-6 h-6" />
              Charge ${amount.toFixed(2)}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 pt-2">
            <div>
              <Label>Card Number</Label>
              <Input
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                placeholder="1234 5678 9012 3456"
                className="font-mono text-xl h-12"
                maxLength={19}
                autoFocus
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Expiry</Label>
                <Input
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                  placeholder="MM/YY"
                  className="font-mono text-lg h-12"
                  maxLength={5}
                />
              </div>
              <div>
                <Label>CVV</Label>
                <Input
                  value={cardCvv}
                  onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="123"
                  className="font-mono text-lg h-12"
                  maxLength={4}
                  type="password"
                />
              </div>
            </div>
            
            <div>
              <Label>Zip Code (optional)</Label>
              <Input
                value={cardZip}
                onChange={(e) => setCardZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="12345"
                className="font-mono h-12"
                maxLength={5}
              />
            </div>
            
            <Button
              className="w-full h-14 text-xl"
              onClick={handleCardPayment}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing...</>
              ) : (
                <><Check className="w-5 h-5 mr-2" /> Charge ${amount.toFixed(2)}</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
