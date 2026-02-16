# Generated migration for Document app

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import apps.documents.models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('contenttypes', '0002_remove_content_type_name'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='DocumentCategory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, unique=True)),
                ('description', models.TextField(blank=True)),
                ('parent', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='subcategories', to='documents.documentcategory')),
            ],
            options={
                'verbose_name': 'Document Category',
                'verbose_name_plural': 'Document Categories',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='Document',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('title', models.CharField(help_text='Document title or description', max_length=255)),
                ('document_type', models.CharField(choices=[('invoice_received', 'Invoice Received (from Supplier)'), ('invoice_sent', 'Invoice Sent (to Customer)'), ('supplier_sheet', 'Supplier Sheet'), ('supplier_catalog', 'Supplier Catalog'), ('book_ad', 'Book Advertisement'), ('purchase_order', 'Purchase Order'), ('receipt', 'Receipt'), ('contract', 'Contract'), ('correspondence', 'Correspondence/Email'), ('other', 'Other')], db_index=True, help_text='Type of document', max_length=50)),
                ('file', models.FileField(help_text='Upload PDF, image, or other document', upload_to=apps.documents.models.document_upload_path)),
                ('object_id', models.PositiveIntegerField(blank=True, help_text='ID of related object', null=True)),
                ('document_date', models.DateField(blank=True, help_text='Date on the document (e.g., invoice date)', null=True)),
                ('reference_number', models.CharField(blank=True, help_text='Invoice number, PO number, etc.', max_length=100)),
                ('notes', models.TextField(blank=True, help_text='Additional notes about this document')),
                ('tags', models.CharField(blank=True, help_text='Comma-separated tags for easy searching', max_length=255)),
                ('content_type', models.ForeignKey(blank=True, help_text='Type of related object (Order, Supplier, Book, etc.)', null=True, on_delete=django.db.models.deletion.CASCADE, to='contenttypes.contenttype')),
                ('uploaded_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='uploaded_documents', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Document',
                'verbose_name_plural': 'Documents',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='document',
            index=models.Index(fields=['document_type', '-created_at'], name='documents_d_documen_5f1e8e_idx'),
        ),
        migrations.AddIndex(
            model_name='document',
            index=models.Index(fields=['content_type', 'object_id'], name='documents_d_content_7a9c0f_idx'),
        ),
        migrations.AddIndex(
            model_name='document',
            index=models.Index(fields=['-document_date'], name='documents_d_documen_c8d9a7_idx'),
        ),
    ]
