/**
 * Settings Page - Application and school settings
 * Full admin panel for superusers
 *
 * Orchestrator component that composes setting cards and modals.
 */
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import PrinterSettingsModal from '../../components/PrinterSettingsModal';
import UserManagementPanel from '../../components/UserManagementPanel';
import { usePrinterStore } from '../../stores/printerStore';
import { usePrintQueueStore } from '../../stores/printQueueStore';
import { useAuthStore } from '../../stores/authStore';
import { useConfigStore } from '../../stores/configStore';
import { useBusinessInfoStore } from '../../stores/businessInfoStore';

// Sub-components
import SettingsServerCard from './SettingsServerCard';
import SettingsProfileCard from './SettingsProfileCard';
import SettingsSecurityCard from './SettingsSecurityCard';
import SettingsSuperuserCards from './SettingsSuperuserCards';
import SettingsNotificationsCard from './SettingsNotificationsCard';
import SettingsPrinterCard from './SettingsPrinterCard';
import SettingsSystemInfoCard from './SettingsSystemInfoCard';

// Modals
import EditProfileModal from './EditProfileModal';
import ChangePasswordModal from './ChangePasswordModal';
import ChangeEmailModal from './ChangeEmailModal';
import ManageSchoolsModal from './ManageSchoolsModal';
import ManageDeliveryZonesModal from './ManageDeliveryZonesModal';
import BusinessInfoModal from './BusinessInfoModal';

import type { ModalType } from './types';

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { apiUrl, setApiUrl, isOnline } = useConfigStore();
  const { info: storedBusinessInfo } = useBusinessInfoStore();
  const {
    settings: printerSettings,
    isModalOpen: isPrinterModalOpen,
    openModal: openPrinterModal,
    closeModal: closePrinterModal,
  } = usePrinterStore();
  const {
    settings: printQueueSettings,
    setSettings: setPrintQueueSettings,
    isConnected: printQueueConnected,
  } = usePrintQueueStore();

  const [customUrl, setCustomUrl] = useState(apiUrl);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [showUserManagementPanel, setShowUserManagementPanel] = useState(false);

  // Stable callbacks for child components
  const openEditProfile = useCallback(() => setActiveModal('editProfile'), []);
  const openChangePassword = useCallback(() => setActiveModal('changePassword'), []);
  const openChangeEmail = useCallback(() => setActiveModal('changeEmail'), []);
  const openManageSchools = useCallback(() => setActiveModal('manageSchools'), []);
  const openManageUsers = useCallback(() => setShowUserManagementPanel(true), []);
  const openManageDeliveryZones = useCallback(() => setActiveModal('manageDeliveryZones'), []);
  const openBusinessInfo = useCallback(() => setActiveModal('businessInfo'), []);
  const openPaymentAccounts = useCallback(() => navigate('/payment-accounts'), [navigate]);

  const closeModal = useCallback(() => setActiveModal(null), []);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Configuracion</h1>
        <p className="text-gray-600 mt-1">Administra la configuracion del sistema</p>
      </div>

      {/* Server Configuration - Full Width */}
      <SettingsServerCard
        apiUrl={apiUrl}
        setApiUrl={setApiUrl}
        isOnline={isOnline}
        customUrl={customUrl}
        setCustomUrl={setCustomUrl}
      />

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SettingsProfileCard user={user} onEditProfile={openEditProfile} />
        <SettingsSecurityCard onChangePassword={openChangePassword} onChangeEmail={openChangeEmail} />

        {user?.is_superuser && (
          <SettingsSuperuserCards
            onManageSchools={openManageSchools}
            onManageUsers={openManageUsers}
            onManageDeliveryZones={openManageDeliveryZones}
            onEditBusinessInfo={openBusinessInfo}
            onManagePaymentAccounts={openPaymentAccounts}
          />
        )}

        <SettingsNotificationsCard />

        <SettingsPrinterCard
          printerSettings={printerSettings}
          openPrinterModal={openPrinterModal}
          printQueueSettings={printQueueSettings}
          setPrintQueueSettings={setPrintQueueSettings}
          printQueueConnected={printQueueConnected}
        />
      </div>

      {/* System Info Card */}
      <SettingsSystemInfoCard
        user={user}
        apiUrl={apiUrl}
        isOnline={isOnline}
        businessName={storedBusinessInfo.business_name || ''}
        tagline={storedBusinessInfo.tagline || ''}
      />

      {/* ========== MODALS ========== */}
      <EditProfileModal isOpen={activeModal === 'editProfile'} onClose={closeModal} />
      <ChangePasswordModal isOpen={activeModal === 'changePassword'} onClose={closeModal} />
      <ChangeEmailModal isOpen={activeModal === 'changeEmail'} onClose={closeModal} />
      <ManageSchoolsModal isOpen={activeModal === 'manageSchools'} onClose={closeModal} />
      <ManageDeliveryZonesModal isOpen={activeModal === 'manageDeliveryZones'} onClose={closeModal} />
      <BusinessInfoModal isOpen={activeModal === 'businessInfo'} onClose={closeModal} />

      {/* User Management Panel */}
      <UserManagementPanel
        isOpen={showUserManagementPanel}
        onClose={() => setShowUserManagementPanel(false)}
      />

      {/* Printer Settings Modal */}
      <PrinterSettingsModal
        isOpen={isPrinterModalOpen}
        onClose={closePrinterModal}
      />
    </Layout>
  );
}
