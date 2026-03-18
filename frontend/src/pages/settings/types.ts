/**
 * Shared types for the Settings page and its sub-components.
 */

export type ModalType =
  | 'editProfile'
  | 'changePassword'
  | 'changeEmail'
  | 'manageSchools'
  | 'createSchool'
  | 'editSchool'
  | 'manageDeliveryZones'
  | 'createDeliveryZone'
  | 'editDeliveryZone'
  | 'businessInfo'
  | null;

export type BusinessInfoSection = 'general' | 'contact' | 'address' | 'hours' | 'web';
