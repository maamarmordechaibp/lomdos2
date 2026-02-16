# Generated migration for Gift Card and Customer Payment models

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0001_initial'),  # Adjust to your last migration
        ('orders', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='GiftCard',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('card_number', models.CharField(db_index=True, help_text='Gift card number (e.g., GC-XXXX-XXXX-XXXX)', max_length=20, unique=True)),
                ('pin', models.CharField(blank=True, help_text='Optional PIN for security', max_length=6)),
                ('initial_balance', models.DecimalField(decimal_places=2, help_text='Starting balance when card was issued', max_digits=10)),
                ('current_balance', models.DecimalField(decimal_places=2, help_text='Current available balance', max_digits=10)),
                ('status', models.CharField(choices=[('active', 'Active'), ('used', 'Fully Used'), ('expired', 'Expired'), ('cancelled', 'Cancelled')], db_index=True, default='active', max_length=20)),
                ('issued_date', models.DateTimeField(auto_now_add=True)),
                ('expiry_date', models.DateField(blank=True, help_text='Expiration date (if applicable)', null=True)),
                ('last_used', models.DateTimeField(blank=True, help_text='Last transaction date', null=True)),
                ('notes', models.TextField(blank=True, help_text='Gift message or notes')),
                ('customer', models.ForeignKey(blank=True, help_text='Current card holder', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='gift_cards', to='customers.customer')),
                ('purchaser', models.ForeignKey(blank=True, help_text='Person who originally purchased the card', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='purchased_gift_cards', to='customers.customer')),
            ],
            options={
                'verbose_name': 'Gift Card',
                'verbose_name_plural': 'Gift Cards',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='GiftCardTransaction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('transaction_type', models.CharField(choices=[('credit', 'Credit (Load/Refund)'), ('debit', 'Debit (Purchase)')], max_length=10)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=10)),
                ('balance_after', models.DecimalField(decimal_places=2, help_text='Balance after this transaction', max_digits=10)),
                ('description', models.CharField(blank=True, max_length=255)),
                ('gift_card', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='transactions', to='customers.giftcard')),
                ('order', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='gift_card_transactions', to='orders.order')),
            ],
            options={
                'verbose_name': 'Gift Card Transaction',
                'verbose_name_plural': 'Gift Card Transactions',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='CustomerPayment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('amount', models.DecimalField(decimal_places=2, help_text='Payment amount', max_digits=10)),
                ('payment_method', models.CharField(choices=[('cash', 'Cash'), ('credit_card', 'Credit Card'), ('debit_card', 'Debit Card'), ('bank_transfer', 'Bank Transfer'), ('check', 'Check'), ('gift_card', 'Gift Card'), ('store_credit', 'Store Credit'), ('other', 'Other')], max_length=20)),
                ('payment_date', models.DateTimeField(auto_now_add=True)),
                ('reference_number', models.CharField(blank=True, help_text='Check number, transaction ID, etc.', max_length=100)),
                ('is_applied', models.BooleanField(default=False, help_text='Has this payment been applied to an order?')),
                ('notes', models.TextField(blank=True)),
                ('customer', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payments', to='customers.customer')),
                ('order', models.ForeignKey(blank=True, help_text='Specific order this payment is for (if any)', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='customer_payments', to='orders.order')),
            ],
            options={
                'verbose_name': 'Customer Payment',
                'verbose_name_plural': 'Customer Payments',
                'ordering': ['-payment_date'],
            },
        ),
        migrations.AddIndex(
            model_name='giftcard',
            index=models.Index(fields=['card_number'], name='customers_g_card_nu_a1b2c3_idx'),
        ),
        migrations.AddIndex(
            model_name='giftcard',
            index=models.Index(fields=['status', '-created_at'], name='customers_g_status_d4e5f6_idx'),
        ),
        migrations.AddIndex(
            model_name='giftcard',
            index=models.Index(fields=['customer'], name='customers_g_custome_g7h8i9_idx'),
        ),
        migrations.AddIndex(
            model_name='customerpayment',
            index=models.Index(fields=['customer', '-payment_date'], name='customers_c_custome_j1k2l3_idx'),
        ),
        migrations.AddIndex(
            model_name='customerpayment',
            index=models.Index(fields=['order'], name='customers_c_order_i_m4n5o6_idx'),
        ),
        migrations.AddIndex(
            model_name='customerpayment',
            index=models.Index(fields=['-payment_date'], name='customers_c_payment_p7q8r9_idx'),
        ),
    ]
