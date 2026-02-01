/**
 * App Component - Main application with routing
 */
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Clients from './pages/Clients';
import Sales from './pages/Sales';
import SaleDetail from './pages/SaleDetail';
import SaleChanges from './pages/SaleChanges';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import WebOrders from './pages/WebOrders';
import Accounting from './pages/Accounting';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
import ContactsManagement from './pages/ContactsManagement';
import PaymentAccounts from './pages/PaymentAccounts';
import Documents from './pages/Documents';
import Payroll from './pages/Payroll';
import Alterations from './pages/Alterations';
import AlterationDetail from './pages/AlterationDetail';
import VerifyEmail from './pages/VerifyEmail';
import EmailLogs from './pages/EmailLogs';
import CFODashboard from './pages/CFODashboard';
import Workforce from './pages/Workforce';
import MyProfile from './pages/MyProfile';

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
    </BrowserRouter>
  );
}

export default App;
