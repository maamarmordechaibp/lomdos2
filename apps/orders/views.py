from django.shortcuts import render, redirect, get_object_or_404
from django.views.generic import ListView, CreateView, UpdateView, DetailView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.urls import reverse_lazy
from django.http import JsonResponse
from django.db import transaction
from django.db.models import Q
from django.contrib import messages

from .models import Order, OrderItem
from apps.books.models import Book
from apps.customers.models import Customer
from apps.suppliers.models import Supplier


class OrderListView(LoginRequiredMixin, ListView):
    """List all orders with filtering."""
    model = Order
    template_name = 'orders/order_list.html'
    context_object_name = 'orders'
    paginate_by = 20
    
    def get_queryset(self):
        queryset = Order.objects.select_related('customer').prefetch_related('items__book').order_by('-created_at')
        
        # Filter by status
        status = self.request.GET.get('status')
        if status:
            queryset = queryset.filter(status=status)
        
        # Search
        search = self.request.GET.get('search')
        if search:
            queryset = queryset.filter(
                Q(order_number__icontains=search) |
                Q(customer__first_name_en__icontains=search) |
                Q(customer__last_name_en__icontains=search) |
                Q(customer__phone__icontains=search)
            )
        
        return queryset


class OrderCreateView(LoginRequiredMixin, CreateView):
    """Create a new order."""
    model = Order
    template_name = 'orders/order_form.html'
    fields = ['customer', 'notes']
    success_url = reverse_lazy('orders:order_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['customers'] = Customer.objects.all()
        context['books'] = Book.objects.select_related('publisher').prefetch_related('authors')
        context['suppliers'] = Supplier.objects.all()
        return context
    
    def form_valid(self, form):
        with transaction.atomic():
            self.object = form.save()
            
            # Process order items from POST data
            book_ids = self.request.POST.getlist('book_id[]')
            quantities = self.request.POST.getlist('quantity[]')
            prices = self.request.POST.getlist('price[]')
            supplier_ids = self.request.POST.getlist('supplier_id[]')
            
            for book_id, quantity, price, supplier_id in zip(book_ids, quantities, prices, supplier_ids):
                if book_id and quantity:
                    book = Book.objects.get(pk=book_id)
                    # Use supplier from form, or fall back to book's default supplier
                    supplier = None
                    if supplier_id:
                        supplier = Supplier.objects.get(pk=supplier_id)
                    elif book.default_supplier:
                        supplier = book.default_supplier
                    
                    # Get unit cost from book or default to 0
                    unit_cost = getattr(book, 'current_cost', None) or getattr(book, 'cost', 0) or 0
                    
                    # Handle optional price - use book price if not provided
                    if not price or price == '':
                        unit_price = getattr(book, 'current_price', None) or getattr(book, 'price', 0) or 0
                    else:
                        unit_price = float(price)
                    
                    # Check if book needs ordering (no stock)
                    needs_ordering = book.stock_quantity < int(quantity)
                    
                    OrderItem.objects.create(
                        order=self.object,
                        book=book,
                        quantity=int(quantity),
                        unit_price=unit_price,
                        unit_cost=float(unit_cost) if unit_cost else 0,
                        supplier=supplier,
                        needs_ordering=needs_ordering
                    )
            
            # Update totals
            self.object.update_totals()
            
            # Process payment if any
            amount_paid = self.request.POST.get('amount_paid', '0')
            payment_method = self.request.POST.get('payment_method', '')
            
            try:
                amount_paid = float(amount_paid) if amount_paid else 0
            except (ValueError, TypeError):
                amount_paid = 0
            
            if amount_paid > 0:
                self.object.amount_paid = amount_paid
                self.object.deposit_amount = amount_paid  # Track as deposit
                self.object.payment_method = payment_method
                self.object.update_payment_status()
            
        messages.success(self.request, f'Order {self.object.order_number} created successfully!')
        return redirect(self.success_url)


class OrderDetailView(LoginRequiredMixin, DetailView):
    """View order details."""
    model = Order
    template_name = 'orders/order_detail.html'
    context_object_name = 'order'
    
    def get_queryset(self):
        return Order.objects.select_related('customer').prefetch_related(
            'items__book__authors',
            'items__supplier'
        )


class RecordPaymentView(LoginRequiredMixin, DetailView):
    """Record payment for an order."""
    model = Order
    template_name = 'orders/record_payment.html'
    context_object_name = 'order'
    
    def post(self, request, *args, **kwargs):
        order = self.get_object()
        amount = float(request.POST.get('amount', 0))
        method = request.POST.get('method', '')
        notes = request.POST.get('notes', '')
        is_deposit = request.POST.get('is_deposit') == 'on'
        
        if amount <= 0:
            messages.error(request, 'Payment amount must be greater than 0')
            return redirect('orders:record_payment', pk=order.pk)
        
        # Record deposit if checked
        if is_deposit and order.deposit_amount == 0:
            order.deposit_amount = amount
            order.save(update_fields=['deposit_amount'])
        
        # Add payment
        balance = order.add_payment(amount, method, notes)
        
        if balance == 0:
            messages.success(request, f'Payment recorded! Order is now fully paid.')
        else:
            messages.success(request, f'Payment of ${amount:.2f} recorded. Balance remaining: ${balance:.2f}')
        
        return redirect('orders:order_detail', pk=order.pk)
