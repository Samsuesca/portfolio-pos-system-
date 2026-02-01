'use client';

/**
 * MainContent - Wrapper component that adjusts padding based on sidebar state
 */
import { ReactNode } from 'react';
import { useSidebarStore } from '@/lib/stores/sidebarStore';

interface MainContentProps {
  children: ReactNode;
}

export default function MainContent({ children }: MainContentProps) {
  const { isCollapsed } = useSidebarStore();

  return (
    <div className={`transition-all duration-300 ${isCollapsed ? 'lg:pl-16' : 'lg:pl-64'}`}>
      {children}
    </div>
  );
}
