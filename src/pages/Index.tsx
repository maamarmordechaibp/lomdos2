import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { 
  ShoppingCart, 
  Package, 
  AlertTriangle, 
  CheckSquare,
  Users,
  Book,
  Truck,
  ArrowRight,
  Send,
  Warehouse
} from 'lucide-react';
import { useCustomerOrders, usePendingSupplierAssignments, usePendingSupplierOrders, useOrdersReadyForSupplier } from '@/hooks/useOrders';
import { useLowStockBooks } from '@/hooks/useInventory';
import { useCustomers } from '@/hooks/useCustomers';
import { useBooks } from '@/hooks/useBooks';
import { useSuppliers } from '@/hooks/useSuppliers';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';

export default function Index() {
  const { data: orders } = useCustomerOrders();
  const { data: pendingAssignments } = usePendingSupplierAssignments();
  const { data: pendingSupplierOrders } = usePendingSupplierOrders();
  const { data: readyForSupplier } = useOrdersReadyForSupplier();
  const { data: lowStockBooks } = useLowStockBooks();
  const { data: customers } = useCustomers();
  const { data: books } = useBooks();
  const { data: suppliers } = useSuppliers();

  const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0;
  const readyOrders = orders?.filter(o => o.status === 'ready').length || 0;
  const pendingSupplier = pendingAssignments?.length || 0;
  // Count both: customer orders ready to become supplier orders + pending supplier orders
  const pendingToSendCount = (readyForSupplier?.length || 0) + (pendingSupplierOrders?.length || 0);
  const lowStockCount = lowStockBooks?.length || 0;

  const recentOrders = orders?.slice(0, 5) || [];

  return (
    <AppLayout 
      title="Dashboard" 
      subtitle="Overview of your bookstore operations"
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
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-card hover:shadow-elevated transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Orders</p>
                  <p className="text-3xl font-display font-bold mt-1">{pendingOrders}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                  <Package className="w-6 h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card hover:shadow-elevated transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Ready for Pickup</p>
                  <p className="text-3xl font-display font-bold mt-1">{readyOrders}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <CheckSquare className="w-6 h-6 text-success" />
                </div>
              </div>
              {readyOrders > 0 && (
                <Button variant="link" asChild className="p-0 h-auto mt-2">
                  <Link to="/pickups">
                    Process pickups <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card hover:shadow-elevated transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Supplier</p>
                  <p className="text-3xl font-display font-bold mt-1">{pendingSupplier}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
              </div>
              {pendingSupplier > 0 && (
                <Button variant="link" asChild className="p-0 h-auto mt-2">
                  <Link to="/pending-supplier">
                    Assign suppliers <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card hover:shadow-elevated transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Orders to Send</p>
                  <p className="text-3xl font-display font-bold mt-1">{pendingToSendCount}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Send className="w-6 h-6 text-blue-500" />
                </div>
              </div>
              {pendingToSendCount > 0 && (
                <Button variant="link" asChild className="p-0 h-auto mt-2">
                  <Link to="/supplier-orders">
                    Send to suppliers <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Low Stock Alert */}
        {lowStockCount > 0 && (
          <Card className="shadow-card border-orange-500/20 bg-orange-500/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <Warehouse className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium text-orange-700">Low Stock Alert</p>
                    <p className="text-sm text-orange-600">{lowStockCount} books running low</p>
                  </div>
                </div>
                <Button variant="outline" asChild className="border-orange-500/30 text-orange-700 hover:bg-orange-500/10">
                  <Link to="/inventory">
                    View Inventory <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="shadow-soft">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Book className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{books?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Books in catalog</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Truck className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{suppliers?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Suppliers</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{orders?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Total orders</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{customers?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Customers</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders */}
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display">Recent Orders</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/orders">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentOrders.length > 0 ? (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <div 
                    key={order.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Book className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{order.book?.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {order.customer?.name} • {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {order.deposit_amount > 0 && (
                        <span className="text-sm text-muted-foreground">
                          ${order.deposit_amount} deposit
                        </span>
                      )}
                      <OrderStatusBadge status={order.status} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground">No orders yet</p>
                <Button asChild className="mt-4">
                  <Link to="/orders/new">Create your first order</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
