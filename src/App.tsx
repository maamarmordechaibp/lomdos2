import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import Login from "./pages/Login";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import NewOrder from "./pages/orders/NewOrderSimple";
import OrderCheckout from "./pages/orders/OrderCheckout";
import OrdersList from "./pages/orders/OrdersList";
import PendingSupplier from "./pages/PendingSupplier";
import CustomersList from "./pages/customers/CustomersList";
import CustomerDetail from "./pages/customers/CustomerDetail";
import BooksList from "./pages/books/BooksList";
import SuppliersList from "./pages/suppliers/SuppliersList";
import SupplierDetail from "./pages/suppliers/SupplierDetail";
import SupplierOrdersList from "./pages/suppliers/SupplierOrdersList";
import SupplierOrderDetail from "./pages/suppliers/SupplierOrderDetail";
import ReceiveOrders from "./pages/ReceiveOrders";
import Pickups from "./pages/Pickups";
import Checkout from "./pages/Checkout";
import Returns from "./pages/Returns";
import Inventory from "./pages/Inventory";
import Balances from "./pages/Balances";
import Financials from "./pages/Financials";
import Settings from "./pages/Settings";
import UserManagement from "./pages/UserManagement";
import CallLogs from "./pages/CallLogs";
import PromoCodes from "./pages/PromoCodes";

// Configure React Query with sensible defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false, // Disable to prevent CORS errors on focus
      retry: 1,
    },
  },
});

// Component to set browser title and favicon from store settings
function DocumentTitle() {
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_settings')
        .select('store_name, store_logo_url, favicon_url')
        .single();
      if (error) return null;
      // Type assertion needed because columns may not exist in generated types yet
      return data as unknown as { store_name: string | null; store_logo_url: string | null; favicon_url: string | null } | null;
    },
  });

  useEffect(() => {
    if (settings?.store_name) {
      document.title = `${settings.store_name} - POS`;
    }
  }, [settings?.store_name]);

  // Set favicon from favicon_url (separate from store logo)
  useEffect(() => {
    const faviconUrl = settings?.favicon_url;
    if (faviconUrl) {
      // Remove existing favicon links
      const existingFavicons = document.querySelectorAll("link[rel*='icon']");
      existingFavicons.forEach(el => el.remove());
      
      // Create new favicon link
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = faviconUrl;
      document.head.appendChild(link);
      
      // Also set apple touch icon
      const appleLink = document.createElement('link');
      appleLink.rel = 'apple-touch-icon';
      appleLink.href = faviconUrl;
      document.head.appendChild(appleLink);
    }
  }, [settings?.favicon_url]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <DocumentTitle />
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<Login />} />
            
            {/* Protected routes - Users can access orders and pickups */}
            <Route path="/orders/new" element={
              <ProtectedRoute>
                <NewOrder />
              </ProtectedRoute>
            } />
            <Route path="/orders/checkout" element={
              <ProtectedRoute>
                <OrderCheckout />
              </ProtectedRoute>
            } />
            <Route path="/pickups" element={
              <ProtectedRoute>
                <Pickups />
              </ProtectedRoute>
            } />
            
            {/* Admin only routes */}
            <Route path="/" element={
              <ProtectedRoute requireAdmin>
                <Index />
              </ProtectedRoute>
            } />
            <Route path="/orders" element={
              <ProtectedRoute requireAdmin>
                <OrdersList />
              </ProtectedRoute>
            } />
            <Route path="/pending-supplier" element={
              <ProtectedRoute requireAdmin>
                <PendingSupplier />
              </ProtectedRoute>
            } />
            <Route path="/supplier-orders" element={
              <ProtectedRoute requireAdmin>
                <SupplierOrdersList />
              </ProtectedRoute>
            } />
            <Route path="/supplier-orders/:id" element={
              <ProtectedRoute requireAdmin>
                <SupplierOrderDetail />
              </ProtectedRoute>
            } />
            <Route path="/receive" element={
              <ProtectedRoute requireAdmin>
                <ReceiveOrders />
              </ProtectedRoute>
            } />
            <Route path="/checkout" element={
              <ProtectedRoute requireAdmin>
                <Checkout />
              </ProtectedRoute>
            } />
            <Route path="/returns" element={
              <ProtectedRoute requireAdmin>
                <Returns />
              </ProtectedRoute>
            } />
            <Route path="/inventory" element={
              <ProtectedRoute requireAdmin>
                <Inventory />
              </ProtectedRoute>
            } />
            <Route path="/balances" element={
              <ProtectedRoute requireAdmin>
                <Balances />
              </ProtectedRoute>
            } />
            <Route path="/financials" element={
              <ProtectedRoute requireAdmin>
                <Financials />
              </ProtectedRoute>
            } />
            <Route path="/customers" element={
              <ProtectedRoute requireAdmin>
                <CustomersList />
              </ProtectedRoute>
            } />
            <Route path="/customers/:id" element={
              <ProtectedRoute requireAdmin>
                <CustomerDetail />
              </ProtectedRoute>
            } />
            <Route path="/books" element={
              <ProtectedRoute requireAdmin>
                <BooksList />
              </ProtectedRoute>
            } />
            <Route path="/suppliers" element={
              <ProtectedRoute requireAdmin>
                <SuppliersList />
              </ProtectedRoute>
            } />
            <Route path="/suppliers/:id" element={
              <ProtectedRoute requireAdmin>
                <SupplierDetail />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute requireAdmin>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="/users" element={
              <ProtectedRoute requireAdmin>
                <UserManagement />
              </ProtectedRoute>
            } />
            <Route path="/call-logs" element={
              <ProtectedRoute requireAdmin>
                <CallLogs />
              </ProtectedRoute>
            } />
            <Route path="/promo-codes" element={
              <ProtectedRoute requireAdmin>
                <PromoCodes />
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
