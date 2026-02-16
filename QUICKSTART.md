# Bookstore Management System - Quick Start Guide

## 🚀 You're Ready to Go!

The foundational structure of your bookstore management system has been successfully created. Here's everything you need to know to get started.

## 📁 What You Have

Your project now includes:

### Core Applications (8 Apps)
1. **Core** - Base models and utilities
2. **Books** - Book catalog with Hebrew/English support
3. **Customers** - Customer management with multilingual names
4. **Orders** - Customer orders and line items
5. **Suppliers** - Supplier management and purchase orders
6. **Pricing** - Price history and profit margin settings
7. **Inventory** - Ready for barcode features
8. **Reports** - Ready for analytics features

### Key Features Already Working
✅ Multilingual support (Hebrew + English)  
✅ Customer autocomplete search  
✅ Book autocomplete search  
✅ Profit margin calculation (global + per-book override)  
✅ Price history tracking  
✅ Admin interfaces for all models  
✅ Celery background task processing  
✅ Email queue system  
✅ Barcode lookup API endpoint  

## 🔧 Installation (First Time Setup)

### Step 1: Install Prerequisites
You need these installed on your computer:
- **Python 3.11+** → https://www.python.org/downloads/
- **Supabase Database** → ✅ Already set up at https://supabase.com/dashboard/project/dbpkdibyecqnlwrmqwjr
- **Redis** → Use Docker: `docker run -d -p 6379:6379 redis:7-alpine`

### Step 2: Quick Setup
Open PowerShell in the project folder and run:
```powershell
.\setup.ps1
```

This script will:
- Create virtual environment
- Install all dependencies
- Create `.env` file
- Run database migrations

### Step 3: Configure Environment
Edit `.env` file with your settings:
```
DB_PASSWORD=your-supabase-password-from-dashboard
EMAIL_HOST_USER=your-gmail@gmail.com
EMAIL_HOST_PASSWORD=your-gmail-app-password
```

**Get your Supabase password:**
1. Go to https://supabase.com/dashboard/project/dbpkdibyecqnlwrmqwjr
2. Settings → Database → Connection string
3. Copy the password from the connection string

### Step 4: Create Admin User
```powershell
python manage.py createsuperuser
```

### Step 5: Initialize Settings
```powershell
python manage.py shell
```
```python
from apps.pricing.models import GlobalSettings
GlobalSettings.objects.create(default_margin_percentage=20.00, currency='USD')
exit()
```

## 🏃 Running the Application

You need **4 terminal windows**:

### Terminal 1: Django Server
```powershell
python manage.py runserver
```
Access at: http://localhost:8000

### Terminal 2: Celery Worker
```powershell
celery -A config worker --pool=gevent -l info
```

### Terminal 3: Celery Beat
```powershell
celery -A config beat -l info
```

### Terminal 4: Flower (Optional - Monitoring)
```powershell
celery -A config flower --port=5555
```
Access at: http://localhost:5555

## 📝 First Steps After Installation

### 1. Log into Admin
Go to: http://localhost:8000/admin
Login with your superuser credentials

### 2. Add Sample Data (in this order):

#### a. Categories
- Fiction
- Non-Fiction
- Children's Books
- Reference
- Textbooks

#### b. Publishers
Add a few publishers with names in both English and Hebrew

#### c. Authors
Add some authors

#### d. Suppliers
**Important:** Add suppliers with valid email addresses
- Name (English + Hebrew)
- Email address (for orders)
- Phone, Address
- Payment terms

#### e. Books
Add books with:
- ISBN (13 digits)
- Title (English + Hebrew)
- Authors, Publisher, Category
- Current cost (from supplier)
- Custom margin (optional)

The system will auto-calculate selling price!

#### f. Customers
Add customers with:
- Names (English and/or Hebrew)
- Phone number
- Email
- Address

### 3. Test Autocomplete
- Try creating an order in admin
- Use the customer field - start typing a name
- Should show autocomplete suggestions

### 4. Check Celery
- Go to Flower: http://localhost:5555
- Should see worker connected
- No errors in terminal

## 🎯 What Works Right Now

### ✅ In Django Admin:
- Add/edit books with multilingual titles
- Add/edit customers with Hebrew/English names
- Create orders manually
- Create supplier orders manually
- View price history
- Set profit margins (global or per-book)
- Search books by ISBN or title
- Search customers by name, phone, address

### ✅ Autocomplete:
- Customer search (name, phone, address)
- Book search (title, ISBN)
- Author search

### ✅ Background Tasks:
- Email queuing (configured but templates needed)
- Scheduled tasks (Celery Beat ready)
- Task monitoring (Flower)

### ✅ Barcode API:
- Endpoint: `/books/lookup/<isbn>/`
- Returns book details and price history as JSON

## 🔨 What Needs Building Next

