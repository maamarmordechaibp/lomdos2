# Post-Implementation Checklist

## Immediate Tasks (Must Do Now)

### 1. Run Database Migrations
```powershell
# Option A: Use the script (recommended)
.\apply_migrations.ps1

# Option B: Manual
python manage.py makemigrations
python manage.py migrate
```

**Expected Output:**
- ✅ orders.0002_orderitem_discount_fields
- ✅ documents.0001_initial  
- ✅ customers.0002_giftcard_customerpayment

### 2. Verify Migrations Succeeded
```powershell
python manage.py showmigrations
```
All new migrations should have [X] next to them.

### 3. Test Admin Access
```powershell
# Start the server
python manage.py runserver

# Visit: http://localhost:8000/admin/
```

**Check These Sections:**
- [ ] Documents section appears
- [ ] Gift Cards section appears under Customers
- [ ] Customer Payments section appears under Customers

---

## Testing Tasks (Do After Migrations)

### Test 1: Profit Removed from Bills
1. Go to an order: http://localhost:8000/orders/{id}/
2. **Expected**: No profit shown on the page
3. Go to admin: http://localhost:8000/admin/orders/order/{id}/
4. **Expected**: Profit IS shown in admin

**Status**: ⬜ Passed / ⬜ Failed

---

### Test 2: Discount Display
1. In admin, create a new order
2. Add an item with:
   - `original_price`: 100.00
   - `unit_price`: 80.00
   - `discount_percentage`: 20
3. View the order at `/orders/{id}/`
4. **Expected**: 
   - See $100.00 with strikethrough
   - See $80.00 in green
   - See discount badge showing "20%"

**Status**: ⬜ Passed / ⬜ Failed

---

### Test 3: Document Upload
1. Go to http://localhost:8000/documents/
2. Click "Upload Document"
3. Upload a test PDF or image
4. Fill in:
   - Title: "Test Invoice"
   - Type: "Invoice Received"
   - Reference #: "INV-001"
5. Save
6. **Expected**: Document appears in list, can download

**Status**: ⬜ Passed / ⬜ Failed

---

### Test 4: Gift Card Creation
1. Go to Admin → Gift Cards → Add
2. Enter initial balance: 100.00
3. Leave card_number blank (auto-generated)
4. Save
5. **Expected**: Card number like "GC-XXXX-XXXX-XXXX" created
6. Check current_balance = 100.00

**Status**: ⬜ Passed / ⬜ Failed

---

### Test 5: Gift Card Usage
```python
# In Django shell: python manage.py shell

from apps.customers.models import GiftCard

# Get the card you created
card = GiftCard.objects.first()

# Check if valid
is_valid, msg = card.is_valid()
print(f"Valid: {is_valid}, Message: {msg}")

# Deduct $50
deducted = card.deduct(50.00, "Test purchase")
print(f"Deducted: ${deducted}")

# Check balance
print(f"New balance: ${card.current_balance}")

# Check transaction history
for txn in card.get_transaction_history():
    print(f"{txn.transaction_type}: ${txn.amount} -> ${txn.balance_after}")
```

**Expected Output:**
- Valid: True
- Deducted: $50.00
- New balance: $50.00
- Transaction listed

**Status**: ⬜ Passed / ⬜ Failed

---

### Test 6: Customer Payment
1. Admin → Customer Payments → Add
2. Select a customer
3. Enter amount: 100.00
4. Select an order
5. Save
6. Click the action checkbox for this payment
7. Select "Apply payments to linked orders"
8. Go to the order
9. **Expected**: Order shows payment, status updated

**Status**: ⬜ Passed / ⬜ Failed

---

### Test 7: Payment Synchronization
1. Create an order with total: $200
2. Record a payment of $100
3. **Expected**: 
   - Order status: "Partially Paid"
   - Amount paid: $100
   - Balance due: $100
4. Record another payment of $100
5. **Expected**:
   - Order status: "Fully Paid"
   - paid field: True
   - Balance due: $0

**Status**: ⬜ Passed / ⬜ Failed

---

## Configuration Tasks (Do After Testing)

### Voicemail Setup
See [VOICEMAIL_SETUP.md](VOICEMAIL_SETUP.md)

**Steps:**
1. Choose Option 1, 2, or 3
2. Configure SignalWire number
3. Test by calling +18456048845
4. Don't answer, let forward to voicemail
5. Leave test message
6. Verify receipt

**Status**: ⬜ Configured / ⬜ Pending

---

## Optional Enhancements

### Add to Base Template Navigation
Edit [templates/base.html](templates/base.html) to add Documents link:

```html
<!-- Find the navigation section and add: -->
<li class="nav-item">
    <a class="nav-link" href="{% url 'documents:document_list' %}">
        <i class="bi bi-files"></i> Documents
    </a>
</li>
```

### Create Sample Data
```python
# In Django shell
from apps.customers.models import GiftCard, Customer
from apps.documents.models import Document

# Create sample gift cards
customer = Customer.objects.first()
GiftCard.objects.create(
    initial_balance=50.00,
    current_balance=50.00,
    customer=customer,
    notes="Bar Mitzvah gift"
)
```

---

## Troubleshooting

### Issue: Migration Fails
**Error**: "No such column: orders_orderitem.original_price"
**Solution**: 
```powershell
python manage.py migrate orders --fake-initial
python manage.py migrate orders
```

### Issue: Import Error
**Error**: "cannot import name 'Document'"
**Solution**: Restart Django development server
```powershell
# Stop server (Ctrl+C)
python manage.py runserver
```

### Issue: 404 on /documents/
**Solution**: Make sure URLs are configured
```powershell
# Restart server
python manage.py runserver
```

### Issue: Files Won't Upload
**Solution**: Check media directory exists
```powershell
# Create media directory if missing
mkdir media\documents
```

---

## Success Criteria

All tasks marked as "Passed" or "Configured":
- [ ] Migrations applied successfully
- [ ] Profit removed from customer bills
- [ ] Discounts display correctly
- [ ] Documents can be uploaded
- [ ] Gift cards can be created and used
- [ ] Payments sync with orders
- [ ] Voicemail configured (optional)

---

## Next Steps After All Tests Pass

1. **Backup Database**
   ```powershell
   python manage.py dumpdata > backup.json
   ```

2. **Create Test Data**
   - 5-10 sample gift cards
   - Sample documents (invoices, supplier sheets)
   - Test orders with discounts

3. **Train Users**
   - Show how to upload documents
   - Show how to manage gift cards
   - Show how to record payments

4. **Monitor**
   - Check payment synchronization daily for first week
   - Verify gift card transactions
   - Test voicemail forwarding

---

**Date Completed**: ______________  
**Tested By**: ______________  
**Issues Found**: ______________  
**Status**: ⬜ Ready for Production / ⬜ Needs Fixes
