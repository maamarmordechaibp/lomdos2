# Supabase Database Setup

## ✅ Your Database is Ready!

You're using Supabase hosted PostgreSQL - no local installation needed!

**Project URL:** https://supabase.com/dashboard/project/dbpkdibyecqnlwrmqwjr

## Connection Details

Your database connection settings:
- **Host:** `db.dbpkdibyecqnlwrmqwjr.supabase.co`
- **Port:** `5432`
- **Database:** `postgres`
- **User:** `postgres`
- **Password:** [Get from Supabase dashboard]

## How to Get Your Database Password

1. Go to your Supabase project dashboard:
   https://supabase.com/dashboard/project/dbpkdibyecqnlwrmqwjr

2. Click on **Settings** (gear icon) in the left sidebar

3. Click on **Database**

4. Scroll down to **Connection string** section

5. You'll see the connection string with `[YOUR-PASSWORD]` placeholder
   - The actual password is shown in the connection string on your dashboard
   - Or you can reset the password if needed

## Setup Steps

### 1. Get Your Password
Copy the password from the Supabase dashboard connection string

### 2. Run Setup Script
```powershell
.\setup.ps1
```

This will:
- Create `.env` file from `.env.example`
- Install dependencies
- Prompt you to edit `.env`

### 3. Edit .env File
Open `.env` and update the password:

```env
# Database (Supabase)
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=YOUR_ACTUAL_PASSWORD_HERE
DB_HOST=db.dbpkdibyecqnlwrmqwjr.supabase.co
DB_PORT=5432
```

### 4. Run Migrations
```powershell
python manage.py migrate
```

This will create all the tables in your Supabase database.

### 5. Create Superuser
```powershell
python manage.py createsuperuser
```

### 6. Initialize Settings
```powershell
python manage.py shell
```
```python
from apps.pricing.models import GlobalSettings
GlobalSettings.objects.create(default_margin_percentage=20.00, currency='USD')
exit()
```

## Advantages of Using Supabase

✅ **No Local PostgreSQL** - No need to install PostgreSQL on your machine  
✅ **Always Accessible** - Access from any computer with internet  
✅ **Automatic Backups** - Supabase handles backups for you  
✅ **Free Tier** - Generous free tier for development  
✅ **Scalable** - Easy to upgrade as you grow  
✅ **Built-in Tools** - Table editor, SQL editor, and more  

## Connection String Format

If you need the full connection string:
```
postgresql://postgres:YOUR_PASSWORD@db.dbpkdibyecqnlwrmqwjr.supabase.co:5432/postgres
```

## Troubleshooting

### Connection Error
- Verify your password is correct
- Check your internet connection
- Ensure Supabase project is active

### SSL Certificate Error
If you get SSL errors, you can disable SSL verification in development (not recommended for production):
Add to `config/settings.py` under DATABASES:
```python
'OPTIONS': {
    'sslmode': 'require',
}
```

### IPv6 Issues
Supabase supports IPv6. If you have connection issues, make sure your network supports it or enable IPv6 in your system.

## Viewing Your Data

You can view and edit your data directly in Supabase:
1. Go to your project dashboard
2. Click **Table Editor** in the left sidebar
3. Browse all your Django tables

## Next Steps

Once connected:
1. Run migrations: `python manage.py migrate`
2. Create superuser: `python manage.py createsuperuser`
3. Start the application: `python manage.py runserver`
4. Access admin: http://localhost:8000/admin

Your bookstore data will be stored securely in Supabase! 🚀
