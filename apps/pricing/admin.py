from django.contrib import admin
from .models import GlobalSettings, PriceHistory


@admin.register(GlobalSettings)
class GlobalSettingsAdmin(admin.ModelAdmin):
    list_display = ['default_margin_percentage', 'currency']
    
    def has_add_permission(self, request):
        # Singleton pattern - only one instance allowed
        return not GlobalSettings.objects.exists()
    
    def has_delete_permission(self, request, obj=None):
        # Cannot delete global settings
        return False


@admin.register(PriceHistory)
class PriceHistoryAdmin(admin.ModelAdmin):
    list_display = ['book', 'supplier', 'purchase_price', 'selling_price', 
                    'profit_margin', 'quantity', 'created_at']
    list_filter = ['supplier', 'created_at']
    search_fields = ['book__translations__title', 'supplier__translations__name']
    readonly_fields = ['created_at', 'updated_at', 'profit_margin']
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Book & Supplier', {
            'fields': ('book', 'supplier')
        }),
        ('Pricing', {
            'fields': ('purchase_price', 'selling_price', 'profit_margin', 'quantity')
        }),
        ('References', {
            'fields': ('supplier_order', 'customer_order')
        }),
        ('Notes', {
            'fields': ('notes',)
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
