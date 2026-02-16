"""
Customers models - Customer management with multilingual support
"""
from django.db import models
from django.contrib.postgres.indexes import GinIndex, BTreeIndex
from django.db.models import Q, Sum, F
from apps.core.models import TimeStampedModel
import uuid
from datetime import datetime, timedelta


class Customer(TimeStampedModel):
    """
    Customer model with support for Hebrew and English names.
    Searchable by name, phone, address.
    """
    
    # Names in both languages
    first_name_en = models.CharField('First Name (English)', max_length=100, blank=True)
    last_name_en = models.CharField('Last Name (English)', max_length=100, blank=True)
    first_name_he = models.CharField('First Name (Hebrew)', max_length=100, blank=True)
    last_name_he = models.CharField('Last Name (Hebrew)', max_length=100, blank=True)
    
    # Contact information
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, db_index=True)
    phone_secondary = models.CharField('Secondary Phone', max_length=20, blank=True)
    
    # Address
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    
    # Additional info
    notes = models.TextField(blank=True)
    
    # Marketing preferences
    email_notifications = models.BooleanField(default=True)
    
    class Meta:
        verbose_name = 'Customer'
        verbose_name_plural = 'Customers'
        ordering = ['last_name_en', 'first_name_en']
        indexes = [
            models.Index(fields=['phone']),
            models.Index(fields=['last_name_en', 'first_name_en']),
            models.Index(fields=['last_name_he', 'first_name_he']),
        ]
    
    def __str__(self):
        # Prefer English name, fall back to Hebrew
        if self.first_name_en or self.last_name_en:
            return f"{self.first_name_en} {self.last_name_en}".strip()
        elif self.first_name_he or self.last_name_he:
            return f"{self.first_name_he} {self.last_name_he}".strip()
        else:
            return f"Customer #{self.id}"
    
    def get_full_name_en(self):
        """Get full name in English."""
        return f"{self.first_name_en} {self.last_name_en}".strip()
    
    def get_full_name_he(self):
        """Get full name in Hebrew."""
        return f"{self.first_name_he} {self.last_name_he}".strip()
    
    def get_lifetime_value(self):
        """Calculate total purchase value for this customer."""
        from django.db.models import Sum
        total = self.orders.aggregate(total=Sum('total'))['total']
        return total or 0
    
    def get_order_count(self):
        """Get total number of orders for this customer."""
        return self.orders.count()
    
    @classmethod
    def search(cls, query):
        """
        Search customers by name (both languages), phone, or address.
        """
        if not query:
            return cls.objects.all()
        
        return cls.objects.filter(
            Q(first_name_en__icontains=query) |
            Q(last_name_en__icontains=query) |
            Q(first_name_he__icontains=query) |
            Q(last_name_he__icontains=query) |
            Q(phone__icontains=query) |
            Q(phone_secondary__icontains=query) |
            Q(address__icontains=query) |
            Q(email__icontains=query)
        ).distinct()

class GiftCard(TimeStampedModel):
    """
    Gift card system for tracking prepaid balances.
    Can be purchased as gifts or loaded with store credit.
    """
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('used', 'Fully Used'),
        ('expired', 'Expired'),
        ('cancelled', 'Cancelled'),
    ]
    
    # Card identification
    card_number = models.CharField(
        max_length=20,
        unique=True,
        db_index=True,
        help_text='Gift card number (e.g., GC-XXXX-XXXX-XXXX)'
    )
    
    pin = models.CharField(
        max_length=6,
        blank=True,
        help_text='Optional PIN for security'
    )
    
    # Ownership
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='gift_cards',
        help_text='Current card holder'
    )
    
    purchaser = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='purchased_gift_cards',
        help_text='Person who originally purchased the card'
    )
    
    # Financial
    initial_balance = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Starting balance when card was issued'
    )
    
    current_balance = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Current available balance'
    )
    
    # Status and dates
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active',
        db_index=True
    )
    
    issued_date = models.DateTimeField(auto_now_add=True)
    expiry_date = models.DateField(
        null=True,
        blank=True,
        help_text='Expiration date (if applicable)'
    )
    
    last_used = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Last transaction date'
    )
    
    # Metadata
    notes = models.TextField(
        blank=True,
        help_text='Gift message or notes'
    )
    
    class Meta:
        verbose_name = 'Gift Card'
        verbose_name_plural = 'Gift Cards'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['card_number']),
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['customer']),
        ]
    
    def __str__(self):
        return f"{self.card_number} - Balance: ${self.current_balance:.2f}"
    
    def save(self, *args, **kwargs):
        """Auto-generate card number if not set."""
        if not self.card_number:
            # Generate format: GC-XXXX-XXXX-XXXX
            unique_code = uuid.uuid4().hex[:12].upper()
            self.card_number = f"GC-{unique_code[:4]}-{unique_code[4:8]}-{unique_code[8:12]}"
        
        # Auto-update status based on balance
        if self.current_balance <= 0 and self.status == 'active':
            self.status = 'used'
        
        super().save(*args, **kwargs)
    
    def is_valid(self):
        """Check if gift card is valid and can be used."""
        if self.status != 'active':
            return False, f"Card is {self.status}"
        
        if self.current_balance <= 0:
            return False, "Card has no remaining balance"
        
        if self.expiry_date and self.expiry_date < datetime.now().date():
            self.status = 'expired'
            self.save()
            return False, "Card has expired"
        
        return True, "Card is valid"
    
    def deduct(self, amount, description=''):
        """
        Deduct an amount from the gift card.
        Returns the actual amount deducted (may be less than requested if insufficient balance).
        """
        if not self.is_valid()[0]:
            return 0
        
        # Deduct up to available balance
        deduction = min(amount, self.current_balance)
        self.current_balance -= deduction
        self.last_used = datetime.now()
        self.save()
        
        # Record the transaction
        GiftCardTransaction.objects.create(
            gift_card=self,
            transaction_type='debit',
            amount=deduction,
            balance_after=self.current_balance,
            description=description
        )
        
        return deduction
    
    def add_balance(self, amount, description=''):
        """Add balance to the gift card (reload/refund)."""
        self.current_balance += amount
        if self.status in ['used', 'expired']:
            self.status = 'active'
        self.save()
        
        # Record the transaction
        GiftCardTransaction.objects.create(
            gift_card=self,
            transaction_type='credit',
            amount=amount,
            balance_after=self.current_balance,
            description=description
        )
    
    def get_transaction_history(self):
        """Get all transactions for this gift card."""
        return self.transactions.order_by('-created_at')


