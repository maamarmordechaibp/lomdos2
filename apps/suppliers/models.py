"""
Suppliers models - Supplier management and ordering
"""
from django.db import models
from parler.models import TranslatableModel, TranslatedFields
from apps.core.models import TimeStampedModel


class Supplier(TranslatableModel, TimeStampedModel):
    """
    Supplier/vendor information with multilingual names.
    """
    
    translations = TranslatedFields(
        name=models.CharField(max_length=200, db_index=True),
        description=models.TextField(blank=True),
    )
    
    # Contact information
    email = models.EmailField(
        help_text='Primary email for order notifications'
    )
    email_cc = models.EmailField(
        'CC Email',
        blank=True,
        help_text='Additional email to CC on orders'
    )
    phone = models.CharField(max_length=20, blank=True)
    website = models.URLField(blank=True)
    
    # Address
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    
    # Business details
    tax_id = models.CharField('Tax ID', max_length=50, blank=True)
    payment_terms = models.CharField(
        max_length=100,
        blank=True,
        help_text='e.g., Net 30, COD, etc.'
    )
    
    # Status
    is_active = models.BooleanField(default=True)
    
    # Notes
    notes = models.TextField(blank=True)
    
    class Meta:
        verbose_name = 'Supplier'
        verbose_name_plural = 'Suppliers'
        ordering = ['translations__name']
    
    def __str__(self):
        return self.safe_translation_getter('name', any_language=True)
    
    def get_total_orders_count(self):
        """Get count of orders placed with this supplier."""
        return self.orders.count()
    
    def get_pending_orders_count(self):
        """Get count of pending orders."""
        return self.orders.filter(status='pending').count()


class SupplierOrder(TimeStampedModel):
    """
    Order placed with a supplier (purchase order).
    """
    
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        ('confirmed', 'Confirmed'),
        ('received', 'Received'),
        ('cancelled', 'Cancelled'),
    ]
    
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.PROTECT,
        related_name='orders'
    )
    
    order_number = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text='Internal order reference number'
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft',
        db_index=True
    )
    
    # Dates
    order_date = models.DateTimeField(auto_now_add=True)
    sent_date = models.DateTimeField(null=True, blank=True)
    expected_date = models.DateField(null=True, blank=True)
    received_date = models.DateTimeField(null=True, blank=True)
    
    # Financial
    total_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )
    
    # Notes
    notes = models.TextField(blank=True)
    
    # Email tracking
    email_sent = models.BooleanField(default=False)
    email_sent_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        verbose_name = 'Supplier Order'
        verbose_name_plural = 'Supplier Orders'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['order_number']),
            models.Index(fields=['status', '-created_at']),
        ]
    
    def __str__(self):
        supplier_name = self.supplier.safe_translation_getter('name', any_language=True)
        return f"Order #{self.order_number} - {supplier_name}"
    
    def calculate_total(self):
        """Calculate total cost from order items."""
        from django.db.models import Sum, F
        total = self.items.aggregate(
            total=Sum(F('quantity') * F('unit_cost'))
        )['total']
        return total or 0
    
    def update_total(self):
        """Update the total_cost field."""
        self.total_cost = self.calculate_total()
        self.save(update_fields=['total_cost'])


class SupplierOrderItem(TimeStampedModel):
    """
    Individual book in a supplier order.
    """
    
    order = models.ForeignKey(
        SupplierOrder,
        on_delete=models.CASCADE,
        related_name='items'
    )
    
    book = models.ForeignKey(
        'books.Book',
        on_delete=models.PROTECT,
        related_name='supplier_order_items'
    )
    
    quantity = models.PositiveIntegerField(default=1)
    
    unit_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Cost per unit from supplier'
    )
    
    # For tracking when items are received
    received_quantity = models.PositiveIntegerField(default=0)
    
    notes = models.TextField(blank=True)
    
    class Meta:
        verbose_name = 'Supplier Order Item'
        verbose_name_plural = 'Supplier Order Items'
        unique_together = ['order', 'book']
    
    def __str__(self):
        book_title = self.book.safe_translation_getter('title', any_language=True)
        return f"{self.quantity}x {book_title}"
    
    def get_total_cost(self):
        """Get total cost for this line item."""
        return self.quantity * self.unit_cost
