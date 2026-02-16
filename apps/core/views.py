from django.shortcuts import render, redirect
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import timedelta

from apps.orders.models import Order
from apps.books.models import Book
from apps.customers.models import Customer
from apps.suppliers.models import SupplierOrder


class HomeView(TemplateView):
    """Dashboard home page with statistics."""
    template_name = 'core/home.html'
    
    def dispatch(self, request, *args, **kwargs):
        # Redirect to admin login if not authenticated
        if not request.user.is_authenticated:
            return redirect('/admin/login/?next=/')
        return super().dispatch(request, *args, **kwargs)
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        
        # Get date ranges
        today = timezone.now().date()
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)
        
        # Orders statistics
        context['total_orders'] = Order.objects.count()
        context['pending_orders'] = Order.objects.filter(status='pending').count()
        context['completed_orders'] = Order.objects.filter(status='completed').count()
        context['week_orders'] = Order.objects.filter(created_at__date__gte=week_ago).count()
        
        # Revenue statistics
        total_revenue = Order.objects.filter(status='completed').aggregate(total=Sum('total'))['total'] or 0
        week_revenue = Order.objects.filter(status='completed', created_at__date__gte=week_ago).aggregate(total=Sum('total'))['total'] or 0
        context['total_revenue'] = total_revenue
        context['week_revenue'] = week_revenue
        
        # Inventory statistics
        context['total_books'] = Book.objects.count()
        context['low_stock_books'] = Book.objects.filter(stock_quantity__lt=5).count()
        context['pending_supplier_books'] = Book.objects.filter(notes__icontains='pending supplier assignment').count()
        
        # Customer statistics
        context['total_customers'] = Customer.objects.count()
        context['new_customers_week'] = Customer.objects.filter(created_at__date__gte=week_ago).count()
        
        # Recent orders
        context['recent_orders'] = Order.objects.select_related('customer').order_by('-created_at')[:10]
        
        # Pending supplier orders
        context['pending_supplier_orders'] = SupplierOrder.objects.filter(
            status__in=['pending', 'sent']
        ).select_related('supplier').order_by('-created_at')[:5]
        
        # Books pending supplier assignment
        context['books_needing_supplier'] = Book.objects.filter(
            notes__icontains='pending supplier assignment'
        ).order_by('-created_at')[:5]
        
        return context
