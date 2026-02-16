# Generated migration for payment tracking

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='amount_paid',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10, help_text='Total amount paid by customer'),
        ),
        migrations.AddField(
            model_name='order',
            name='deposit_amount',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10, help_text='Deposit/advance payment'),
        ),
        migrations.AddField(
            model_name='order',
            name='payment_status',
            field=models.CharField(
                choices=[
                    ('unpaid', 'Unpaid'),
                    ('deposit', 'Deposit Paid'),
                    ('partial', 'Partially Paid'),
                    ('paid', 'Fully Paid'),
                ],
                default='unpaid',
                max_length=20,
                db_index=True
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='payment_notes',
            field=models.TextField(blank=True, help_text='Payment history and notes'),
        ),
    ]
