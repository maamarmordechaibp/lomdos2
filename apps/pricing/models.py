"""
Pricing models - Price history and margin settings
"""
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from apps.core.models import TimeStampedModel


class GlobalSettings(models.Model):
    """
    Global pricing settings (singleton pattern).
    """
    
    default_margin_percentage = models.DecimalField(
        'Default Profit Margin (%)',
        max_digits=5,
        decimal_places=2,
        default=20.00,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text='Default profit margin percentage applied to all books'
    )
    
    currency = models.CharField(
        max_length=3,
        default='USD',
        help_text='Currency code (USD, EUR, ILS, etc.)'
    )
    
    class Meta:
        verbose_name = 'Global Settings'
        verbose_name_plural = 'Global Settings'
    
    def __str__(self):
        return f"Global Settings (Margin: {self.default_margin_percentage}%)"
    
    @classmethod
    def get_settings(cls):
        """Get or create global settings (singleton)."""
        settings, created = cls.objects.get_or_create(pk=1)
        return settings
    
    def save(self, *args, **kwargs):
        # Ensure singleton
        self.pk = 1
        super().save(*args, **kwargs)
    
    def delete(self, *args, **kwargs):
        # Prevent deletion
        pass


class PriceHistory(TimeStampedModel):
    """
    Historical record of book purchase and selling prices.
    Tracks which supplier sold the book and at what price.
    """
    
    book = models.ForeignKey(
        'books.Book',
        on_delete=models.CASCADE,
        related_name='price_history'
    )
    
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='price_history'
    )
    
    # Prices at time of purchase
    purchase_price = models.DecimalField(
        'Purchase Price',
        max_digits=10,
        decimal_places=2,
        help_text='Cost paid to supplier'
    )
    
    selling_price = models.DecimalField(
        'Selling Price',
        max_digits=10,
        decimal_places=2,
        help_text='Price sold to customer'
    )
    
    profit_margin = models.DecimalField(
        'Profit Margin (%)',
        max_digits=5,
        decimal_places=2,
        help_text='Calculated profit margin'
    )
    
    quantity = models.PositiveIntegerField(
        default=1,
        help_text='Number of units purchased'
    )
    
    # Reference to supplier order if applicable
    supplier_order = models.ForeignKey(
        'suppliers.SupplierOrder',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='price_records'
    )
    
    # Reference to customer order if applicable
    customer_order = models.ForeignKey(
        'orders.Order',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='price_records'
    )
    
    notes = models.TextField(blank=True)
    
    class Meta:
        verbose_name = 'Price History'
        verbose_name_plural = 'Price History Records'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['book', '-created_at']),
            models.Index(fields=['supplier', '-created_at']),
        ]
    
    def __str__(self):
        book_title = self.book.safe_translation_getter('title', any_language=True)
        supplier_name = self.supplier.safe_translation_getter('name', any_language=True) if self.supplier else 'Unknown'
        return f"{book_title} - {supplier_name} (${self.purchase_price})"
    
    def calculate_margin(self):
        """Calculate profit margin percentage."""
        if self.purchase_price > 0:
            return ((self.selling_price - self.purchase_price) / self.purchase_price) * 100
        return 0
    
    def save(self, *args, **kwargs):
        # Auto-calculate margin if not set
        if not self.profit_margin:
            self.profit_margin = self.calculate_margin()
        super().save(*args, **kwargs)
