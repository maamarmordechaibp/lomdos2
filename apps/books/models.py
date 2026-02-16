"""
Books models - Book catalog with multilingual support
"""
from django.db import models
from django.contrib.postgres.indexes import GinIndex
from parler.models import TranslatableModel, TranslatedFields
from apps.core.models import TimeStampedModel


class Category(TranslatableModel, TimeStampedModel):
    """Book category with multilingual names."""
    
    translations = TranslatedFields(
        name=models.CharField(max_length=100, db_index=True),
        description=models.TextField(blank=True),
    )
    
    class Meta:
        verbose_name = 'Category'
        verbose_name_plural = 'Categories'
        ordering = ['translations__name']
    
    def __str__(self):
        return self.safe_translation_getter('name', any_language=True)


class Publisher(TranslatableModel, TimeStampedModel):
    """Publisher information with multilingual names."""
    
    translations = TranslatedFields(
        name=models.CharField(max_length=200, db_index=True),
    )
    
    website = models.URLField(blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    
    class Meta:
        verbose_name = 'Publisher'
        verbose_name_plural = 'Publishers'
        ordering = ['translations__name']
    
    def __str__(self):
        return self.safe_translation_getter('name', any_language=True)


class Author(TranslatableModel, TimeStampedModel):
    """Author information with multilingual names."""
    
    translations = TranslatedFields(
        name=models.CharField(max_length=200, db_index=True),
        biography=models.TextField(blank=True),
    )
    
    class Meta:
        verbose_name = 'Author'
        verbose_name_plural = 'Authors'
        ordering = ['translations__name']
    
    def __str__(self):
        return self.safe_translation_getter('name', any_language=True)


class Book(TranslatableModel, TimeStampedModel):
    """
    Book model with multilingual title and description.
    Supports ISBN barcodes and price history tracking.
    """
    
    # Unique identifiers
    isbn = models.CharField(
        'ISBN',
        max_length=17,
        unique=True,
        db_index=True,
        help_text='ISBN-10 or ISBN-13'
    )
    
    # Multilingual fields
    translations = TranslatedFields(
        title=models.CharField(max_length=300, db_index=True),
        subtitle=models.CharField(max_length=300, blank=True),
        description=models.TextField(blank=True),
    )
    
    # Relationships
    authors = models.ManyToManyField(Author, related_name='books')
    publisher = models.ForeignKey(
        Publisher,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='books'
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='books'
    )
    
    # Physical attributes
    pages = models.PositiveIntegerField(null=True, blank=True)
    language = models.CharField(max_length=10, default='en')
    publication_date = models.DateField(null=True, blank=True)
    edition = models.CharField(max_length=50, blank=True)
    
    # Pricing (current values)
    current_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Current purchase cost from supplier'
    )
    current_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Current selling price to customer'
    )
    
    # Custom margin settings
    MARGIN_TYPE_CHOICES = [
        ('percentage', 'Percentage'),
        ('flat', 'Flat Rate'),
    ]
    custom_margin_type = models.CharField(
        max_length=20,
        choices=MARGIN_TYPE_CHOICES,
        blank=True,
        help_text='Override global margin with custom calculation'
    )
    custom_margin_value = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Margin value (percentage or flat amount)'
    )
    
    # Stock tracking
    stock_quantity = models.IntegerField(default=0)
    
    # Default supplier for this book
    default_supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='supplied_books',
        help_text='Default supplier for ordering this book'
    )
    
    # Additional info
    cover_image = models.ImageField(upload_to='books/covers/', blank=True)
    notes = models.TextField(blank=True)
    
    # Barcode
    barcode_generated = models.BooleanField(default=False)
    
    class Meta:
        verbose_name = 'Book'
        verbose_name_plural = 'Books'
        ordering = ['translations__title']
        indexes = [
            models.Index(fields=['isbn']),
            models.Index(fields=['stock_quantity']),
        ]
    
    def __str__(self):
        title = self.safe_translation_getter('title', any_language=True)
        return f"{title} ({self.isbn})"
    
    def calculate_selling_price(self, cost=None):
        """
        Calculate selling price based on cost and margin settings.
        Uses custom margin if set, otherwise global margin.
        """
        if cost is None:
            cost = self.current_cost
        
        if cost is None:
            return None
        
        # Use custom margin if configured
        if self.custom_margin_value is not None:
            if self.custom_margin_type == 'flat':
                return cost + self.custom_margin_value
            else:  # percentage
                return cost * (1 + self.custom_margin_value / 100)
        
        # Fall back to global margin
        from apps.pricing.models import GlobalSettings
        try:
            settings = GlobalSettings.get_settings()
            return cost * (1 + settings.default_margin_percentage / 100)
        except:
            return cost  # No margin if settings not configured
    
    def get_latest_purchase(self):
        """Get the most recent purchase price history."""
        return self.price_history.order_by('-created_at').first()
    
    def get_supplier_price_history(self):
        """Get price history grouped by supplier."""
        from apps.pricing.models import PriceHistory
        return PriceHistory.objects.filter(book=self).select_related('supplier').order_by('-created_at')
