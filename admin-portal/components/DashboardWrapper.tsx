'use client';

/**
 * DashboardWrapper - Provides global modal management for the dashboard
 * Integrates DraftsBar with SaleModal and OrderModal
 */
import { useState, createContext, useContext, useCallback } from 'react';
import { DraftsBar } from './DraftsBar';
import SaleModal from './vendor/SaleModal';
import OrderModal from './vendor/OrderModal';
import { useDraftStore } from '@/lib/stores/draftStore';

interface DashboardContextType {
  openSaleModal: (draftId?: string | null) => void;
  openOrderModal: (draftId?: string | null) => void;
  closeSaleModal: () => void;
  closeOrderModal: () => void;
}

const DashboardContext = createContext<DashboardContextType | null>(null);

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within DashboardWrapper');
  }
  return context;
}

interface DashboardWrapperProps {
  children: React.ReactNode;
}

export default function DashboardWrapper({ children }: DashboardWrapperProps) {
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [saleDraftId, setSaleDraftId] = useState<string | null>(null);
  const [orderDraftId, setOrderDraftId] = useState<string | null>(null);

  const { setActiveDraft } = useDraftStore();

  const openSaleModal = useCallback((draftId?: string | null) => {
    setSaleDraftId(draftId || null);
    if (draftId) {
      setActiveDraft(draftId);
    }
    setSaleModalOpen(true);
  }, [setActiveDraft]);

  const openOrderModal = useCallback((draftId?: string | null) => {
    setOrderDraftId(draftId || null);
    if (draftId) {
      setActiveDraft(draftId);
    }
    setOrderModalOpen(true);
  }, [setActiveDraft]);

  const closeSaleModal = useCallback(() => {
    setSaleModalOpen(false);
    setSaleDraftId(null);
    setActiveDraft(null);
  }, [setActiveDraft]);

  const closeOrderModal = useCallback(() => {
    setOrderModalOpen(false);
    setOrderDraftId(null);
    setActiveDraft(null);
  }, [setActiveDraft]);

  const handleSaleSuccess = useCallback(() => {
    closeSaleModal();
    // Could trigger a refresh or notification here
  }, [closeSaleModal]);

  const handleOrderSuccess = useCallback(() => {
    closeOrderModal();
    // Could trigger a refresh or notification here
  }, [closeOrderModal]);

  const contextValue: DashboardContextType = {
    openSaleModal,
    openOrderModal,
    closeSaleModal,
    closeOrderModal,
  };

  return (
    <DashboardContext.Provider value={contextValue}>
      {/* DraftsBar */}
      <DraftsBar
        onOpenSale={(draftId) => openSaleModal(draftId)}
        onOpenOrder={(draftId) => openOrderModal(draftId)}
        onNewSale={() => openSaleModal()}
        onNewOrder={() => openOrderModal()}
      />

      {/* Main Content */}
      {children}

      {/* Sale Modal */}
      <SaleModal
        isOpen={saleModalOpen}
        onClose={closeSaleModal}
        onSuccess={handleSaleSuccess}
        draftId={saleDraftId}
        onMinimize={() => setSaleModalOpen(false)}
      />

      {/* Order Modal */}
      <OrderModal
        isOpen={orderModalOpen}
        onClose={closeOrderModal}
        onSuccess={handleOrderSuccess}
        draftId={orderDraftId}
        onMinimize={() => setOrderModalOpen(false)}
      />
    </DashboardContext.Provider>
  );
}
