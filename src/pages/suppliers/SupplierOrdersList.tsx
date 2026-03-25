import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Truck,
  Send,
  Package,
  Eye,
  Mail,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  Book,
  User,
} from 'lucide-react';
import { useSupplierOrders, usePendingSupplierOrders, useOrdersGroupedBySupplier, useCreateSupplierOrder } from '@/hooks/useOrders';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useEmailSupplier } from '@/hooks/useSupplierEmail';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export default function SupplierOrdersList() {
  const { data: allOrders, isLoading } = useSupplierOrders();
  const { data: pendingOrders } = usePendingSupplierOrders();
  const { data: ordersGroupedBySupplier, isLoading: loadingReadyOrders } = useOrdersGroupedBySupplier();
  const { data: suppliers } = useSuppliers();
  const emailSupplier = useEmailSupplier();
  const createSupplierOrder = useCreateSupplierOrder();

  const [sendingAll, setSendingAll] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState<string | null>(null);

  // Count orders ready to be created
  const readyToCreateCount = Object.values(ordersGroupedBySupplier || {}).reduce(
    (sum, group) => sum + group.orders.length, 0
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'sent':
        return <Badge variant="secondary" className="bg-blue-500/10 text-blue-600"><Send className="w-3 h-3 mr-1" />Sent</Badge>;
      case 'partial':
        return <Badge variant="secondary" className="bg-orange-500/10 text-orange-600"><AlertCircle className="w-3 h-3 mr-1" />Partial</Badge>;
      case 'received':
        return <Badge variant="secondary" className="bg-green-500/10 text-green-600"><CheckCircle className="w-3 h-3 mr-1" />Received</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleSendAllOrders = async () => {
    if (!pendingOrders || pendingOrders.length === 0) {
      toast.info('No pending orders to send');
      return;
    }

    setSendingAll(true);
    let successCount = 0;
    let failCount = 0;

    for (const order of pendingOrders) {
      try {
        await emailSupplier.mutateAsync({
          supplierId: order.supplier_id,
          supplierOrderId: order.id,
          emailType: 'new_order',
        });
        successCount++;
      } catch (error) {
        failCount++;
        console.error(`Failed to send order ${order.id}:`, error);
      }
    }

    setSendingAll(false);
    if (successCount > 0) {
      toast.success(`Successfully sent ${successCount} orders`);
    }
    if (failCount > 0) {
      toast.error(`Failed to send ${failCount} orders`);
    }
  };

  const handleSendOrder = async (order: any) => {
    try {
      await emailSupplier.mutateAsync({
        supplierId: order.supplier_id,
        supplierOrderId: order.id,
        emailType: 'new_order',
      });
    } catch (error) {
      // Error is already handled by the mutation's onError callback
      console.error('Failed to send order:', error);
    }
  };

  // Create supplier order from pending customer orders
  const handleCreateSupplierOrder = async (supplierId: string, customerOrderIds: string[]) => {
    setCreatingOrder(supplierId);
    try {
      const order = await createSupplierOrder.mutateAsync({ supplierId, customerOrderIds });
      toast.success('Supplier order created. Ready to send!');
    } catch (error) {
      // Error handled by mutation
    } finally {
      setCreatingOrder(null);
    }
  };

  // Create all supplier orders at once
  const handleCreateAllOrders = async () => {
    for (const [supplierId, group] of Object.entries(ordersGroupedBySupplier || {})) {
      const orderIds = group.orders.map(o => o.id);
      await handleCreateSupplierOrder(supplierId, orderIds);
    }
  };

  // Group orders by supplier
  const ordersBySupplier = allOrders?.reduce((acc, order) => {
    const supplierId = order.supplier_id;
    if (!acc[supplierId]) {
      acc[supplierId] = [];
    }
    acc[supplierId].push(order);
    return acc;
  }, {} as Record<string, typeof allOrders>) || {};

  return (
    <AppLayout
      title="Supplier Orders"
      subtitle="Manage and track orders to suppliers"
      actions={
        <div className="flex gap-2">
          {readyToCreateCount > 0 && (
            <Button
              variant="outline"
              onClick={handleCreateAllOrders}
              disabled={!!creatingOrder}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create All Orders ({readyToCreateCount})
            </Button>
          )}
          <Button 
            onClick={handleSendAllOrders}
            disabled={sendingAll || !pendingOrders?.length}
          >
            <Send className="w-4 h-4 mr-2" />
            {sendingAll ? 'Sending...' : `Send All Pending (${pendingOrders?.length || 0})`}
          </Button>
        </div>
      }
    >
      <div className="space-y-6 animate-fade-in">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Ready to Create</p>
                  <p className="text-2xl font-bold text-purple-600">{readyToCreateCount}</p>
                </div>
                <Plus className="w-8 h-8 text-purple-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending to Send</p>
                  <p className="text-2xl font-bold text-yellow-600">{pendingOrders?.length || 0}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Sent</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {allOrders?.filter(o => o.status === 'sent').length || 0}
                  </p>
                </div>
                <Send className="w-8 h-8 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Partially Received</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {allOrders?.filter(o => o.status === 'partial').length || 0}
                  </p>
                </div>
                <Package className="w-8 h-8 text-orange-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-green-600">
                    {allOrders?.filter(o => o.status === 'received').length || 0}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Customer Orders Ready to Create Supplier Orders */}
        {Object.keys(ordersGroupedBySupplier || {}).length > 0 && (
          <>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Plus className="w-5 h-5 text-purple-500" />
              Customer Orders Ready to Send
            </h2>
            {Object.entries(ordersGroupedBySupplier || {}).map(([supplierId, group]) => (
              <Card key={supplierId} className="shadow-card border-purple-200 bg-purple-50/30">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <Truck className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{group.supplier?.name || 'Unknown Supplier'}</CardTitle>
                      <p className="text-sm text-muted-foreground">{group.supplier?.email}</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleCreateSupplierOrder(supplierId, group.orders.map(o => o.id))}
                    disabled={creatingOrder === supplierId}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {creatingOrder === supplierId ? 'Creating...' : `Create Order (${group.orders.length} items)`}
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {group.orders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-white/70"
                      >
                        <div className="flex items-center gap-4">
                          <Book className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{order.book?.title}</p>
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <User className="w-3 h-3" />
                              {order.customer?.name} • Qty: {order.quantity}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline">Pending</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        )}

        {/* Existing Supplier Orders */}
        {Object.keys(ordersBySupplier).length > 0 && (
          <>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Supplier Orders
            </h2>
            {Object.entries(ordersBySupplier).map(([supplierId, orders]) => {
              const supplier = suppliers?.find(s => s.id === supplierId);
              const pendingCount = orders?.filter(o => o.status === 'pending').length || 0;

              return (
                <Card key={supplierId} className="shadow-card">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Truck className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{supplier?.name || 'Unknown Supplier'}</CardTitle>
                        <p className="text-sm text-muted-foreground">{supplier?.email}</p>
                      </div>
                    </div>
                    {pendingCount > 0 && (
                      <Badge className="bg-yellow-500">{pendingCount} pending</Badge>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {orders?.map((order) => (
                        <div
                          key={order.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div>
                              <p className="font-medium">
                                Order #{order.id.slice(0, 8)}
                                <span className="ml-2 text-sm text-muted-foreground">
                                  ({order.items?.length || 0} items)
                                </span>
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(order.status)}
                            <Button variant="ghost" size="sm" asChild>
                              <Link to={`/supplier-orders/${order.id}`}>
                                <Eye className="w-4 h-4 mr-1" />
                                View
                              </Link>
                            </Button>
                            {order.status === 'pending' && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleSendOrder(order)}
                                disabled={emailSupplier.isPending}
                              >
                                <Mail className="w-4 h-4 mr-1" />
                                Send
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </>
        )}

        {/* Empty State */}
        {Object.keys(ordersBySupplier).length === 0 && Object.keys(ordersGroupedBySupplier || {}).length === 0 && !isLoading && (
          <Card className="shadow-card">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No supplier orders yet</p>
              <p className="text-sm mt-1">Orders will appear here when customers place orders with books that have suppliers assigned</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
