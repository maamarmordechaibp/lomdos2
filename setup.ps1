# Quick Setup Script for Bookstore Management System
# Run this after installing Python, PostgreSQL, and Redis/Docker

Write-Host "=== Bookstore Management System - Quick Setup ===" -ForegroundColor Green
Write-Host ""

# Check if Python is installed
Write-Host "Checking Python installation..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✓ Found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Python not found. Please install Python 3.11+ from python.org" -ForegroundColor Red
    exit 1
}

# Create virtual environment
Write-Host "`nCreating virtual environment..." -ForegroundColor Yellow
if (Test-Path "venv") {
    Write-Host "✓ Virtual environment already exists" -ForegroundColor Green
} else {
    python -m venv venv
    Write-Host "✓ Virtual environment created" -ForegroundColor Green
}

# Activate virtual environment
Write-Host "`nActivating virtual environment..." -ForegroundColor Yellow
& ".\venv\Scripts\Activate.ps1"

# Upgrade pip
Write-Host "`nUpgrading pip..." -ForegroundColor Yellow
python -m pip install --upgrade pip

# Install poetry
Write-Host "`nInstalling Poetry..." -ForegroundColor Yellow
pip install poetry

# Install dependencies
Write-Host "`nInstalling project dependencies (this may take a few minutes)..." -ForegroundColor Yellow
poetry install

# Create .env file if it doesn't exist
if (-not (Test-Path ".env")) {
    Write-Host "`nCreating .env file from template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✓ .env file created. IMPORTANT: Edit .env with your settings!" -ForegroundColor Green
    Write-Host "  - Set DB_PASSWORD to your PostgreSQL password" -ForegroundColor Cyan
    Write-Host "  - Set EMAIL credentials for Gmail" -ForegroundColor Cyan
    Write-Host "  - Change SECRET_KEY for production" -ForegroundColor Cyan
} else {
    Write-Host "✓ .env file already exists" -ForegroundColor Green
}

# Check if .env is configured
Write-Host "`n=== Configuration Check ===" -ForegroundColor Yellow
$envContent = Get-Content ".env" -Raw
if ($envContent -match "your-supabase-password" -or $envContent -match "your-secret-key-here") {
    Write-Host "⚠ WARNING: .env file contains default values!" -ForegroundColor Red
    Write-Host "  You're using SUPABASE database. Please:" -ForegroundColor Red
    Write-Host "  1. Go to: https://supabase.com/dashboard/project/dbpkdibyecqnlwrmqwjr" -ForegroundColor Cyan
    Write-Host "  2. Get your database password from Settings → Database" -ForegroundColor Cyan
    Write-Host "  3. Edit .env file with your Supabase password" -ForegroundColor Cyan
    Write-Host "  See SUPABASE_QUICKSTART.md for detailed instructions" -ForegroundColor Cyan
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        Write-Host "Setup paused. Edit .env file and run this script again." -ForegroundColor Yellow
        exit 0
    }
}

# Run migrations
Write-Host "`nRunning database migrations..." -ForegroundColor Yellow
python manage.py makemigrations
python manage.py migrate

Write-Host "`n=== Setup Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Get your Supabase password from: https://supabase.com/dashboard/project/dbpkdibyecqnlwrmqwjr" -ForegroundColor White
Write-Host "   (Settings → Database → Connection string)" -ForegroundColor White
Write-Host "2. Edit .env file and paste your Supabase password" -ForegroundColor White
Write-Host "3. Make sure Redis is running (Docker: docker run -d -p 6379:6379 redis:7-alpine)" -ForegroundColor White
Write-Host "3. Create superuser: python manage.py createsuperuser" -ForegroundColor White
Write-Host "4. Create global settings:" -ForegroundColor White
Write-Host "   python manage.py shell" -ForegroundColor White
Write-Host "   >>> from apps.pricing.models import GlobalSettings" -ForegroundColor White
Write-Host "   >>> GlobalSettings.objects.create(default_margin_percentage=20.00, currency='USD')" -ForegroundColor White
Write-Host "   >>> exit()" -ForegroundColor White
Write-Host ""
Write-Host "To start the application:" -ForegroundColor Cyan
Write-Host "Terminal 1: python manage.py runserver" -ForegroundColor White
Write-Host "Terminal 2: celery -A config worker --pool=gevent -l info" -ForegroundColor White
Write-Host "Terminal 3: celery -A config beat -l info" -ForegroundColor White
Write-Host ""
Write-Host "Access at: http://localhost:8000" -ForegroundColor Green
Write-Host "Admin panel: http://localhost:8000/admin" -ForegroundColor Green
Write-Host ""