class GiftCardTransaction(TimeStampedModel):
    """
    Transaction history for gift cards.
    """
    
    TRANSACTION_TYPE_CHOICES = [
        ('credit', 'Credit (Load/Refund)'),
        ('debit', 'Debit (Purchase)'),
    ]
    
    gift_card = models.ForeignKey(
        GiftCard,
        on_delete=models.CASCADE,
        related_name='transactions'
    )
    
    transaction_type = models.CharField(
        max_length=10,
        choices=TRANSACTION_TYPE_CHOICES
    )
    
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )
    
    balance_after = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Balance after this transaction'
    )
    
    # Optional link to order if used for purchase
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='gift_card_transactions'
    )
    
    description = models.CharField(
        max_length=255,
        blank=True
    )
    
    class Meta:
        verbose_name = 'Gift Card Transaction'
        verbose_name_plural = 'Gift Card Transactions'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.get_transaction_type_display()} - ${self.amount:.2f} on {self.gift_card.card_number}"

class CustomerPayment(TimeStampedModel):
    ""
    Track payments made by customers.
    Can be linked to specific orders or kept as store credit.
    ""
    
    PAYMENT_METHOD_CHOICES = [
        ('cash', 'Cash'),
        ('credit_card', 'Credit Card'),
        ('debit_card', 'Debit Card'),
        ('bank_transfer', 'Bank Transfer'),
        ('check', 'Check'),
        ('gift_card', 'Gift Card'),
        ('store_credit', 'Store Credit'),
        ('other', 'Other'),
    ]
    
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='payments'
    )
    
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Payment amount'
    )
    
    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_METHOD_CHOICES
    )
    
    payment_date = models.DateTimeField(auto_now_add=True)
    
    reference_number = models.CharField(
        max_length=100,
        blank=True,
        help_text='Check number, transaction ID, etc.'
    )
    
    # Link to order if this payment is for a specific order
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='customer_payments',
        help_text='Specific order this payment is for (if any)'
    )
    
    is_applied = models.BooleanField(
        default=False,
        help_text='Has this payment been applied to an order?'
    )
    
    notes = models.TextField(blank=True)
    
    class Meta:
        verbose_name = 'Customer Payment'
        verbose_name_plural = 'Customer Payments'
        ordering = ['-payment_date']
        indexes = [
            models.Index(fields=['customer', '-payment_date']),
            models.Index(fields=['order']),
            models.Index(fields=['-payment_date']),
        ]
    
    def __str__(self):
        return f"{self.customer} - {self.amount:.2f} ({self.get_payment_method_display()})"
    
    def apply_to_order(self, order=None):
        ""Apply this payment to an order.""
        if not order and self.order:
            order = self.order
        
        if order and not self.is_applied:
            order.add_payment(
                amount=self.amount,
                method=self.get_payment_method_display(),
                notes=f"Payment #{self.id} - {self.reference_number}"
            )
            self.is_applied = True
            self.order = order
            self.save()
