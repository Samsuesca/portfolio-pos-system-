"""
Contract Lifecycle (FSM)

Máquina de estados del contrato B2B y sus transiciones válidas. Las
transiciones inválidas lanzan ``ValueError`` (la ruta las mapea a 409).

Transiciones válidas:
  pending_deposit  → in_production (al registrar anticipo), cancelled
  in_production    → partial_delivery (hito), delivered (entrega total), cancelled
  partial_delivery → partial_delivery (siguiente hito), delivered, closed
  delivered        → closed (al cobrar saldo / sin saldo pendiente)
  closed           → (terminal)
  cancelled        → (terminal)

Nota: ``cancelled`` solo es alcanzable desde pending_deposit / in_production.
Un contrato con entregas (partial_delivery / delivered) no se cancela libremente
— requiere flujo de devolución/nota crédito (fuera de scope B3).
"""
from app.models.b2b import ContractStatus


VALID_TRANSITIONS: dict[ContractStatus, set[ContractStatus]] = {
    ContractStatus.PENDING_DEPOSIT: {
        ContractStatus.IN_PRODUCTION,
        ContractStatus.CANCELLED,
    },
    ContractStatus.IN_PRODUCTION: {
        ContractStatus.PARTIAL_DELIVERY,
        ContractStatus.DELIVERED,
        ContractStatus.CANCELLED,
    },
    ContractStatus.PARTIAL_DELIVERY: {
        ContractStatus.PARTIAL_DELIVERY,
        ContractStatus.DELIVERED,
        ContractStatus.CLOSED,
    },
    ContractStatus.DELIVERED: {
        ContractStatus.CLOSED,
    },
    ContractStatus.CLOSED: set(),
    ContractStatus.CANCELLED: set(),
}


def as_contract_status(value: ContractStatus | str) -> ContractStatus:
    """Normaliza el status (puede venir como enum o como str del driver)."""
    return value if isinstance(value, ContractStatus) else ContractStatus(value)


def assert_transition(current: ContractStatus | str, target: ContractStatus | str) -> None:
    """Valida una transición de estado. Lanza ValueError si es inválida."""
    current = as_contract_status(current)
    target = as_contract_status(target)
    if target == current:
        return
    if target not in VALID_TRANSITIONS[current]:
        raise ValueError(
            f"Transición de contrato no permitida: {current.value} → {target.value}"
        )


class ContractLifecycleMixin:
    """Mixin con helpers de validación de la FSM del contrato."""

    def _assert_transition(
        self,
        current: ContractStatus | str,
        target: ContractStatus | str,
    ) -> None:
        assert_transition(current, target)

    def _require_status(
        self,
        current: ContractStatus | str,
        allowed: set[ContractStatus],
        action: str,
    ) -> None:
        """Precondición ESTRICTA para operaciones de dinero (anticipo, entrega,
        cancelación).

        A diferencia de ``_assert_transition``, NO admite el mismo-estado como
        noop: re-ejecutar una de esas operaciones sobre un contrato que ya está
        en el estado destino duplicaría asientos contables (doble anticipo,
        doble ingreso, doble reversa de la cancelación). El estado actual DEBE
        pertenecer al conjunto de orígenes válidos.
        """
        if as_contract_status(current) not in allowed:
            raise ValueError(
                f"No se puede {action}: el contrato está en estado "
                f"'{as_contract_status(current).value}'"
            )
