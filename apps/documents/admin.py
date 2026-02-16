"""
Documents admin configuration
"""
from django.contrib import admin
from .models import Document, DocumentCategory


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ['title', 'document_type', 'document_date', 'reference_number', 
                    'get_related_object', 'get_file_extension', 'created_at']
    list_filter = ['document_type', 'document_date', 'created_at']
    search_fields = ['title', 'reference_number', 'notes', 'tags']
    date_hierarchy = 'document_date'
    readonly_fields = ['created_at', 'updated_at', 'get_file_size', 'uploaded_by']
    
    fieldsets = (
        ('Document Information', {
            'fields': ('title', 'document_type', 'file')
        }),
        ('Related Object', {
            'fields': ('content_type', 'object_id'),
            'description': 'Link this document to an order, supplier, book, etc.'
        }),
        ('Metadata', {
            'fields': ('document_date', 'reference_number', 'tags', 'notes')
        }),
        ('Upload Info', {
            'fields': ('uploaded_by', 'get_file_size', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_related_object(self, obj):
        """Display the related object."""
        if obj.related_object:
            return str(obj.related_object)
        return '-'
    get_related_object.short_description = 'Related To'
    
    def save_model(self, request, obj, form, change):
        """Auto-set uploaded_by to current user."""
        if not change:  # Only on creation
            obj.uploaded_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(DocumentCategory)
class DocumentCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'parent', 'description']
    search_fields = ['name', 'description']
    list_filter = ['parent']
