from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.db.models import Q
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
from django.views.generic import ListView, DetailView
from django.contrib.auth.mixins import LoginRequiredMixin
from dal import autocomplete
from .models import Book, Author
import uuid


class BookListView(LoginRequiredMixin, ListView):
    """List all books in the catalog."""
    model = Book
    template_name = 'books/book_list.html'
    context_object_name = 'books'
    paginate_by = 50
    
    def get_queryset(self):
        qs = Book.objects.all().select_related('category', 'publisher')
        
        # Search functionality
        search = self.request.GET.get('search')
        if search:
            qs = qs.filter(
                Q(isbn__icontains=search) |
                Q(translations__title__icontains=search)
            ).distinct()
        
        # Filter by stock status
        stock_filter = self.request.GET.get('stock')
        if stock_filter == 'in_stock':
            qs = qs.filter(stock_quantity__gt=0)
        elif stock_filter == 'low_stock':
            qs = qs.filter(stock_quantity__gt=0, stock_quantity__lt=5)
        elif stock_filter == 'out_of_stock':
            qs = qs.filter(stock_quantity=0)
        
        return qs.order_by('-created_at')


class BookDetailView(LoginRequiredMixin, DetailView):
    """Detailed view of a book with price history."""
    model = Book
    template_name = 'books/book_detail.html'
    context_object_name = 'book'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        book = self.get_object()
        
        # Get price history
        context['price_history'] = book.get_supplier_price_history()[:10]
        
        return context


class BookAutocomplete(autocomplete.Select2QuerySetView):
    """Autocomplete view for book search with add permission."""
    
    def has_add_permission(self, request):
        """Allow authenticated users to add books."""
        return request.user.is_authenticated
    
    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return Book.objects.none()
        
        qs = Book.objects.all()
        
        if self.q:
            # Search in ISBN, title (both languages)
            qs = qs.filter(
                Q(isbn__icontains=self.q) |
                Q(translations__title__icontains=self.q)
            ).distinct()
        
        return qs.select_related('category', 'publisher')
    
    def get_result_label(self, result):
        """Custom label format for autocomplete results."""
        title = result.safe_translation_getter('title', any_language=True)
        stock_info = "✅ In Stock" if result.stock_quantity > 0 else "⏳ To Order"
        return f"{title} - ISBN: {result.isbn} ({stock_info})"


class AuthorAutocomplete(autocomplete.Select2QuerySetView):
    """Autocomplete view for author search."""
    
    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return Author.objects.none()
        
        qs = Author.objects.all()
        
        if self.q:
            qs = qs.filter(
                translations__name__icontains=self.q
            ).distinct()
        
        return qs


@login_required
@require_POST
def create_book_ajax(request):
    """
    AJAX endpoint to create a new book with minimal information.
    Books created this way are marked as to order (stock_quantity=0).
    """
    try:
        # Get data from request
        title_en = request.POST.get('title_en', '').strip()
        title_he = request.POST.get('title_he', '').strip()
        isbn = request.POST.get('isbn', '').strip()
        price = request.POST.get('price', '').strip()
        cost = request.POST.get('cost', '').strip()
        supplier_id = request.POST.get('supplier_id', '').strip()
        margin_type = request.POST.get('margin_type', 'percentage').strip()
        margin_value = request.POST.get('margin_value', '10').strip()
        
        # Validate required field
        if not title_en:
            return JsonResponse({
                'success': False,
                'error': 'English title is required'
            }, status=400)
        
        # Generate ISBN if not provided
        if not isbn:
            isbn = f"TEMP-{uuid.uuid4().hex[:10].upper()}"
        
        # Get supplier if provided
        supplier = None
        if supplier_id:
            from apps.suppliers.models import Supplier
            try:
                supplier = Supplier.objects.get(pk=supplier_id)
            except Supplier.DoesNotExist:
                pass
        
        # Create the book with minimal info and English translation
        book = Book.objects.language('en').create(
            isbn=isbn,
            title=title_en,
            current_price=float(price) if price else None,
            current_cost=float(cost) if cost else None,
            default_supplier=supplier,
            custom_margin_type=margin_type if margin_type in ['percentage', 'flat'] else '',
            custom_margin_value=float(margin_value) if margin_value else None,
            stock_quantity=0,  # Pending - needs to be ordered
            notes='Created during order entry - pending supplier assignment' if not supplier else f'Supplier: {supplier}'
        )
        
        # Add Hebrew translation if provided
        if title_he:
            book.set_current_language('he')
            book.title = title_he
            book.save()
        
        return JsonResponse({
            'success': True,
            'book': {
                'id': book.id,
                'title': title_en,
                'isbn': book.isbn,
                'price': float(book.current_price) if book.current_price else 0,
                'cost': float(book.current_cost) if book.current_cost else 0,
                'supplier_id': supplier.id if supplier else None,
            },
            'message': f'Book "{title_en}" created successfully!'
        })
    
    except Exception as e:
        import traceback
        return JsonResponse({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }, status=500)


def book_lookup(request, isbn):
    """
    HTMX endpoint for barcode/ISBN lookup.
    Returns book details and price history.
    """
    try:
        book = Book.objects.get(isbn=isbn)
        
        # Get price history
        price_history = book.get_supplier_price_history()[:5]  # Last 5 purchases
        
        data = {
            'id': book.id,
            'isbn': book.isbn,
            'title': book.safe_translation_getter('title', any_language=True),
            'current_cost': str(book.current_cost) if book.current_cost else None,
            'current_price': str(book.current_price) if book.current_price else None,
            'stock_quantity': book.stock_quantity,
            'price_history': [
                {
                    'supplier': ph.supplier.name if ph.supplier else 'N/A',
                    'cost': str(ph.purchase_price),
                    'price': str(ph.selling_price),
                    'date': ph.created_at.strftime('%Y-%m-%d')
                }
                for ph in price_history
            ]
        }
        
        return JsonResponse(data)
    
    except Book.DoesNotExist:
        return JsonResponse({'error': 'Book not found'}, status=404)
