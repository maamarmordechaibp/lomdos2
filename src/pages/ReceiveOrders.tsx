import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  CheckSquare, 
  Package,
  Book,
  User,
  DollarSign,
  Phone,
  MessageSquare,
  Mail,
  Truck,
  BookMarked,
  AlertTriangle
} from 'lucide-react';
import { useCustomerOrders, useUpdateCustomerOrder } from '@/hooks/useOrders';
import { useUpdateBook } from '@/hooks/useBooks';
import { useSettings } from '@/hooks/useSettings';
import { useCreateExpense } from '@/hooks/useBalances';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { notifyCustomer } from '@/services/notificationService';
import { CustomerOrder } from '@/types/database';

export default function ReceiveOrders() {
  const { data: orders, isLoading } = useCustomerOrders('ordered');
  const { data: receivedOrders, isLoading: loadingReceived } = useCustomerOrders('received');
  const { data: settings } = useSettings();
  const updateOrder = useUpdateCustomerOrder();
  const updateBook = useUpdateBook();
  const createExpense = useCreateExpense();
  
  const [receivedItems, setReceivedItems] = useState<Record<string, { received: boolean; cost: string }>>({});
  const [shippingCost, setShippingCost] = useState('');
  const [showShippingDialog, setShowShippingDialog] = useState(false);
  const [pendingProcess, setPendingProcess] = useState<Array<[string, { received: boolean; cost: string }]>>([]);
  const [notifyDialog, setNotifyDialog] = useState<{ open: boolean; order: CustomerOrder | null }>({ open: false, order: null });
  const [isSendingNotification, setIsSendingNotification] = useState(false);

  const handleToggleReceived = (orderId: string) => {
    setReceivedItems(prev => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        received: !prev[orderId]?.received,
      }
    }));
  };

  const handleCostChange = (orderId: string, cost: string) => {
    setReceivedItems(prev => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        cost,
      }
    }));
  };

  const calculatePrice = (costPerPiece: number, quantity: number, book: any) => {
    const totalCost = costPerPiece * quantity;
    if (book?.no_profit) return totalCost;
    const margin = book?.custom_profit_margin ?? settings?.default_profit_margin ?? 20;
    return totalCost * (1 + margin / 100);
  };

  const handleProcessReceived = async () => {
    const toProcess = Object.entries(receivedItems).filter(([_, item]) => item.received && item.cost);
    
    if (toProcess.length === 0) {
      toast.error('Please mark items as received and enter costs');
      return;
    }

    // Show shipping dialog before processing
    setPendingProcess(toProcess);
    setShowShippingDialog(true);
  };

  const handleConfirmProcess = async (includeShipping: boolean) => {
    setShowShippingDialog(false);
    const toProcess = pendingProcess;
    
    // Record shipping expense if provided
    if (includeShipping && shippingCost && parseFloat(shippingCost) > 0) {
      try {
        await createExpense.mutateAsync({
          category: 'shipping',
          description: `Shipping for ${toProcess.length} received order(s)`,
          amount: parseFloat(shippingCost),
          expense_date: new Date().toISOString().split('T')[0],
          is_tax_deductible: true,
          receipt_url: null,
          notes: `Orders: ${toProcess.map(([id]) => orders?.find(o => o.id === id)?.book?.title).join(', ')}`,
        });
      } catch (error) {
        console.error('Failed to record shipping expense:', error);
      }
    }

    for (const [orderId, item] of toProcess) {
      const order = orders?.find(o => o.id === orderId);
      if (!order || !order.book) continue;

      const costPerPiece = parseFloat(item.cost);
      const totalCost = costPerPiece * order.quantity;
      const finalPrice = calculatePrice(costPerPiece, order.quantity, order.book);
      
      // Calculate balance due considering any deposit already paid
      const balanceDue = parseFloat(finalPrice.toFixed(2)) - (order.amount_paid || 0);

      // Update the order with final price
      await updateOrder.mutateAsync({
        id: orderId,
        status: 'received',
        actual_cost: totalCost, // Store total cost, not per-piece
        final_price: parseFloat(finalPrice.toFixed(2)),
        balance_due: balanceDue,
        payment_status: balanceDue <= 0 ? 'paid' : (order.amount_paid > 0 ? 'partial' : 'unpaid'),
      });
      
      // Save the cost per piece to the book so future orders will have an estimated price
      await updateBook.mutateAsync({
        id: order.book.id,
        default_cost: costPerPiece,
      });
    }

    setReceivedItems({});
    setShippingCost('');
    setPendingProcess([]);
    toast.success(`Processed ${toProcess.length} orders`);
  };

  const handleMarkReady = async (orderId: string) => {
    const order = receivedOrders?.find(o => o.id === orderId);
    if (order) {
      // Show notification dialog
      setNotifyDialog({ open: true, order });
    }
  };

  const handleSendNotification = async () => {
    if (!notifyDialog.order) return;
    
    setIsSendingNotification(true);
    try {
      const result = await notifyCustomer({
        customerId: notifyDialog.order.customer_id,
        customerOrderId: notifyDialog.order.id,
        notificationType: 'order_ready',
      });

      if (result.success) {
        toast.success('Customer notified successfully!');
      } else {
        toast.error('Failed to notify: ' + result.error);
      }

      // Mark as ready regardless of notification result
      await updateOrder.mutateAsync({ id: notifyDialog.order.id, status: 'ready' });
      setNotifyDialog({ open: false, order: null });
    } catch (error: any) {
      toast.error('Error: ' + error.message);
    } finally {
      setIsSendingNotification(false);
    }
  };

  const handleSkipNotification = async () => {
    if (!notifyDialog.order) return;
    await updateOrder.mutateAsync({ id: notifyDialog.order.id, status: 'ready' });
    setNotifyDialog({ open: false, order: null });
    toast.success('Order marked as ready (no notification sent)');
  };

  const allReceivedOrders = receivedOrders || [];

  return (
    <AppLayout 
      title="Receive Orders" 
      subtitle="Check off received books and set prices"
    >
      <div className="space-y-6 animate-fade-in">
        {/* Ordered - Waiting to Receive */}
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display flex items-center gap-2">
              <Package className="w-5 h-5" />
              Ordered - Waiting to Receive
            </CardTitle>
            {Object.values(receivedItems).some(i => i.received) && (
              <Button onClick={handleProcessReceived}>
                <CheckSquare className="w-4 h-4 mr-2" />
                Process Received
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : orders && orders.length > 0 ? (
              <div className="space-y-3">
                {orders.map((order) => (
                  <div 
                    key={order.id}
                    className="flex items-center gap-4 p-4 rounded-lg bg-secondary/30"
                  >
                    <Checkbox
                      checked={receivedItems[order.id]?.received || false}
                      onCheckedChange={() => handleToggleReceived(order.id)}
                    />
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Book className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{order.book?.title}</p>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {order.customer?.name}
                        </span>
                        <span>Qty: {order.quantity}</span>
                        {order.amount_paid > 0 && (
                          <span className="text-green-600 font-medium">
                            <DollarSign className="w-3.5 h-3.5 inline" />
                            {order.amount_paid.toFixed(2)} deposit paid
                          </span>
                        )}
                        {order.wants_binding && (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">
                            <BookMarked className="w-3 h-3 mr-1" />
                            Needs Binding
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="w-32">
                      <Label className="text-xs text-muted-foreground">Cost/piece ($)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={order.book?.default_cost ? order.book.default_cost.toFixed(2) : '0.00'}
                        value={receivedItems[order.id]?.cost || ''}
                        onChange={(e) => handleCostChange(order.id, e.target.value)}
                        className="mt-1"
                      />
                      {receivedItems[order.id]?.cost && order.quantity > 1 && (
                        <p className="text-xs text-green-600 mt-1">
                          Total: ${(parseFloat(receivedItems[order.id].cost) * order.quantity * (1 + (order.book?.custom_profit_margin ?? settings?.default_profit_margin ?? 20) / 100)).toFixed(2)}
                        </p>
                      )}
                      {order.book?.default_cost && !receivedItems[order.id]?.cost && (
                        <p className="text-xs text-muted-foreground mt-1">Last: ${order.book.default_cost.toFixed(2)}/ea</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No orders waiting to be received
              </div>
            )}
          </CardContent>
        </Card>

        {/* Received - Ready to Notify */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <CheckSquare className="w-5 h-5" />
              Received - Ready to Mark as Ready
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allReceivedOrders.length > 0 ? (
              <div className="space-y-3">
                {allReceivedOrders.map((order) => (
                  <div 
                    key={order.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-success/5 border border-success/20"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                        <Book className="w-5 h-5 text-success" />
                      </div>
                      <div>
                        <p className="font-medium">{order.book?.title}</p>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {order.customer?.name} ({order.customer?.phone})
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5" />
                            Final: ${order.final_price} (Cost: ${order.actual_cost})
                          </span>
                          {order.deposit_amount > 0 && (
                            <span className="text-green-600">
                              Deposit: ${order.deposit_amount}
                            </span>
                          )}
                          {order.wants_binding && (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">
                              <BookMarked className="w-3 h-3 mr-1" />
                              Needs Binding
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {order.wants_binding && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mr-4 flex items-center gap-2 text-amber-800">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-xs font-medium">Bind before marking ready!</span>
                      </div>
                    )}
                    <Button onClick={() => handleMarkReady(order.id)}>
                      Mark Ready & Notify
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No orders ready to notify
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notification Dialog */}
      <Dialog open={notifyDialog.open} onOpenChange={(open) => !open && setNotifyDialog({ open: false, order: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notify Customer?</DialogTitle>
            <DialogDescription>
              {notifyDialog.order?.customer?.name}'s book "{notifyDialog.order?.book?.title}" is ready for pickup.
              Would you like to notify them?
            </DialogDescription>
          </DialogHeader>
          
          {notifyDialog.order?.customer && (
            <div className="py-4 space-y-3">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                {notifyDialog.order.customer.notification_preference === 'phone' && (
                  <>
                    <Phone className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">Automated Phone Call</p>
                      <p className="text-sm text-muted-foreground">
                        Customer will receive a call at {notifyDialog.order.customer.phone}
                      </p>
                    </div>
                  </>
                )}
                {notifyDialog.order.customer.notification_preference === 'sms' && (
                  <>
                    <MessageSquare className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">Text Message</p>
                      <p className="text-sm text-muted-foreground">
                        Customer will receive SMS at {notifyDialog.order.customer.phone}
                      </p>
                    </div>
                  </>
                )}
                {notifyDialog.order.customer.notification_preference === 'email' && (
                  <>
                    <Mail className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">Email</p>
                      <p className="text-sm text-muted-foreground">
                        Customer will receive email at {notifyDialog.order.customer.email}
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="p-3 bg-secondary/50 rounded-lg text-sm">
                <p><strong>Price:</strong> ${notifyDialog.order.final_price}</p>
                {notifyDialog.order.deposit_amount > 0 && (
                  <>
                    <p><strong>Deposit:</strong> ${notifyDialog.order.deposit_amount}</p>
                    <p><strong>Balance Due:</strong> ${((notifyDialog.order.final_price || 0) - notifyDialog.order.deposit_amount).toFixed(2)}</p>
                  </>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleSkipNotification}>
              Skip Notification
            </Button>
            <Button onClick={handleSendNotification} disabled={isSendingNotification}>
              {isSendingNotification ? 'Sending...' : 'Notify Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shipping Cost Dialog */}
      <Dialog open={showShippingDialog} onOpenChange={(open) => !open && setShowShippingDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Shipping Cost
            </DialogTitle>
            <DialogDescription>
              Enter the shipping cost for this delivery (if any). This will be recorded as a shipping expense.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label htmlFor="shipping">Shipping Cost ($)</Label>
            <Input
              id="shipping"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={shippingCost}
              onChange={(e) => setShippingCost(e.target.value)}
              className="mt-2"
            />
            <p className="text-sm text-muted-foreground mt-2">
              Processing {pendingProcess.length} order(s)
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleConfirmProcess(false)}>
              No Shipping Cost
            </Button>
            <Button onClick={() => handleConfirmProcess(true)} disabled={!shippingCost || parseFloat(shippingCost) <= 0}>
              <DollarSign className="w-4 h-4 mr-2" />
              Record & Process
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
