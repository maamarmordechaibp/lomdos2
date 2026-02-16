"""
Supplier management views - Order books from suppliers, track arrivals, notify customers
"""
import json
import uuid
from decimal import Decimal
from django.shortcuts import render, get_object_or_404, redirect
from django.views.generic import ListView, DetailView, View, CreateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.db.models import Sum, Count, Q, F
from django.http import JsonResponse
from django.contrib import messages
from django.utils import timezone
from django.urls import reverse_lazy
from django.db import transaction
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings

from .models import Supplier, SupplierOrder, SupplierOrderItem
from apps.orders.models import OrderItem, Order
from apps.books.models import Book


class SupplierListView(LoginRequiredMixin, ListView):
    """List all suppliers with their order statistics."""
    model = Supplier
    template_name = 'suppliers/supplier_list.html'
    context_object_name = 'suppliers'
    paginate_by = 50
    
    def get_queryset(self):
        qs = Supplier.objects.annotate(
            total_orders=Count('orders'),
            total_spent=Sum('orders__total_cost'),
            books_supplied=Count('supplied_books', distinct=True)
        ).order_by('translations__name')
        
        search = self.request.GET.get('search')
        if search:
            qs = qs.filter(translations__name__icontains=search).distinct()
        
        return qs
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        # Count books needing suppliers
        context['pending_assignment_count'] = OrderItem.objects.filter(
            needs_ordering=True, 
            supplier__isnull=True,
            is_received=False
        ).count()
        return context


class SupplierDetailView(LoginRequiredMixin, DetailView):
    """Detailed view of a supplier with order history."""
    model = Supplier
    template_name = 'suppliers/supplier_detail.html'
    context_object_name = 'supplier'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        supplier = self.get_object()
        
        orders = SupplierOrder.objects.filter(supplier=supplier).order_by('-created_at')
        
        context['orders'] = orders
        context['total_orders'] = orders.count()
        context['total_spent'] = orders.aggregate(total=Sum('total_cost'))['total'] or 0
        context['pending_orders'] = orders.filter(status='pending').count()
        context['completed_orders'] = orders.filter(status='received').count()
        context['books'] = supplier.supplied_books.all()
        
        return context


class PendingSupplierBooksView(LoginRequiredMixin, ListView):
    """List all books and order items that need suppliers assigned."""
    template_name = 'suppliers/pending_supplier_books.html'
    context_object_name = 'items'
    paginate_by = 50
    
    def get_queryset(self):
        # Get order items that need ordering (no supplier, not received)
        return OrderItem.objects.filter(
            supplier__isnull=True,
            is_received=False
        ).select_related('order', 'order__customer', 'book').order_by('-created_at')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['suppliers'] = Supplier.objects.filter(is_active=True)
        
        # Also get books without default supplier (for proactive assignment)
        context['books_without_supplier'] = Book.objects.filter(
            default_supplier__isnull=True
        ).order_by('-created_at')
        
        return context


class AssignSupplierView(LoginRequiredMixin, View):
    """Assign a supplier to order items."""
    
    def post(self, request):
        item_ids = request.POST.getlist('item_ids[]')
        supplier_id = request.POST.get('supplier_id')
        cost = request.POST.get('cost')
        margin_type = request.POST.get('margin_type', 'percentage')
        margin_value = request.POST.get('margin_value', '10')
        
        if not item_ids or not supplier_id:
            return JsonResponse({'success': False, 'error': 'Missing item IDs or supplier'})
        
        try:
            supplier = Supplier.objects.get(pk=supplier_id)
            cost = Decimal(cost) if cost else None
            margin_value = Decimal(margin_value) if margin_value else Decimal('10')
            
            # Calculate selling price
            if cost:
                if margin_type == 'percentage':
                    selling_price = cost * (1 + margin_value / 100)
                else:  # flat
                    selling_price = cost + margin_value
            else:
                selling_price = None
            
            with transaction.atomic():
                items = OrderItem.objects.filter(pk__in=item_ids)
                for item in items:
                    item.supplier = supplier
                    item.needs_ordering = True  # Mark as needing ordering
                    if cost:
                        item.unit_cost = cost
                        if selling_price:
                            item.unit_price = selling_price
                    item.save()
                    
                    # Update book's default supplier and prices
                    book = item.book
                    if not book.default_supplier:
                        book.default_supplier = supplier
                    if cost:
                        book.current_cost = cost
                        if selling_price:
                            book.current_price = selling_price
                        book.custom_margin_type = margin_type
                        book.custom_margin_value = margin_value
                    book.save()
            
            return JsonResponse({
                'success': True, 
                'message': f'Assigned {len(item_ids)} items to {supplier}'
            })
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})


