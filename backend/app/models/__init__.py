"""
Database Models

Import all models here to ensure they are registered with SQLAlchemy
and available for Alembic migrations.
"""
from app.db.base import Base

# Import all models
from app.models.user import User, UserSchoolRole, UserRole, EmailVerificationToken
from app.models.cash_drawer import DrawerAccessCode
from app.models.school import School
from app.models.permission import Permission, CustomRole, RolePermission
from app.models.product import (
    GarmentType, GarmentTypeImage, Product, Inventory,
    GlobalGarmentType, GlobalGarmentTypeImage, GlobalProduct, GlobalInventory
)
from app.models.inventory_log import InventoryLog, InventoryMovementType
from app.models.email_log import EmailLog, EmailType, EmailStatus
from app.models.client import Client, ClientStudent, ClientType, NotificationPreference
from app.models.sale import Sale, SaleItem, SalePayment, PaymentMethod, SaleStatus, SaleChange, ChangeType, ChangeStatus, SaleSource
from app.models.order import Order, OrderItem, OrderStatus, DeliveryType, PaymentProofStatus
from app.models.delivery_zone import DeliveryZone
from app.models.contact import Contact, ContactType, ContactStatus
from app.models.payment_account import PaymentAccount, PaymentMethodType
from app.models.accounting import (
    Transaction, TransactionType,
    Expense, ExpenseCategory,
    DailyCashRegister,
    AccPaymentMethod,
    # Balance General models
    AccountType,
    BalanceAccount,
    BalanceEntry,
    AccountsReceivable,
    AccountsPayable,
    # Expense Adjustment models
    AdjustmentReason,
    ExpenseAdjustment,
    # Caja Menor Config
    CajaMenorConfig,
    # Debt Payment Schedule
    DebtPaymentSchedule,
    DebtPaymentStatus,
)
from app.models.fixed_expense import (
    FixedExpense,
    FixedExpenseType,
    ExpenseFrequency,
)
from app.models.document import DocumentFolder, BusinessDocument
from app.models.alteration import (
    Alteration,
    AlterationPayment,
    AlterationType,
    AlterationStatus,
)
from app.models.payroll import (
    Employee, EmployeeBonus,
    PayrollRun, PayrollItem, PayrollStatus, PaymentFrequency,
)
from app.models.notification import Notification, NotificationType, ReferenceType
from app.models.business_settings import BusinessSettings, DEFAULT_BUSINESS_SETTINGS
from app.models.print_queue import PrintQueueItem, PrintQueueStatus
from app.models.workforce import (
    ShiftType, ShiftTemplate, EmployeeSchedule,
    AttendanceStatus, AttendanceRecord,
    AbsenceType, AbsenceRecord,
    ChecklistItemStatus, ChecklistTemplate, ChecklistTemplateItem,
    DailyChecklist, DailyChecklistItem,
    ReviewPeriod, PerformanceReview,
    ResponsibilityCategory, PositionResponsibility,
)

__all__ = [
    "Base",
    # User models
    "User",
    "UserSchoolRole",
    "UserRole",
    "EmailVerificationToken",
    # Cash Drawer models
    "DrawerAccessCode",
    # School models
    "School",
    # Permission models
    "Permission",
    "CustomRole",
    "RolePermission",
    # Product models
    "GarmentType",
    "GarmentTypeImage",
    "Product",
    "Inventory",
    # Global product models
    "GlobalGarmentType",
    "GlobalGarmentTypeImage",
    "GlobalProduct",
    "GlobalInventory",
    # Inventory Log models
    "InventoryLog",
    "InventoryMovementType",
    # Email Log models
    "EmailLog",
    "EmailType",
    "EmailStatus",
    # Client models
    "Client",
    "ClientStudent",
    "ClientType",
    "NotificationPreference",
    # Sale models
    "Sale",
    "SaleItem",
    "SalePayment",
    "PaymentMethod",
    "SaleStatus",
    "SaleChange",
    "ChangeType",
    "ChangeStatus",
    "SaleSource",
    # Order models
    "Order",
    "OrderItem",
    "OrderStatus",
    "DeliveryType",
    "PaymentProofStatus",
    # Delivery Zone models
    "DeliveryZone",
    # Contact models
    "Contact",
    "ContactType",
    "ContactStatus",
    # Payment Account models
    "PaymentAccount",
    "PaymentMethodType",
    # Accounting models
    "Transaction",
    "TransactionType",
    "Expense",
    "ExpenseCategory",
    "DailyCashRegister",
    "AccPaymentMethod",
    # Balance General models
    "AccountType",
    "BalanceAccount",
    "BalanceEntry",
    "AccountsReceivable",
    "AccountsPayable",
    # Expense Adjustment models
    "AdjustmentReason",
    "ExpenseAdjustment",
    # Caja Menor Config
    "CajaMenorConfig",
    # Fixed Expense models
    "FixedExpense",
    "FixedExpenseType",
    "ExpenseFrequency",
    # Document models
    "DocumentFolder",
    "BusinessDocument",
    # Alteration models
    "Alteration",
    "AlterationPayment",
    "AlterationType",
    "AlterationStatus",
    # Notification models
    "Notification",
    "NotificationType",
    "ReferenceType",
    # Business Settings models
    "BusinessSettings",
    "DEFAULT_BUSINESS_SETTINGS",
    # Print Queue models
    "PrintQueueItem",
    "PrintQueueStatus",
    # Payroll models
    "Employee",
    "EmployeeBonus",
    "PayrollRun",
    "PayrollItem",
    "PayrollStatus",
    "PaymentFrequency",
    # Workforce Management models
    "ShiftType",
    "ShiftTemplate",
    "EmployeeSchedule",
    "AttendanceStatus",
    "AttendanceRecord",
    "AbsenceType",
    "AbsenceRecord",
    "ChecklistItemStatus",
    "ChecklistTemplate",
    "ChecklistTemplateItem",
    "DailyChecklist",
    "DailyChecklistItem",
    "ReviewPeriod",
    "PerformanceReview",
    "ResponsibilityCategory",
    "PositionResponsibility",
]
