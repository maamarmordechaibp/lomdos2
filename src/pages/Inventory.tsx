import { useState, useRef, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Package, 
  Book,
  AlertTriangle,
  Search,
  Plus,
  Truck,
  Check,
  Edit2,
  ShoppingCart,
  Send,
  Printer,
  Barcode
} from 'lucide-react';
import { useBooksWithStock, useLowStockBooks, useStockOrders, useCreateStockOrder, useReceiveStockOrder, useUpdateBookStock, useUpdateStockOrder } from '@/hooks/useInventory';
import { supabase } from '@/integrations/supabase/client';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useSettings } from '@/hooks/useSettings';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Book as BookType, StockOrder } from '@/types/database';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookLabelPrinter } from '@/components/inventory/BookLabelPrinter';

export default function Inventory() {
  const { data: books, isLoading } = useBooksWithStock();
  const { data: lowStockBooks } = useLowStockBooks();
  const { data: pendingOrders } = useStockOrders('pending');
  const { data: orderedOrders } = useStockOrders('ordered');
  const { data: suppliers } = useSuppliers();
  const { data: settings } = useSettings();
  
  const createStockOrder = useCreateStockOrder();
  const receiveStock = useReceiveStockOrder();
  const updateStock = useUpdateBookStock();
  const updateStockOrder = useUpdateStockOrder();
  
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState('inventory');
  const [search, setSearch] = useState('');
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [sendingOrder, setSendingOrder] = useState<string | null>(null);
  const [orderDialog, setOrderDialog] = useState<{ open: boolean; book: BookType | null }>({ open: false, book: null });
  const [receiveDialog, setReceiveDialog] = useState<{ open: boolean; order: StockOrder | null }>({ open: false, order: null });
  const [editStockDialog, setEditStockDialog] = useState<{ open: boolean; book: BookType | null }>({ open: false, book: null });
  
  // Label printing state
  const [labelDialog, setLabelDialog] = useState<{ open: boolean; book: BookType | null; quantity: number; price: number }>({ 
    open: false, book: null, quantity: 0, price: 0 
  });
  const [askPrintLabels, setAskPrintLabels] = useState<{ open: boolean; book: BookType | null; quantity: number; cost: number } | null>(null);
  
  const [orderForm, setOrderForm] = useState({ quantity: 5, supplierId: '', notes: '' });
  const [receiveCost, setReceiveCost] = useState('');
  const [newStockQty, setNewStockQty] = useState('');

  // Calculate price based on cost + margin
  const calculatePrice = (cost: number, book?: BookType | null) => {
    if (book?.no_profit) return cost;
    const margin = book?.custom_profit_margin ?? settings?.default_profit_margin ?? 20;
    return cost * (1 + margin / 100);
  };

  // Handle barcode scan - look up book by ISBN or ID
  const handleBarcodeScan = (barcode: string) => {
    const cleanBarcode = barcode.trim().replace(/-/g, '');
    if (!cleanBarcode) return;
    
    const foundBook = books?.find(b => 
      b.isbn?.replace(/-/g, '') === cleanBarcode ||
      b.id.replace(/-/g, '').substring(0, 12).toUpperCase() === cleanBarcode.toUpperCase()
    );
    
    if (foundBook) {
      setSearch(foundBook.title);
      setBarcodeSearch('');
      toast.success(`Found: ${foundBook.title}`);
    } else {
      toast.error(`Book not found for barcode: ${cleanBarcode}`);
    }
  };

  // Listen for barcode scanner input (typically ends with Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If focus is in the barcode input and Enter is pressed
      if (e.key === 'Enter' && document.activeElement === barcodeInputRef.current) {
        e.preventDefault();
        handleBarcodeScan(barcodeSearch);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [barcodeSearch, books]);

  const filteredBooks = books?.filter(book => 
    book.title?.toLowerCase().includes(search.toLowerCase()) ||
    book.author?.toLowerCase().includes(search.toLowerCase()) ||
    book.isbn?.includes(search)
  ) || [];

  const handleOpenOrderDialog = (book: BookType) => {
    setOrderForm({
      quantity: book.reorder_quantity || 5,
      supplierId: book.current_supplier_id || '',
      notes: '',
    });
    setOrderDialog({ open: true, book });
  };

  const handleCreateOrder = async () => {
    if (!orderDialog.book) return;
    
    await createStockOrder.mutateAsync({
      book_id: orderDialog.book.id,
      supplier_id: orderForm.supplierId || null,
      quantity: orderForm.quantity,
      status: 'pending',
      notes: orderForm.notes || null,
      cost_per_unit: null,
      total_cost: null,
      ordered_at: null,
      received_at: null,
    });
    
    setOrderDialog({ open: false, book: null });
    setActiveTab('pending'); // Switch to pending tab after creating order
  };

  const handleSendToSupplier = async (order: StockOrder) => {
    if (!order.supplier_id || !order.supplier) {
      toast.error('Please select a supplier first');
      return;
    }
    
    setSendingOrder(order.id);
    try {
      // Update order status to 'ordered'
      await updateStockOrder.mutateAsync({
        id: order.id,
        status: 'ordered',
        ordered_at: new Date().toISOString(),
      });
      
      // Send email to supplier
      const { error } = await supabase.functions.invoke('email-supplier', {
        body: {
          supplierEmail: order.supplier.email,
          supplierName: order.supplier.name,
          items: [{
            bookTitle: order.book?.title || 'Unknown',
            quantity: order.quantity,
            cost: order.cost_per_unit,
          }],
          notes: order.notes,
          isStockOrder: true,
        },
      });
      
      if (error) {
        console.error('Error sending email:', error);
        toast.error('Order marked as sent, but email failed');
      } else {
        toast.success(`Order sent to ${order.supplier.name}`);
      }
      
      setActiveTab('ordered'); // Switch to ordered tab
    } catch (error) {
      console.error('Error sending order:', error);
      toast.error('Failed to send order');
    } finally {
      setSendingOrder(null);
    }
  };

  const handleOpenReceiveDialog = (order: StockOrder) => {
    setReceiveCost(order.cost_per_unit?.toString() || '');
    setReceiveDialog({ open: true, order });
  };

  const handleReceiveStock = async () => {
    if (!receiveDialog.order) return;
    
    const cost = receiveCost ? parseFloat(receiveCost) : 0;
    
    await receiveStock.mutateAsync({
      orderId: receiveDialog.order.id,
      costPerUnit: cost || undefined,
    });
    
    // Close receive dialog and ask about printing labels
    const book = receiveDialog.order.book;
    const quantity = receiveDialog.order.quantity;
    setReceiveDialog({ open: false, order: null });
    
    if (book && quantity > 0 && cost > 0) {
      setAskPrintLabels({ open: true, book, quantity, cost });
    }
  };

  const handlePrintLabelsAfterReceive = () => {
    if (!askPrintLabels) return;
    
    const price = calculatePrice(askPrintLabels.cost, askPrintLabels.book);
    setLabelDialog({
      open: true,
      book: askPrintLabels.book,
      quantity: askPrintLabels.quantity,
      price,
    });
    setAskPrintLabels(null);
  };

  const handleOpenLabelPrinter = (book: BookType) => {
    // For reprinting labels, use the book's default cost and calculate price
    const cost = book.default_cost || 0;
    const price = calculatePrice(cost, book);
    setLabelDialog({
      open: true,
      book,
      quantity: 1,
      price,
    });
  };

  const handleOpenEditStock = (book: BookType) => {
    setNewStockQty(book.quantity_in_stock.toString());
    setEditStockDialog({ open: true, book });
  };

  const handleUpdateStock = async () => {
    if (!editStockDialog.book) return;
    
    await updateStock.mutateAsync({
      bookId: editStockDialog.book.id,
      newQuantity: parseInt(newStockQty) || 0,
    });
    
    toast.success('Stock updated');
    setEditStockDialog({ open: false, book: null });
  };

  const getStockBadge = (book: BookType) => {
    if (book.quantity_in_stock === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    }
    if (book.quantity_in_stock <= book.low_stock_threshold) {
      return <Badge variant="secondary" className="bg-orange-500/10 text-orange-600">Low Stock</Badge>;
    }
    return <Badge variant="secondary" className="bg-green-500/10 text-green-600">In Stock</Badge>;
  };

  return (
    <AppLayout 
      title="Inventory" 
      subtitle="Manage stock levels and reorder books"
    >
      <div className="space-y-6 animate-fade-in">
        {/* Low Stock Alert */}
        {lowStockBooks && lowStockBooks.length > 0 && (
          <Card className="shadow-card border-orange-500/20 bg-orange-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="font-display flex items-center gap-2 text-orange-600">
                <AlertTriangle className="w-5 h-5" />
                Low Stock Alert ({lowStockBooks.length} items)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {lowStockBooks.slice(0, 10).map((book) => (
                  <Button
                    key={book.id}
                    variant="outline"
                    size="sm"
                    className="border-orange-500/30"
                    onClick={() => handleOpenOrderDialog(book)}
                  >
                    {book.title} ({book.quantity_in_stock})
                    <Plus className="w-3 h-3 ml-1" />
                  </Button>
                ))}
                {lowStockBooks.length > 10 && (
                  <span className="text-sm text-muted-foreground self-center">
                    +{lowStockBooks.length - 10} more
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="pending">
              Pending Orders
              {(pendingOrders?.length || 0) > 0 && (
                <Badge variant="secondary" className="ml-2">{pendingOrders?.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="ordered">
              Ordered
              {(orderedOrders?.length || 0) > 0 && (
                <Badge variant="secondary" className="ml-2">{orderedOrders?.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="mt-4">
            {/* Search and Barcode Scanner */}
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search books by name or author..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="relative max-w-xs">
                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  ref={barcodeInputRef}
                  placeholder="Scan barcode or enter ISBN..."
                  value={barcodeSearch}
                  onChange={(e) => setBarcodeSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleBarcodeScan(barcodeSearch);
                    }
                  }}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Books Grid */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  All Books
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : filteredBooks.length > 0 ? (
                  <div className="space-y-2">
                    {filteredBooks.map((book) => {
                      const price = book.default_cost ? calculatePrice(book.default_cost, book) : null;
                      return (
                      <div 
                        key={book.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Book className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{book.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {book.author || 'Unknown author'}
                              {book.current_supplier && ` • ${book.current_supplier.name}`}
                              {book.isbn && ` • ISBN: ${book.isbn}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {getStockBadge(book)}
                          {price && (
                            <div className="text-right">
                              <p className="font-bold text-green-600">${price.toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground">price</p>
                            </div>
                          )}
                          <div className="text-right">
                            <p className="font-bold text-lg">{book.quantity_in_stock}</p>
                            <p className="text-xs text-muted-foreground">in stock</p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenLabelPrinter(book)}
                              title="Print labels"
                            >
                              <Printer className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEditStock(book)}
                              title="Edit stock"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenOrderDialog(book)}
                              title="Order more"
                            >
                              <ShoppingCart className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {search ? 'No books found' : 'No books in inventory'}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pending" className="mt-4">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Pending Stock Orders
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingOrders && pendingOrders.length > 0 ? (
                  <div className="space-y-2">
                    {pendingOrders.map((order) => (
                      <div 
                        key={order.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                            <Package className="w-5 h-5 text-yellow-600" />
                          </div>
                          <div>
                            <p className="font-medium">{order.book?.title}</p>
                            <p className="text-sm text-muted-foreground">
                              Qty: {order.quantity}
                              {order.supplier && ` • From: ${order.supplier.name}`}
                              {!order.supplier && <span className="text-orange-500"> • No supplier selected</span>}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            onClick={() => handleSendToSupplier(order)}
                            disabled={!order.supplier_id || sendingOrder === order.id}
                          >
                            {sendingOrder === order.id ? (
                              <>Sending...</>
                            ) : (
                              <>
                                <Send className="w-4 h-4 mr-1" />
                                Send Order
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No pending stock orders
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ordered" className="mt-4">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Ordered - Waiting to Receive
                </CardTitle>
              </CardHeader>
              <CardContent>
                {orderedOrders && orderedOrders.length > 0 ? (
                  <div className="space-y-2">
                    {orderedOrders.map((order) => (
                      <div 
                        key={order.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-blue-500/5 border border-blue-500/20"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <Truck className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium">{order.book?.title}</p>
                            <p className="text-sm text-muted-foreground">
                              Qty: {order.quantity}
                              {order.supplier && ` • From: ${order.supplier.name}`}
                            </p>
                          </div>
                        </div>
                        <Button size="sm" onClick={() => handleOpenReceiveDialog(order)}>
                          <Check className="w-4 h-4 mr-1" />
                          Receive
                        </Button>
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
          </TabsContent>
        </Tabs>
      </div>

      {/* Order Dialog */}
      <Dialog open={orderDialog.open} onOpenChange={(open) => !open && setOrderDialog({ open: false, book: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Order Stock</DialogTitle>
            <DialogDescription>
              Order more copies of "{orderDialog.book?.title}" for inventory
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm"><strong>Current Stock:</strong> {orderDialog.book?.quantity_in_stock}</p>
              <p className="text-sm"><strong>Low Stock Alert:</strong> {orderDialog.book?.low_stock_threshold}</p>
            </div>

            <div className="space-y-2">
              <Label>Quantity to Order</Label>
              <Input
                type="number"
                min="1"
                value={orderForm.quantity}
                onChange={(e) => setOrderForm({ ...orderForm, quantity: parseInt(e.target.value) || 1 })}
              />
            </div>

            <div className="space-y-2">
              <Label>Supplier</Label>
              <Select
                value={orderForm.supplierId}
                onValueChange={(value) => setOrderForm({ ...orderForm, supplierId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers?.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                value={orderForm.notes}
                onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                placeholder="Any special instructions..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderDialog({ open: false, book: null })}>
              Cancel
            </Button>
            <Button onClick={handleCreateOrder} disabled={createStockOrder.isPending}>
              {createStockOrder.isPending ? 'Creating...' : 'Create Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive Dialog */}
      <Dialog open={receiveDialog.open} onOpenChange={(open) => !open && setReceiveDialog({ open: false, order: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receive Stock</DialogTitle>
            <DialogDescription>
              Mark "{receiveDialog.order?.book?.title}" as received
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted/50 rounded-lg space-y-1">
              <p className="text-sm"><strong>Quantity:</strong> {receiveDialog.order?.quantity}</p>
              <p className="text-sm"><strong>Supplier:</strong> {receiveDialog.order?.supplier?.name || 'N/A'}</p>
            </div>

            <div className="space-y-2">
              <Label>Cost Per Unit ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={receiveCost}
                onChange={(e) => setReceiveCost(e.target.value)}
                placeholder="0.00"
              />
              {receiveCost && receiveDialog.order && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Total Cost: ${(parseFloat(receiveCost) * receiveDialog.order.quantity).toFixed(2)}
                  </p>
                  <p className="text-sm font-medium text-green-600">
                    Selling Price: ${calculatePrice(parseFloat(receiveCost), receiveDialog.order.book).toFixed(2)} per book
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveDialog({ open: false, order: null })}>
              Cancel
            </Button>
            <Button onClick={handleReceiveStock} disabled={receiveStock.isPending}>
              {receiveStock.isPending ? 'Receiving...' : 'Receive & Update Stock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Stock Dialog */}
      <Dialog open={editStockDialog.open} onOpenChange={(open) => !open && setEditStockDialog({ open: false, book: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Stock</DialogTitle>
            <DialogDescription>
              Manually adjust stock for "{editStockDialog.book?.title}"
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Quantity in Stock</Label>
              <Input
                type="number"
                min="0"
                value={newStockQty}
                onChange={(e) => setNewStockQty(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditStockDialog({ open: false, book: null })}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStock} disabled={updateStock.isPending}>
              {updateStock.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ask to Print Labels Dialog */}
      <Dialog open={askPrintLabels?.open || false} onOpenChange={(open) => !open && setAskPrintLabels(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5" />
              Print Labels?
            </DialogTitle>
            <DialogDescription>
              Stock has been received. Would you like to print price labels?
            </DialogDescription>
          </DialogHeader>
          
          {askPrintLabels && (
            <div className="py-4">
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Book:</span>
                  <span className="font-medium">{askPrintLabels.book?.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quantity:</span>
                  <span className="font-medium">{askPrintLabels.quantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cost per unit:</span>
                  <span>${askPrintLabels.cost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-green-600 font-bold">
                  <span>Selling Price:</span>
                  <span>${calculatePrice(askPrintLabels.cost, askPrintLabels.book).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAskPrintLabels(null)}>
              Skip
            </Button>
            <Button onClick={handlePrintLabelsAfterReceive}>
              <Printer className="w-4 h-4 mr-2" />
              Print {askPrintLabels?.quantity} Label{(askPrintLabels?.quantity || 0) > 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Label Printer Dialog */}
      <BookLabelPrinter
        open={labelDialog.open}
        onClose={() => setLabelDialog({ open: false, book: null, quantity: 0, price: 0 })}
        book={labelDialog.book}
        quantity={labelDialog.quantity}
        price={labelDialog.price}
      />
    </AppLayout>
  );
}
