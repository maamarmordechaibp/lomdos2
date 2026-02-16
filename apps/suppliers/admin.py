from django.contrib import admin
from parler.admin import TranslatableAdmin
from .models import Supplier, SupplierOrder, SupplierOrderItem


@admin.register(Supplier)
class SupplierAdmin(TranslatableAdmin):
    list_display = ['name', 'email', 'phone', 'is_active', 'get_orders_count', 'created_at']
    list_filter = ['is_active', 'country', 'created_at']
    search_fields = ['translations__name', 'email', 'phone']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'description', 'is_active')
        }),
        ('Contact', {
            'fields': ('email', 'email_cc', 'phone', 'website')
        }),
        ('Address', {
            'fields': ('address', 'city', 'country')
        }),
        ('Business Details', {
            'fields': ('tax_id', 'payment_terms')
        }),
        ('Notes', {
            'fields': ('notes',)
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_orders_count(self, obj):
        return obj.get_total_orders_count()
    get_orders_count.short_description = 'Total Orders'


class SupplierOrderItemInline(admin.TabularInline):
    model = SupplierOrderItem
    extra = 1
    fields = ['book', 'quantity', 'unit_cost', 'received_quantity', 'notes']
    raw_id_fields = ['book']


@admin.register(SupplierOrder)
class SupplierOrderAdmin(admin.ModelAdmin):
    list_display = ['order_number', 'supplier', 'status', 'total_cost', 
                    'order_date', 'expected_date', 'email_sent']
    list_filter = ['status', 'email_sent', 'order_date', 'supplier']
    search_fields = ['order_number', 'supplier__translations__name']
    readonly_fields = ['order_date', 'created_at', 'updated_at', 'email_sent_at', 
                      'sent_date', 'received_date']
    date_hierarchy = 'order_date'
    inlines = [SupplierOrderItemInline]
    
    fieldsets = (
        ('Order Information', {
            'fields': ('order_number', 'supplier', 'status')
        }),
        ('Dates', {
            'fields': ('order_date', 'sent_date', 'expected_date', 'received_date')
        }),
        ('Financial', {
            'fields': ('total_cost',)
        }),
        ('Email Tracking', {
            'fields': ('email_sent', 'email_sent_at')
        }),
        ('Notes', {
            'fields': ('notes',)
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        obj.update_total()
