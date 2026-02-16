"""
Documents models - Document and file management
"""
from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from apps.core.models import TimeStampedModel
import os


def document_upload_path(instance, filename):
    """Generate upload path based on document type."""
    # Clean filename
    name, ext = os.path.splitext(filename)
    # Create path: documents/{document_type}/{year}/{month}/{filename}
    from django.utils import timezone
    now = timezone.now()
    return f'documents/{instance.document_type}/{now.year}/{now.month:02d}/{filename}'


class Document(TimeStampedModel):
    """
    Document storage for invoices, supplier sheets, ads, etc.
    Uses generic foreign key to link to any model (Order, Supplier, Book, etc.)
    """
    
    DOCUMENT_TYPE_CHOICES = [
        ('invoice_received', 'Invoice Received (from Supplier)'),
        ('invoice_sent', 'Invoice Sent (to Customer)'),
        ('supplier_sheet', 'Supplier Sheet'),
        ('supplier_catalog', 'Supplier Catalog'),
        ('book_ad', 'Book Advertisement'),
        ('purchase_order', 'Purchase Order'),
        ('receipt', 'Receipt'),
        ('contract', 'Contract'),
        ('correspondence', 'Correspondence/Email'),
        ('other', 'Other'),
    ]
    
    title = models.CharField(
        max_length=255,
        help_text='Document title or description'
    )
    
    document_type = models.CharField(
        max_length=50,
        choices=DOCUMENT_TYPE_CHOICES,
        db_index=True,
        help_text='Type of document'
    )
    
    file = models.FileField(
        upload_to=document_upload_path,
        help_text='Upload PDF, image, or other document'
    )
    
    # Generic relationship - can link to any model
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text='Type of related object (Order, Supplier, Book, etc.)'
    )
    object_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='ID of related object'
    )
    related_object = GenericForeignKey('content_type', 'object_id')
    
    # Additional metadata
    document_date = models.DateField(
        null=True,
        blank=True,
        help_text='Date on the document (e.g., invoice date)'
    )
    
    reference_number = models.CharField(
        max_length=100,
        blank=True,
        help_text='Invoice number, PO number, etc.'
    )
    
    notes = models.TextField(
        blank=True,
        help_text='Additional notes about this document'
    )
    
    tags = models.CharField(
        max_length=255,
        blank=True,
        help_text='Comma-separated tags for easy searching'
    )
    
    uploaded_by = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_documents'
    )
    
    class Meta:
        verbose_name = 'Document'
        verbose_name_plural = 'Documents'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['document_type', '-created_at']),
            models.Index(fields=['content_type', 'object_id']),
            models.Index(fields=['-document_date']),
        ]
    
    def __str__(self):
        return f"{self.get_document_type_display()} - {self.title}"
    
    def get_file_size(self):
        """Get file size in human-readable format."""
        if self.file:
            size = self.file.size
            for unit in ['B', 'KB', 'MB', 'GB']:
                if size < 1024.0:
                    return f"{size:.1f} {unit}"
                size /= 1024.0
        return "Unknown"
    
    def get_file_extension(self):
        """Get file extension."""
        if self.file:
            return os.path.splitext(self.file.name)[1].upper().replace('.', '')
        return None


class DocumentCategory(models.Model):
    """
    Custom categories for organizing documents beyond the predefined types.
    """
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='subcategories'
    )
    
    class Meta:
        verbose_name = 'Document Category'
        verbose_name_plural = 'Document Categories'
        ordering = ['name']
    
    def __str__(self):
        if self.parent:
            return f"{self.parent.name} > {self.name}"
        return self.name
