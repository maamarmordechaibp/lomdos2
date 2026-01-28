import { useState } from 'react';
import { Search, Plus, BookOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useBooks, useCreateBook } from '@/hooks/useBooks';
import { Book } from '@/types/database';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface BookSearchProps {
  onSelect: (book: Book) => void;
  selectedBook?: Book | null;
}

export function BookSearch({ onSelect, selectedBook }: BookSearchProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [newBook, setNewBook] = useState({
    title: '',
    title_hebrew: '',
    author: '',
    isbn: '',
    current_supplier_id: null as string | null,
    default_cost: null as number | null,
    no_profit: false,
    custom_profit_margin: null as number | null,
  });

  const { data: books, isLoading } = useBooks(search);
  const createBook = useCreateBook();

  const handleCreateBook = async () => {
    const book = await createBook.mutateAsync(newBook);
    onSelect(book);
    setIsOpen(false);
    setNewBook({
      title: '',
      title_hebrew: '',
      author: '',
      isbn: '',
      current_supplier_id: null,
      default_cost: null,
      no_profit: false,
      custom_profit_margin: null,
    });
  };

  const handleSelect = (book: Book) => {
    onSelect(book);
    setShowResults(false);
    setSearch('');
  };

  if (selectedBook) {
    return (
      <Card className="p-4 bg-secondary/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{selectedBook.title}</p>
              {selectedBook.title_hebrew && (
                <p className="text-sm text-muted-foreground" dir="rtl">{selectedBook.title_hebrew}</p>
              )}
              {selectedBook.author && (
                <p className="text-xs text-muted-foreground">by {selectedBook.author}</p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onSelect(null as any)}>
            Change
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, author, or ISBN..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            className="pl-10"
          />
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon">
              <Plus className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">New Book</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={newBook.title}
                  onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
                  placeholder="Book title (English)"
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
              <Button 
                onClick={handleCreateBook} 
                className="w-full"
                disabled={!newBook.title || createBook.isPending}
              >
                Create Book
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {showResults && search && (
        <Card className="absolute z-50 w-full mt-1 max-h-60 overflow-auto shadow-elevated">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">Searching...</div>
          ) : books && books.length > 0 ? (
            <div className="py-1">
              {books.map((book) => (
                <button
                  key={book.id}
                  onClick={() => handleSelect(book)}
                  className="w-full px-4 py-3 text-left hover:bg-secondary/50 transition-colors flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{book.title}</p>
                    {book.title_hebrew && (
                      <p className="text-sm text-muted-foreground truncate" dir="rtl">{book.title_hebrew}</p>
                    )}
                    {book.author && (
                      <p className="text-xs text-muted-foreground">by {book.author}</p>
                    )}
                  </div>
                  {!book.current_supplier_id && (
                    <span className="text-xs px-2 py-1 bg-warning/10 text-warning rounded-full">
                      No supplier
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center">
              <p className="text-muted-foreground mb-2">No books found</p>
              <Button variant="outline" size="sm" onClick={() => {
                setNewBook({ ...newBook, title: search });
                setIsOpen(true);
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Create "{search}"
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
