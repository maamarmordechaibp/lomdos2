# Quick Supabase Connection Guide

## Your Supabase Database Details

From the screenshot, your connection details are:

```
Host: db.dbpkdibyecqnlwrmqwjr.supabase.co
Port: 5432
Database: postgres
User: postgres
Password: [You need to copy this from your Supabase dashboard]
```

## Step-by-Step Setup

### 1. Get Your Password

**From the screenshot you shared:**
- Go to: https://supabase.com/dashboard/project/dbpkdibyecqnlwrmqwjr
- The connection string shows: `postgresql://postgres:[YOUR-PASSWORD]@db.dbpkdibyecqnlwrmqwjr.supabase.co:5432/postgres`
- Click "View parameters" button to see the actual password

**Alternative: Find password in Supabase dashboard:**
1. Go to Settings (gear icon)
2. Click "Database"
3. Scroll to "Connection string"
4. Your password is visible there

### 2. Update .env File

After running `.\setup.ps1`, edit the `.env` file:

```env
# Django Settings
SECRET_KEY=django-insecure-change-this-in-production
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database (Supabase)
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=PASTE_YOUR_SUPABASE_PASSWORD_HERE
DB_HOST=db.dbpkdibyecqnlwrmqwjr.supabase.co
DB_PORT=5432

# Email Configuration (Gmail)
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password-here
DEFAULT_FROM_EMAIL=bookstore@yourdomain.com

# Redis
REDIS_URL=redis://127.0.0.1:6379
CELERY_BROKER_URL=redis://127.0.0.1:6379/0
```

### 3. Test Connection

```powershell
# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Test database connection
python manage.py check --database default
```

If successful, you'll see: "System check identified no issues"

### 4. Run Migrations

```powershell
python manage.py migrate
```

This creates all the tables in your Supabase database:
- books_book, books_author, books_publisher, books_category
- customers_customer  
- orders_order, orders_orderitem
- suppliers_supplier, suppliers_supplierorder, suppliers_supplierorderitem
- pricing_globalsettings, pricing_pricehistory
- And more...

### 5. Verify in Supabase

1. Go to your Supabase dashboard
2. Click "Table Editor" 
3. You should see all Django tables created!

## Troubleshooting

### "could not connect to server"
- Check your internet connection
- Verify the password is correct
- Make sure you copied the password without extra spaces

### "database does not exist"
- The database name should be `postgres` (not `bookstore_db`)
- Supabase creates a default `postgres` database

### SSL/TLS errors
If you get SSL certificate errors, the connection should still work as Supabase requires SSL by default.

## Quick Commands

```powershell
# Run setup
.\setup.ps1

# Edit .env with your password
notepad .env

# Test connection
python manage.py check --database default

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Start server
python manage.py runserver
```

## What's Different from Local PostgreSQL?

✅ **No installation needed** - Database is hosted  
✅ **Accessible anywhere** - Connect from any device  
✅ **Built-in tools** - Table viewer, SQL editor  
✅ **Automatic backups** - Supabase handles it  
✅ **Free tier** - No cost for development  

## Supabase Dashboard Features

You can use the Supabase dashboard to:
- **View tables** - See all your data
- **Run SQL** - Execute queries directly
- **Monitor** - Check database performance
- **Backup** - Manual backups if needed
- **Logs** - View connection logs

## Success!

Once migrations run successfully, you're ready to:
1. Create superuser
2. Start Django server
3. Access admin at http://localhost:8000/admin
4. Start adding books, customers, suppliers!

Your data is now stored securely in Supabase! 🎉
