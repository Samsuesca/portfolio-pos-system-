/**
 * Dashboard Components - Barrel exports
 */
export { DashboardWidget } from './DashboardWidget';
export { StatCard, type TrendData } from './StatCard';
export { UpcomingOrdersWidget } from './UpcomingOrdersWidget';
export {
  UrgentAlertsSection,
  processOrdersForAlerts,
  processCriticalStock,
  type UrgentOrderAlert,
  type AlertsData,
} from './UrgentAlertsSection';
export { DailyFinanceWidget } from './DailyFinanceWidget';
export { AlterationsSummaryWidget } from './AlterationsSummaryWidget';
export { QuickActionsGrid } from './QuickActionsGrid';
export { WidgetSkeleton, StatCardSkeleton, AlertsSkeleton } from './WidgetSkeleton';
