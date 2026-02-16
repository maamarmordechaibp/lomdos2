# Bookstore Management System - Project Overview

## Current Status: Phase 1 Complete ✓

The foundational structure of the bookstore management system has been implemented. The project now has all core models, database schema, admin interfaces, and basic autocomplete functionality.

## What's Been Implemented

### ✅ Core Infrastructure
- Django 5.0 project structure with modular apps
- Celery + Redis for background task processing (Windows-compatible with gevent)
- PostgreSQL database with multilingual support (django-parler)
- Environment-based configuration with django-environ
- Django admin customization for all models

### ✅ Apps & Models

#### 1. Core App (`apps.core`)
- Base models with timestamps and soft-delete functionality
- Shared utilities and mixins
- Homepage view

#### 2. Books App (`apps.books`)
- **Models:** Book, Author, Publisher, Category
- **Features:**
  - Multilingual support (Hebrew/English) for titles and descriptions
  - ISBN tracking with barcode support flag
  - Custom profit margin settings per book (flat rate or percentage)
  - Current cost and price tracking
  - Stock quantity management
  - Book autocomplete view for search
  - Barcode lookup endpoint (JSON API)

#### 3. Customers App (`apps.customers`)
- **Models:** Customer
- **Features:**
  - Dual-language names (Hebrew and English)
  - Phone, email, address tracking
  - Search by any field (name, phone, address)
  - Purchase history tracking methods
  - Customer autocomplete view
  - GIN indexes for fast full-text search

#### 4. Suppliers App (`apps.suppliers`)
- **Models:** Supplier, SupplierOrder, SupplierOrderItem
- **Features:**
  - Multilingual supplier names
  - Email configuration (primary + CC)
  - Order status tracking (draft → pending → sent → confirmed → received)
  - Email tracking (sent timestamp, status)
  - Purchase order management with line items
  - Total cost calculation

#### 5. Orders App (`apps.orders`)
- **Models:** Order, OrderItem
- **Features:**
  - Customer order management
  - Order status tracking
  - Line items with quantity, cost, and price
  - Profit calculation per item and order
  - Payment tracking (method, status, date)
  - Supplier order linking per item
  - Tax and total calculation
  - "Needs ordering" flag for inventory management

#### 6. Pricing App (`apps.pricing`)
- **Models:** GlobalSettings, PriceHistory
- **Features:**
  - Singleton global margin settings
  - Historical price tracking by supplier
  - Purchase and selling price records
  - Automatic profit margin calculation
  - Links to both supplier and customer orders
  - Quantity tracking per price record

#### 7. Inventory App (`apps.inventory`)
- Structure created, ready for barcode generation and label printing features

#### 8. Reports App (`apps.reports`)
- Structure created with permission model
- Ready for sales reports, profit analysis, and exports

### ✅ Configuration
- Celery beat scheduler for periodic tasks
- Post Office email integration configured
- HTMX and Alpine.js for dynamic interfaces
- Bootstrap 5 with Select2 for autocomplete
- Django debug toolbar for development
- Crispy forms for better form rendering

### ✅ Templates & Static Files
- Base template with Bootstrap 5, HTMX, Alpine.js
- Responsive navigation
- Homepage with quick links
- Custom CSS with RTL support for Hebrew

## What's Next (To Be Implemented)

### 🔲 Phase 2: Order Entry Workflow
1. Create order entry form with HTMX
2. Implement book search/barcode scanning
3. Show price history when book is selected
4. Auto-calculate selling price based on margins
5. Group items by supplier automatically
6. Real-time order total calculation

### 🔲 Phase 3: Supplier Ordering
1. Pending supplier orders dashboard
2. Review and edit pending orders
3. Email template for supplier orders
4. Celery task for sending emails
5. Order confirmation tracking
6. Receive inventory workflow

### 🔲 Phase 4: Barcode & Labels
1. Generate ISBN barcodes with python-barcode
2. WeasyPrint PDF label templates
3. Bulk label printing
4. Barcode scanner input detection
5. Quick book lookup interface

### 🔲 Phase 5: Reporting
1. Sales reports with date filters
2. Profit analysis by book/supplier
3. Customer purchase history
4. Chart.js visualizations
5. PDF and Excel export
6. Scheduled email reports

## How to Get Started

### Prerequisites
You need to install:
1. **Python 3.11+** - https://www.python.org/downloads/
2. **PostgreSQL** - https://www.postgresql.org/download/windows/
3. **Redis** (Docker or Memurai) - See SETUP.md

### Quick Start

1. **Run the setup script:**
   ```powershell
   .\setup.ps1
   ```

2. **Edit `.env` file** with your database and email credentials

3. **Create superuser:**
   ```powershell
   python manage.py createsuperuser
   ```

4. **Create global pricing settings:**
   ```powershell
   python manage.py shell
   ```
   ```python
   from apps.pricing.models import GlobalSettings
   GlobalSettings.objects.create(default_margin_percentage=20.00, currency='USD')
   exit()
   ```

5. **Start services** (4 terminals):
   ```powershell
   # Terminal 1: Django
   python manage.py runserver
   
   # Terminal 2: Celery Worker
   celery -A config worker --pool=gevent -l info
   
   # Terminal 3: Celery Beat
   celery -A config beat -l info
   
   # Terminal 4: Flower (optional)
   celery -A config flower --port=5555
   ```

6. **Access the application:**
   - Main site: http://localhost:8000
   - Admin: http://localhost:8000/admin
   - Flower: http://localhost:5555

## Project Structure

