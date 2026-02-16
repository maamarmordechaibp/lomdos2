from django.contrib import admin
from .models import Customer, GiftCard, GiftCardTransaction, CustomerPayment


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ['get_full_name', 'phone', 'email', 'city', 'get_order_count', 'created_at']
    list_filter = ['city', 'email_notifications', 'created_at']
    search_fields = ['first_name_en', 'last_name_en', 'first_name_he', 'last_name_he', 
                     'phone', 'email', 'address']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('English Name', {
            'fields': ('first_name_en', 'last_name_en')
        }),
        ('Hebrew Name', {
            'fields': ('first_name_he', 'last_name_he')
        }),
        ('Contact Information', {
            'fields': ('email', 'phone', 'phone_secondary')
        }),
        ('Address', {
            'fields': ('address', 'city', 'postal_code')
        }),
        ('Preferences', {
            'fields': ('email_notifications', 'notes')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_full_name(self, obj):
        return str(obj)
    get_full_name.short_description = 'Name'
    
    def get_order_count(self, obj):
        return obj.get_order_count()
    get_order_count.short_description = 'Orders'


class GiftCardTransactionInline(admin.TabularInline):
    model = GiftCardTransaction
    extra = 0
    readonly_fields = ['created_at', 'transaction_type', 'amount', 'balance_after', 'order', 'description']
    can_delete = False
    
    def has_add_permission(self, request, obj=None):
        return False


@admin.register(GiftCard)
class GiftCardAdmin(admin.ModelAdmin):
    list_display = ['card_number', 'customer', 'current_balance', 'initial_balance', 
                    'status', 'issued_date', 'expiry_date']
    list_filter = ['status', 'issued_date', 'expiry_date']
    search_fields = ['card_number', 'customer__first_name_en', 'customer__last_name_en', 
                     'customer__phone', 'notes']
    readonly_fields = ['issued_date', 'last_used', 'created_at', 'updated_at']
    inlines = [GiftCardTransactionInline]
    
    fieldsets = (
        ('Card Information', {
            'fields': ('card_number', 'pin', 'status')
        }),
        ('Ownership', {
            'fields': ('customer', 'purchaser')
        }),
        ('Balance', {
            'fields': ('initial_balance', 'current_balance')
        }),
        ('Dates', {
            'fields': ('issued_date', 'expiry_date', 'last_used')
        }),
        ('Notes', {
            'fields': ('notes',)
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    actions = ['activate_cards', 'cancel_cards']
    
    def activate_cards(self, request, queryset):
        queryset.update(status='active')
        self.message_user(request, f'{queryset.count()} cards activated.')
    activate_cards.short_description = 'Activate selected gift cards'
    
    def cancel_cards(self, request, queryset):
        queryset.update(status='cancelled')
        self.message_user(request, f'{queryset.count()} cards cancelled.')
    cancel_cards.short_description = 'Cancel selected gift cards'


@admin.register(GiftCardTransaction)
class GiftCardTransactionAdmin(admin.ModelAdmin):
    list_display = ['gift_card', 'transaction_type', 'amount', 'balance_after', 
                    'order', 'created_at']
    list_filter = ['transaction_type', 'created_at']
    search_fields = ['gift_card__card_number', 'description']
    readonly_fields = ['created_at']
    date_hierarchy = 'created_at'


@admin.register(CustomerPayment)
class CustomerPaymentAdmin(admin.ModelAdmin):
    list_display = ['customer', 'amount', 'payment_method', 'payment_date', 
                    'order', 'is_applied', 'reference_number']
    list_filter = ['payment_method', 'is_applied', 'payment_date']
    search_fields = ['customer__first_name_en', 'customer__last_name_en', 
                     'customer__phone', 'reference_number', 'notes']
    readonly_fields = ['payment_date', 'created_at', 'updated_at']
    date_hierarchy = 'payment_date'
    raw_id_fields = ['customer', 'order']
    
    fieldsets = (
        ('Payment Information', {
            'fields': ('customer', 'amount', 'payment_method', 'payment_date')
        }),
        ('Link to Order', {
            'fields': ('order', 'is_applied')
        }),
        ('Details', {
            'fields': ('reference_number', 'notes')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    actions = ['apply_payments_to_orders']
    
    def apply_payments_to_orders(self, request, queryset):
        """Apply selected payments to their linked orders."""
        applied = 0
        for payment in queryset.filter(is_applied=False, order__isnull=False):
            payment.apply_to_order()
            applied += 1
        self.message_user(request, f'{applied} payments applied to orders.')
    apply_payments_to_orders.short_description = 'Apply payments to linked orders'
