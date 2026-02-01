# 🚀 Phase 2 Instructions for Claude Code

**Context:** Phase 1 (Core Architecture & Sales) is complete. We are now moving to Phase 2: Refinement, New Features, and Real Data Injection.

---

## 📋 Phase 2 Task Priority Order

1. 🚨 **Critical Bug Fix** - Refund Crash
2. 👥 **Feature 5** - Clients CRUD (Connect existing page)
3. 📦 **Feature 6** - Orders/Pedidos System (Connect existing page)
4. 📊 **Feature 7** - Basic Reports
5. 🛠️ **Feature 1** - Role System Refactor
6. 💰 **Feature 2** - Accounting Module
7. 🧪 **Feature 3** - Dev/Test Environment UI
8. 🔓 **Feature 4** - Superuser Data Editing
9. 📝 **Data Injection** - Real Data for "I.E Caracas"
10. ✅ **Testing Strategy** - Unit & Integration Tests

---

## 🚨 Critical Bug Fix: Refund Crash

**Issue:** The application crashes (white screen) when attempting a refund.
**Error:** `422 Unprocessable Entity` on `POST /api/v1/schools/{id}/sales/{id}/changes`.
**Diagnosis:** The `SaleChangeCreate` schema in `backend/app/schemas/sale.py` has strict validation.
- If `change_type` is `RETURN`, `new_product_id` MUST be None and `new_quantity` MUST be 0.
- If `change_type` is `SIZE_CHANGE`, `new_product_id` is REQUIRED.