```
bookstore/
├── apps/                      # Django applications
│   ├── books/                # Book catalog
│   │   ├── models.py        # Book, Author, Publisher, Category
│   │   ├── admin.py         # Admin configuration
│   │   ├── views.py         # Autocomplete, barcode lookup
│   │   └── urls.py
│   ├── customers/           # Customer management
│   │   ├── models.py       # Customer
│   │   ├── admin.py
│   │   ├── views.py        # Customer autocomplete
│   │   └── urls.py
│   ├── orders/             # Customer orders
│   │   ├── models.py      # Order, OrderItem
│   │   ├── admin.py
│   │   └── views.py
│   ├── suppliers/         # Supplier management
│   │   ├── models.py     # Supplier, SupplierOrder, SupplierOrderItem
│   │   ├── admin.py
│   │   └── views.py
│   ├── pricing/          # Price history & margins
│   │   ├── models.py    # GlobalSettings, PriceHistory
│   │   └── admin.py
│   ├── inventory/       # Barcode & labels (to be implemented)
│   ├── reports/         # Analytics & reports (to be implemented)
│   └── core/            # Shared utilities
│       ├── models.py   # Base models
│       └── views.py    # Homepage
├── config/                  # Project configuration
│   ├── settings.py         # Django settings
│   ├── urls.py            # URL routing
│   ├── celery.py          # Celery configuration
│   └── wsgi.py
├── templates/              # HTML templates
│   ├── base.html          # Base template
│   └── core/
│       └── home.html
├── static/                 # Static files (CSS, JS)
│   └── style.css
├── manage.py              # Django management script
├── pyproject.toml         # Poetry dependencies
├── .env                   # Environment variables (create from .env.example)
├── README.md              # Project overview
├── SETUP.md               # Detailed setup instructions
└── setup.ps1              # Quick setup script
```

## Key Features

### Multilingual Support
- Hebrew and English support for book titles, descriptions, names
- Uses django-parler for clean translation management
- RTL support in CSS for Hebrew text

### Profit Margin Flexibility
- Global default margin percentage
- Per-book override (flat amount or percentage)
- Automatic selling price calculation
- Historical tracking of margins

### Price History Tracking
- Every purchase recorded with supplier, cost, and date
- Easy comparison of supplier prices
- Automatic margin calculation
- Links to original orders

### Zero-Inventory Model
- Books ordered only when customer requests
- Supplier orders automatically created from customer orders
- "Needs ordering" flag on order items
- Pending orders dashboard

### Autocomplete Search
- Fast customer search by name (both languages), phone, address
- Book search by title (both languages) or ISBN
- PostgreSQL full-text search with GIN indexes
- Select2 integration for better UX

### Email Integration
- django-post-office for reliable email delivery
- Email queuing with retry logic
- Celery for async sending
- Template management in admin
- Gmail SMTP support

## Database Schema Overview

### Key Relationships
```
Customer --< Order >-- OrderItem >-- Book
                          |            |
                          |            |-- Category
                          |            |-- Publisher
                          |            |-- Authors (M2M)
                          |
                          v
                    SupplierOrder >-- SupplierOrderItem >-- Supplier
                          |
                          v
                    PriceHistory
```

### Important Indexes
- GIN indexes on customer names for full-text search
- B-tree indexes on ISBN, phone numbers, order numbers
- Composite indexes on (book, date) for price history

## Development Tips

### Making Model Changes
```powershell
python manage.py makemigrations
python manage.py migrate
```

### Creating Admin Users
```powershell
python manage.py createsuperuser
```

### Testing Celery Tasks
```python
# In Django shell
from apps.suppliers.tasks import send_supplier_order_email
result = send_supplier_order_email.delay(order_id=1)
result.status  # Check status
```

### Debugging
- Use Django Debug Toolbar (enabled in development)
- Check Celery logs in worker terminal
- Use Flower to monitor Celery tasks
- Check post_office admin for email status

## Common Workflows

### Adding a New Book
1. Log into admin
2. Go to Books → Books → Add Book
3. Enter ISBN, titles (English and Hebrew)
4. Set authors, publisher, category
5. Set current cost from supplier
6. Optionally set custom margin
7. Save - selling price auto-calculated

### Taking a Customer Order
(To be implemented in Phase 2)
1. Search for customer (or create new)
2. Add books to order (search or scan barcode)
3. System shows previous price history
4. Adjust quantities and prices if needed
5. Books that need ordering are flagged
6. Save order

### Ordering from Suppliers
(To be implemented in Phase 3)
1. View pending supplier orders dashboard
2. Review and edit orders per supplier
3. Click "Send Order" to email supplier
4. Email sent via Celery (async)
5. Update status to "Sent"
6. When received, mark as "Received"
7. Stock automatically updated

## Performance Considerations

- **Autocomplete:** Uses SELECT2 with AJAX for large datasets
- **Reports:** Will use Redis caching for expensive queries
- **Emails:** Queued and sent asynchronously via Celery
- **Search:** PostgreSQL full-text search with proper indexing
- **Static Files:** Served efficiently in production

## Security Notes

- Change SECRET_KEY in production
- Use environment variables for sensitive data
- Set DEBUG=False in production
- Use HTTPS in production
- Implement proper user permissions
- Regular database backups

## Next Steps for Development

1. Complete the order entry workflow (Phase 2)
2. Implement supplier email functionality (Phase 3)
3. Add barcode generation and scanning (Phase 4)
4. Build reporting dashboard (Phase 5)
5. Add user authentication and permissions
6. Implement advanced filtering and search
7. Add data import/export functionality
8. Create customer-facing views

## Support & Documentation

- **Django Docs:** https://docs.djangoproject.com/
- **Celery Docs:** https://docs.celeryq.dev/
- **django-parler:** https://django-parler.readthedocs.io/
- **HTMX:** https://htmx.org/docs/
- **Alpine.js:** https://alpinejs.dev/

## License

MIT License - Free to use and modify for your bookstore needs.
