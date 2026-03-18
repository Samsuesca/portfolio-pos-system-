/**
 * App Component - Main application with routing
 *
 * All page components are lazy-loaded via React.lazy() for code splitting.
 * Each page is bundled as a separate chunk and fetched on demand.
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import LoadingSpinner from './components/LoadingSpinner';

// Lazy-loaded page components (code-split per route)
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Products = lazy(() => import('./pages/products'));
const Clients = lazy(() => import('./pages/Clients'));
const Sales = lazy(() => import('./pages/Sales'));
const SaleDetail = lazy(() => import('./pages/SaleDetail'));
const SaleChanges = lazy(() => import('./pages/SaleChanges'));
const Orders = lazy(() => import('./pages/Orders'));
const OrderDetail = lazy(() => import('./pages/OrderDetail'));
const WebOrders = lazy(() => import('./pages/WebOrders'));
const Accounting = lazy(() => import('./pages/Accounting'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/settings'));
const Admin = lazy(() => import('./pages/Admin'));
const ContactsManagement = lazy(() => import('./pages/ContactsManagement'));
const PaymentAccounts = lazy(() => import('./pages/PaymentAccounts'));
const Documents = lazy(() => import('./pages/Documents'));
const Payroll = lazy(() => import('./pages/payroll'));
const Alterations = lazy(() => import('./pages/Alterations'));
const AlterationDetail = lazy(() => import('./pages/AlterationDetail'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const EmailLogs = lazy(() => import('./pages/EmailLogs'));
const CFODashboard = lazy(() => import('./pages/CFODashboard'));
const Workforce = lazy(() => import('./pages/workforce'));
const MyProfile = lazy(() => import('./pages/MyProfile'));

// Protected Route component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { token, isAuthenticated, getCurrentUser, logout } = useAuthStore();
  const [isValidating, setIsValidating] = useState(true);

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
          <p className="text-gray-600">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
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
            <ProtectedRoute>
              <Products />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clients"
          element={
            <ProtectedRoute>
              <Clients />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales"
          element={
            <ProtectedRoute>
              <Sales />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/:saleId"
          element={
            <ProtectedRoute>
              <SaleDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sale-changes"
          element={
            <ProtectedRoute>
              <SaleChanges />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <Orders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders/:orderId"
          element={
            <ProtectedRoute>
              <OrderDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/web-orders"
          element={
            <ProtectedRoute>
              <WebOrders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounting"
          element={
            <ProtectedRoute>
              <Accounting />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cfo"
          element={
            <ProtectedRoute>
              <CFODashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
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
            <ProtectedRoute>
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
          path="/payment-accounts"
          element={
            <ProtectedRoute>
              <PaymentAccounts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents"
          element={
            <ProtectedRoute>
              <Documents />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payroll"
          element={
            <ProtectedRoute>
              <Payroll />
            </ProtectedRoute>
          }
        />
        <Route
          path="/alterations"
          element={
            <ProtectedRoute>
              <Alterations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/alterations/:alterationId"
          element={
            <ProtectedRoute>
              <AlterationDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workforce"
          element={
            <ProtectedRoute>
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
            <ProtectedRoute>
              <EmailLogs />
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
    </BrowserRouter>
  );
}

export default App;