**Task:**
1. **Frontend:** Debug `SaleChangeForm` (or equivalent) to ensure it sends the correct payload matching the schema. Handle `422` errors gracefully (show toast, don't crash).
2. **Backend:** Verify the validator logic in `SaleChangeCreate` is not too restrictive or buggy.

---

## 👥 Feature 5: Clients CRUD (HIGH PRIORITY)

**Requirement:** Connect the existing Clients page (`frontend/src/pages/Clients.tsx`) to the real API.
**Current State:** Page exists but shows placeholder/mock data.

**Backend Endpoints (Already exist - verify):**
```
GET    /api/v1/schools/{school_id}/clients          # List clients
POST   /api/v1/schools/{school_id}/clients          # Create client
GET    /api/v1/schools/{school_id}/clients/{id}     # Get client detail
PUT    /api/v1/schools/{school_id}/clients/{id}     # Update client
DELETE /api/v1/schools/{school_id}/clients/{id}     # Delete client
```

**Frontend Tasks:**
1. **List View:**
   - Fetch clients from API on page load
   - Display in table with columns: Nombre, Teléfono, Email, Estudiante, Grado, Última compra
   - Add search/filter functionality
   - Pagination if needed

2. **Create Client Modal:**
   - Form fields: name, phone, email, student_name, grade, notes
   - Validation (required fields, email format, phone format)
   - Submit to POST endpoint
   - Show success/error toast

3. **Edit Client:**
   - Click row to open edit modal
   - Pre-populate form with existing data
   - Submit to PUT endpoint

4. **Delete Client:**
   - Confirmation dialog
   - Soft delete via API
   - Refresh list after delete

**Schema Reference:**
```typescript
interface Client {
  id: string;
  school_id: string;
  name: string;
  phone?: string;
  email?: string;
  student_name?: string;
  grade?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}
```

---

## 📦 Feature 6: Orders/Pedidos System (HIGH PRIORITY)

**Requirement:** Connect the Orders page to real API and implement full order management flow.
**Current State:** Page exists as placeholder.

**Business Context:**
- Orders (Encargos) are custom uniform requests that need production/procurement
- Different from direct sales (ventas) which are immediate
- Orders have lifecycle: PENDING → IN_PROGRESS → READY → DELIVERED/CANCELLED

**Backend Endpoints (Already exist - verify):**
```
GET    /api/v1/schools/{school_id}/orders           # List orders
POST   /api/v1/schools/{school_id}/orders           # Create order
GET    /api/v1/schools/{school_id}/orders/{id}      # Get order detail
PUT    /api/v1/schools/{school_id}/orders/{id}      # Update order
PATCH  /api/v1/schools/{school_id}/orders/{id}/status  # Change status
DELETE /api/v1/schools/{school_id}/orders/{id}      # Cancel order
```

**Frontend Tasks:**

1. **Orders List View:**
   - Table columns: Código, Cliente, Items, Total, Estado, Fecha Entrega, Abono
   - Status badges with colors (Pending=yellow, InProgress=blue, Ready=green, Delivered=gray)
   - Filter by status
   - Search by client name or order code

2. **Create Order Flow:**
   - Step 1: Select/Create Client
   - Step 2: Add Items (product, size, quantity, custom measurements if needed)
   - Step 3: Set delivery date, notes, deposit (abono)
   - Step 4: Review and confirm
   - Generate order code: `ENC-YYYY-NNNN`

3. **Order Detail View:**
   - Show all order info
   - List of items with measurements
   - Payment history (deposits)
   - Status change buttons (for ADMIN/SELLER)
   - Print order ticket

4. **Status Management:**
   - PENDING → IN_PROGRESS (start production)
   - IN_PROGRESS → READY (ready for pickup)
   - READY → DELIVERED (customer picked up, final payment)
   - Any → CANCELLED (with reason)

5. **Deposit/Payment Tracking:**
   - Record initial deposit (abono)
   - Record additional payments
   - Show remaining balance
   - Mark as fully paid when delivered

**Schema Reference:**
```typescript
interface Order {
  id: string;
  school_id: string;
  code: string;  // ENC-2025-0001
  client_id: string;
  client?: Client;
  status: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'DELIVERED' | 'CANCELLED';
  total_amount: number;
  deposit_amount: number;
  remaining_balance: number;
  delivery_date?: string;
  notes?: string;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product?: Product;
  quantity: number;
  unit_price: number;
  subtotal: number;
  size?: string;
  custom_measurements?: Record<string, any>;  // JSONB for custom sizes
  notes?: string;
}
```

---

## 📊 Feature 7: Basic Reports (HIGH PRIORITY)

**Requirement:** Implement basic reporting functionality for business insights.
**Location:** New page `frontend/src/pages/Reports.tsx` or Dashboard enhancement.

**Reports to Implement:**

### 7.1 Sales Report
- **Daily Sales:** Total sales for today, item count, payment method breakdown
- **Weekly/Monthly Sales:** Chart showing sales trend
- **Top Products:** Best selling products by quantity and revenue
- **Sales by Payment Method:** Cash vs Transfer vs Card breakdown

### 7.2 Inventory Report
- **Low Stock Alert:** Products with stock < threshold (e.g., 5 units)
- **Stock Value:** Total inventory value (quantity × price)
- **Stock Movement:** Products with most movement (sales + returns)

### 7.3 Orders Report
- **Pending Orders:** Orders awaiting production
- **Orders by Status:** Pie chart of order statuses
- **Upcoming Deliveries:** Orders due this week

### 7.4 Client Report
- **Top Clients:** Clients with most purchases
- **New Clients:** Clients registered this month
- **Client Purchase History:** Individual client report

**Backend Endpoints (Create if not exist):**
```
GET /api/v1/schools/{school_id}/reports/sales/daily
GET /api/v1/schools/{school_id}/reports/sales/summary?period=week|month|year
GET /api/v1/schools/{school_id}/reports/inventory/low-stock
GET /api/v1/schools/{school_id}/reports/inventory/value
GET /api/v1/schools/{school_id}/reports/orders/pending
GET /api/v1/schools/{school_id}/reports/clients/top
```

**Frontend Components:**
- Use charts library (recharts or chart.js)
- Cards for KPIs (Total Sales, Orders Pending, Low Stock Count)
- Tables for detailed data
- Date range selector for filtering
- Export to PDF/Excel (optional, can be Phase 3)

---

## 🛠️ Feature 1: Role System Refactor

**Requirement:** Implement 4 distinct roles with specific permissions.
**Current State:** `UserRole` enum has `OWNER`, `ADMIN`, `SELLER`, `VIEWER`.

**New Structure:**
1. **DEVELOPER (Superuser):**
   - **Access:** UNLIMITED. Can modify DB configs, see all tenants, edit ANY data.
   - **Implementation:** Use `is_superuser=True` flag in `User` model.

2. **ADMIN (Business Owner):**
   - **Access:** Full access to Business Data (Sales, Inventory, Accounting, Users).
   - **Restriction:** NO access to technical DB configurations or system-level settings.

3. **SELLER:**
   - **Access:** Sales (Create/Read), Inventory (Read), Clients (Read/Create), Orders (Create/Read/Update status).
   - **Restriction:** NO access to Accounting, NO delete permissions.

4. **CLIENT:**
   - **Access:** Future web portal (Read own orders).

**Action:** Update `UserRole` enum and `api/dependencies.py` to reflect these scopes.

---

## 💰 Feature 2: Accounting Module

**Requirement:** Full accounting system, not just accounts payable.

**Scope:**
- **Income:** Automatic tracking from Sales (Cash, Transfer, etc.).
- **Expenses:** Module to register business expenses (Rent, Utilities, Payroll, Supplies).
- **Cash Flow:** Daily/Monthly balance view.
- **Models:** Create `Transaction`, `Expense`, `Account` models.

**UI Components:**
- Expenses list with CRUD
- Income summary (auto-generated from sales)
- Daily cash register view
- Monthly profit/loss summary

---

## 🧪 Feature 3: Dev/Test Environment UI

**Requirement:** A UI tool for the Developer to switch contexts easily.

**Features:**
- **Environment Switcher:** Toggle between `LOCAL` (Mac Dev) and `LAN/PROD` (Windows User View).
- **Role Impersonation:** "View as Seller", "View as Admin" buttons for testing permissions without relogging.
- **Debug Info:** Show current API URL, Latency, and Tenant ID in a floating dev bar (visible only to Developer).

---

## 🔓 Feature 4: Superuser Data Editing

**Requirement:** Developer must be able to edit ANY field in the UI.

**Action:**
- Add "Edit Mode" toggle for Superusers.
- Allow inline editing of "Read-Only" fields (like Stock, Prices, Historical Dates) when in Edit Mode.

---

## 📝 Data Injection: "Uniformes Consuelo Rios"

**Source:** `ListasPrecios/precios_uniformes_caracas.md`

**Action:**
1. **Read the file:** Parse product information from the markdown file
2. **Create Seed Script:** Create `scripts/seed_real_data.py` to insert:
   - **School:** "I.E Caracas" (or actual school name from file)
   - **Garment Types:** Extract categories (Camisas, Pantalones, etc.)
   - **Products:** Extract items, prices, and sizes from file
   - **Initial Stock:** Set default (e.g., 50) if not specified
3. **Allow UI Upload:** Leave space for uploading/adjusting inventory through the UI

---

## ✅ Testing Strategy

**Requirement:** Tests must be implemented BEFORE Cloud Deployment.

**Action:**
1. **Unit Tests:** `pytest` for all Services:
   - `SaleService` - create sale, validate stock, apply discounts
   - `InventoryService` - adjust stock, reserve stock, check availability
   - `OrderService` - create order, change status, calculate balance
   - `ClientService` - CRUD operations

2. **Integration Tests:** Test full flows:
   - Create Sale → Inventory Update → (Future: Accounting Entry)
   - Create Order → Status Changes → Final Delivery
   - Create Change/Return → Inventory Adjustment

3. **Test Coverage Target:** Minimum 80% for services

---

## 🔄 Implementation Order Recommendation

### Sprint 1 (Immediate - This Session)
1. ✅ Fix Refund Crash Bug
2. ✅ Clients CRUD Connection
3. ✅ Orders Page Connection (basic list + create)

### Sprint 2 (Next Session)
4. Orders Full Flow (status management, payments)
5. Basic Reports (Sales + Inventory)
6. Role System Refactor

### Sprint 3 (Before Cloud)
7. Accounting Module
8. Dev/Test Environment UI
9. Real Data Injection
10. Unit Tests

### Sprint 4 (Cloud Deployment)
11. VPS Setup
12. Database Migration
13. SSL + Domain
14. Production Testing

---

**Next Step:** Start with Critical Bug Fix, then move to Clients CRUD.
