from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
from django.views.generic import ListView, DetailView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.db.models import Sum, Count
from dal import autocomplete
from .models import Customer
from apps.orders.models import Order


class CustomerListView(LoginRequiredMixin, ListView):
    """List all customers with their order statistics."""
    model = Customer
    template_name = 'customers/customer_list.html'
    context_object_name = 'customers'
    paginate_by = 50
    
    def get_queryset(self):
        qs = Customer.objects.annotate(
            total_orders=Count('orders'),
            total_spent=Sum('orders__total')
        ).order_by('-created_at')
        
        # Search functionality
        search = self.request.GET.get('search')
        if search:
            qs = Customer.search(search)
        
        return qs


class CustomerDetailView(LoginRequiredMixin, DetailView):
    """Detailed view of a customer with order history and payments."""
    model = Customer
    template_name = 'customers/customer_detail.html'
    context_object_name = 'customer'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        customer = self.get_object()
        
        # Get customer orders
        orders = Order.objects.filter(customer=customer).order_by('-created_at')
        
        # Calculate statistics
        context['orders'] = orders
        context['total_orders'] = orders.count()
        context['total_spent'] = orders.filter(status='completed').aggregate(
            total=Sum('total')
        )['total'] or 0
        context['pending_orders'] = orders.filter(status='pending').count()
        context['completed_orders'] = orders.filter(status='completed').count()
        
        return context


class CustomerAutocomplete(autocomplete.Select2QuerySetView):
    """
    Autocomplete view for customer search.
    Searches by first name, last name (both languages), phone, and address.
    """
    
    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return Customer.objects.none()
        
        qs = Customer.objects.all()
        
        if self.q:
            qs = Customer.search(self.q)
        
        return qs
    
    def get_result_label(self, result):
        """Custom label format for autocomplete results."""
        name = str(result)
        phone = result.phone if result.phone else ''
        return f"{name} - {phone}" if phone else name
    
    def has_add_permission(self, request):
        """Allow adding new customers."""
        return request.user.is_authenticated


@login_required
@require_POST
def create_customer_ajax(request):
    """Create a new customer via AJAX."""
    try:
        customer = Customer.objects.create(
            first_name_en=request.POST.get('first_name_en', ''),
            last_name_en=request.POST.get('last_name_en', ''),
            first_name_he=request.POST.get('first_name_he', ''),
            last_name_he=request.POST.get('last_name_he', ''),
            phone=request.POST.get('phone', ''),
            email=request.POST.get('email', ''),
            address=request.POST.get('address', ''),
        )
        return JsonResponse({
            'success': True,
            'customer': {
                'id': customer.id,
                'name': str(customer),
                'phone': customer.phone,
            }
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)
