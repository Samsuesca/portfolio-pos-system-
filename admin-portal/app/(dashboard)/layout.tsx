import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import DashboardWrapper from '@/components/DashboardWrapper';
import { ToastContainer } from '@/components/ui/Toast';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-surface-100">
        <Sidebar />
        <div className="lg:pl-64">
          <Header />
          <DashboardWrapper>
            <main className="p-6">{children}</main>
          </DashboardWrapper>
        </div>
        <ToastContainer />
      </div>
    </AuthGuard>
  );
}
