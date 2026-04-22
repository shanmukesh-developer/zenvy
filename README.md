# 🚨 STOP! READ THIS BEFORE DEPLOYING 🚨

Bro, this is a **Monorepo** (multiple apps in one). If you just click "New Web Service" and select this repo, it will **FAIL** with a "package.json not found" error.

## ✅ THE ONLY WAY TO DEPLOY (Click "Blueprint")
Follow these **exact** steps on Render:

1.  **Go to Dashboard**: [https://dashboard.render.com](https://dashboard.render.com)
2.  **Click "New +"**: Select **Blueprint** (the one with the map icon 🗺️).
3.  **Select Repo**: Connect your `zenvy` repository.
4.  **Confirm**: Render will read `render.yaml` and show you 5 services (Backend, Customer, Delivery, Restaurant, Admin).
5.  **Click "Apply"**: That's it! It will deploy everything in the correct order.

## 🚀 LOCAL DEVELOPMENT (Zenvy unified startup)
If you want to run the system locally for testing:

1. **Seed the Database**:
   ```bash
   cd backend
   npm run seed # or node scripts/unified_seed.js
   ```
   This will initialize the database with standard components (Nexus Omni-Kitchen, Mock Orders, Vault Items) and create the standard test credentials.

2. **Standard Test Credentials**:
   - **Admin**: `9391955674` / `zenvy_admin`
   - **Delivery Partner**: `driver1` / `password123`
   - **Customer (Student)**: `9123456789` / `password123`
   - **Customer (System Admin)**: `9999999999` / `admin123`

3. **Verify System Health**:
   ```bash
   cd backend
   node scripts/verify_system.js
   ```

---

## 🛠️ IF YOU MUST DEPLOY MANUALLY (Not Recommended)
If you decide to create a "Web Service" anyway, you **MUST** change the **Root Directory** in the Render settings to `backend`, `frontend`, etc. Otherwise, it will keep failing.
