import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomerSearch } from '@/components/customers/CustomerSearch';
import { useCreateCustomerOrder } from '@/hooks/useOrders';
import { useFromStock } from '@/hooks/useInventory';
import { useBooks, useCreateBook } from '@/hooks/useBooks';
import { useSettings } from '@/hooks/useSettings';
import { useCategories } from '@/hooks/useCategories';
import { Customer, Book } from '@/types/database';
import { 
  ShoppingCart, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  DollarSign,
  CreditCard,
  Banknote,
  Check,
  Loader2,
  X,
  User,
  Edit2,
  BookPlus,
  FolderOpen,
  ArrowLeft,
  Book,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
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

interface CartItem {
  book: Book;
  quantity: number;
  price: number;
}

export default function NewOrder() {
  const createOrder = useCreateCustomerOrder();
  const fromStock = useFromStock();
  const createBook = useCreateBook();
  const { data: books, refetch: refetchBooks } = useBooks();
  const { data: settings } = useSettings();
  const { categoryNames: BOOK_CATEGORIES } = useCategories();
  
  // State
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [bookSearch, setBookSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [showCardDialog, setShowCardDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Edit price state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  
  // Create book dialog
  const [showCreateBook, setShowCreateBook] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookPrice, setNewBookPrice] = useState('');
  const [newBookAuthor, setNewBookAuthor] = useState('');
  const [newBookCategory, setNewBookCategory] = useState('');
  
  // Card form
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardZip, setCardZip] = useState('');
  
  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const amount = parseFloat(paymentAmount) || 0;
  const change = amount > subtotal ? amount - subtotal : 0;
  const balanceDue = subtotal > amount ? subtotal - amount : 0;
  const isFullPayment = amount >= subtotal && subtotal > 0;
  const isPartialPayment = amount > 0 && amount < subtotal;
  
  // Calculate price with margin
  const calculatePrice = (book: Book) => {
    if (!book.default_cost) return 0;
    if (book.no_profit) return book.default_cost;
    const margin = book.custom_profit_margin ?? settings?.default_profit_margin ?? 20;
    return book.default_cost * (1 + margin / 100);
  };
  
  // Filter books by search and category
  const filteredBooks = books?.filter(book => {
    // First check category if selected
    if (selectedCategory && selectedCategory !== '__ALL__' && book.category !== selectedCategory) return false;
    
    // Then apply search filter
    if (!bookSearch) return true;
    const search = bookSearch.toLowerCase();
    return (
      book.title?.toLowerCase().includes(search) ||
      book.title_hebrew?.toLowerCase().includes(search) ||
      book.author?.toLowerCase().includes(search) ||
      book.isbn?.includes(search)
    );
  }).slice(0, 50) || [];
  
  // Use preloaded categories, but only show ones that have books
  const categoriesWithBooks = BOOK_CATEGORIES.filter(cat => 
    books?.some(b => b.category === cat)
  );
  
  // Don't auto-set payment amount - let user decide how much to pay
  // Just clear it when cart is emptied
  useEffect(() => {
    if (subtotal === 0) {
      setPaymentAmount('');
    }
  }, [subtotal]);
  
  const addToCart = (book: Book) => {
    const existing = cart.find(item => item.book.id === book.id);
    const price = calculatePrice(book);
    
    if (existing) {
      setCart(cart.map(item => 
        item.book.id === book.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      // If no price, prompt to set it
      if (price === 0) {
        setEditingItemId(book.id);
        setEditPrice('');
        setCart([...cart, { book, quantity: 1, price: 0 }]);
      } else {
        setCart([...cart, { book, quantity: 1, price }]);
      }
    }
  };
  
  const updateQuantity = (bookId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.book.id === bookId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };
  
  const removeFromCart = (bookId: string) => {
    setCart(cart.filter(item => item.book.id !== bookId));
    if (editingItemId === bookId) {
      setEditingItemId(null);
    }
  };
  
  const updatePrice = (bookId: string, newPrice: number) => {
    setCart(cart.map(item => 
      item.book.id === bookId 
        ? { ...item, price: newPrice }
        : item
    ));
    setEditingItemId(null);
    setEditPrice('');
  };
  
  const clearCart = () => {
    setCart([]);
    setCustomer(null);
    setPaymentAmount('');
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');
    setCardZip('');
    setEditingItemId(null);
  };
  
  const handleCreateBook = async () => {
    if (!newBookTitle.trim()) {
      toast.error('Enter book title');
      return;
    }
    
    const price = parseFloat(newBookPrice) || 0;
    const cost = price > 0 ? price / 1.2 : 0;
    
    try {
      const newBook = await createBook.mutateAsync({
        title: newBookTitle.trim(),
        title_hebrew: null,
        author: newBookAuthor.trim() || null,
        isbn: null,
        category: newBookCategory.trim() || null,
        current_supplier_id: null,
        default_cost: cost > 0 ? cost : null,
        no_profit: false,
        custom_profit_margin: null,
        quantity_in_stock: 0,
        low_stock_threshold: 5,
        reorder_quantity: 10,
      });
      
      setCart([...cart, { book: newBook, quantity: 1, price }]);
      setShowCreateBook(false);
      setNewBookTitle('');
      setNewBookPrice('');
      setNewBookAuthor('');
      setNewBookCategory('');
      setBookSearch('');
      refetchBooks();
    } catch (error) {
      // Error handled by hook
    }
  };
  
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
      
      // Create orders for each item
      for (const item of cart) {
        const hasStock = item.book.quantity_in_stock >= item.quantity;
        const itemTotal = item.price * item.quantity;
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
          notes: hasStock ? '[POS - From Stock]' : '[POS - Will Order]',
        });
        
        // Record payment
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
      
      // Update customer outstanding balance if there's balance due
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
        toast.success(`Order created! Balance due: $${subtotal.toFixed(2)}`);
      } else if (!isFullPayment && amount > 0) {
        toast.success(`Deposit recorded! Balance: $${(subtotal - amount).toFixed(2)}`);
      } else {
        toast.success('Order complete!');
      }
      
      // Reset for next customer
      clearCart();
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to process order');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleCashPayment = () => {
    // Allow $0 payment - this creates the order with full balance due
    processPayment('cash');
  };
  
  const handleCardPayment = async () => {
    // Validate
    const cleanCard = cardNumber.replace(/\s/g, '');
    if (cleanCard.length < 15) {
      toast.error('Enter valid card number');
      return;
    }
    if (cardExpiry.length < 4) {
      toast.error('Enter expiry MM/YY');
      return;
    }
    if (cardCvv.length < 3) {
      toast.error('Enter CVV');
      return;
    }
    
    setIsProcessing(true);
    try {
      // Process card payment via edge function
      const { data, error } = await supabase.functions.invoke('process-sola-payment', {
        body: {
          amount: amount,
          cardNumber: cleanCard,
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
    <AppLayout title="New Order" subtitle="Point of Sale">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-140px)]">
        
        {/* Left: Book Search & Grid */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          {/* Search Bar with Category Back Button */}
          <div className="flex gap-2 mb-3">
            {selectedCategory && (
              <Button 
                variant="outline" 
                className="h-12 px-3"
                onClick={() => setSelectedCategory(null)}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder={selectedCategory ? `Search in ${selectedCategory}...` : "Search books..."}
                value={bookSearch}
                onChange={(e) => setBookSearch(e.target.value)}
                className="pl-11 h-12 text-lg"
                autoFocus
              />
              {bookSearch && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => setBookSearch('')}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            <Button 
              variant="outline" 
              className="h-12 px-4"
              onClick={() => {
                setShowCreateBook(true);
                setNewBookTitle(bookSearch);
              }}
            >
              <BookPlus className="w-5 h-5 mr-2" />
              New Book
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {/* Show Categories when no category selected and no search */}
            {!selectedCategory && !bookSearch ? (
              <div className="space-y-4">
                {/* Category Grid - Show all preloaded categories */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {BOOK_CATEGORIES.map((category) => {
                    const booksInCategory = books?.filter(b => b.category === category).length || 0;
                    return (
                      <Card 
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={`cursor-pointer transition-all hover:shadow-md active:scale-95 ${
                          booksInCategory > 0 
                            ? 'bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20' 
                            : 'opacity-50'
                        }`}
                      >
                        <CardContent className="p-4 text-center">
                          <FolderOpen className={`w-10 h-10 mx-auto mb-2 ${booksInCategory > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
                          <p className="font-semibold text-sm">{category}</p>
                          <p className="text-xs text-muted-foreground">{booksInCategory} books</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                  
                  {/* "All Books" option */}
                  <Card 
                    onClick={() => setSelectedCategory('__ALL__')}
                    className="cursor-pointer transition-all hover:shadow-md active:scale-95 border-dashed"
                  >
                    <CardContent className="p-4 text-center">
                      <Search className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
                      <p className="font-semibold text-sm">All Books</p>
                      <p className="text-xs text-muted-foreground">{books?.length || 0} total</p>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Books without category */}
                {books?.some(b => !b.category) && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Uncategorized</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {books?.filter(b => !b.category).slice(0, 12).map((book) => {
                        const price = calculatePrice(book);
                        const inCart = cart.find(i => i.book.id === book.id);
                        const hasStock = book.quantity_in_stock > 0;
                        
                        return (
                          <Card 
                            key={book.id}
                            onClick={() => addToCart(book)}
                            className={`cursor-pointer transition-all hover:shadow-md active:scale-95 ${
                              inCart ? 'ring-2 ring-primary bg-primary/5' : ''
                            }`}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start gap-2">
                                {book.cover_image_url ? (
                                  <img 
                                    src={book.cover_image_url} 
                                    alt={book.title}
                                    className="w-10 h-14 rounded object-cover flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-10 h-14 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                    <Book className="w-5 h-5 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm line-clamp-2">{book.title_hebrew || book.title}</p>
                                  {book.subcategory && (
                                    <p className="text-xs text-muted-foreground truncate">{book.subcategory}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex justify-between items-center mt-2">
                                <span className={`font-bold ${price > 0 ? 'text-primary' : 'text-orange-500'}`}>
                                  {price > 0 ? `$${price.toFixed(2)}` : 'No price'}
                                </span>
                                {inCart && (
                                  <span className="bg-primary text-primary-foreground text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                                    {inCart.quantity}
                                  </span>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Show Books Grid when category selected or searching */
              <div>
                {selectedCategory && selectedCategory !== '__ALL__' && (
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <FolderOpen className="w-4 h-4 text-primary" />
                    <span className="font-medium text-primary">{selectedCategory}</span>
                    <span className="text-muted-foreground text-sm">({filteredBooks.length} books)</span>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {(selectedCategory === '__ALL__' ? books?.filter(book => {
                if (!bookSearch) return true;
                const search = bookSearch.toLowerCase();
                return (
                  book.title?.toLowerCase().includes(search) ||
                  book.title_hebrew?.toLowerCase().includes(search) ||
                  book.author?.toLowerCase().includes(search) ||
                  book.isbn?.includes(search)
                );
              }).slice(0, 50) : filteredBooks)?.map((book) => {
                const price = calculatePrice(book);
                const inCart = cart.find(i => i.book.id === book.id);
                const hasStock = book.quantity_in_stock > 0;
                
                return (
                  <Card 
                    key={book.id}
                    onClick={() => addToCart(book)}
                    className={`cursor-pointer transition-all hover:shadow-md active:scale-95 ${
                      inCart ? 'ring-2 ring-primary bg-primary/5' : ''
                    }`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        {book.cover_image_url ? (
                          <img 
                            src={book.cover_image_url} 
                            alt={book.title}
                            className="w-10 h-14 rounded object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-14 rounded bg-muted flex items-center justify-center flex-shrink-0">
                            <Book className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm line-clamp-2">{book.title_hebrew || book.title}</p>
                          {book.subcategory && (
                            <p className="text-xs text-muted-foreground truncate">{book.subcategory}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className={`font-bold ${price > 0 ? 'text-primary' : 'text-orange-500'}`}>
                          {price > 0 ? `$${price.toFixed(2)}` : 'No price'}
                        </span>
                        <div className="flex items-center gap-1">
                          {!hasStock && (
                            <span className="text-xs text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">Order</span>
                          )}
                          {inCart && (
                            <span className="bg-primary text-primary-foreground text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                              {inCart.quantity}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            
            {filteredBooks.length === 0 && bookSearch && (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No books found for "{bookSearch}"</p>
                <Button 
                  variant="link" 
                  onClick={() => {
                    setShowCreateBook(true);
                    setNewBookTitle(bookSearch);
                  }}
                >
                  <BookPlus className="w-4 h-4 mr-1" />
                  Create "{bookSearch}"
                </Button>
              </div>
            )}
            </div>
            )}
          </div>
        </div>
        
        {/* Right: Cart & Payment */}
        <div className="flex flex-col bg-card rounded-lg border shadow-sm min-h-0">
          {/* Customer Selection */}
          <div className="p-3 border-b">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Customer</Label>
            {customer ? (
              <div className="flex items-center justify-between mt-1 p-2 bg-muted rounded">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  <div>
                    <span className="font-medium">{customer.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{customer.phone}</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setCustomer(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="mt-1">
                <CustomerSearch onSelect={setCustomer} selectedCustomer={customer} />
              </div>
            )}
          </div>
          
          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            {cart.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Click books to add</p>
              </div>
            ) : (
              <>
                {cart.map((item) => (
                  <div key={item.book.id} className="p-2 bg-muted/50 rounded">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.book.title}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.book.id, -1)}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-6 text-center font-bold">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.book.id, 1)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(item.book.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Price row - editable */}
                    <div className="flex items-center justify-between mt-1">
                      {editingItemId === item.book.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">$</span>
                          <Input
                            type="number"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="h-7 w-20 text-sm"
                            placeholder="0.00"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const newPrice = parseFloat(editPrice) || 0;
                                if (newPrice > 0) {
                                  updatePrice(item.book.id, newPrice);
                                }
                              }
                              if (e.key === 'Escape') {
                                setEditingItemId(null);
                              }
                            }}
                          />
                          <Button 
                            size="sm" 
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => {
                              const newPrice = parseFloat(editPrice) || 0;
                              if (newPrice > 0) {
                                updatePrice(item.book.id, newPrice);
                              }
                            }}
                          >
                            <Check className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <button 
                          className={`text-xs flex items-center gap-1 hover:underline ${item.price > 0 ? 'text-muted-foreground' : 'text-orange-500 font-medium'}`}
                          onClick={() => {
                            setEditingItemId(item.book.id);
                            setEditPrice(item.price > 0 ? item.price.toFixed(2) : '');
                          }}
                        >
                          {item.price > 0 ? (
                            <>
                              ${item.price.toFixed(2)} × {item.quantity}
                              <Edit2 className="w-3 h-3" />
                            </>
                          ) : (
                            <>
                              Set price
                              <Edit2 className="w-3 h-3" />
                            </>
                          )}
                        </button>
                      )}
                      <span className="font-bold text-sm">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
                
                {cart.length > 0 && (
                  <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={clearCart}>
                    <Trash2 className="w-3 h-3 mr-1" /> Clear Cart
                  </Button>
                )}
              </>
            )}
          </div>
          
          {/* Payment Section */}
          <div className="border-t p-3 space-y-3 bg-muted/30">
            {/* Total */}
            <div className="flex justify-between items-center">
              <span className="text-lg">Total:</span>
              <span className="text-2xl font-bold text-primary">${subtotal.toFixed(2)}</span>
            </div>
            
            {/* Payment Amount */}
            <div>
              <Label className="text-xs">Payment Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="pl-9 text-xl h-12 font-mono"
                  placeholder="0.00"
                />
              </div>
              {/* Quick amount buttons */}
              {subtotal > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs h-7"
                    onClick={() => setPaymentAmount(subtotal.toFixed(2))}
                  >
                    Full ${subtotal.toFixed(2)}
                  </Button>
                  {subtotal > 10 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-xs h-7"
                      onClick={() => setPaymentAmount('10.00')}
                    >
                      $10
                    </Button>
                  )}
                  {subtotal > 20 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-xs h-7"
                      onClick={() => setPaymentAmount('20.00')}
                    >
                      $20
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs h-7"
                    onClick={() => setPaymentAmount('0')}
                  >
                    $0
                  </Button>
                </div>
              )}
            </div>
            
            {/* Change or Deposit indicator */}
            {subtotal > 0 && (
              change > 0 ? (
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded text-green-700 dark:text-green-400 text-center font-bold">
                  Change: ${change.toFixed(2)}
                </div>
              ) : balanceDue > 0 ? (
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded text-orange-700 dark:text-orange-400 text-center text-sm">
                  {amount > 0 ? 'Deposit' : 'No payment'} - Balance due: ${balanceDue.toFixed(2)}
                </div>
              ) : amount > 0 ? (
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded text-green-700 dark:text-green-400 text-center text-sm">
                  ✓ Full payment
                </div>
              ) : null
            )}
            
            {/* Payment Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="lg"
                variant="outline"
                className="h-14 text-lg"
                onClick={handleCashPayment}
                disabled={!customer || cart.length === 0 || isProcessing}
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Banknote className="w-5 h-5 mr-2" />}
                {amount > 0 ? 'Cash' : 'No Payment'}
              </Button>
              <Button
                size="lg"
                className="h-14 text-lg"
                onClick={() => setShowCardDialog(true)}
                disabled={!customer || cart.length === 0 || amount <= 0 || isProcessing}
              >
                <CreditCard className="w-5 h-5 mr-2" />
                Card
              </Button>
            </div>
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
            
            <p className="text-xs text-center text-muted-foreground">
              Secure payment processing
            </p>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Create Book Dialog */}
      <Dialog open={showCreateBook} onOpenChange={setShowCreateBook}>
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookPlus className="w-5 h-5" />
              Quick Add Book
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 pt-2 overflow-y-auto flex-1 pr-2">
            <div>
              <Label>Book Title *</Label>
              <Input
                value={newBookTitle}
                onChange={(e) => setNewBookTitle(e.target.value)}
                placeholder="Enter book title"
                className="h-12"
                autoFocus
              />
            </div>
            
            <div>
              <Label>Author (optional)</Label>
              <Input
                value={newBookAuthor}
                onChange={(e) => setNewBookAuthor(e.target.value)}
                placeholder="Author name"
              />
            </div>
            
            <div>
              <Label>Category (optional)</Label>
              <Select
                value={newBookCategory || 'none'}
                onValueChange={(value) => setNewBookCategory(value === 'none' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {BOOK_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Selling Price</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  value={newBookPrice}
                  onChange={(e) => setNewBookPrice(e.target.value)}
                  placeholder="0.00"
                  className="pl-9 h-12"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to set price when adding to cart
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowCreateBook(false)}>
                Cancel
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleCreateBook}
                disabled={createBook.isPending || !newBookTitle.trim()}
              >
                {createBook.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Create & Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
