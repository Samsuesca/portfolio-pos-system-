# 🌐 Uniformes System - Web Portal

This is the public-facing web application for **Uniformes System v2.0**, built with **Next.js 14**.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Backend running on `http://localhost:8000` (for API integration)

### Installation

```bash
cd web-portal
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🏗️ Tech Stack

-   **Framework:** Next.js 14 (App Router)
-   **Styling:** Tailwind CSS (Premium Theme)
-   **State:** Zustand (Cart & Session)
-   **Data Fetching:** TanStack Query
-   **Icons:** Lucide React

## 📂 Project Structure

```bash
web-portal/
├── app/
│   ├── layout.tsx          # Main layout (Fonts, Providers)
│   ├── page.tsx            # Landing Page (School Selector)
│   └── [school_slug]/      # Dynamic Tenant Route
│       ├── page.tsx        # Product Catalog
│       ├── cart/           # Shopping Cart
│       └── checkout/       # Order Placement
├── components/
│   ├── ui/                 # Reusable UI Components
│   └── catalog/            # Business Components
├── lib/
│   ├── api.ts              # Axios Instance
│   └── store.ts            # Zustand Store
└── public/                 # Static Assets
```

## 🔌 API Integration

The portal connects to the FastAPI backend.
-   **Base URL:** `http://localhost:8000/api/v1`
-   **Key Endpoints:**
    -   `GET /schools/{id}/products`: Fetch catalog
    -   `POST /schools/{id}/orders`: Create order

## 🎨 Design System

We use the **"Premium"** theme defined in the main project:
-   **Fonts:** Outfit (Headings), Inter (Body)
-   **Colors:** Deep Royal Blue (`bg-primary`), Brand Blue (`text-brand-600`)

## 💳 Payments

-   **Wompi:** Primary gateway (Nequi/Bancolombia).
-   **Manual:** Fallback option (Upload receipt).
