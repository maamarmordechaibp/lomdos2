# Development Roadmap - Bookstore Management System

## ✅ PHASE 1: FOUNDATION (COMPLETED)

### What's Done
- ✓ Django project structure with 8 apps
- ✓ All core models (Book, Customer, Order, Supplier, PriceHistory)
- ✓ Multilingual support (Hebrew/English)
- ✓ Admin interfaces for all models
- ✓ Autocomplete views for books and customers
- ✓ Celery + Redis configuration
- ✓ Email backend setup (django-post-office)
- ✓ Base templates with Bootstrap 5, HTMX, Alpine.js
- ✓ Setup scripts and documentation

### Database Schema
All tables created and migrated:
- books_book, books_author, books_publisher, books_category
- customers_customer
- orders_order, orders_orderitem
- suppliers_supplier, suppliers_supplierorder, suppliers_supplierorderitem
- pricing_globalsettings, pricing_pricehistory
- Parler translation tables for multilingual fields

---

## 🔨 PHASE 2: ORDER ENTRY WORKFLOW (NEXT)

### Priority: High
### Estimated Time: 2-3 days

### Files to Create/Modify:

#### 1. Order Entry View (`apps/orders/views.py`)
```python
class OrderCreateView(CreateView):
    """Create new customer order with HTMX enhancement."""
    model = Order
    template_name = 'orders/order_form.html'
    
    # Features:
    # - Customer autocomplete
    # - Dynamic book addition
    # - Price history display
    # - Real-time total calculation
    # - Supplier grouping
```

#### 2. Order Entry Template (`templates/orders/order_form.html`)
- HTMX form for adding books dynamically
- Barcode input field with auto-submit
- Price history display per book
- Order items table with inline editing
- Real-time total calculation (Alpine.js)
- Save as draft / Confirm order buttons

#### 3. Book Selection Partial (`templates/orders/_book_item.html`)
- HTMX partial for individual order items
- Shows: Book, Quantity, Cost, Price, Subtotal
- Edit/Delete buttons
- Supplier indicator

#### 4. URLs Update (`apps/orders/urls.py`)
```python
urlpatterns = [
    path('create/', views.OrderCreateView.as_view(), name='create'),
    path('add-item/', views.add_order_item, name='add-item'),  # HTMX
    path('remove-item/<int:pk>/', views.remove_order_item, name='remove-item'),
    path('<int:pk>/', views.OrderDetailView.as_view(), name='detail'),
]
```

### Key Features:
1. ✓ Customer selection with autocomplete
2. ✓ Book search/selection (autocomplete or barcode)
3. ✓ Price history display when book selected
4. ✓ Auto-calculate selling price from margin settings
5. ✓ Real-time order total
6. ✓ Group items by supplier (visual indicator)
7. ✓ Save draft orders
8. ✓ Generate supplier orders from customer order

---

## 📧 PHASE 3: SUPPLIER ORDERING & EMAILS

### Priority: High
### Estimated Time: 2-3 days

### Files to Create/Modify:

#### 1. Supplier Order Management (`apps/suppliers/views.py`)
```python
class PendingOrdersView(ListView):
    """Dashboard of pending supplier orders."""
    
class SupplierOrderDetailView(DetailView):
    """Review supplier order before sending."""
    
def send_supplier_order(request, pk):
    """Send email to supplier (triggers Celery task)."""
```

#### 2. Celery Tasks (`apps/suppliers/tasks.py`)
```python
@shared_task
def send_supplier_order_email(order_id):
    """Async task to send supplier order email."""
    # Get order
    # Render email template
    # Send via post_office
    # Update order status
```

#### 3. Email Template (HTML)
Create in admin: Post Office → Email Templates
- Template name: `supplier_order`
- Subject: Order #{{ order_number }} from Bookstore
- HTML body with order details table
- Books list with quantities and prices

#### 4. Templates
- `templates/suppliers/pending_orders.html` - Dashboard
- `templates/suppliers/order_detail.html` - Review before send
- `templates/suppliers/order_sent.html` - Confirmation
- `templates/emails/supplier_order.html` - Email template

### Key Features:
1. ✓ Pending supplier orders dashboard
2. ✓ Review order details
3. ✓ Edit order before sending
4. ✓ Send email via Celery (async)
5. ✓ Track email send status
6. ✓ Mark orders as confirmed/received
7. ✓ Update stock when received
8. ✓ Create price history records

