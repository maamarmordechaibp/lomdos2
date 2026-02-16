# Bookstore Management System

A Django-based bookstore management system with zero-inventory model, supplier ordering, and multilingual support (Hebrew/English).

## Features

- **Customer Management**: Hebrew/English names, autocomplete search
- **Book Catalog**: ISBN barcodes, multilingual titles, price history
- **Supplier Ordering**: Automatic order aggregation, email integration
- **Price Management**: Configurable profit margins per book
- **Barcode Support**: Generate labels, scan for quick lookup
- **Reporting**: Sales analytics, profit analysis, Excel/PDF export
- **Async Processing**: Celery for background email tasks

## Setup

### Prerequisites

- Python 3.11+
- Supabase Database (already configured)
- Redis (or Memurai for Windows)

### Installation

1. Install dependencies:
```bash
poetry install
```

2. Copy environment file:
```bash
copy .env.example .env
```

3. Configure `.env` with your database and email settings

4. Run migrations:
```bash
python manage.py migrate
```

5. Create superuser:
```bash
python manage.py createsuperuser
```

6. Run development server:
```bash
python manage.py runserver
```

### Running Celery (Windows)

Terminal 1 - Redis:
```bash
docker run -d -p 6379:6379 redis:7-alpine
```

Terminal 2 - Django:
```bash
python manage.py runserver
```

Terminal 3 - Celery Worker:
```bash
celery -A config worker --pool=gevent -l info
```

Terminal 4 - Celery Beat:
```bash
celery -A config beat -l info
```

Terminal 5 - Flower (optional monitoring):
```bash
celery -A config flower --port=5555
```

## Project Structure

```
bookstore/
├── apps/
│   ├── books/          # Book catalog
│   ├── customers/      # Customer management
│   ├── orders/         # Sales orders
│   ├── suppliers/      # Supplier management
│   ├── pricing/        # Price history & margins
│   ├── inventory/      # Barcode & labels
│   ├── reports/        # Analytics & reports
│   └── core/           # Shared utilities
├── config/             # Django settings
├── templates/          # HTML templates
└── static/             # CSS, JS, images
```

## License

MIT
