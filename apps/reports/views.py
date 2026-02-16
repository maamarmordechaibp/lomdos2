from django.shortcuts import render
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import timedelta
from apps.orders.models import Order
from apps.suppliers.models import SupplierOrder
from apps.customers.models import Customer


class FinancialReportView(LoginRequiredMixin, TemplateView):
    """Financial reports showing income and expenses."""
    template_name = 'reports/financial.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        
        # Date range filter
        today = timezone.now().date()
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)
        year_ago = today - timedelta(days=365)
        
        # Customer orders (income)
        customer_orders = Order.objects.filter(status='completed')
        context['total_income'] = customer_orders.aggregate(total=Sum('total'))['total'] or 0
        context['week_income'] = customer_orders.filter(created_at__date__gte=week_ago).aggregate(total=Sum('total'))['total'] or 0
        context['month_income'] = customer_orders.filter(created_at__date__gte=month_ago).aggregate(total=Sum('total'))['total'] or 0
        context['year_income'] = customer_orders.filter(created_at__date__gte=year_ago).aggregate(total=Sum('total'))['total'] or 0
        
        # Supplier orders (expenses)
        supplier_orders = SupplierOrder.objects.filter(status='received')
        context['total_expenses'] = supplier_orders.aggregate(total=Sum('total_cost'))['total'] or 0
        context['week_expenses'] = supplier_orders.filter(created_at__date__gte=week_ago).aggregate(total=Sum('total_cost'))['total'] or 0
        context['month_expenses'] = supplier_orders.filter(created_at__date__gte=month_ago).aggregate(total=Sum('total_cost'))['total'] or 0
        context['year_expenses'] = supplier_orders.filter(created_at__date__gte=year_ago).aggregate(total=Sum('total_cost'))['total'] or 0
        
        # Profit calculation
        context['total_profit'] = context['total_income'] - context['total_expenses']
        context['week_profit'] = context['week_income'] - context['week_expenses']
        context['month_profit'] = context['month_income'] - context['month_expenses']
        context['year_profit'] = context['year_income'] - context['year_expenses']
        
        # Recent transactions
        context['recent_customer_orders'] = Order.objects.filter(status='completed').order_by('-created_at')[:10]
        context['recent_supplier_orders'] = SupplierOrder.objects.filter(status='received').order_by('-created_at')[:10]
        
        return context


class PaymentsView(LoginRequiredMixin, TemplateView):
    """View showing all payments to suppliers and from customers."""
    template_name = 'reports/payments.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        
        # Payments from customers
        customer_orders = Order.objects.select_related('customer').order_by('-created_at')
        context['customer_payments'] = customer_orders[:50]
        
        # Payments to suppliers
        supplier_orders = SupplierOrder.objects.select_related('supplier').order_by('-created_at')
        context['supplier_payments'] = supplier_orders[:50]
        
        # Summary
        context['total_received'] = customer_orders.filter(status='completed').aggregate(total=Sum('total'))['total'] or 0
        context['pending_from_customers'] = customer_orders.filter(status='pending').aggregate(total=Sum('total'))['total'] or 0
        context['total_paid_to_suppliers'] = supplier_orders.filter(status='received').aggregate(total=Sum('total_cost'))['total'] or 0
        context['pending_to_suppliers'] = supplier_orders.filter(status__in=['pending', 'sent']).aggregate(total=Sum('total_cost'))['total'] or 0
        
        return context

