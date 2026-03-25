import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useBooks, useCreateBook } from '@/hooks/useBooks';
import { useSettings } from '@/hooks/useSettings';
import { useCategories } from '@/hooks/useCategories';
import { Book } from '@/types/database';
import { 
  ShoppingCart, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  X,
  BookPlus,
  FolderOpen,
  ArrowLeft,
  Book as BookIcon,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
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
import { Label } from '@/components/ui/label';

interface CartItem {
  book: Book;
  quantity: number;
  price: number;
  wantsBinding: boolean;
}

const BINDING_FEE = 5.00;

export default function NewOrder() {
  const navigate = useNavigate();
  const location = useLocation();
  const createBook = useCreateBook();
  const { data: books, refetch: refetchBooks } = useBooks();
  const { data: settings } = useSettings();
  const { categoryNames: BOOK_CATEGORIES } = useCategories();
  
  // Restore cart from checkout if coming back
  const initialCart = (location.state?.cart as CartItem[]) || [];
  
  // State
  const [cart, setCart] = useState<CartItem[]>(initialCart);
  const [bookSearch, setBookSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Create book dialog
  const [showCreateBook, setShowCreateBook] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookPrice, setNewBookPrice] = useState('');
  const [newBookAuthor, setNewBookAuthor] = useState('');
  const [newBookCategory, setNewBookCategory] = useState('');
  
  // Calculate price with margin
  const calculatePrice = (book: Book) => {
    if (!book.default_cost) return 0;
    if (book.no_profit) return book.default_cost;
    const margin = book.custom_profit_margin ?? settings?.default_profit_margin ?? 20;
    return book.default_cost * (1 + margin / 100);
  };
  
  // Filter books by search and category
  const filteredBooks = books?.filter(book => {
    if (selectedCategory && selectedCategory !== '__ALL__' && book.category !== selectedCategory) return false;
    if (!bookSearch) return true;
    const search = bookSearch.toLowerCase();
    return (
      book.title.toLowerCase().includes(search) ||
      book.title_hebrew?.toLowerCase().includes(search) ||
      book.author?.toLowerCase().includes(search) ||
      book.subcategory?.toLowerCase().includes(search) ||
      book.isbn?.includes(search)
    );
  }) || [];
  
  // Cart functions
  const addToCart = (book: Book) => {
    const price = calculatePrice(book);
    setCart(prev => {
      const existing = prev.find(i => i.book.id === book.id);
      if (existing) {
        return prev.map(i => i.book.id === book.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { book, quantity: 1, price, wantsBinding: false }];
    });
  };
  
  const toggleBinding = (bookId: string) => {
    setCart(prev => prev.map(item => 
      item.book.id === bookId ? { ...item, wantsBinding: !item.wantsBinding } : item
    ));
  };
  
  const updateQuantity = (bookId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.book.id === bookId) {
        const newQty = Math.max(0, item.quantity + delta);
        if (newQty === 0) return null as any;
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(Boolean));
  };
  
  const removeFromCart = (bookId: string) => {
    setCart(prev => prev.filter(item => item.book.id !== bookId));
  };
  
  const clearCart = () => {
    setCart([]);
  };
  
  const handleCreateBook = async () => {
    if (!newBookTitle.trim()) {
      toast.error('Title is required');
      return;
    }
    
    try {
      const newBook = await createBook.mutateAsync({
        title: newBookTitle.trim(),
        author: newBookAuthor.trim() || null,
        category: newBookCategory || null,
        default_cost: newBookPrice ? parseFloat(newBookPrice) : null,
        quantity_in_stock: 0,
      });
      
      await refetchBooks();
      setShowCreateBook(false);
      setNewBookTitle('');
      setNewBookPrice('');
      setNewBookAuthor('');
      setNewBookCategory('');
      
      if (newBook) {
        addToCart(newBook);
      }
      
      toast.success('Book created and added to cart');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create book');
    }
  };
  
  const proceedToCheckout = () => {
    if (cart.length === 0) {
      toast.error('Please add items to cart first');
      return;
    }
    navigate('/orders/checkout', { state: { cart } });
  };
  
  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalBindingFees = cart.reduce((sum, item) => sum + (item.wantsBinding ? BINDING_FEE * item.quantity : 0), 0);
  const grandTotal = subtotal + totalBindingFees;
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <AppLayout title="New Order" subtitle="Select books for order">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-140px)]">
        
        {/* Left: Book Search & Grid (3 columns) */}
        <div className="lg:col-span-3 flex flex-col min-h-0">
          {/* Search Bar */}
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {BOOK_CATEGORIES.map((category) => {
                  const booksInCategory = books?.filter(b => b.category === category).length || 0;
                  return (
                    <Card 
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`cursor-pointer transition-all hover:shadow-md active:scale-95 ${
                        booksInCategory > 0 
                          ? 'bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20' 
                          : ''
                      }`}
                    >
                      <CardContent className="p-4 text-center">
                        <FolderOpen className="w-8 h-8 mx-auto mb-2 text-primary/70" />
                        <p className="font-medium text-sm line-clamp-2">{category}</p>
                        <p className="text-xs text-muted-foreground mt-1">{booksInCategory} books</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {(bookSearch && !selectedCategory ? books?.filter(book => {
                  const search = bookSearch.toLowerCase();
                  return (
                    book.title.toLowerCase().includes(search) ||
                    book.title_hebrew?.toLowerCase().includes(search) ||
                    book.author?.toLowerCase().includes(search) ||
                    book.subcategory?.toLowerCase().includes(search) ||
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
                              <BookIcon className="w-5 h-5 text-muted-foreground" />
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
            )}
            
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
        </div>
        
        {/* Right: Cart Summary (1 column) */}
        <div className="flex flex-col bg-card rounded-lg border shadow-sm">
          {/* Cart Header */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Cart
              </h3>
              {cart.length > 0 && (
                <Badge>{itemCount} items</Badge>
              )}
            </div>
          </div>
          
          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            {cart.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Click books to add to cart</p>
              </div>
            ) : (
              <>
                {cart.map((item) => (
                  <div key={item.book.id} className="p-2 bg-muted/50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.book.title_hebrew || item.book.title}</p>
                        <p className="text-xs text-muted-foreground">
                          ${item.price.toFixed(2)} × {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.book.id, -1)}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-5 text-center font-bold text-sm">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.book.id, 1)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeFromCart(item.book.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1 pt-1 border-t border-border/50">
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                        <input 
                          type="checkbox" 
                          checked={item.wantsBinding}
                          onChange={() => toggleBinding(item.book.id)}
                          className="rounded border-gray-300 w-3.5 h-3.5"
                        />
                        <span className={item.wantsBinding ? 'text-primary font-medium' : 'text-muted-foreground'}>
                          Bind +${BINDING_FEE.toFixed(0)}
                        </span>
                      </label>
                      <span className="font-bold text-sm">
                        ${(item.price * item.quantity + (item.wantsBinding ? BINDING_FEE * item.quantity : 0)).toFixed(2)}
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
          
          {/* Cart Footer */}
          <div className="border-t p-4 space-y-3 bg-muted/30">
            {/* Subtotal */}
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {totalBindingFees > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Binding</span>
                <span className="text-primary">+${totalBindingFees.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="font-medium">Total</span>
              <span className="text-2xl font-bold">${grandTotal.toFixed(2)}</span>
            </div>
            
            {/* Checkout Button */}
            <Button 
              size="lg" 
              className="w-full h-14 text-lg"
              onClick={proceedToCheckout}
              disabled={cart.length === 0}
            >
              Proceed to Checkout
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Create Book Dialog */}
      <Dialog open={showCreateBook} onOpenChange={setShowCreateBook}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookPlus className="w-5 h-5" />
              Quick Add Book
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={newBookTitle}
                onChange={(e) => setNewBookTitle(e.target.value)}
                placeholder="Book title"
                autoFocus
              />
            </div>
            
            <div className="space-y-2">
              <Label>Author</Label>
              <Input
                value={newBookAuthor}
                onChange={(e) => setNewBookAuthor(e.target.value)}
                placeholder="Author name"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={newBookCategory} onValueChange={setNewBookCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {BOOK_CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Cost Price</Label>
              <Input
                type="number"
                value={newBookPrice}
                onChange={(e) => setNewBookPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            
            <Button className="w-full" onClick={handleCreateBook}>
              Create & Add to Cart
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
