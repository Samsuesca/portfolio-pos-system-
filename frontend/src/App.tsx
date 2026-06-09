/**
 * App Component - Main application with routing
 *
 * All page components are lazy-loaded via React.lazy() for code splitting.
 * Each page is bundled as a separate chunk and fetched on demand.
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { useAuthStore } from './stores/authStore';
import { useSchoolStore } from './stores/schoolStore';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';
import { setupSpanishFormValidation } from './utils/formValidation';

// Lazy-loaded page components (code-split per route)
const Login = lazy(() => import('./pages/Login'));
const GoogleCallback = lazy(() => import('./pages/GoogleCallback'));
const GoogleLinkCallback = lazy(() => import('./pages/GoogleLinkCallback'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Products = lazy(() => import('./pages/products'));
const Clients = lazy(() => import('./pages/Clients'));
const Sales = lazy(() => import('./pages/Sales'));
const SaleDetail = lazy(() => import('./pages/SaleDetail'));
const SaleChanges = lazy(() => import('./pages/SaleChanges'));
const Orders = lazy(() => import('./pages/Orders'));
const OrderDetail = lazy(() => import('./pages/OrderDetail'));
const WebOrders = lazy(() => import('./pages/WebOrders'));
const B2BQuotations = lazy(() => import('./pages/B2BQuotations'));
const B2BContracts = lazy(() => import('./pages/B2BContracts'));
const Accounting = lazy(() => import('./pages/Accounting'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/settings'));
const Admin = lazy(() => import('./pages/Admin'));
const ContactsManagement = lazy(() => import('./pages/ContactsManagement'));
const Documents = lazy(() => import('./pages/Documents'));
const Payroll = lazy(() => import('./pages/payroll'));
const Alterations = lazy(() => import('./pages/Alterations'));
const AlterationDetail = lazy(() => import('./pages/AlterationDetail'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const EmailLogs = lazy(() => import('./pages/EmailLogs'));
const CFODashboard = lazy(() => import('./pages/CFODashboard'));
const Workforce = lazy(() => import('./pages/workforce'));
const MyProfile = lazy(() => import('./pages/MyProfile'));
const TelegramAlerts = lazy(() => import('./pages/TelegramAlerts'));
const TelegramAlertsAdmin = lazy(() => import('./pages/TelegramAlertsAdmin'));

// Protected Route component
function ProtectedRoute({
  children,
  permission,
  anyPermission,
  requireSuperuser,
}: {
  children: React.ReactNode;
  permission?: string;
  anyPermission?: string[];
  requireSuperuser?: boolean;
}) {
  const { isAuthenticated, user } = useAuthStore();
  const currentSchoolId = useSchoolStore((s) => s.currentSchool?.id);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Authenticated but the user object hasn't resolved yet (getCurrentUser in
  // flight). Wait instead of mis-evaluating the gates below — otherwise
  // `!user?.is_superuser` is true and we'd wrongly redirect a superuser.
  if (!user) {
    return <LoadingSpinner />;
  }

  if (requireSuperuser && !user.is_superuser) {
    return <Navigate to="/dashboard" replace />;
  }

  const requiresCheck =
    (permission || (anyPermission && anyPermission.length > 0)) && user && !user.is_superuser;

  if (requiresCheck) {
    const roles = user.school_roles || [];
    // Gate against the currently selected school. Before it resolves on first
    // load, fall back to the union across all schools to avoid redirect flicker.
    const scoped = currentSchoolId
      ? roles.filter((r) => r.school_id === currentSchoolId)
      : roles;
    const perms = new Set(scoped.flatMap((r) => r.permissions || []));
    const allowed =
      (permission ? perms.has(permission) : false) ||
      (anyPermission ? anyPermission.some((p) => perms.has(p)) : false);
    if (!allowed) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}

function App() {
  const { token, isAuthenticated, getCurrentUser, logout } = useAuthStore();
  const [isValidating, setIsValidating] = useState(true);

  // Localize native browser validation messages to Spanish app-wide.
  useEffect(() => setupSpanishFormValidation(), []);

  // Validate token on app startup
  useEffect(() => {
    const validateSession = async () => {
      // If there's a token, validate it with the server
      if (token && isAuthenticated) {
        try {
          await getCurrentUser();
        } catch {
          // Token invalid or expired, force logout
          logout();
        }
      } else if (!token || !isAuthenticated) {
        // No valid session, ensure clean state
        logout();
      }
      setIsValidating(false);
    };

    validateSession();
  }, []);

  // Show loading while validating
  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-stone-600">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  return (
    <GoogleOAuthProvider clientId={googleClientId ?? ''}>
    <BrowserRouter>
      <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/auth/google/callback" element={<GoogleCallback />} />
        <Route path="/auth/google/link-callback" element={<GoogleLinkCallback />} />
        <Route path="/verify-email/:token" element={<VerifyEmail />} />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute permission="products.view">
              <Products />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clients"
          element={
            <ProtectedRoute permission="clients.view">
              <Clients />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales"
          element={
            <ProtectedRoute permission="sales.view">
              <Sales />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/:saleId"
          element={
            <ProtectedRoute permission="sales.view">
              <SaleDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sale-changes"
          element={
            <ProtectedRoute permission="changes.view">
              <SaleChanges />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute permission="orders.view">
              <Orders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders/:orderId"
          element={
            <ProtectedRoute permission="orders.view">
              <OrderDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/web-orders"
          element={
            <ProtectedRoute permission="orders.view">
              <WebOrders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/b2b/quotations"
          element={
            <ProtectedRoute permission="b2b.view">
              <B2BQuotations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/b2b/contracts"
          element={
            <ProtectedRoute permission="b2b.view">
              <B2BContracts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounting"
          element={
            <ProtectedRoute permission="accounting.view_cash">
              <Accounting />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cfo"
          element={
            <ProtectedRoute permission="accounting.view_cash">
              <CFODashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute anyPermission={['reports.sales', 'reports.orders', 'reports.financial', 'reports.alterations', 'reports.inventory']}>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute permission="users.view">
              <Admin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contacts"
          element={
            <ProtectedRoute>
              <ContactsManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents"
          element={
            <ProtectedRoute requireSuperuser>
              <Documents />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payroll"
          element={
            <ProtectedRoute permission="payroll.manage">
              <Payroll />
            </ProtectedRoute>
          }
        />
        <Route
          path="/alterations"
          element={
            <ProtectedRoute anyPermission={['alterations.view', 'accounting.view_cash']}>
              <Alterations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/alterations/:alterationId"
          element={
            <ProtectedRoute anyPermission={['alterations.view', 'accounting.view_cash']}>
              <AlterationDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workforce"
          element={
            <ProtectedRoute anyPermission={['workforce.view_shifts', 'workforce.view_attendance']}>
              <Workforce />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-profile"
          element={
            <ProtectedRoute>
              <MyProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/email-logs"
          element={
            <ProtectedRoute requireSuperuser>
              <EmailLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/alertas-telegram"
          element={
            <ProtectedRoute>
              <TelegramAlerts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/alertas-telegram"
          element={
            <ProtectedRoute>
              <TelegramAlertsAdmin />
            </ProtectedRoute>
          }
        />

        {/* Redirect root to dashboard or login */}
        <Route
          path="/"
          element={<Navigate to="/dashboard" replace />}
        />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;
