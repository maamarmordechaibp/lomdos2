from django.contrib import admin
from django.utils.html import format_html
from parler.admin import TranslatableAdmin
from .models import Book, Author, Publisher, Category


@admin.register(Category)
class CategoryAdmin(TranslatableAdmin):
    list_display = ['name', 'created_at']
    search_fields = ['translations__name']


@admin.register(Publisher)
class PublisherAdmin(TranslatableAdmin):
    list_display = ['name', 'email', 'website', 'created_at']
    search_fields = ['translations__name', 'email']


@admin.register(Author)
class AuthorAdmin(TranslatableAdmin):
    list_display = ['name', 'created_at']
    search_fields = ['translations__name']


@admin.register(Book)
class BookAdmin(TranslatableAdmin):
    list_display = ['title', 'isbn', 'stock_status_display', 'current_cost', 'current_price', 'stock_quantity', 'supplier_status', 'created_at']
    list_filter = ['category', 'language', 'created_at', 'stock_quantity']
    search_fields = ['isbn', 'translations__title', 'notes']
    filter_horizontal = ['authors']
    readonly_fields = ['created_at', 'updated_at', 'barcode_generated']
    
    def stock_status_display(self, obj):
        """Display stock status with color coding."""
        if obj.stock_quantity > 10:
            return format_html('<span style="color: green; font-weight: bold;">✅ In Stock ({})</span>', obj.stock_quantity)
        elif obj.stock_quantity > 0:
            return format_html('<span style="color: orange; font-weight: bold;">⚠️ Low Stock ({})</span>', obj.stock_quantity)
        else:
            return format_html('<span style="color: red; font-weight: bold;">⏳ To Order</span>')
    stock_status_display.short_description = 'Stock Status'
    
    def supplier_status(self, obj):
        """Display supplier assignment status."""
        if 'pending supplier assignment' in obj.notes.lower():
            return format_html('<span style="background: #fff3cd; color: #856404; padding: 3px 8px; border-radius: 4px;">📋 Pending Assignment</span>')
        return format_html('<span style="color: green;">✓</span>')
    supplier_status.short_description = 'Supplier'
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('isbn', 'title', 'subtitle', 'description'),
            'description': 'Enter the basic book information. ISBN can be temporary for pending books.'
        }),
        ('Relationships', {
            'fields': ('authors', 'publisher', 'category'),
            'description': 'Assign authors, publisher, and category. Can be updated later for pending books.'
        }),
        ('Physical Details', {
            'fields': ('pages', 'language', 'publication_date', 'edition', 'cover_image')
        }),
        ('Pricing', {
            'fields': ('current_cost', 'current_price', 'custom_margin_type', 'custom_margin_value')
        }),
        ('Stock', {
            'fields': ('stock_quantity',)
        }),
        ('Additional', {
            'fields': ('notes', 'barcode_generated', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
