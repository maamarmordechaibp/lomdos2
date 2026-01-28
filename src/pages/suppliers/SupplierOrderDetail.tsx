import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Send,
  Mail,
  Book,
  User,
  Trash2,
  Save,
  Check,
  Phone,
  MessageSquare,
} from 'lucide-react';
import { useSupplierOrder, useUpdateSupplierOrder, useUpdateSupplierOrderItem, useDeleteSupplierOrderItem, useUpdateCustomerOrder } from '@/hooks/useOrders';
import { useEmailSupplier } from '@/hooks/useSupplierEmail';
import { useNotifyCustomer } from '@/hooks/useNotifications';
import { useSettings } from '@/hooks/useSettings';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export default function SupplierOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: order, isLoading } = useSupplierOrder(id);
  const { data: settings } = useSettings();
  const updateOrder = useUpdateSupplierOrder();
  const updateItem = useUpdateSupplierOrderItem();
  const deleteItem = useDeleteSupplierOrderItem();
  const emailSupplier = useEmailSupplier();
  const notifyCustomer = useNotifyCustomer();
  const updateCustomerOrder = useUpdateCustomerOrder();

  const [editedCosts, setEditedCosts] = useState<Record<string, string>>({});
  const [receivedItems, setReceivedItems] = useState<Set<string>>(new Set());
  const [notifyDialog, setNotifyDialog] = useState<{ 
    open: boolean; 
    customers: Array<{ 
      customerId: string;
      customerName: string;
      phone: string;
      email: string | null;
      preference: string;
      orderIds: string[];
      bookTitles: string[];
    }> 
  }>({ open: false, customers: [] });

  const handleCostChange = (itemId: string, cost: string) => {
    setEditedCosts(prev => ({ ...prev, [itemId]: cost }));
  };

  const handleToggleReceived = (itemId: string) => {
    setReceivedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleSaveItem = async (itemId: string) => {
    const cost = editedCosts[itemId];
    if (cost) {
      await updateItem.mutateAsync({
        id: itemId,
        cost: parseFloat(cost),
      });
      toast.success('Item cost updated');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (confirm('Are you sure you want to remove this item from the order?')) {
      await deleteItem.mutateAsync(itemId);
    }
  };

  const handleSendOrder = async () => {
    if (!order) return;
    await emailSupplier.mutateAsync({
      supplierId: order.supplier_id,
      supplierOrderId: order.id,
      emailType: 'new_order',
    });
  };

  const calculateFinalPrice = (cost: number, book: any) => {
    if (book?.no_profit) return cost;
    const margin = book?.custom_profit_margin ?? settings?.default_profit_margin ?? 20;
    return cost * (1 + margin / 100);
  };

  const handleProcessReceived = async () => {
    if (receivedItems.size === 0) {
      toast.error('Please select items to mark as received');
      return;
    }

    // Group items by customer to batch notifications
    const customerOrders: Record<string, {
      customerId: string;
      customerName: string;
      phone: string;
      email: string | null;
      preference: string;
      orderIds: string[];
      bookTitles: string[];
    }> = {};

    for (const itemId of receivedItems) {
      const item = order?.items?.find(i => i.id === itemId);
      if (!item) continue;

      const cost = editedCosts[itemId] ? parseFloat(editedCosts[itemId]) : item.cost;
      
      // Update supplier order item
      await updateItem.mutateAsync({
        id: itemId,
        is_received: true,
        cost,
      });

      // Update customer order if linked
      if (item.customer_order_id && cost) {
        const finalPrice = calculateFinalPrice(cost, item.book);
        await updateCustomerOrder.mutateAsync({
          id: item.customer_order_id,
          status: 'received',
          actual_cost: cost,
          final_price: parseFloat(finalPrice.toFixed(2)),
        });

        // Group by customer for batch notification
        if (item.customer_order?.customer) {
          const customer = item.customer_order.customer;
          if (!customerOrders[customer.id]) {
            customerOrders[customer.id] = {
              customerId: customer.id,
              customerName: customer.name,
              phone: customer.phone,
              email: customer.email,
              preference: customer.notification_preference,
              orderIds: [],
              bookTitles: [],
            };
          }
          customerOrders[customer.id].orderIds.push(item.customer_order_id);
          customerOrders[customer.id].bookTitles.push(item.book?.title || 'Unknown');
        }
      }
    }

    // Check if all items received
    const allReceived = order?.items?.every(item => 
      item.is_received || receivedItems.has(item.id)
    );

    if (allReceived) {
      await updateOrder.mutateAsync({
        id: order!.id,
        status: 'received',
        received_at: new Date().toISOString(),
      });
    } else {
      await updateOrder.mutateAsync({
        id: order!.id,
        status: 'partial',
      });
    }

    setReceivedItems(new Set());
    toast.success('Items marked as received');

    // Show notification dialog if there are customers to notify
    const customersToNotify = Object.values(customerOrders);
    if (customersToNotify.length > 0) {
      setNotifyDialog({ open: true, customers: customersToNotify });
    }
  };

  const handleNotifyCustomer = async (customer: typeof notifyDialog.customers[0]) => {
    // Send ONE notification per customer, regardless of how many books
    // Use the first order ID but mention all books in the notification
    await notifyCustomer.mutateAsync({
      customerId: customer.customerId,
      customerOrderId: customer.orderIds[0],
      notificationType: 'order_ready',
      customMessage: customer.bookTitles.length > 1 
        ? `Your books are ready for pickup: ${customer.bookTitles.join(', ')}`
        : undefined,
    });

    // Update all orders to ready status
    for (const orderId of customer.orderIds) {
      await updateCustomerOrder.mutateAsync({
        id: orderId,
        status: 'ready',
      });
    }
  };

  const handleNotifyAllCustomers = async () => {
    for (const customer of notifyDialog.customers) {
      await handleNotifyCustomer(customer);
    }
    setNotifyDialog({ open: false, customers: [] });
    toast.success('All customers notified');
  };

  const handleSkipNotification = () => {
    setNotifyDialog({ open: false, customers: [] });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600">Pending</Badge>;
      case 'sent':
        return <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">Sent</Badge>;
      case 'partial':
        return <Badge variant="secondary" className="bg-orange-500/10 text-orange-600">Partially Received</Badge>;
      case 'received':
        return <Badge variant="secondary" className="bg-green-500/10 text-green-600">Received</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <AppLayout title="Loading...">
        <div className="text-center py-12 text-muted-foreground">Loading order...</div>
      </AppLayout>
    );
  }

  if (!order) {
    return (
      <AppLayout title="Order Not Found">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Order not found</p>
          <Button asChild>
            <Link to="/supplier-orders">Back to Orders</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  const canEdit = order.status === 'pending';
  const canReceive = order.status === 'sent' || order.status === 'partial';

  return (
    <AppLayout
      title={`Order #${order.id.slice(0, 8)}`}
      subtitle={`Order to ${order.supplier?.name}`}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/supplier-orders">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
          {order.status === 'pending' && (
            <Button onClick={handleSendOrder} disabled={emailSupplier.isPending}>
              <Send className="w-4 h-4 mr-2" />
              {emailSupplier.isPending ? 'Sending...' : 'Send Order Email'}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-6 animate-fade-in">
        {/* Order Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="shadow-card">
            <CardContent className="p-4">
              <Label className="text-muted-foreground">Status</Label>
              <div className="mt-1">{getStatusBadge(order.status)}</div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-4">
              <Label className="text-muted-foreground">Supplier</Label>
              <p className="font-medium mt-1">{order.supplier?.name}</p>
              <p className="text-sm text-muted-foreground">{order.supplier?.email}</p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-4">
              <Label className="text-muted-foreground">Created</Label>
              <p className="font-medium mt-1">
                {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
              </p>
              {order.sent_at && (
                <p className="text-sm text-muted-foreground">
                  Sent: {formatDistanceToNow(new Date(order.sent_at), { addSuffix: true })}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Order Items */}
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Order Items ({order.items?.length || 0})</CardTitle>
            {canReceive && receivedItems.size > 0 && (
              <Button onClick={handleProcessReceived}>
                <Check className="w-4 h-4 mr-2" />
                Mark {receivedItems.size} as Received
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {order.items?.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-lg border ${item.is_received ? 'bg-green-500/5 border-green-500/20' : 'bg-secondary/30 border-transparent'}`}
                >
                  <div className="flex items-start gap-4">
                    {canReceive && !item.is_received && (
                      <Checkbox
                        checked={receivedItems.has(item.id)}
                        onCheckedChange={() => handleToggleReceived(item.id)}
                        className="mt-1"
                      />
                    )}
                    
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Book className="w-5 h-5 text-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{item.book?.title}</p>
                          {item.book?.title_hebrew && (
                            <p className="text-sm text-muted-foreground">{item.book.title_hebrew}</p>
                          )}
                          {item.book?.author && (
                            <p className="text-sm text-muted-foreground">by {item.book.author}</p>
                          )}
                          {item.book?.isbn && (
                            <p className="text-xs text-muted-foreground">ISBN: {item.book.isbn}</p>
                          )}
                        </div>
                        {item.is_received && (
                          <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                            <Check className="w-3 h-3 mr-1" />
                            Received
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-sm">Qty: <strong>{item.quantity}</strong></span>
                        
                        {item.customer_order && (
                          <span className="text-sm flex items-center gap-1 text-muted-foreground">
                            <User className="w-3.5 h-3.5" />
                            For: {item.customer_order.customer?.name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="w-28">
                        <Label className="text-xs text-muted-foreground">Cost ($)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editedCosts[item.id] ?? item.cost ?? ''}
                          onChange={(e) => handleCostChange(item.id, e.target.value)}
                          disabled={item.is_received}
                          className="mt-1"
                        />
                      </div>

                      {canEdit && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSaveItem(item.id)}
                            disabled={!editedCosts[item.id]}
                          >
                            <Save className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteItem(item.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        {order.notes && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Notification Dialog */}
      <Dialog open={notifyDialog.open} onOpenChange={(open) => !open && setNotifyDialog({ open: false, customers: [] })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Notify Customers?</DialogTitle>
            <DialogDescription>
              {notifyDialog.customers.length === 1 
                ? `${notifyDialog.customers[0]?.customerName}'s order is ready for pickup.`
                : `${notifyDialog.customers.length} customers have orders ready for pickup.`
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-3 max-h-80 overflow-y-auto">
            {notifyDialog.customers.map((customer) => (
              <div key={customer.customerId} className="p-3 bg-muted/50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span className="font-medium">{customer.customerName}</span>
                  </div>
                  <Badge variant="outline">
                    {customer.bookTitles.length} book{customer.bookTitles.length > 1 ? 's' : ''}
                  </Badge>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  {customer.bookTitles.map((title, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <Book className="w-3 h-3" />
                      {title}
                    </div>
                  ))}
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  {customer.preference === 'phone' && (
                    <>
                      <Phone className="w-3.5 h-3.5 text-primary" />
                      <span>Call: {customer.phone}</span>
                    </>
                  )}
                  {customer.preference === 'sms' && (
                    <>
                      <MessageSquare className="w-3.5 h-3.5 text-primary" />
                      <span>SMS: {customer.phone}</span>
                    </>
                  )}
                  {customer.preference === 'email' && (
                    <>
                      <Mail className="w-3.5 h-3.5 text-primary" />
                      <span>Email: {customer.email}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> Each customer will receive <strong>one notification</strong> for all their books, not multiple calls.
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={handleSkipNotification}>
              Skip for Now
            </Button>
            <Button onClick={handleNotifyAllCustomers} disabled={notifyCustomer.isPending}>
              {notifyCustomer.isPending ? 'Sending...' : `Notify ${notifyDialog.customers.length} Customer${notifyDialog.customers.length > 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
