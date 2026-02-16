"""
Orders models - Customer orders and order items
"""
from django.db import models
from django.db.models import Sum, F
from apps.core.models import TimeStampedModel


class Order(TimeStampedModel):
    """
    Customer order (sales order).
    """
    
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    
    PAYMENT_STATUS_CHOICES = [
        ('unpaid', 'Unpaid'),
        ('deposit', 'Deposit Paid'),
        ('partial', 'Partially Paid'),
        ('paid', 'Fully Paid'),
    ]
    
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.PROTECT,
        related_name='orders'
    )
    
    order_number = models.CharField(
        max_length=50,
        unique=True,
        db_index=True
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft',
        db_index=True
    )
    
    # Dates
    order_date = models.DateTimeField(auto_now_add=True)
    completed_date = models.DateTimeField(null=True, blank=True)
    
    # Financial
    subtotal = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )
    
    tax = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )
    
    total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )
    
    # Payment
    payment_method = models.CharField(
        max_length=50,
        blank=True,
        help_text='Cash, Credit Card, Bank Transfer, etc.'
    )
    
    paid = models.BooleanField(default=False)
    payment_date = models.DateTimeField(null=True, blank=True)
    
    # POS Payment Tracking
    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default='unpaid',
        db_index=True,
        help_text='Current payment status'
    )
    
    deposit_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text='Deposit/advance payment'
    )
    
    amount_paid = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text='Total amount paid by customer'
    )
    
    payment_notes = models.TextField(
        blank=True,
        help_text='Payment history and notes'
    )
    
    # Notes
    notes = models.TextField(blank=True)
    
    class Meta:
        verbose_name = 'Order'
        verbose_name_plural = 'Orders'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['order_number']),
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['customer', '-created_at']),
        ]
    
    def __str__(self):
        return f"Order #{self.order_number} - {self.customer}"
    
    def calculate_totals(self):
        """Calculate subtotal and total from order items."""
        subtotal = self.items.aggregate(
            total=Sum(F('quantity') * F('unit_price'))
        )['total'] or 0
        
        # Calculate total with tax
        total = subtotal + self.tax
        
        return subtotal, total
    
    def update_totals(self):
        """Update financial fields."""
        self.subtotal, self.total = self.calculate_totals()
        self.save(update_fields=['subtotal', 'total'])
    
    def get_profit(self):
        """Calculate total profit for this order."""
        profit = self.items.aggregate(
            total=Sum((F('unit_price') - F('unit_cost')) * F('quantity'))
        )['total']
        return profit or 0
    
    def get_total_quantity(self):
        """Get total quantity of all items in order."""
        return self.items.aggregate(total=Sum('quantity'))['total'] or 0
    
    def get_balance_due(self):
        """Calculate outstanding balance."""
        return max(self.total - self.amount_paid, 0)
    
    def update_payment_status(self):
        """Automatically update payment status based on amount paid."""
        if self.amount_paid == 0:
            self.payment_status = 'unpaid'
            self.paid = False
        elif self.amount_paid >= self.total:
            self.payment_status = 'paid'
            self.paid = True
        elif self.deposit_amount > 0 and self.amount_paid == self.deposit_amount:
            self.payment_status = 'deposit'
            self.paid = False
        else:
            self.payment_status = 'partial'
            self.paid = False
        self.save(update_fields=['payment_status', 'paid'])
    
    def add_payment(self, amount, method='', notes=''):
        """Record a payment for this order."""
        from django.utils import timezone
        self.amount_paid += amount
        if not self.payment_method:
            self.payment_method = method
        if notes:
            timestamp = timezone.now().strftime('%Y-%m-%d %H:%M')
            self.payment_notes += f"\n[{timestamp}] {method}: ${amount} - {notes}".strip()
        self.update_payment_status()
        return self.get_balance_due()
    
    def save(self, *args, **kwargs):
        """Auto-generate order number if not set."""
        if not self.order_number:
            import uuid
            from django.utils import timezone
            # Format: ORD-YYYYMMDD-XXXX (random 4 chars)
            date_str = timezone.now().strftime('%Y%m%d')
            unique_id = uuid.uuid4().hex[:6].upper()
            self.order_number = f'ORD-{date_str}-{unique_id}'
        super().save(*args, **kwargs)


class OrderItem(TimeStampedModel):
    """
    Individual book in a customer order.
    """
    
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='items'
    )
    
    book = models.ForeignKey(
        'books.Book',
        on_delete=models.PROTECT,
        related_name='order_items'
    )
    
    quantity = models.PositiveIntegerField(default=1)
    
    unit_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Our cost (from supplier)'
    )
    
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Selling price to customer'
    )
    
    original_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Original price before discount'
    )
    
    discount_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        help_text='Discount percentage applied'
    )
    
    # For tracking supplier orders that need to be placed
    needs_ordering = models.BooleanField(
        default=False,
        help_text='Does this item need to be ordered from supplier?'
    )
    
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text='Supplier to order from'
    )
    
    # Link to supplier order when placed
    supplier_order = models.ForeignKey(
        'suppliers.SupplierOrder',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='customer_order_items'
    )
    
    # Receiving tracking
    is_received = models.BooleanField(
        default=False,
        help_text='Has this item been received from supplier?'
    )
    received_date = models.DateTimeField(null=True, blank=True)
    actual_supplier_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Actual cost from supplier (may differ from quoted)'
    )
    customer_notified = models.BooleanField(
        default=False,
        help_text='Has customer been notified of book arrival?'
    )
    customer_notified_at = models.DateTimeField(null=True, blank=True)
    
    notes = models.TextField(blank=True)
    
    class Meta:
        verbose_name = 'Order Item'
        verbose_name_plural = 'Order Items'
        unique_together = ['order', 'book']
    
    def __str__(self):
        book_title = self.book.safe_translation_getter('title', any_language=True)
        return f"{self.quantity}x {book_title}"
    
    def get_total_price(self):
        """Get total selling price for this line item."""
        return self.quantity * self.unit_price
    
    def get_subtotal(self):
        """Alias for get_total_price for template compatibility."""
        return self.get_total_price()
    
    def get_total_cost(self):
        """Get total cost for this line item."""
        return self.quantity * self.unit_cost
    
    def get_profit(self):
        """Get profit for this line item."""
        return (self.unit_price - self.unit_cost) * self.quantity
    
    def get_discount_amount(self):
        """Get total discount amount for this line item."""
        if self.original_price and self.original_price > self.unit_price:
            return (self.original_price - self.unit_price) * self.quantity
        return 0
    
    def has_discount(self):
        """Check if this item has a discount."""
        return self.original_price and self.original_price > self.unit_price
