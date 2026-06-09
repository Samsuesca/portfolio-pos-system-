"""
Unit tests de la FSM del contrato B2B (Fase B3).

Cubre la invariante I10: la FSM bloquea transiciones inválidas. La validación
de la FSM es pura (no toca DB), así que estos tests no usan fixtures de sesión.
"""
import pytest

from app.models.b2b import ContractStatus
from app.services.contract.lifecycle import (
    VALID_TRANSITIONS,
    assert_transition,
    as_contract_status,
)


# ---------------------------------------------------------------------------
# Transiciones válidas
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "current,target",
    [
        (ContractStatus.PENDING_DEPOSIT, ContractStatus.IN_PRODUCTION),
        (ContractStatus.PENDING_DEPOSIT, ContractStatus.CANCELLED),
        (ContractStatus.IN_PRODUCTION, ContractStatus.PARTIAL_DELIVERY),
        (ContractStatus.IN_PRODUCTION, ContractStatus.DELIVERED),
        (ContractStatus.IN_PRODUCTION, ContractStatus.CANCELLED),
        (ContractStatus.PARTIAL_DELIVERY, ContractStatus.PARTIAL_DELIVERY),
        (ContractStatus.PARTIAL_DELIVERY, ContractStatus.DELIVERED),
        (ContractStatus.PARTIAL_DELIVERY, ContractStatus.CLOSED),
        (ContractStatus.DELIVERED, ContractStatus.CLOSED),
    ],
)
def test_valid_transitions_pass(current, target):
    # No debe levantar
    assert_transition(current, target)


def test_same_state_is_noop():
    assert_transition(ContractStatus.IN_PRODUCTION, ContractStatus.IN_PRODUCTION)


# ---------------------------------------------------------------------------
# I10 — transiciones inválidas bloqueadas
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "current,target",
    [
        # deliver sobre pending_deposit (sin anticipo) → bloqueado
        (ContractStatus.PENDING_DEPOSIT, ContractStatus.DELIVERED),
        (ContractStatus.PENDING_DEPOSIT, ContractStatus.PARTIAL_DELIVERY),
        # cancel sobre delivered/partial → bloqueado (requiere devolución)
        (ContractStatus.DELIVERED, ContractStatus.CANCELLED),
        (ContractStatus.PARTIAL_DELIVERY, ContractStatus.CANCELLED),
        # deposit sobre delivered → bloqueado
        (ContractStatus.DELIVERED, ContractStatus.IN_PRODUCTION),
        # estados terminales
        (ContractStatus.CLOSED, ContractStatus.IN_PRODUCTION),
        (ContractStatus.CANCELLED, ContractStatus.IN_PRODUCTION),
    ],
)
def test_invalid_transitions_raise(current, target):
    with pytest.raises(ValueError, match="no permitida"):
        assert_transition(current, target)


def test_terminal_states_have_no_outgoing():
    assert VALID_TRANSITIONS[ContractStatus.CLOSED] == set()
    assert VALID_TRANSITIONS[ContractStatus.CANCELLED] == set()


def test_as_contract_status_normalizes_string():
    assert as_contract_status("in_production") == ContractStatus.IN_PRODUCTION
    assert as_contract_status(ContractStatus.DELIVERED) == ContractStatus.DELIVERED
