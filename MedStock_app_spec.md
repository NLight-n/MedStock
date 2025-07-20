---

## 📦 Prompt: Create a Stock Management Web Application for the Interventional Radiology Department

---

### 🔐 Authentication & Permission-Based Access Control

#### User Model:
- Users created **only by Admin**
- Each user has:
  - **Descriptive Role**: Doctor, Nurse, Technician, Admin, Others (for display only)
  - **Permissions**: Explicitly assigned; no access granted based on role

#### Permissions:

| Permission          | Description                                                                 |
|---------------------|-----------------------------------------------------------------------------|
| ✅ **View Only**     | Always enabled by default; allows viewing all modules                       |
| Edit Materials       | Add/edit inventory items and batches                                        |
| Record Usage         | Record materials used during procedures; deducts stock automatically        |
| Edit Documents       | Upload, edit, delete document images and metadata                           |
| Manage Settings      | Access to general/config settings, manage master data                       |
| Manage Users         | Admin only: manage users, assign roles and permissions                      |

---

### 🧭 Pages & Features Overview

#### 1. **Initial Setup Page (One-Time Only)**
- Create the first **Admin User**
- Connect to **PostgreSQL** database:
  - Host, Port, Username, Password, DB Name
- **Choose file storage location**:
  - Local folder path or **network-shared folder** for storing document images (e.g., `\\NetworkDrive\RadiologyDocs`)
- After setup: redirect to login page

---

#### 2. **Login Page**
- Secure login with email/username and password
- No public sign-up

---

#### 3. **Dashboard**
- Displays:
  - Recent Activity
  - Low Stock Alerts
  - Expiring Soon Alerts
- Charts:
  - Inventory by category
  - Top-used materials
  - Expiry patterns
  - Monthly usage trends

---

#### 4. **Inventory Page**
- **Parent Materials**:
  - Name, Size, Brand, Material Type
- **Child Batches**:
  - **Required**: Quantity, Purchase Type, Vendor, Expiration Date, Storage Location  
  - **Optional**: Lot Number, Invoice/DC numbers (link later if needed)  
  - **Auto-filled**: Stock Added Date, Added By
- Many-to-many linkage to documents (Invoice/DC/PO)

**Features**:
- Filters:
  - Material Type, Brand, Vendor, Purchase Type, Stock Status (default = In Stock)
- Real-time search (name, brand, vendor)
- Entry counter: `X of Y entries` (by parent material)
- Lazy-expand for batch details
- Export: PDF / Excel
- Requires **Edit Materials** permission to add/edit
- All users with **View Only** can view full details, filter, and search

---

#### 5. **Usage Page**
- Input:
  - Patient Name, ID, Procedure Name, Date, Time (auto-filled), Physician
  - Material usage: Select parent → Suggest FEFO batch → Enter quantity
- Auto deducts stock from selected batch

**Features**:
- View-only users can search/filter and view records
- Users with **Record Usage** permission can add new entries
- Export as PDF / Excel

---

#### 6. **Documents Page**
- Document fields:
  - Type (Invoice / Delivery Challan / Purchase Order)
  - Document Number *(required)*
  - Date *(required)*
  - Vendor *(optional)*
  - Upload scanned document (stored locally)
- Documents link to multiple batches

**Features**:
- All users with **View Only** can view and search documents
- Only users with **Edit Documents** permission can upload/edit/delete

---

#### 7. **Settings Page**
- **Visible only with "Manage Settings" permission**
- Tabs:
  - General Settings
  - Material Types
  - Brands
  - Vendors
  - Physicians
  - Backup (Create / Restore)
  - **User Management** (Admin only):
    - Create/edit/delete users
    - Assign roles (for label only) and permissions (functional control)
  - **Data Log**:
    - Tracks every change (material edit, usage recorded, document uploaded, settings change, etc.)
    - Shows: User, Action, Item affected (material name, quantity), Timestamp – newest first

---

#### 8. **Analytics Page**
- Visual reports and trends:
  - Inventory status
  - Usage by material, type, date
  - **Month-wise usage breakdown**
- Filters: Material Type, Date Range, Physician
- Export: PDF / Excel
- Accessible to all users with **View Only**

---

#### 9. **User Profile Page**
- Users can edit:
  - Username
  - Email
  - Password
- Cannot view or change roles/permissions

---

### 🧱 Data Model Summary

#### Material
- Name, Size, Brand, Type
- Linked Batches

#### Batch
- Quantity, Purchase Type, Vendor, Expiry, Storage Location *(required)*
- Lot Number, Bill_Number (Linked Document), Cost (optional)
- Stock Added Date, Added By (auto)
- Many-to-many link to documents

#### Document
- Type, Bill_Number, Date, Vendor
- Image file
- Linked to one or more batches (using Bill_Number)

#### Usage Record
- Patient Info, Procedure Details, Date/Time
- Materials used: Material → Batch → Quantity

#### User
- Username, Email, Password
- Role (for label only)
- Explicit permissions (View Only + others as assigned)

---

### 🗃️ File Storage Configuration

- All document uploads (Invoice/DC/PO) are stored **locally**
- During **initial setup**, allow admin to:
  - Choose a **network-shared folder path** (e.g., `\\HospitalNAS\IR_Documents`)
  - Or leave blank to use a **default local storage path**

---

### 🛠️ Optional Tech Stack

| Layer       | Recommendation                     |
|-------------|------------------------------------|
| Frontend    | Next.js                            |
| Backend     | Next.js                            |
| Database    | PostgreSQL                         |
| ORM         | Prisma                             |
| Auth        | JWT or session-based               |
| File Storage| minIO                              |
| Export      | jsPDF, SheetJS                     |
| Charts      | Chart.js, ApexCharts, or ECharts   |

---

### UI should be optimized to both PC and Phone