class AssignBookSupplierView(LoginRequiredMixin, View):
    """Assign default supplier to books (not order items)."""
    
    def post(self, request):
        book_ids = request.POST.getlist('book_ids[]')
        supplier_id = request.POST.get('supplier_id')
        cost = request.POST.get('cost')
        margin_type = request.POST.get('margin_type', 'percentage')
        margin_value = request.POST.get('margin_value', '10')
        
        if not book_ids or not supplier_id:
            return JsonResponse({'success': False, 'error': 'Missing book IDs or supplier'})
        
        try:
            supplier = Supplier.objects.get(pk=supplier_id)
            cost = Decimal(cost) if cost else None
            margin_value = Decimal(margin_value) if margin_value else Decimal('10')
            
            # Calculate selling price
            if cost:
                if margin_type == 'percentage':
                    selling_price = cost * (1 + margin_value / 100)
                else:  # flat
                    selling_price = cost + margin_value
            else:
                selling_price = None
            
            with transaction.atomic():
                books = Book.objects.filter(pk__in=book_ids)
                for book in books:
                    book.default_supplier = supplier
                    if cost:
                        book.current_cost = cost
                        if selling_price:
                            book.current_price = selling_price
                        book.custom_margin_type = margin_type
                        book.custom_margin_value = margin_value
                    book.save()
            
            return JsonResponse({
                'success': True, 
                'message': f'Set default supplier for {len(book_ids)} books to {supplier}'
            })
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})


class SendBookQuoteRequestView(LoginRequiredMixin, View):
    """Send quote request to suppliers for specific books."""
    
    def post(self, request):
        supplier_ids = request.POST.getlist('supplier_ids[]')
        book_ids = request.POST.getlist('book_ids[]')
        
        if not supplier_ids or not book_ids:
            return JsonResponse({'success': False, 'error': 'Missing suppliers or books'})
        
        try:
            books = Book.objects.filter(pk__in=book_ids)
            suppliers = Supplier.objects.filter(pk__in=supplier_ids)
            
            emails_sent = 0
            errors = []
            
            for supplier in suppliers:
                if not supplier.email:
                    errors.append(f'{supplier.name}: No email address')
                    continue
                    
                try:
                    # Render email
                    html_content = render_to_string('suppliers/emails/book_quote_request.html', {
                        'supplier': supplier,
                        'books': books,
                    })
                    
                    text_content = render_to_string('suppliers/emails/book_quote_request.txt', {
                        'supplier': supplier,
                        'books': books,
                    })
                    
                    subject = 'בקשה להצעת מחיר - ספרי לימוד'
                    from_email = settings.DEFAULT_FROM_EMAIL
                    to_emails = [supplier.email]
                    
                    email = EmailMultiAlternatives(subject, text_content, from_email, to_emails)
                    email.attach_alternative(html_content, "text/html")
                    email.send()
                    emails_sent += 1
                except Exception as e:
                    errors.append(f'{supplier.name}: {str(e)}')
            
            if emails_sent > 0:
                return JsonResponse({
                    'success': True,
                    'message': f'Quote requests sent to {emails_sent} suppliers',
                    'errors': errors if errors else None
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'No emails were sent',
                    'details': errors
                })
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})


