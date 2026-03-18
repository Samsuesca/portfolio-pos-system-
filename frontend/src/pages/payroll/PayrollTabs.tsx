/**
 * PayrollTabs - Tab navigation for Employees / Payroll Runs
 */
import React from 'react';
import { Users, Receipt } from 'lucide-react';
import type { TabType } from './types';

interface PayrollTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const tabs: { id: TabType; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'employees', label: 'Empleados', icon: Users },
  { id: 'payroll', label: 'Liquidaciones', icon: Receipt },
];

const PayrollTabs: React.FC<PayrollTabsProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="border-b border-gray-200 mb-6">
      <nav className="-mb-px flex space-x-8">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default React.memo(PayrollTabs);
