from django.contrib import admin
from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 1
    fields = ['book', 'quantity', 'unit_cost', 'unit_price', 'needs_ordering', 
              'supplier', 'supplier_order']
    raw_id_fields = ['book', 'supplier', 'supplier_order']


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['order_number', 'customer', 'status', 'total', 'paid', 
                    'order_date', 'get_profit']
    list_filter = ['status', 'paid', 'payment_method', 'order_date']
    search_fields = ['order_number', 'customer__first_name_en', 'customer__last_name_en',
                     'customer__phone']
    readonly_fields = ['order_date', 'created_at', 'updated_at', 'completed_date', 
                      'payment_date', 'subtotal', 'total']
    date_hierarchy = 'order_date'
    inlines = [OrderItemInline]
    
    fieldsets = (
        ('Order Information', {
            'fields': ('order_number', 'customer', 'status')
        }),
        ('Dates', {
            'fields': ('order_date', 'completed_date')
        }),
        ('Financial', {
            'fields': ('subtotal', 'tax', 'total')
        }),
        ('Payment', {
            'fields': ('payment_method', 'paid', 'payment_date')
        }),
        ('Notes', {
            'fields': ('notes',)
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_profit(self, obj):
        profit = obj.get_profit()
        return f"${profit:.2f}"
    get_profit.short_description = 'Profit'
    
    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        obj.update_totals()