class SupplierOrdersView(LoginRequiredMixin, ListView):
    """List items grouped by supplier that need ordering."""
    template_name = 'suppliers/supplier_orders.html'
    context_object_name = 'suppliers_with_items'
    
    def get_queryset(self):
        return None  # We'll handle this in get_context_data
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        
        # Get items that have supplier but not yet ordered
        items_needing_order = OrderItem.objects.filter(
            needs_ordering=True,
            supplier__isnull=False,
            supplier_order__isnull=True,
            is_received=False
        ).select_related('supplier', 'book', 'order', 'order__customer')
        
        # Group by supplier
        suppliers_dict = {}
        for item in items_needing_order:
            supplier = item.supplier
            if supplier.id not in suppliers_dict:
                suppliers_dict[supplier.id] = {
                    'supplier': supplier,
                    'items': [],
                    'total_cost': Decimal('0'),
                    'total_qty': 0
                }
            suppliers_dict[supplier.id]['items'].append(item)
            suppliers_dict[supplier.id]['total_cost'] += item.unit_cost * item.quantity if item.unit_cost else 0
            suppliers_dict[supplier.id]['total_qty'] += item.quantity
        
        context['suppliers_with_items'] = list(suppliers_dict.values())
        context['total_pending'] = items_needing_order.count()
        
        return context


class CreateSupplierOrderView(LoginRequiredMixin, View):
    """Create a supplier order for selected items."""
    
    def post(self, request):
        supplier_id = request.POST.get('supplier_id')
        item_ids = request.POST.getlist('item_ids[]')
        
        if not supplier_id or not item_ids:
            return JsonResponse({'success': False, 'error': 'Missing supplier or items'})
        
        try:
            supplier = Supplier.objects.get(pk=supplier_id)
            items = OrderItem.objects.filter(pk__in=item_ids)
            
            with transaction.atomic():
                # Create supplier order
                date_str = timezone.now().strftime('%Y%m%d')
                unique_id = uuid.uuid4().hex[:6].upper()
                
                supplier_order = SupplierOrder.objects.create(
                    supplier=supplier,
                    order_number=f'PO-{date_str}-{unique_id}',
                    status='pending'
                )
                
                # Create order items and link to customer order items
                for item in items:
                    SupplierOrderItem.objects.create(
                        order=supplier_order,
                        book=item.book,
                        quantity=item.quantity,
                        unit_cost=item.unit_cost or 0
                    )
                    item.supplier_order = supplier_order
                    item.save()
                
                supplier_order.update_total()
            
            return JsonResponse({
                'success': True,
                'order_id': supplier_order.id,
                'order_number': supplier_order.order_number,
                'message': f'Created order {supplier_order.order_number}'
            })
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})


class SendSupplierEmailView(LoginRequiredMixin, View):
    """Send order email to supplier."""
    
    def post(self, request):
        order_id = request.POST.get('order_id')
        
        if not order_id:
            return JsonResponse({'success': False, 'error': 'Missing order ID'})
        
        try:
            order = SupplierOrder.objects.get(pk=order_id)
            supplier = order.supplier
            
            if not supplier.email:
                return JsonResponse({
                    'success': False, 
                    'error': f'Supplier {supplier.name} has no email address configured'
                })
            
            # Render email template
            html_content = render_to_string('suppliers/emails/order_request.html', {
                'order': order,
                'supplier': supplier,
                'items': order.items.all(),
            })
            
            text_content = render_to_string('suppliers/emails/order_request.txt', {
                'order': order,
                'supplier': supplier,
                'items': order.items.all(),
            })
            
            # Create email
            subject = f'הזמנת ספרים - {order.order_number}'
            from_email = settings.DEFAULT_FROM_EMAIL
            to_emails = [supplier.email]
            if supplier.email_cc:
                to_emails.append(supplier.email_cc)
            
            try:
                email = EmailMultiAlternatives(subject, text_content, from_email, to_emails)
                email.attach_alternative(html_content, "text/html")
                email.send()
            except Exception as e:
                return JsonResponse({
                    'success': False, 
                    'error': f'Failed to send email: {str(e)}. Please check email configuration.'
                })
            
            # Update order status
            order.status = 'sent'
            order.sent_date = timezone.now()
            order.email_sent = True
            order.email_sent_at = timezone.now()
            order.save()
            
            return JsonResponse({
                'success': True,
                'message': f'Email sent to {supplier.email}'
            })
        except SupplierOrder.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Order not found'})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})


