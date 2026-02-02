import { 
  Book, 
  Users, 
  Truck, 
  ShoppingCart, 
  Package, 
  Settings, 
  Home,
  AlertTriangle,
  CheckSquare,
  RotateCcw,
  Send,
  ShoppingBag,
  Warehouse,
  DollarSign,
  BarChart3,
  CreditCard,
  UserCog,
  LogOut,
  Phone,
  Tag,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/hooks/useSettings';

const menuItems = [
  { title: 'Dashboard', icon: Home, path: '/' },
  { title: 'New Order', icon: ShoppingCart, path: '/orders/new' },
  { title: 'Orders', icon: Package, path: '/orders' },
  { title: 'Pending Supplier', icon: AlertTriangle, path: '/pending-supplier' },
  { title: 'Supplier Orders', icon: Send, path: '/supplier-orders' },
  { title: 'Receive Orders', icon: CheckSquare, path: '/receive' },
  { title: 'Pickups', icon: ShoppingBag, path: '/pickups' },
  { title: 'Checkout', icon: CreditCard, path: '/checkout' },
  { title: 'Returns', icon: RotateCcw, path: '/returns' },
];

const managementItems = [
  { title: 'Customers', icon: Users, path: '/customers' },
  { title: 'Books', icon: Book, path: '/books' },
  { title: 'Suppliers', icon: Truck, path: '/suppliers' },
  { title: 'Inventory', icon: Warehouse, path: '/inventory' },
  { title: 'Promo Codes', icon: Tag, path: '/promo-codes' },
  { title: 'Balances', icon: DollarSign, path: '/balances' },
  { title: 'Financials', icon: BarChart3, path: '/financials' },
  { title: 'Call Logs', icon: Phone, path: '/call-logs' },
];

const settingsItems = [
  { title: 'Settings', icon: Settings, path: '/settings' },
  { title: 'Users', icon: UserCog, path: '/users', adminOnly: true },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, isAdmin, signOut } = useAuth();
  const { data: settings } = useSettings();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  // Filter menu items based on role
  const visibleMenuItems = isAdmin 
    ? menuItems 
    : menuItems.filter(item => item.path === '/orders/new' || item.path === '/pickups');

  const visibleManagementItems = isAdmin ? managementItems : [];
  const visibleSettingsItems = settingsItems.filter(item => !item.adminOnly || isAdmin);
  
  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-3">
          {settings?.store_logo_url ? (
            <img 
              src={settings.store_logo_url} 
              alt={settings.store_name || 'Store logo'} 
              className="w-10 h-10 object-contain rounded-lg"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg gradient-warm flex items-center justify-center">
              <Book className="w-5 h-5 text-white" />
            </div>
          )}
          <div>
            <h1 className="font-display text-lg font-semibold text-sidebar-foreground">
              {settings?.store_name || 'BookStore'}
            </h1>
            <p className="text-xs text-sidebar-foreground/60">Order Management</p>
          </div>
        </Link>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase text-xs tracking-wider">
            Orders
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMenuItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton 
                    asChild
                    isActive={location.pathname === item.path}
                    className="transition-all duration-200"
                  >
                    <Link to={item.path}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {visibleManagementItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase text-xs tracking-wider">
              Management
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleManagementItems.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton 
                      asChild
                      isActive={location.pathname === item.path}
                      className="transition-all duration-200"
                    >
                      <Link to={item.path}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {/* User info */}
        {profile && (
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {profile.name || profile.email}
            </p>
            <p className="text-xs text-sidebar-foreground/60 capitalize">
              {profile.role}
            </p>
          </div>
        )}
        <SidebarMenu>
          {visibleSettingsItems.map((item) => (
            <SidebarMenuItem key={item.path}>
              <SidebarMenuButton 
                asChild
                isActive={location.pathname === item.path}
              >
                <Link to={item.path}>
                  <item.icon className="w-4 h-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} className="text-destructive hover:text-destructive">
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
