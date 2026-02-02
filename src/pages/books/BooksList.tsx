import { useState, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCategories } from '@/hooks/useCategories';
import { 
  Book, 
  Search,
  Plus,
  Truck,
  DollarSign,
  AlertCircle,
  ImageIcon,
  Upload,
  Trash2
} from 'lucide-react';
import { useBooks, useCreateBook, useUpdateBook } from '@/hooks/useBooks';
import { useSuppliers } from '@/hooks/useSuppliers';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function BooksList() {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<any>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingEditImage, setUploadingEditImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const editImageInputRef = useRef<HTMLInputElement>(null);
  const [newBook, setNewBook] = useState({
    title: '',
    title_hebrew: '',
    author: '',
    isbn: '',
    category: '',
    subcategory: '',
    cover_image_url: '',
    current_supplier_id: null as string | null,
    default_cost: null as number | null,
    no_profit: false,
    custom_profit_margin: null as number | null,
    fixed_discount: null as number | null,
    discount_type: 'percentage' as 'percentage' | 'fixed',
  });

  const { data: books, isLoading } = useBooks(search);
  const { categoryNames: BOOK_CATEGORIES, categories, getSubcategories } = useCategories();
  const { data: suppliers } = useSuppliers();
  const createBook = useCreateBook();
  const updateBook = useUpdateBook();

  // Get subcategories for current selection
  const newBookSubcategories = newBook.category ? getSubcategories(newBook.category) : [];
  const editingBookSubcategories = editingBook?.category ? getSubcategories(editingBook.category) : [];

  const handleImageUpload = async (
    file: File,
    setUploading: (v: boolean) => void,
    onSuccess: (url: string) => void
  ) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `book-cover-${Date.now()}.${fileExt}`;
      const filePath = `book-covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('store-assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('store-assets')
        .getPublicUrl(filePath);

      onSuccess(publicUrl);
      toast.success('Cover image uploaded!');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Failed to upload: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async () => {
    await createBook.mutateAsync(newBook);
    setIsOpen(false);
    setNewBook({
      title: '',
      title_hebrew: '',
      author: '',
      isbn: '',
      category: '',
      subcategory: '',
      cover_image_url: '',
      current_supplier_id: null,
      default_cost: null,
      no_profit: false,
      custom_profit_margin: null,
      fixed_discount: null,
      discount_type: 'percentage',
    });
  };

  const handleUpdate = async () => {
    if (!editingBook) return;
    await updateBook.mutateAsync(editingBook);
    setEditingBook(null);
  };

  return (
    <AppLayout 
      title="Books" 
      subtitle="Manage your book catalog"
      actions={
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Book
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="font-display">New Book</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4 overflow-y-auto flex-1 pr-2">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={newBook.title}
                  onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
                  placeholder="Book title"
                />
              </div>
              <div className="space-y-2">
                <Label>Hebrew Title</Label>
                <Input
                  value={newBook.title_hebrew || ''}
                  onChange={(e) => setNewBook({ ...newBook, title_hebrew: e.target.value })}
                  placeholder="שם הספר בעברית"
                  dir="rtl"
                />
              </div>
              <div className="space-y-2">
                <Label>Author</Label>
                <Input
                  value={newBook.author || ''}
                  onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
                  placeholder="Author name"
                />
              </div>
              <div className="space-y-2">
                <Label>ISBN</Label>
                <Input
                  value={newBook.isbn || ''}
                  onChange={(e) => setNewBook({ ...newBook, isbn: e.target.value })}
                  placeholder="ISBN number"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={newBook.category || 'none'}
                  onValueChange={(value) => setNewBook({ ...newBook, category: value === 'none' ? '' : value, subcategory: '' })}
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
              {newBookSubcategories.length > 0 && (
                <div className="space-y-2">
                  <Label>Subcategory</Label>
                  <Select
                    value={newBook.subcategory || 'none'}
                    onValueChange={(value) => setNewBook({ ...newBook, subcategory: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select subcategory" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No subcategory</SelectItem>
                      {newBookSubcategories.map((sub) => (
                        <SelectItem key={sub.id} value={sub.name}>
                          {sub.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Cover Image</Label>
                <div className="flex items-center gap-4">
                  {newBook.cover_image_url ? (
                    <div className="relative">
                      <img 
                        src={newBook.cover_image_url} 
                        alt="Book cover" 
                        className="w-20 h-28 object-cover rounded-lg border"
                      />
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute -top-2 -right-2 w-6 h-6"
                        onClick={() => setNewBook({ ...newBook, cover_image_url: '' })}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="w-20 h-28 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/50">
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file, setUploadingImage, (url) => setNewBook({ ...newBook, cover_image_url: url }));
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="w-full"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingImage ? 'Uploading...' : 'Upload Cover'}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Default Supplier</Label>
                <Select
                  value={newBook.current_supplier_id || 'none'}
                  onValueChange={(value) => setNewBook({ ...newBook, current_supplier_id: value === 'none' ? null : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No supplier</SelectItem>
                    {suppliers?.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={handleCreate} 
                className="w-full"
                disabled={!newBook.title || createBook.isPending}
              >
                Create Book
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="space-y-6 animate-fade-in">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, author, or ISBN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Books List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading books...</div>
        ) : books && books.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {books.map((book) => (
              <Card 
                key={book.id} 
                className="shadow-soft hover:shadow-card transition-shadow cursor-pointer"
                onClick={() => setEditingBook({ ...book })}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {book.cover_image_url ? (
                      <img 
                        src={book.cover_image_url} 
                        alt={book.title}
                        className="w-12 h-16 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-16 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Book className="w-6 h-6 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{book.title}</h3>
                      {book.title_hebrew && (
                        <p className="text-sm text-muted-foreground truncate" dir="rtl">
                          {book.title_hebrew}
                        </p>
                      )}
                      {book.author && (
                        <p className="text-sm text-muted-foreground">by {book.author}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {book.category && (
                          <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            {book.category}
                          </span>
                        )}
                        {book.subcategory && (
                          <span className="text-xs text-secondary-foreground bg-secondary px-2 py-0.5 rounded-full">
                            {book.subcategory}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {!book.current_supplier_id && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-warning/10 text-warning rounded-full">
                            <AlertCircle className="w-3 h-3" />
                            No supplier
                          </span>
                        )}
                        {book.no_profit && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded-full">
                            <DollarSign className="w-3 h-3" />
                            No profit
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="shadow-soft">
            <CardContent className="py-12 text-center">
              <Book className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground">No books found</p>
              <Button onClick={() => setIsOpen(true)} className="mt-4">
                Add your first book
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Edit Book Dialog */}
        <Dialog open={!!editingBook} onOpenChange={(open) => !open && setEditingBook(null)}>
          <DialogContent className="max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="font-display">Edit Book</DialogTitle>
            </DialogHeader>
            {editingBook && (
              <div className="space-y-4 mt-4 overflow-y-auto flex-1 pr-2">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={editingBook.title}
                    onChange={(e) => setEditingBook({ ...editingBook, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hebrew Title</Label>
                  <Input
                    value={editingBook.title_hebrew || ''}
                    onChange={(e) => setEditingBook({ ...editingBook, title_hebrew: e.target.value })}
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={editingBook.category || 'none'}
                    onValueChange={(value) => setEditingBook({ ...editingBook, category: value === 'none' ? '' : value, subcategory: '' })}
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
                {editingBookSubcategories.length > 0 && (
                  <div className="space-y-2">
                    <Label>Subcategory</Label>
                    <Select
                      value={editingBook.subcategory || 'none'}
                      onValueChange={(value) => setEditingBook({ ...editingBook, subcategory: value === 'none' ? '' : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select subcategory" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No subcategory</SelectItem>
                        {editingBookSubcategories.map((sub) => (
                          <SelectItem key={sub.id} value={sub.name}>
                            {sub.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Cover Image</Label>
                  <div className="flex items-center gap-4">
                    {editingBook.cover_image_url ? (
                      <div className="relative">
                        <img 
                          src={editingBook.cover_image_url} 
                          alt="Book cover" 
                          className="w-20 h-28 object-cover rounded-lg border"
                        />
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute -top-2 -right-2 w-6 h-6"
                          onClick={() => setEditingBook({ ...editingBook, cover_image_url: '' })}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="w-20 h-28 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/50">
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <input
                        ref={editImageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(file, setUploadingEditImage, (url) => setEditingBook({ ...editingBook, cover_image_url: url }));
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => editImageInputRef.current?.click()}
                        disabled={uploadingEditImage}
                        className="w-full"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {uploadingEditImage ? 'Uploading...' : 'Upload Cover'}
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Supplier</Label>
                  <Select
                    value={editingBook.current_supplier_id || 'none'}
                    onValueChange={(value) => setEditingBook({ ...editingBook, current_supplier_id: value === 'none' ? null : value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No supplier</SelectItem>
                      {suppliers?.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Default Cost ($)</Label>
                  <Input
                    type="number"
                    value={editingBook.default_cost || ''}
                    onChange={(e) => setEditingBook({ ...editingBook, default_cost: parseFloat(e.target.value) || null })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Discount Type</Label>
                  <Select
                    value={editingBook.discount_type || 'percentage'}
                    onValueChange={(value: 'percentage' | 'fixed') => setEditingBook({ ...editingBook, discount_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage Margin (%)</SelectItem>
                      <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editingBook.discount_type === 'percentage' ? (
                  <div className="space-y-2">
                    <Label>Custom Profit Margin (%)</Label>
                    <Input
                      type="number"
                      value={editingBook.custom_profit_margin || ''}
                      onChange={(e) => setEditingBook({ ...editingBook, custom_profit_margin: parseFloat(e.target.value) || null })}
                      placeholder="Use default"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Fixed Profit Amount ($)</Label>
                    <Input
                      type="number"
                      value={editingBook.fixed_discount || ''}
                      onChange={(e) => setEditingBook({ ...editingBook, fixed_discount: parseFloat(e.target.value) || null })}
                      placeholder="e.g., 5.00"
                    />
                    <p className="text-xs text-muted-foreground">
                      This amount will be added to the cost to get the selling price
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <Label>No Profit (return/special)</Label>
                  <Switch
                    checked={editingBook.no_profit}
                    onCheckedChange={(checked) => setEditingBook({ ...editingBook, no_profit: checked })}
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setEditingBook(null)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleUpdate}
                    disabled={updateBook.isPending}
                  >
                    {updateBook.isPending ? 'Saving...' : 'Save Changes'}
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