class SendQuoteRequestView(LoginRequiredMixin, View):
    """Send quote request to suppliers for books without prices."""
    
    def post(self, request):
        supplier_ids = request.POST.getlist('supplier_ids[]')
        item_ids = request.POST.getlist('item_ids[]')
        
        if not supplier_ids or not item_ids:
            return JsonResponse({'success': False, 'error': 'Missing suppliers or items'})
        
        try:
            items = OrderItem.objects.filter(pk__in=item_ids).select_related('book')
            suppliers = Supplier.objects.filter(pk__in=supplier_ids)
            
            emails_sent = 0
            errors = []
            
            for supplier in suppliers:
                if not supplier.email:
                    errors.append(f'{supplier.name}: No email address')
                    continue
                    
                try:
                    # Render email
                    html_content = render_to_string('suppliers/emails/quote_request.html', {
                        'supplier': supplier,
                        'items': items,
                    })
                    
                    text_content = render_to_string('suppliers/emails/quote_request.txt', {
                        'supplier': supplier,
                        'items': items,
                    })
                    
                    subject = 'בקשה להצעת מחיר - ספרים'
                    from_email = settings.DEFAULT_FROM_EMAIL
                    to_emails = [supplier.email]
                    
                    email = EmailMultiAlternatives(subject, text_content, from_email, to_emails)
                    email.attach_alternative(html_content, "text/html")
                    email.send()
                    emails_sent += 1
                except Exception as e:
                    errors.append(f'{supplier.name}: {str(e)}')
            
            if emails_sent > 0:
                return JsonResponse({
                    'success': True,
                    'message': f'Quote requests sent to {emails_sent} suppliers',
                    'errors': errors if errors else None
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'No emails were sent',
                    'details': errors
                })
            })
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})


class PendingReceivingView(LoginRequiredMixin, ListView):
    """List supplier orders pending receiving."""
    template_name = 'suppliers/pending_receiving.html'
    context_object_name = 'orders'
    
    def get_queryset(self):
        return SupplierOrder.objects.filter(
            status__in=['sent', 'confirmed']
        ).select_related('supplier').prefetch_related('items__book').order_by('-created_at')


class ReceiveItemsView(LoginRequiredMixin, View):
    """Mark items as received from supplier."""
    
    def get(self, request, pk):
        """Show receiving form for a supplier order."""
        order = get_object_or_404(SupplierOrder, pk=pk)
        items = order.items.select_related('book')
        
        # Get associated customer order items
        customer_items = OrderItem.objects.filter(
            supplier_order=order
        ).select_related('order', 'order__customer', 'book')
        
        return render(request, 'suppliers/receive_items.html', {
            'order': order,
            'items': items,
            'customer_items': customer_items,
        })
    
    def post(self, request, pk):
        """Process received items."""
        order = get_object_or_404(SupplierOrder, pk=pk)
        
        try:
            received_items = json.loads(request.POST.get('received_items', '[]'))
            update_prices = request.POST.get('update_prices') == 'true'
            notify_customers = request.POST.get('notify_customers') == 'true'
            
            customers_to_notify = set()
            
            with transaction.atomic():
                for item_data in received_items:
                    item_id = item_data.get('id')
                    received = item_data.get('received', False)
                    actual_cost = item_data.get('actual_cost')
                    
                    # Update supplier order item
                    so_item = SupplierOrderItem.objects.get(pk=item_id)
                    if received:
                        so_item.received_quantity = so_item.quantity
                        if actual_cost:
                            so_item.unit_cost = Decimal(actual_cost)
                        so_item.save()
                        
                        # Update linked customer order items
                        customer_items = OrderItem.objects.filter(
                            supplier_order=order,
                            book=so_item.book
                        )
                        for ci in customer_items:
                            ci.is_received = True
                            ci.received_date = timezone.now()
                            if actual_cost:
                                ci.actual_supplier_cost = Decimal(actual_cost)
                            ci.save()
                            
                            # Collect customers to notify
                            if notify_customers and ci.order.customer:
                                customers_to_notify.add(ci.order.customer)
                        
                        # Update book's default price if requested
                        if update_prices and actual_cost:
                            book = so_item.book
                            book.current_cost = Decimal(actual_cost)
                            # Recalculate selling price
                            book.current_price = book.calculate_selling_price(Decimal(actual_cost))
                            book.save()
                
                # Check if all items received
                all_received = not order.items.filter(received_quantity=0).exists()
                if all_received:
                    order.status = 'received'
                    order.received_date = timezone.now()
                order.save()
            
            # Handle customer notifications
            notification_result = None
            if notify_customers and customers_to_notify:
                notification_result = self._notify_customers(list(customers_to_notify))
            
            return JsonResponse({
                'success': True,
                'message': 'Items received successfully',
                'all_received': all_received,
                'customers_notified': len(customers_to_notify) if notify_customers else 0,
                'notification_result': notification_result
            })
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    def _notify_customers(self, customers):
        """Trigger phone calls to notify customers via Supabase Edge Function."""
        results = []
        for customer in customers:
            if customer.phone:
                # Get books for this customer
                from apps.orders.models import OrderItem
                items = OrderItem.objects.filter(
                    order__customer=customer,
                    is_received=True,
                    customer_notified=False
                )
                book_titles = [item.book.title for item in items if item.book]
                
                result = trigger_customer_call(
                    customer, 
                    book_title=', '.join(book_titles) if book_titles else 'הספרים שלך'
                )
                results.append({
                    'customer': str(customer),
                    'phone': customer.phone,
                    'success': result.get('success', False)
                })
        return results


