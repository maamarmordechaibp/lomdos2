# Bookstore Management System - Setup Guide

## Prerequisites

Before setting up the project, ensure you have the following installed:

1. **Python 3.11 or higher**
   - Download from: https://www.python.org/downloads/
   - During installation, check "Add Python to PATH"

2. **PostgreSQL Database**
   - Download from: https://www.postgresql.org/download/windows/
   - Remember your postgres user password during installation

3. **Redis** (for Celery)
   - Option A: Docker Desktop (Recommended)
     - Download from: https://www.docker.com/products/docker-desktop/
   - Option B: Memurai (Redis for Windows)
     - Download from: https://www.memurai.com/get-memurai

4. **Git** (Optional, for version control)
   - Download from: https://git-scm.com/download/win

## Installation Steps

### Step 1: Install Python Dependencies

Open PowerShell in the project directory and run:

```powershell
# Create virtual environment
python -m venv venv

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# If you get execution policy error, run:
# Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Install Poetry (package manager)
pip install poetry

# Install project dependencies
poetry install
```

### Step 2: Set Up Supabase Database

**You're using Supabase! No need to install PostgreSQL locally.**

Your Supabase project is already created at:
https://supabase.com/dashboard/project/dbpkdibyecqnlwrmqwjr

The database is already set up and ready to use.

### Step 3: Configure Environment Variables

1. Copy the example environment file:
```powershell
copy .env.example .env
```

2. Edit `.env` file with your settings:
```
SECRET_KEY=your-secret-key-change-this-in-production
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database (Supabase)
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your-supabase-password-here
DB_HOST=db.dbpkdibyecqnlwrmqwjr.supabase.co
DB_PORT=5432

# Email (Gmail)
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-gmail-app-password
DEFAULT_FROM_EMAIL=bookstore@yourdomain.com

# Redis
REDIS_URL=redis://127.0.0.1:6379
CELERY_BROKER_URL=redis://127.0.0.1:6379/0
```

**Gmail App Password:**
- Go to Google Account settings → Security → 2-Step Verification
- At bottom, select "App passwords"
- Generate password for "Mail"
- Use this password (not your regular Gmail password)

### Step 4: Run Database Migrations

```powershell
# With virtual environment activated
python manage.py makemigrations
python manage.py migrate
```

### Step 5: Create Superuser (Admin Account)

```powershell
python manage.py createsuperuser
```
Follow prompts to set username, email, and password.

### Step 6: Create Initial Global Settings

```powershell
python manage.py shell
```

Then in the Python shell:
```python
from apps.pricing.models import GlobalSettings
GlobalSettings.objects.create(default_margin_percentage=20.00, currency='USD')
exit()
```

### Step 7: Start Redis (Choose One Option)

**Option A: Docker**
```powershell
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

**Option B: Memurai**
- Start Memurai from Start Menu or Services

### Step 8: Run the Application

You'll need **4 terminal windows**:

**Terminal 1 - Django Development Server:**
```powershell
.\venv\Scripts\Activate.ps1
python manage.py runserver
```

**Terminal 2 - Celery Worker:**
```powershell
.\venv\Scripts\Activate.ps1
celery -A config worker --pool=gevent -l info
```

**Terminal 3 - Celery Beat (Scheduler):**
```powershell
.\venv\Scripts\Activate.ps1
celery -A config beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

**Terminal 4 - Flower (Optional - Celery Monitoring):**
```powershell
.\venv\Scripts\Activate.ps1
celery -A config flower --port=5555
```

### Step 9: Access the Application

- **Main Site:** http://localhost:8000
- **Admin Panel:** http://localhost:8000/admin
- **Flower (Celery Monitor):** http://localhost:5555

## Common Issues & Solutions

### Issue: "python: command not found"
**Solution:** Ensure Python is added to PATH, or use `py` instead of `python`

### Issue: "Permission denied" when activating venv
**Solution:** Run PowerShell as Administrator and execute:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Issue: PostgreSQL connection error
**Solution:** 
- Check PostgreSQL is running (Services → postgresql-x64-XX)
- Verify database name, username, and password in `.env`
- Ensure DB_HOST is `localhost` or `127.0.0.1`

### Issue: Redis connection error
**Solution:**
- Check Docker container is running: `docker ps`
- Or check Memurai service is running in Windows Services

### Issue: Celery doesn't start on Windows
**Solution:** 
- Install gevent: `pip install gevent`
- Use: `celery -A config worker --pool=gevent -l info`

## Next Steps

1. **Add Sample Data:**
   - Log into admin at http://localhost:8000/admin
   - Add categories, publishers, authors
   - Add some books
   - Add suppliers with email addresses
   - Add customers

2. **Configure Email Templates:**
   - Go to Post Office → Email Templates in admin
   - Create template for supplier orders

3. **Test the System:**
   - Create a customer order
   - Add books to order
   - Generate supplier orders
   - Send emails to suppliers

## Development Workflow

1. Always activate virtual environment before working:
   ```powershell
   .\venv\Scripts\Activate.ps1
   ```

2. After model changes, create migrations:
   ```powershell
   python manage.py makemigrations
   python manage.py migrate
   ```

3. Collect static files for production:
   ```powershell
   python manage.py collectstatic
   ```

## Production Deployment

For production deployment on Windows Server:

1. Use proper web server (IIS with wfastcgi or nginx)
2. Set DEBUG=False in .env
3. Configure proper SECRET_KEY
4. Use HTTPS
5. Set up Celery as Windows Service using NSSM
6. Use production-grade database settings
7. Set up regular backups

## Support

For issues or questions:
- Check Django documentation: https://docs.djangoproject.com/
- Check Celery documentation: https://docs.celeryq.dev/
- Review the code comments for implementation details
