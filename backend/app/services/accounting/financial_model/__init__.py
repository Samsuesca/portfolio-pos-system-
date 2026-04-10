"""
Financial Model Services Package

Provides financial analysis, KPIs, profitability, trends,
budgets, forecasts, alerts, and executive summaries.
"""
from app.services.accounting.financial_model.kpis import KPIService
from app.services.accounting.financial_model.profitability import ProfitabilityService
from app.services.accounting.financial_model.trends import TrendAnalysisService
from app.services.accounting.financial_model.budgets import BudgetService
from app.services.accounting.financial_model.forecast import CashForecastService
from app.services.accounting.financial_model.alerts import HealthAlertService
from app.services.accounting.financial_model.executive_summary import ExecutiveSummaryService

__all__ = [
    'KPIService',
    'ProfitabilityService',
    'TrendAnalysisService',
    'BudgetService',
    'CashForecastService',
    'HealthAlertService',
    'ExecutiveSummaryService',
]