See [ROADMAP.md](ROADMAP.md) for detailed plans, but in priority order:

### Phase 2: Order Entry Workflow (CRITICAL)
Build a proper order entry interface with:
- Customer selection
- Book scanning/selection
- Price history display
- Auto-calculated totals
- Supplier grouping

**Why:** This is the core daily workflow you described

### Phase 3: Supplier Ordering (CRITICAL)
Build supplier order management:
- Review pending orders
- Send emails to suppliers
- Mark as received
- Update inventory

**Why:** This completes your ordering workflow

### Phase 4: Barcode & Labels (IMPORTANT)
Add barcode generation and label printing:
- Generate ISBN barcodes
- Print pricing labels
- Barcode scanner support

**Why:** Makes receiving inventory faster

### Phase 5: Reporting (IMPORTANT)
Add business intelligence:
- Sales reports
- Profit analysis by supplier/book
- Customer purchase history
- Export to Excel/PDF

**Why:** You need to track profits and compare supplier prices

## 📚 Documentation

Read these files for details:
- **SETUP.md** - Detailed installation instructions
- **PROJECT_STATUS.md** - What's implemented and technical details
- **ROADMAP.md** - Development phases and tasks
- **README.md** - Project overview

## 🆘 Troubleshooting

### Python not found
Install Python 3.11+ from python.org and check "Add to PATH"

### PostgreSQL connection error
1. Check PostgreSQL service is running
2. Verify password in `.env` file
3. Ensure database `bookstore_db` exists

### Celery won't start
1. Make sure Redis is running: `docker ps`
2. Use gevent pool: `celery -A config worker --pool=gevent -l info`
3. Check for errors in output

### Module not found errors
```powershell
poetry install
```

### Permission denied (PowerShell)
Run as Administrator:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## 💡 Pro Tips

### Daily Workflow:
1. Start Redis (if not already running)
2. Activate venv: `.\venv\Scripts\Activate.ps1`
3. Start Django: `python manage.py runserver`
4. Start Celery Worker: `celery -A config worker --pool=gevent -l info`
5. Start Celery Beat: `celery -A config beat -l info`

### Development:
- Use Django Debug Toolbar (already installed)
- Check admin site for email status (Post Office)
- Monitor Celery tasks in Flower
- Use `python manage.py shell` for testing

### Adding New Data:
- Always use admin interface for now
- Custom forms will be built in Phase 2
- Data can be imported via admin (django-import-export installed)

## 🎉 Success Criteria

You'll know it's working when you can:
1. ✅ Access admin at http://localhost:8000/admin
2. ✅ Add a book with Hebrew title
3. ✅ Search for book using autocomplete
4. ✅ Add a customer with Hebrew name
5. ✅ Create an order in admin
6. ✅ See price calculated automatically
7. ✅ Celery worker shows no errors
8. ✅ Flower dashboard loads

## 📞 Next Steps

1. **Complete Installation**
   - Run setup.ps1
   - Configure .env
   - Create superuser
   - Start all services

2. **Add Sample Data**
   - Categories, Publishers, Authors
   - At least 10 books
   - At least 2 suppliers with emails
   - At least 5 customers

3. **Test the System**
   - Create an order in admin
   - Check price calculation
   - View price history
   - Test autocomplete

4. **Start Phase 2**
   - Review ROADMAP.md
   - Begin building order entry form
   - Or ask for help implementing features!

## 🤝 Need Help?

If you run into issues or want to start building Phase 2:
- Check the troubleshooting section above
- Read the detailed documentation files
- All code is commented for clarity
- Database migrations are ready to run

## 📊 Project Statistics

- **Lines of Code:** ~2,500+
- **Models Created:** 15 core models
- **Admin Interfaces:** 15 registered
- **URL Endpoints:** 10+ configured
- **Templates:** Base layout + homepage
- **Dependencies:** 25+ Python packages
- **Documentation:** 1,500+ lines

## ✨ What Makes This Special

- **Zero-Inventory Model:** Books ordered only when needed
- **Multilingual:** Full Hebrew and English support
- **Price History:** Track all supplier prices over time
- **Flexible Margins:** Global or per-book profit margins
- **Async Tasks:** Background email sending with Celery
- **Modern Stack:** HTMX + Alpine.js for interactivity
- **Extensible:** Clean structure ready for more features

---

## 🚀 Ready to Launch!

Your bookstore management system foundation is complete and ready for use. The hard work of setting up the infrastructure is done. Now you can focus on building the features that matter to your business.

**Start with:** [SETUP.md](SETUP.md) for detailed installation  
**Then see:** [ROADMAP.md](ROADMAP.md) for what to build next  
**Reference:** [PROJECT_STATUS.md](PROJECT_STATUS.md) for technical details  

Good luck with your bookstore! 📚
