import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ShoppingCart, 
  Search,
  User,
  Book,
  DollarSign,
  Filter,
  Edit,
  Trash2,
  CreditCard
} from 'lucide-react';
import { useCustomerOrders, useUpdateCustomerOrder } from '@/hooks/useOrders';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { OrderStatus, CustomerOrder } from '@/types/database';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { PaymentStatusBadge } from '@/components/orders/PaymentStatusBadge';

const statusOptions: { value: string; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'received', label: 'Received' },
  { value: 'ready', label: 'Ready' },
  { value: 'picked_up', label: 'Picked Up' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function OrdersList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingOrder, setEditingOrder] = useState<CustomerOrder | null>(null);
  const [editForm, setEditForm] = useState({
    quantity: 1,
    deposit_amount: 0,
    final_price: '',
    actual_cost: '',
    notes: '',
  });
  
  const queryClient = useQueryClient();
  const { data: orders, isLoading } = useCustomerOrders(
    statusFilter !== 'all' ? statusFilter : undefined
  );
  const updateOrder = useUpdateCustomerOrder();

  const filteredOrders = orders?.filter(order => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      order.customer?.name?.toLowerCase().includes(searchLower) ||
      order.book?.title?.toLowerCase().includes(searchLower) ||
      order.customer?.phone?.includes(search)
    );
  });

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    await updateOrder.mutateAsync({ id: orderId, status: newStatus });
  };

  const handleEditOrder = (order: CustomerOrder) => {
    setEditingOrder(order);
    setEditForm({
      quantity: order.quantity,
      deposit_amount: order.deposit_amount,
      final_price: order.final_price?.toString() || '',
      actual_cost: order.actual_cost?.toString() || '',
      notes: order.notes || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingOrder) return;
    
    await updateOrder.mutateAsync({
      id: editingOrder.id,
      quantity: editForm.quantity,
      deposit_amount: editForm.deposit_amount,
      final_price: editForm.final_price ? parseFloat(editForm.final_price) : null,
      actual_cost: editForm.actual_cost ? parseFloat(editForm.actual_cost) : null,
      notes: editForm.notes || null,
    });
    
    setEditingOrder(null);
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to delete this order?')) return;
    
    const { error } = await supabase
      .from('customer_orders')
      .delete()
      .eq('id', orderId);
    
    if (error) {
      toast.error('Failed to delete order: ' + error.message);
    } else {
      toast.success('Order deleted');
      queryClient.invalidateQueries({ queryKey: ['customer-orders'] });
    }
  };

  return (
    <AppLayout 
      title="Orders" 
      subtitle="Manage customer orders"
      actions={
        <Button asChild>
          <Link to="/orders/new">
            <ShoppingCart className="w-4 h-4 mr-2" />
            New Order
          </Link>
        </Button>
      }
    >
      <div className="space-y-6 animate-fade-in">
        {/* Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Orders List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading orders...</div>
        ) : filteredOrders && filteredOrders.length > 0 ? (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <Card key={order.id} className="shadow-soft hover:shadow-card transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Book className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{order.book?.title}</h3>
                        {order.book?.title_hebrew && (
                          <p className="text-sm text-muted-foreground truncate" dir="rtl">
                            {order.book.title_hebrew}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {order.customer?.name}
                          </span>
                          <span>Qty: {order.quantity}</span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5" />
                            {order.deposit_amount > 0 ? `$${order.deposit_amount} deposit` : 'No deposit'}
                          </span>
                        </div>
                        {order.notes && (
                          <p className="text-sm text-muted-foreground mt-1 truncate">
                            Note: {order.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/checkout?orders=${order.id}`)}
                        className="text-xs"
                      >
                        <CreditCard className="w-3 h-3 mr-1" />
                        Pay
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEditOrder(order)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteOrder(order.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                      {order.payment_status && (
                        <PaymentStatusBadge status={order.payment_status} />
                      )}
                      <Select 
                        value={order.status} 
                        onValueChange={(value) => handleStatusChange(order.id, value as OrderStatus)}
                      >
                        <SelectTrigger className="w-32">
                          <OrderStatusBadge status={order.status} />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.filter(o => o.value !== 'all').map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <span>Created: {new Date(order.created_at).toLocaleDateString()}</span>
                    {order.final_price && (
                      <span className="font-medium text-foreground">
                        Final: ${order.final_price}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="shadow-soft">
            <CardContent className="py-12 text-center">
              <ShoppingCart className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground">No orders found</p>
              <Button asChild className="mt-4">
                <Link to="/orders/new">Create your first order</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Edit Order Dialog */}
        <Dialog open={!!editingOrder} onOpenChange={(open) => !open && setEditingOrder(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Edit Order</DialogTitle>
            </DialogHeader>
            {editingOrder && (
              <div className="space-y-4 mt-4">
                <div className="p-3 bg-secondary/50 rounded-lg">
                  <p className="font-medium">{editingOrder.book?.title}</p>
                  <p className="text-sm text-muted-foreground">{editingOrder.customer?.name}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={editForm.quantity}
                      onChange={(e) => setEditForm({ ...editForm, quantity: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Deposit Amount ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.deposit_amount}
                      onChange={(e) => setEditForm({ ...editForm, deposit_amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Actual Cost ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.actual_cost}
                      onChange={(e) => setEditForm({ ...editForm, actual_cost: e.target.value })}
                      placeholder="Cost from supplier"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Final Price ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.final_price}
                      onChange={(e) => setEditForm({ ...editForm, final_price: e.target.value })}
                      placeholder="Price for customer"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    placeholder="Order notes..."
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={handleSaveEdit} 
                    className="flex-1"
                    disabled={updateOrder.isPending}
                  >
                    Save Changes
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setEditingOrder(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
