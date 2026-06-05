import { useHotkeys } from 'react-hotkeys-hook';

interface POSHotkeysOptions {
  onNewSale?: () => void;
  onOpenProductSearch?: () => void;
  onFocusClientSearch?: () => void;
  onFocusSchoolSelector?: () => void;
  onSubmitSale?: () => void;
  onSplitPayment?: () => void;
  onCloseModal?: () => void;
  enabled?: boolean;
}

export function usePOSHotkeys({
  onNewSale,
  onOpenProductSearch,
  onFocusClientSearch,
  onFocusSchoolSelector,
  onSubmitSale,
  onSplitPayment,
  onCloseModal,
  enabled = true,
}: POSHotkeysOptions) {
  useHotkeys('f2', (e) => {
    e.preventDefault();
    onNewSale?.();
  }, { enabled: enabled && !!onNewSale, enableOnFormTags: true });

  useHotkeys('f3', (e) => {
    e.preventDefault();
    onOpenProductSearch?.();
  }, { enabled: enabled && !!onOpenProductSearch, enableOnFormTags: true });

  useHotkeys('f4', (e) => {
    e.preventDefault();
    onFocusClientSearch?.();
  }, { enabled: enabled && !!onFocusClientSearch, enableOnFormTags: true });

  useHotkeys('f5', (e) => {
    e.preventDefault();
    onFocusSchoolSelector?.();
  }, { enabled: enabled && !!onFocusSchoolSelector, enableOnFormTags: true });

  useHotkeys('ctrl+enter, meta+enter', (e) => {
    e.preventDefault();
    onSubmitSale?.();
  }, { enabled: enabled && !!onSubmitSale, enableOnFormTags: true });

  useHotkeys('ctrl+p, meta+p', (e) => {
    e.preventDefault();
    onSplitPayment?.();
  }, { enabled: enabled && !!onSplitPayment, enableOnFormTags: true });

  useHotkeys('escape', (e) => {
    e.preventDefault();
    onCloseModal?.();
  }, { enabled: enabled && !!onCloseModal });
}

export function useSalesPageHotkeys({ onNewSale }: { onNewSale: () => void }) {
  useHotkeys('f2', (e) => {
    e.preventDefault();
    onNewSale();
  }, { enableOnFormTags: true });
}