---

## 🏷️ PHASE 4: BARCODE & LABEL PRINTING

### Priority: Medium
### Estimated Time: 2 days

### Files to Create/Modify:

#### 1. Barcode Generation (`apps/inventory/utils.py`)
```python
from barcode import EAN13
from barcode.writer import ImageWriter

def generate_isbn_barcode(isbn):
    """Generate barcode image from ISBN."""
    
def generate_barcode_base64(isbn):
    """Generate barcode as base64 for embedding."""
```

#### 2. Label Generation (`apps/inventory/labels.py`)
```python
from weasyprint import HTML

def generate_book_label(book):
    """Generate PDF label with barcode and price."""
    
def generate_bulk_labels(books):
    """Generate labels for multiple books."""
```

#### 3. Views (`apps/inventory/views.py`)
```python
def print_label(request, book_id):
    """Generate and download single label."""
    
def print_bulk_labels(request):
    """Generate labels for received order."""
    
def barcode_scanner(request):
    """Barcode scanning interface."""
```

#### 4. Templates
- `templates/inventory/label_template.html` - WeasyPrint template
- `templates/inventory/scanner.html` - Barcode scanning page
- `templates/inventory/bulk_print.html` - Select books for labels

### Key Features:
1. ✓ Generate ISBN-13 barcodes
2. ✓ PDF label with barcode, title, price
3. ✓ Bulk label generation
4. ✓ Print labels when order received
5. ✓ USB barcode scanner support
6. ✓ Camera-based scanning (optional)
7. ✓ Quick book lookup by barcode

---

## 📊 PHASE 5: REPORTING & ANALYTICS

### Priority: Medium
### Estimated Time: 3-4 days

### Files to Create/Modify:

#### 1. Sales Report (`apps/reports/views.py`)
```python
class SalesReportView(FilterView):
    """Sales report with filters and charts."""
    filterset_class = SalesReportFilter
    template_name = 'reports/sales.html'
```

#### 2. Filters (`apps/reports/filters.py`)
```python
from django_filters import FilterSet

class SalesReportFilter(FilterSet):
    date_range = DateFromToRangeFilter()
    customer = ModelChoiceFilter()
    # etc.
```

#### 3. Tables (`apps/reports/tables.py`)
```python
import django_tables2 as tables

class SalesReportTable(tables.Table):
    # Define columns
```

#### 4. Export (`apps/reports/exporters.py`)
```python
def export_pdf(queryset, template):
    """Export report as PDF."""
    
def export_excel(queryset, columns):
    """Export report as Excel."""
```

#### 5. Templates
- `templates/reports/dashboard.html` - Main dashboard
- `templates/reports/sales.html` - Sales report
- `templates/reports/profit_analysis.html` - Profit by supplier/book
- `templates/reports/customer_history.html` - Customer purchases

### Reports to Implement:
1. ✓ Sales by date range
2. ✓ Sales by customer
3. ✓ Sales by book
4. ✓ Profit analysis by supplier
5. ✓ Profit analysis by book
6. ✓ Customer purchase history
7. ✓ Supplier price comparison
8. ✓ Best-selling books
9. ✓ Low stock alerts

### Visualizations:
- Chart.js line charts (sales over time)
- Bar charts (top books, top customers)
- Pie charts (sales by category)

### Export Formats:
- PDF (WeasyPrint)
- Excel (openpyxl)
- CSV (built-in)

---

## 🔐 PHASE 6: AUTHENTICATION & PERMISSIONS

### Priority: Medium
### Estimated Time: 1-2 days

### Features:
1. ✓ User roles (Staff, Manager, Admin)
2. ✓ Permission-based access to reports
3. ✓ Object-level permissions
4. ✓ Audit logging for sensitive actions
5. ✓ Login/logout views
6. ✓ Password reset functionality

---

## 🎨 PHASE 7: UI/UX ENHANCEMENTS

### Priority: Low
### Estimated Time: 2-3 days

### Features:
1. ✓ Dashboard with key metrics
2. ✓ Quick actions (New Order, Search Book, etc.)
3. ✓ Notification system
4. ✓ Recent activity feed
5. ✓ Keyboard shortcuts
6. ✓ Mobile responsive design
7. ✓ Dark mode (optional)
8. ✓ Print-friendly views

