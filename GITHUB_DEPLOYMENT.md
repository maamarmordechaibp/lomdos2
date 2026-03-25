# GitHub Deployment Guide

## ✅ Git Repository Initialized

Your code has been committed to a local git repository!

## Steps to Push to GitHub

### Option 1: Create New Repository on GitHub (Recommended)

1. **Go to GitHub**: https://github.com/new

2. **Create Repository**:
   - Repository name: `bookstore-management` (or your preferred name)
   - Description: "Bookstore management system with orders, inventory, and customer tracking"
   - **Important**: Do NOT initialize with README, .gitignore, or license (we already have these)
   - Click "Create repository"

3. **Push Your Code** (GitHub will show you these commands):
   ```powershell
   # Add the remote repository
   git remote add origin https://github.com/YOUR-USERNAME/bookstore-management.git
   
   # Push your code
   git push -u origin master
   ```

### Option 2: Push to Existing Repository

If you already have a repository:

```powershell
# Add your repository URL
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git

# Push to main or master branch
git push -u origin master
# OR
git push -u origin main
```

### Authentication

If prompted for credentials:

**Option A: Personal Access Token (Recommended)**
1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with `repo` scope
3. Use token as password when prompted

**Option B: SSH Key**
```powershell
# Generate SSH key
ssh-keygen -t ed25519 -C "your.email@example.com"

# Add to GitHub: Settings → SSH and GPG keys → New SSH key
cat ~/.ssh/id_ed25519.pub

# Change remote to SSH
git remote set-url origin git@github.com:YOUR-USERNAME/YOUR-REPO-NAME.git
```

---

## SQL Requirements

### ✅ No Manual SQL Required!

**Good news**: Django migrations handle everything automatically. You don't need to run any SQL scripts manually.

### What You Need to Do:

#### 1. Run Django Migrations (Required)

```powershell
# Apply all database schema changes
python manage.py migrate

# Or use the script:
.\apply_migrations.ps1
```

This will create these new tables:
- ✅ `documents_document` - Document storage
- ✅ `documents_documentcategory` - Document categories
- ✅ `customers_giftcard` - Gift cards
- ✅ `customers_giftcardtransaction` - Gift card transactions
- ✅ `customers_customerpayment` - Customer payments
- ✅ `orders_orderitem` (modified) - Added discount fields

#### 2. Supabase SQL (Optional - Only for Phone Calls Feature)

If you're using the phone call features:

**File**: [supabase/migrations/001_phone_call_logs.sql](supabase/migrations/001_phone_call_logs.sql)

**Where to run**:
1. Go to: https://supabase.com/dashboard/project/dbpkdibyecqnlwrmqwjr/sql/new
2. Copy the contents of `001_phone_call_logs.sql`
3. Paste and run

**What it creates**:
- `phone_call_logs` table in Supabase for tracking SignalWire calls

**Note**: This is separate from your main Django database and only needed if you're using the phone notification feature.

---

## Complete Deployment Checklist

### Before Pushing to GitHub:

- [x] Git repository initialized
- [x] All files committed
- [x] .gitignore created
- [ ] Update .env.example with your settings (optional)
- [ ] Remove any sensitive data from code

### After Pushing to GitHub:

1. **Run Migrations**:
   ```powershell
   python manage.py migrate
   ```

2. **Test the Features**:
   - [ ] Documents upload works
   - [ ] Gift cards can be created
   - [ ] Discounts display correctly
   - [ ] Payment sync works

3. **Supabase Setup** (if using phone calls):
   - [ ] Run `001_phone_call_logs.sql` in Supabase
   - [ ] Deploy edge functions (see SUPABASE_SETUP.md)
   - [ ] Configure voicemail (see VOICEMAIL_SETUP.md)

---

## Quick Commands Reference

### Push to GitHub:
```powershell
# First time only
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin master

# Future updates
git add .
git commit -m "Your commit message"
git push
```

### Run Migrations:
```powershell
python manage.py migrate
```

### Check Migration Status:
```powershell
python manage.py showmigrations
```

### Create Backup Before Migrations:
```powershell
python manage.py dumpdata > backup_before_migration.json
```

---

## What's in Your Commit

**New Features (146 files changed, 16,141 lines added)**:

1. ✅ Document Management System
   - `apps/documents/` - Complete app
   - Templates for upload and viewing

2. ✅ Gift Card System
   - `customers_giftcard` model
   - `customers_giftcardtransaction` model
   - Admin interface

3. ✅ Payment Synchronization
   - `customers_customerpayment` model
   - Fixed order payment status sync

4. ✅ Discount Display
   - Modified `OrderItem` with discount fields
   - Updated order detail template

5. ✅ Documentation
   - IMPLEMENTATION_SUMMARY.md
   - QUICK_REFERENCE_YI.md (Yiddish)
   - POST_IMPLEMENTATION_CHECKLIST.md
   - VOICEMAIL_SETUP.md

---

## Troubleshooting

### Issue: "fatal: remote origin already exists"
```powershell
git remote remove origin
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
```

### Issue: "rejected - non-fast-forward"
```powershell
# If you're sure you want to overwrite remote
git push -f origin master
```

### Issue: "Permission denied (publickey)"
Use HTTPS instead of SSH, or set up SSH keys (see above)

---

## Next Steps

1. **Push to GitHub** using commands above
2. **Run migrations**: `python manage.py migrate`
3. **Test features** using POST_IMPLEMENTATION_CHECKLIST.md
4. **Configure voicemail** (optional) using VOICEMAIL_SETUP.md

---

**Summary**:
- ✅ Code committed locally
- ⏳ Need to push to GitHub (instructions above)
- ⏳ Need to run Django migrations (automatic, no manual SQL)
- ⏳ Optional: Supabase SQL for phone features only

Your code is ready to deploy! 🚀
