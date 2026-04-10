"""
Canonical mapping between sale PaymentMethod and accounting AccPaymentMethod.

Zero service imports — safe to import from any module without circular deps.
"""
from app.models.sale import PaymentMethod
from app.models.accounting import AccPaymentMethod


SALE_TO_ACC: dict[PaymentMethod, AccPaymentMethod] = {
    PaymentMethod.CASH: AccPaymentMethod.CASH,
    PaymentMethod.NEQUI: AccPaymentMethod.NEQUI,
    PaymentMethod.TRANSFER: AccPaymentMethod.TRANSFER,
    PaymentMethod.CARD: AccPaymentMethod.CARD,
    PaymentMethod.CREDIT: AccPaymentMethod.CREDIT,
}

STR_TO_ACC: dict[str, AccPaymentMethod] = {
    "cash": AccPaymentMethod.CASH,
    "nequi": AccPaymentMethod.NEQUI,
    "transfer": AccPaymentMethod.TRANSFER,
    "card": AccPaymentMethod.CARD,
    "credit": AccPaymentMethod.CREDIT,
}


def to_acc_payment_method(method: PaymentMethod | str) -> AccPaymentMethod:
    if isinstance(method, PaymentMethod):
        return SALE_TO_ACC[method]
    return STR_TO_ACC.get(str(method).lower(), AccPaymentMethod.CASH)