def trigger_customer_call(customer, book_title=None, order_id=None):
    """
    Trigger a phone call to customer using Supabase Edge Function + SignalWire.
    Speaks Hebrew, male voice, about learning materials (ספרי לימוד).
    """
    from django.conf import settings
    import requests
    
    try:
        # Get Supabase configuration
        supabase_url = getattr(settings, 'SUPABASE_URL', None)
        supabase_anon_key = getattr(settings, 'SUPABASE_ANON_KEY', None)
        
        if not supabase_url or not supabase_anon_key:
            return {'success': False, 'error': 'Supabase not configured'}
        
        # Get customer name
        customer_name = (
            customer.first_name_en or 
            customer.safe_translation_getter('first_name', any_language=True) or 
            'לקוח יקר'
        )
        
        # Call the Supabase Edge Function
        edge_function_url = f"{supabase_url}/functions/v1/call-customer"
        
        payload = {
            'customer_name': customer_name,
            'customer_phone': customer.phone,
            'book_title': book_title or 'ספרי הלימוד שהזמנת',
            'order_id': order_id,
            'message_type': 'book_arrival'
        }
        
        response = requests.post(
            edge_function_url,
            json=payload,
            headers={
                'Authorization': f'Bearer {supabase_anon_key}',
                'Content-Type': 'application/json',
            },
            timeout=30
        )
        
        result = response.json()
        
        if result.get('success'):
            # Mark items as notified
            from apps.orders.models import OrderItem
            OrderItem.objects.filter(
                order__customer=customer,
                is_received=True,
                customer_notified=False
            ).update(
                customer_notified=True,
                customer_notified_at=timezone.now()
            )
        
        return result
        
    except requests.exceptions.RequestException as e:
        return {'success': False, 'error': f'Network error: {str(e)}'}
    except Exception as e:
        return {'success': False, 'error': str(e)}


class CreateSupplierAjaxView(LoginRequiredMixin, View):
    """AJAX view to create a new supplier."""
    
    def post(self, request):
        name = request.POST.get('name', '').strip()
        email = request.POST.get('email', '').strip()
        phone = request.POST.get('phone', '').strip()
        
        if not name or not email:
            return JsonResponse({'success': False, 'error': 'Name and email are required'})
        
        try:
            supplier = Supplier.objects.create(email=email, phone=phone)
            supplier.set_current_language('en')
            supplier.name = name
            supplier.save()
            
            return JsonResponse({
                'success': True,
                'supplier': {
                    'id': supplier.id,
                    'name': name,
                    'email': email
                }
            })
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})

