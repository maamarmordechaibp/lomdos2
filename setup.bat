@echo off
echo ========================================
echo Bookstore Management System Setup
echo ========================================
echo.

echo Step 1: Creating virtual environment...
python -m venv venv
if errorlevel 1 (
    echo ERROR: Failed to create virtual environment
    echo Make sure Python 3.11+ is installed
    pause
    exit /b 1
)
echo SUCCESS: Virtual environment created
echo.

echo Step 2: Activating virtual environment...
call venv\Scripts\activate.bat
echo.

echo Step 3: Upgrading pip...
python -m pip install --upgrade pip
echo.

echo Step 4: Installing dependencies (this may take 5-10 minutes)...
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo SUCCESS: All dependencies installed
echo.

echo Step 5: Checking database connection...
python manage.py check --database default
if errorlevel 1 (
    echo ERROR: Database connection failed
    echo Check your .env file settings
    pause
    exit /b 1
)
echo SUCCESS: Database connection OK
echo.

echo Step 6: Creating database tables...
python manage.py makemigrations
python manage.py migrate
if errorlevel 1 (
    echo ERROR: Migration failed
    pause
    exit /b 1
)
echo SUCCESS: Database tables created
echo.

echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Create superuser: python manage.py createsuperuser
echo 2. Create global settings (see MANUAL_SETUP.md)
echo 3. Start Redis: docker run -d -p 6379:6379 redis:7-alpine
echo 4. Start Django: python manage.py runserver
echo 5. Start Celery: celery -A config worker --pool=gevent -l info
echo.
echo Access your app at: http://localhost:8000/admin
echo.
pause
