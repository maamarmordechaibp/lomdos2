# COMPLETE SETUP GUIDE - NO SCRIPTS NEEDED

## Step 1: Enable PowerShell Scripts (Choose ONE option)

### Option A: Bypass for this session only (Recommended)
Run this command first:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```
Then run:
```powershell
.\setup.ps1
```

### Option B: Manual Setup (If Option A doesn't work)
Follow the commands below one by one.

---

## Step 2: Install Dependencies

```powershell
# Create virtual environment
python -m venv venv

# Activate it
.\venv\Scripts\Activate.ps1

# If you get an error, use this instead:
.\venv\Scripts\activate.bat

# Upgrade pip
python -m pip install --upgrade pip

# Install all dependencies
pip install -r requirements.txt
```

---

## Step 3: Create Database Tables

```powershell
# Make migrations
python manage.py makemigrations

# Apply migrations to Supabase database
python manage.py migrate
```

---

## Step 4: Create Admin User

```powershell
python manage.py createsuperuser
```

Enter:
- Username: admin (or your choice)
- Email: your email
- Password: choose a secure password

---

## Step 5: Create Global Settings

```powershell
python manage.py shell
```

Then paste these lines one by one:
```python
from apps.pricing.models import GlobalSettings
GlobalSettings.objects.create(default_margin_percentage=20.00, currency='USD')
exit()
```

---

## Step 6: Start Redis (Required for Celery)

### If you have Docker:
```powershell
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

### If you don't have Docker:
Download and install Memurai (Redis for Windows):
https://www.memurai.com/get-memurai

---

## Step 7: Start the Application

You need 3 terminal windows:

### Terminal 1 - Django Server
```powershell
cd C:\Users\congt\Downloads\books
.\venv\Scripts\activate.bat
python manage.py runserver
```

Keep this running. Access: http://localhost:8000

### Terminal 2 - Celery Worker (New PowerShell window)
```powershell
cd C:\Users\congt\Downloads\books
.\venv\Scripts\activate.bat
celery -A config worker --pool=gevent -l info
```

### Terminal 3 - Celery Beat (New PowerShell window)
```powershell
cd C:\Users\congt\Downloads\books
.\venv\Scripts\activate.bat
celery -A config beat -l info
```

---

## ✅ Verification Checklist

- [ ] Virtual environment created and activated
- [ ] All packages installed (no errors)
- [ ] Migrations completed successfully
- [ ] Superuser created
- [ ] Global settings created
- [ ] Redis/Memurai running
- [ ] Django server running (Terminal 1)
- [ ] Celery worker running (Terminal 2)
- [ ] Celery beat running (Terminal 3)
- [ ] Can access http://localhost:8000/admin
- [ ] Can log in to admin panel

---

## 🚀 Quick Start Commands (Copy & Paste)

```powershell
# All in one - run these in order:
python -m venv venv
.\venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
```

Then start Redis and run the servers in 3 terminals.

---

## 🆘 Troubleshooting

### "python: command not found"
- Install Python 3.11+ from python.org
- Check "Add Python to PATH" during installation

### "activate.bat" doesn't work
Try:
```powershell
venv\Scripts\python.exe -m pip install -r requirements.txt
venv\Scripts\python.exe manage.py migrate
```

### Can't connect to Supabase
- Check .env file has correct password
- Test internet connection
- Password is: D4C@Kb3jUet4ZXn

### Redis connection error
- Make sure Docker container is running: `docker ps`
- Or check Memurai service is running

### Celery won't start
- Install gevent: `pip install gevent`
- Use activate.bat instead of Activate.ps1

---

## 📊 What You'll Have

Once complete, you can:
1. ✅ Access admin at http://localhost:8000/admin
2. ✅ Add books with Hebrew/English titles
3. ✅ Add customers with multilingual names
4. ✅ Create orders
5. ✅ Manage suppliers
6. ✅ Track price history
7. ✅ Search with autocomplete

---

## Next Steps

After setup is complete:
1. Log into admin panel
2. Add some categories, publishers, authors
3. Add books with ISBN numbers
4. Add suppliers with email addresses
5. Add customers
6. Start taking orders!

All your data is stored in Supabase - you can view it at:
https://supabase.com/dashboard/project/dbpkdibyecqnlwrmqwjr
