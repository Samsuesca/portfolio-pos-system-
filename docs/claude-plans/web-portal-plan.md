# 🌐 Client Web Portal Plan

**Objective:** Create a public-facing web application for parents and students to view the catalog, check prices, and place orders (encargos) online.

## 🏗️ Technology Stack

-   **Framework:** **Next.js 14** (App Router)
    -   *Why?* Superior SEO for the catalog, faster initial load, and optimized image handling.
-   **Styling:** **Tailwind CSS**
    -   *Design System:* Reusing the "Premium" theme (Outfit/Inter fonts, Deep Royal Blue palette) defined in the Desktop App.
-   **State Management:** **Zustand** (Cart & User Session).
-   **Data Fetching:** **TanStack Query** (React Query).
-   **Deployment:** to be defined

## 📱 Core Features

### 1. School Selection (Landing Page)
-   Search/Select School (Tenant).
-   *Context:* The entire app adapts to the selected school (Logo, specific products).

### 2. Public Catalog
-   **Filters:** Category (Uniforms, PE Kit, Accessories), Size, Gender.
-   **Product Card:** Image, Price, "Add to Cart" button.
-   **Stock Indicator:** "Available", "Low Stock", "Out of Stock".

### 3. Product Detail
-   High-quality images.
-   **Size Guide:** Interactive modal.
-   Related products.

### 4. Shopping Cart & Checkout
-   **Cart:** Edit quantities, remove items.
-   **Checkout Flow:**
    1.  **Contact Info:** Name, Phone, Student Name, Grade.
    2.  **Order Type:** "Reserve" (Pay at store) or "Pre-order" (Encargo).
    3.  **Payment (Online):** Integration with Payment Gateway.
    4.  **Confirmation:** Generates an Order Code (e.g., `WEB-2025-001`).

### 5. Client Area (Optional for MVP)
-   Login via Email/Phone.
-   Order History & Status Tracking.

## 💳 Payment Gateway Options (Colombia)

Given the business uses **Bancolombia** and **Nequi**, here are the best options:

### **Option A: Wompi (Recommended)** 🏆
-   **Why:** Owned by Bancolombia. Best integration with Nequi and Bancolombia accounts.
-   **Features:**
    -   **QR Nequi:** Users scan and pay instantly.
    -   **Boton Bancolombia:** Direct transfer without leaving the flow.
    -   **Payouts:** Daily payouts to your Bancolombia account (often faster/cheaper).
-   **Fees:** Competitive (~2.85% + $800 COP per transaction, varies by plan).

### **Option B: Mercado Pago**
-   **Why:** Extremely popular, high user trust.
-   **Features:** Supports PSE, Credit Cards, and Nequi.
-   **Pros:** Very easy developer integration (SDKs).
-   **Cons:** Payouts might take a bit longer to hit the bank compared to Wompi.

### **Option C: Manual Transfer (MVP)**
-   **Flow:** User selects "Transferencia".
-   **Action:** Shows Nequi QR / Bank Details.
-   **Verification:** User uploads screenshot of payment to WhatsApp or via the portal.
-   **Pros:** $0 fees.
-   **Cons:** Manual verification required (high operational load).

**Recommendation:** Start with **Wompi** for the automated flow, but keep **Manual Transfer** as a fallback.

## 🔌 Backend Integration

The portal will consume the **existing FastAPI Backend**.
-   **Endpoints:**
    -   `GET /api/v1/schools/{id}/products` (Public)
    -   `POST /api/v1/schools/{id}/orders` (Public/Auth)
    -   `GET /api/v1/schools/{id}/config` (To get school branding/logo)

## 📂 Project Structure (Monorepo)

We will add the portal as a new folder inside your existing project. This makes it easier to manage and deploy.

```bash
uniformes-system-v2/           # 📂 Root Directory
├── backend/                   # 🐍 FastAPI (Existing)
├── frontend/                  # 🖥️ Tauri Desktop App (Existing)
├── docs/                      # 📄 Documentation
└── web-portal/                # 🌐 NEW Next.js App (Client Portal)
    ├── app/
    │   ├── [school_slug]/     # Dynamic route (e.g., /ie-caracas)
    │   │   ├── page.tsx       # Catalog
    │   │   └── cart/
    │   └── layout.tsx
    ├── components/
    ├── lib/
    └── public/
```

**Why this structure?**
1.  **Unified Context:** You have everything (API, Desktop, Web) in one place.
2.  **Easier Deployment:** You can connect this same repo to Vercel and tell it to deploy only the `web-portal` folder.
3.  **Shared Assets:** Easier to reference design tokens or logic if needed in the future.

## 🗓️ Implementation Phases

1.  **Setup:** Initialize Next.js project + Tailwind Config.
2.  **Catalog:** Connect to Backend API to list products.
3.  **Cart:** Implement local storage cart.
4.  **Checkout:** Create Order endpoint integration.
5.  **Polish:** SEO tags, Loading states, Mobile responsiveness.