---

## 📱 PHASE 8: ADVANCED FEATURES (FUTURE)

### Features:
1. Customer-facing order status tracking
2. Mobile app (React Native)
3. REST API (Django REST Framework)
4. Inventory forecasting
5. Automatic reordering
6. Multi-location support
7. Return/refund management
8. Loyalty program
9. Integration with accounting software
10. Advanced analytics with AI insights

---

## Development Priorities

### Immediate (This Week):
1. Order Entry Workflow - Critical for daily operations
2. Supplier Ordering & Emails - Critical for business flow

### Short Term (Next 2 Weeks):
3. Barcode & Labels - Important for efficiency
4. Basic Reporting - Important for business insights

### Medium Term (Next Month):
5. Authentication & Permissions - Important for security
6. UI/UX Enhancements - Important for usability

### Long Term (Future):
7. Advanced Features - Nice to have

---

## Testing Checklist

### Phase 2 Testing:
- [ ] Create customer order
- [ ] Add books to order
- [ ] Verify price history displays
- [ ] Check auto-calculated prices
- [ ] Verify supplier grouping
- [ ] Save as draft
- [ ] Confirm order
- [ ] Check order in admin

### Phase 3 Testing:
- [ ] View pending orders
- [ ] Edit order
- [ ] Send email to supplier
- [ ] Verify email received
- [ ] Check Celery task completed
- [ ] Mark order as received
- [ ] Verify stock updated

### Phase 4 Testing:
- [ ] Generate single barcode
- [ ] Print single label
- [ ] Print bulk labels
- [ ] Scan barcode (USB scanner)
- [ ] Look up book by barcode
- [ ] Verify barcode format

### Phase 5 Testing:
- [ ] Generate sales report
- [ ] Filter by date range
- [ ] Export to PDF
- [ ] Export to Excel
- [ ] View profit analysis
- [ ] Check customer history
- [ ] Verify chart displays

---

## Performance Optimization Tasks

### Database:
- [ ] Add missing indexes
- [ ] Optimize N+1 queries (use select_related, prefetch_related)
- [ ] Add database query logging
- [ ] Set up query caching

### Caching:
- [ ] Cache expensive reports
- [ ] Cache autocomplete results
- [ ] Use Redis for session storage
- [ ] Implement view-level caching

### Frontend:
- [ ] Minify CSS/JS
- [ ] Lazy load images
- [ ] Implement pagination
- [ ] Add loading indicators

---

## Deployment Tasks

### Windows Server:
- [ ] Install IIS with FastCGI
- [ ] Configure wfastcgi
- [ ] Set up Celery as Windows Service (NSSM)
- [ ] Configure firewall
- [ ] Set up SSL certificate
- [ ] Configure automatic backups
- [ ] Set up monitoring

### Docker (Alternative):
- [ ] Create Dockerfile
- [ ] Create docker-compose.yml
- [ ] Configure volumes
- [ ] Set up reverse proxy
- [ ] Configure SSL

---

## Maintenance Tasks

### Daily:
- [ ] Check Celery worker status
- [ ] Monitor email queue
- [ ] Check error logs

### Weekly:
- [ ] Database backup
- [ ] Review slow queries
- [ ] Update dependencies
- [ ] Check disk space

### Monthly:
- [ ] Security updates
- [ ] Performance review
- [ ] User feedback review
- [ ] Clean up old data

---

## Documentation Tasks

- [ ] API documentation (if REST API added)
- [ ] User manual
- [ ] Admin manual
- [ ] Deployment guide
- [ ] Troubleshooting guide
- [ ] Code comments
- [ ] Inline help text

---

## Questions to Consider

1. **Currency:** USD, EUR, ILS, or multi-currency?
2. **Tax:** How to handle tax calculations?
3. **Discounts:** Do you need discount codes or bulk pricing?
4. **Returns:** How to handle book returns?
5. **Shipping:** Track shipping addresses and costs?
6. **Payment:** Integrate with payment gateways?
7. **Invoicing:** Generate invoices automatically?
8. **Multi-user:** Will multiple staff use the system simultaneously?

---

## Ready to Start Phase 2!

The foundation is solid. You can now:
1. Follow SETUP.md to install and run the system
2. Add sample data via admin
3. Start building Phase 2 (Order Entry)
4. Test each feature as you build

Need help with any phase? Just ask!
