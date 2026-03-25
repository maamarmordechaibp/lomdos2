import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Truck, 
  Mail,
  Phone,
  MapPin,
  Book,
  Send,
  ArrowLeft,
  Package,
  Eye,
  DollarSign,
  CreditCard,
  History,
  Upload,
  FileText,
  Receipt,
  CheckCircle,
  XCircle,
  ExternalLink,
  Edit2,
  Save,
  X,
  Trash2,
} from 'lucide-react';
import { useSupplier, useSupplierBooks, useUpdateSupplier, useDeleteSupplier } from '@/hooks/useSuppliers';
import { useCustomerOrders, useSupplierOrders, useCreateSupplierOrder } from '@/hooks/useOrders';
import { useEmailSupplier } from '@/hooks/useSupplierEmail';
import { useSupplierPayments, useCreateSupplierPayment } from '@/hooks/useBalances';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow, format } from 'date-fns';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function SupplierDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: supplier, isLoading: supplierLoading } = useSupplier(id);
  const { data: supplierBooks } = useSupplierBooks(id);
  const { data: allOrders } = useCustomerOrders();
  const { data: supplierOrders } = useSupplierOrders(id);
  const { data: payments } = useSupplierPayments(id);
  const createSupplierOrder = useCreateSupplierOrder();
  const emailSupplier = useEmailSupplier();
  const createPayment = useCreateSupplierPayment();
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();

  const [isSending, setIsSending] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBulkAddDialog, setShowBulkAddDialog] = useState(false);
  const [bulkBooksText, setBulkBooksText] = useState('');
  const [isAddingBulkBooks, setIsAddingBulkBooks] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'check' as 'cash' | 'check' | 'credit' | 'wire' | 'other',
    payment_type: 'invoice' as 'invoice' | 'deposit' | 'balance' | 'credit_memo' | 'refund' | 'other',
    invoice_number: '',
    reference_number: '',
    notes: '',
    receipt_url: '' as string | null,
    supplier_order_id: '' as string | null,
  });

  // Get pending orders for this supplier's books
  const pendingOrders = allOrders?.filter(order => 
    order.status === 'pending' && 
    order.book?.current_supplier_id === id
  ) || [];

  const handleStartEdit = () => {
    if (supplier) {
      setEditForm({
        name: supplier.name,
        email: supplier.email,
        phone: supplier.phone || '',
        address: supplier.address || '',
        notes: supplier.notes || '',
      });
      setIsEditing(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!id) return;
    await updateSupplier.mutateAsync({
      id,
      name: editForm.name,
      email: editForm.email,
      phone: editForm.phone || null,
      address: editForm.address || null,
      notes: editForm.notes || null,
    });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteSupplier.mutateAsync(id);
      navigate('/suppliers');
    } catch (error) {
      // Error is handled by the hook
    }
    setShowDeleteDialog(false);
  };

  const handleSendOrder = async () => {
    if (pendingOrders.length === 0) {
      toast.info('No pending orders to send');
      return;
    }

    if (!supplier) return;

    setIsSending(true);
    try {
      // Create supplier order with all pending items
      const customerOrderIds = pendingOrders.map(o => o.id);
      const supplierOrder = await createSupplierOrder.mutateAsync({
        supplierId: id!,
        customerOrderIds,
      });

      // Try to send email to supplier (non-blocking)
      try {
        await emailSupplier.mutateAsync({
          supplierId: id!,
          supplierOrderId: supplierOrder.id,
          emailType: 'new_order',
        });
        toast.success(`Order sent to ${supplier.name} with ${pendingOrders.length} items`);
      } catch (emailError) {
        // Email failed but order was created
        console.warn('Email failed, but order was created:', emailError);
        toast.success(`Order created for ${supplier.name} with ${pendingOrders.length} items (email not sent)`);
      }
    } catch (error) {
      console.error('Failed to create order:', error);
      toast.error('Failed to create supplier order');
    } finally {
      setIsSending(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentForm.amount || !id) return;
    
    await createPayment.mutateAsync({
      supplier_id: id,
      supplier_order_id: paymentForm.supplier_order_id || null,
      amount: parseFloat(paymentForm.amount),
      payment_method: paymentForm.method,
      payment_type: paymentForm.payment_type,
      invoice_number: paymentForm.invoice_number || null,
      reference_number: paymentForm.reference_number || null,
      notes: paymentForm.notes || null,
      receipt_url: paymentForm.receipt_url || null,
      paid_at: new Date().toISOString(),
    });
    
    setPaymentDialog(false);
    setPaymentForm({ 
      amount: '', 
      method: 'check', 
      payment_type: 'invoice',
      invoice_number: '',
      reference_number: '',
      notes: '', 
      receipt_url: null,
      supplier_order_id: '' 
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('invoices')
        .getPublicUrl(fileName);
      
      setPaymentForm(prev => ({ ...prev, receipt_url: publicUrl }));
      toast.success('Invoice uploaded');
    } catch (error: any) {
      toast.error('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // Handle bulk add books
  const handleBulkAddBooks = async () => {
    if (!bulkBooksText.trim() || !id) return;
    
    setIsAddingBulkBooks(true);
    try {
      // Split by newlines and filter empty lines
      const bookTitles = bulkBooksText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      if (bookTitles.length === 0) {
        toast.error('Please enter at least one book title');
        return;
      }
      
      let addedCount = 0;
      let existingCount = 0;
      
      for (const title of bookTitles) {
        // Check if book already exists
        const { data: existingBook } = await supabase
          .from('books')
          .select('id')
          .ilike('title', title)
          .single();
        
        if (existingBook) {
          // Book exists, just update the supplier
          await supabase
            .from('books')
            .update({ current_supplier_id: id })
            .eq('id', existingBook.id);
          
          // Add to supplier history if not already there
          const { data: existingHistory } = await supabase
            .from('book_supplier_history')
            .select('id')
            .eq('book_id', existingBook.id)
            .eq('supplier_id', id)
            .single();
          
          if (!existingHistory) {
            await supabase.from('book_supplier_history').insert({
              book_id: existingBook.id,
              supplier_id: id,
              is_active: true,
            });
          }
          existingCount++;
        } else {
          // Create new book with this supplier
          const { data: newBook, error } = await supabase
            .from('books')
            .insert({
              title: title,
              current_supplier_id: id,
              quantity_in_stock: 0,
              low_stock_threshold: 5,
              reorder_quantity: 10,
            })
            .select()
            .single();
          
          if (!error && newBook) {
            // Add to supplier history
            await supabase.from('book_supplier_history').insert({
              book_id: newBook.id,
              supplier_id: id,
              is_active: true,
            });
            addedCount++;
          }
        }
      }
      
      toast.success(`Added ${addedCount} new books, updated ${existingCount} existing books`);
      setBulkBooksText('');
      setShowBulkAddDialog(false);
      
      // Refresh the supplier books list
      window.location.reload();
    } catch (error: any) {
      toast.error('Failed to add books: ' + error.message);
    } finally {
      setIsAddingBulkBooks(false);
    }
  };

  if (supplierLoading) {
    return (
      <AppLayout title="Loading...">
        <div className="text-center py-12 text-muted-foreground">Loading supplier...</div>
      </AppLayout>
    );
  }

  if (!supplier) {
    return (
      <AppLayout title="Supplier Not Found">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Supplier not found</p>
          <Button asChild>
            <Link to="/suppliers">Back to Suppliers</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout 
      title={supplier.name}
      subtitle="Supplier details and pending orders"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          <Button variant="outline" asChild>
            <Link to="/suppliers">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
        </div>
      }
    >
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Supplier Info */}
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-display flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Contact Information
              </CardTitle>
              {!isEditing ? (
                <Button variant="ghost" size="sm" onClick={handleStartEdit}>
                  <Edit2 className="w-4 h-4" />
                </Button>
              ) : (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleSaveEdit} disabled={updateSupplier.isPending}>
                    <Save className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {isEditing ? (
                <>
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Textarea
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      rows={2}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{supplier.email}</span>
                  </div>
                  {supplier.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{supplier.phone}</span>
                    </div>
                  )}
                  {supplier.address && (
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <span className="whitespace-pre-line">{supplier.address}</span>
                    </div>
                  )}
                  {supplier.notes && (
                    <div className="pt-3 border-t border-border">
                      <p className="text-sm text-muted-foreground">{supplier.notes}</p>
                    </div>
                  )}
                </>
              )}
              
              {/* Outstanding Balance */}
              {supplier.outstanding_balance > 0 && (
                <div className="pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-red-500" />
                      <span className="text-red-600 font-medium">Balance Due:</span>
                    </div>
                    <span className="text-lg font-bold text-red-600">
                      ${supplier.outstanding_balance.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
              
              <Button 
                className="w-full mt-4"
                variant="outline"
                onClick={() => setPaymentDialog(true)}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Record Payment
              </Button>
            </CardContent>
          </Card>

          {/* Pending Orders */}
          <Card className="shadow-card lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-display">Pending Orders</CardTitle>
              {pendingOrders.length > 0 && (
                <Button onClick={handleSendOrder} disabled={isSending}>
                  <Send className="w-4 h-4 mr-2" />
                  {isSending ? 'Sending...' : 'Send Order Email'}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {pendingOrders.length > 0 ? (
                <div className="space-y-3">
                  {pendingOrders.map((order) => (
                    <div 
                      key={order.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Book className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{order.book?.title}</p>
                          <p className="text-sm text-muted-foreground">
                            Customer: {order.customer?.name} • Qty: {order.quantity}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No pending orders for this supplier
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Supplier Orders History */}
        {supplierOrders && supplierOrders.length > 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <Package className="w-5 h-5" />
                Order History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {supplierOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                  >
                    <div>
                      <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                      <p className="text-sm text-muted-foreground">
                        {order.items?.length || 0} items • {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={order.status === 'received' ? 'default' : 'secondary'}>
                        {order.status}
                      </Badge>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/supplier-orders/${order.id}`}>
                          <Eye className="w-4 h-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Books from this supplier */}
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display flex items-center gap-2">
              <Book className="w-5 h-5" />
              Books from this Supplier ({supplierBooks?.length || 0})
            </CardTitle>
            <Button onClick={() => setShowBulkAddDialog(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Add Books
            </Button>
          </CardHeader>
          <CardContent>
            {supplierBooks && supplierBooks.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Last Cost</TableHead>
                    <TableHead>In Stock</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierBooks.map((item: any) => (
                    <TableRow key={item.book?.id}>
                      <TableCell className="font-medium">{item.book?.title}</TableCell>
                      <TableCell className="text-muted-foreground">{item.book?.author || '-'}</TableCell>
                      <TableCell>{item.last_cost ? `$${item.last_cost}` : '-'}</TableCell>
                      <TableCell>{item.book?.quantity_in_stock || 0}</TableCell>
                      <TableCell>
                        {item.is_current ? (
                          <Badge className="bg-green-500/10 text-green-600">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Current
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <History className="w-3 h-3 mr-1" />
                            Previous
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No books assigned to this supplier yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment History */}
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Payment History
            </CardTitle>
            <Button onClick={() => setPaymentDialog(true)}>
              <CreditCard className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
          </CardHeader>
          <CardContent>
            {payments && payments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Invoice</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{format(new Date(payment.paid_at), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        <Badge variant={
                          payment.payment_type === 'refund' || payment.payment_type === 'credit_memo' 
                            ? 'destructive' 
                            : 'outline'
                        }>
                          {payment.payment_type || 'invoice'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">{payment.invoice_number || '-'}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">{payment.reference_number || '-'}</TableCell>
                      <TableCell className="capitalize">{payment.payment_method}</TableCell>
                      <TableCell>
                        {payment.supplier_order_id ? (
                          <Link 
                            to={`/supplier-orders/${payment.supplier_order_id}`}
                            className="text-primary hover:underline"
                          >
                            #{payment.supplier_order_id.slice(0, 8)}
                          </Link>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        ${payment.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {payment.receipt_url ? (
                          <a 
                            href={payment.receipt_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <FileText className="w-4 h-4" />
                            View
                          </a>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No payments recorded yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Record Payment Dialog */}
      <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Record Payment to {supplier.name}
            </DialogTitle>
            <DialogDescription>
              Record a payment made to this supplier with invoice details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {supplier.outstanding_balance > 0 && (
              <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-600">
                  Outstanding balance: <strong>${supplier.outstanding_balance.toFixed(2)}</strong>
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Payment Type</Label>
                <Select
                  value={paymentForm.payment_type}
                  onValueChange={(value: any) => setPaymentForm({ ...paymentForm, payment_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoice">Invoice Payment</SelectItem>
                    <SelectItem value="deposit">Deposit</SelectItem>
                    <SelectItem value="balance">Balance Payment</SelectItem>
                    <SelectItem value="credit_memo">Credit Memo</SelectItem>
                    <SelectItem value="refund">Refund Received</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select
                  value={paymentForm.method}
                  onValueChange={(value: any) => setPaymentForm({ ...paymentForm, method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="credit">Credit Card</SelectItem>
                    <SelectItem value="wire">Wire Transfer</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="amount">Payment Amount *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  placeholder="0.00"
                  className="pl-9"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="invoice_number">Invoice Number</Label>
                <Input
                  id="invoice_number"
                  value={paymentForm.invoice_number}
                  onChange={(e) => setPaymentForm({ ...paymentForm, invoice_number: e.target.value })}
                  placeholder="INV-12345"
                />
              </div>
              <div>
                <Label htmlFor="reference_number">Reference/Check #</Label>
                <Input
                  id="reference_number"
                  value={paymentForm.reference_number}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                  placeholder="Check #, Wire ref, etc."
                />
              </div>
            </div>
            
            {supplierOrders && supplierOrders.length > 0 && (
              <div>
                <Label>Link to Supplier Order (optional)</Label>
                <Select
                  value={paymentForm.supplier_order_id || 'none'}
                  onValueChange={(value) => setPaymentForm({ ...paymentForm, supplier_order_id: value === 'none' ? null : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an order..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific order</SelectItem>
                    {supplierOrders.map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        Order #{order.id.slice(0, 8)} - {order.items?.length || 0} items
                        {order.total_cost && ` • $${order.total_cost}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div>
              <Label>Upload Invoice/Receipt</Label>
              <div className="mt-1">
                {paymentForm.receipt_url ? (
                  <div className="flex items-center gap-2 p-3 border rounded-lg bg-green-500/5">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="flex-1 text-sm text-green-600">Invoice uploaded</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setPaymentForm(prev => ({ ...prev, receipt_url: null }))}
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                    <a 
                      href={paymentForm.receipt_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                    <Upload className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {uploading ? 'Uploading...' : 'Click to upload invoice'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                )}
              </div>
            </div>
            
            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                placeholder="Additional details about this payment..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRecordPayment} disabled={createPayment.isPending || !paymentForm.amount}>
              {createPayment.isPending ? 'Recording...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{supplier.name}"? This action cannot be undone.
              The supplier will only be deleted if they have no assigned books or pending orders.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSupplier.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Add Books Dialog */}
      <Dialog open={showBulkAddDialog} onOpenChange={setShowBulkAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Add Multiple Books to {supplier.name}
            </DialogTitle>
            <DialogDescription>
              Enter book titles, one per line. Each title will be saved as a separate book assigned to this supplier.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder={`Enter book titles, one per line:\nדי הימל אין די ערד\nדי ערד אין די הימל\nBook Title 3`}
              value={bulkBooksText}
              onChange={(e) => setBulkBooksText(e.target.value)}
              rows={10}
              className="font-mono"
              dir="auto"
            />
            <p className="text-sm text-muted-foreground">
              {bulkBooksText.split('\n').filter(l => l.trim()).length} books to add
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkAddDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleBulkAddBooks} 
              disabled={isAddingBulkBooks || !bulkBooksText.trim()}
            >
              {isAddingBulkBooks ? 'Adding...' : 'Add Books'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
