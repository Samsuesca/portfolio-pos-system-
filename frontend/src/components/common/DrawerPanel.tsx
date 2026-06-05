import { type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface DrawerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}

export default function DrawerPanel({
  isOpen,
  onClose,
  children,
  width = 'w-[560px]',
}: DrawerPanelProps): React.ReactElement | null {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/30"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={`fixed right-0 top-0 h-full ${width} max-w-[90vw] bg-white shadow-2xl flex flex-col`}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
