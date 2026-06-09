"""
B2B Contracts Endpoints (GLOBAL/corporativo — sin school_id)

Ciclo de vida contable de contratos B2B made-to-order: registro de anticipo
(pasivo, no ingreso), entrega total o por hitos (reconocimiento de ingreso +
reversa de anticipo + COGS + saldo a CxC), cobro del saldo y cancelación.

La contabilidad es GLOBAL (una sola caja, una sola cuenta de banco). El control
de acceso usa require_global_permission:
- b2b.view             → lectura
- b2b.manage_contracts → anticipo / entrega / cobro
- b2b.void_contracts   → cancelación
"""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.dependencies import (
    DatabaseSession,
    CurrentUser,
    require_global_permission,
)
from app.api.error_responses import responses, AUTHENTICATED
from app.schemas.base import PaginatedResponse, paginate
from app.schemas.b2b import (
    ContractCreate,
    ContractResponse,
    ContractListResponse,
    DepositRegister,
    DeliveryRegister,
    MilestoneDeliveryRegister,
    BalancePaymentRegister,
    ContractCancel,
)
from app.models.b2b import ContractStatus
from app.services.contract import ContractService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/b2b/contracts", tags=["B2B Contracts"])


def _map_value_error(message: str) -> HTTPException:
    """Mapea errores de servicio: no encontrado→404, FSM→409, resto→400."""
    if "no encontrad" in message.lower():
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message)
    # Conflictos de estado: FSM del update_status ("no permitida") y las
    # precondiciones estrictas de las operaciones de dinero ("No se puede
    # registrar el anticipo/entregar el contrato/cancelar el contrato...").
    msg = message.lower()
    if "no permitida" in msg or msg.startswith("no se puede"):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message)
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)


@router.get(
    "",
    response_model=PaginatedResponse[ContractListResponse],
    summary="Listar contratos B2B",
    responses=AUTHENTICATED,
    dependencies=[Depends(require_global_permission("b2b.view"))],
)
async def list_contracts(
    db: DatabaseSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    status_filter: ContractStatus | None = Query(
        None, alias="status", description="Filtrar por estado"
    ),
    b2b_client_id: UUID | None = Query(None, description="Filtrar por cliente B2B"),
    branch_id: UUID | None = Query(None, description="Filtrar por sucursal"),
    search: str | None = Query(None, description="Buscar por número de contrato"),
):
    """Lista contratos B2B (GLOBAL) con filtros y paginación."""
    service = ContractService(db)
    items, total = await service.list_contracts(
        skip=skip,
        limit=limit,
        status=status_filter,
        b2b_client_id=b2b_client_id,
        branch_id=branch_id,
        search=search,
    )
    return paginate(items, total, skip, limit)


@router.post(
    "",
    response_model=ContractResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear contrato B2B (alta directa)",
    responses=responses(400),
    dependencies=[Depends(require_global_permission("b2b.manage_contracts"))],
)
async def create_contract(
    data: ContractCreate,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Crea un contrato pending_deposit (alta directa, sin cotización)."""
    service = ContractService(db)
    try:
        contract = await service.create_contract(data, user_id=current_user.id)
    except ValueError as e:
        raise _map_value_error(str(e))
    await db.commit()
    return await service.get_contract_with_milestones(contract.id)


@router.get(
    "/{contract_id}",
    response_model=ContractResponse,
    summary="Obtener contrato B2B",
    responses=responses(404),
    dependencies=[Depends(require_global_permission("b2b.view"))],
)
async def get_contract(
    contract_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Obtiene un contrato con sus hitos."""
    service = ContractService(db)
    contract = await service.get_contract_with_milestones(contract_id)
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contrato no encontrado",
        )
    return contract


@router.post(
    "/{contract_id}/deposit",
    response_model=ContractResponse,
    summary="Registrar anticipo del contrato",
    responses=responses(400, 404, 409),
    dependencies=[Depends(require_global_permission("b2b.manage_contracts"))],
)
async def register_deposit(
    contract_id: UUID,
    data: DepositRegister,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Registra el anticipo (pending_deposit → in_production).

    El anticipo entra a caja y se registra como pasivo (2110). NO es ingreso.
    """
    service = ContractService(db)
    try:
        contract = await service.register_deposit(
            contract_id,
            payment_method=data.payment_method,
            amount=data.amount,
            payment_date=data.payment_date,
            user_id=current_user.id,
        )
    except ValueError as e:
        raise _map_value_error(str(e))
    await db.commit()
    return await service.get_contract_with_milestones(contract.id)


@router.post(
    "/{contract_id}/deliver",
    response_model=ContractResponse,
    summary="Registrar entrega total del contrato",
    responses=responses(400, 404, 409),
    dependencies=[Depends(require_global_permission("b2b.manage_contracts"))],
)
async def deliver_contract(
    contract_id: UUID,
    data: DeliveryRegister,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Registra la entrega total: reconoce ingreso, reversa anticipo, COGS y saldo."""
    service = ContractService(db)
    try:
        contract = await service.deliver_contract(
            contract_id,
            delivery_date=data.delivery_date,
            cogs_amount=data.cogs_amount,
            settlement_method=data.settlement_method,
            user_id=current_user.id,
        )
    except ValueError as e:
        raise _map_value_error(str(e))
    await db.commit()
    return await service.get_contract_with_milestones(contract.id)


@router.post(
    "/{contract_id}/milestones/{milestone_id}/deliver",
    response_model=ContractResponse,
    summary="Registrar entrega de un hito",
    responses=responses(400, 404, 409),
    dependencies=[Depends(require_global_permission("b2b.manage_contracts"))],
)
async def deliver_milestone(
    contract_id: UUID,
    milestone_id: UUID,
    data: MilestoneDeliveryRegister,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Registra la entrega de un hito (prorrateo del anticipo)."""
    service = ContractService(db)
    try:
        contract = await service.deliver_milestone(
            contract_id,
            milestone_id,
            delivery_date=data.delivery_date,
            cogs_amount=data.cogs_amount,
            settlement_method=data.settlement_method,
            user_id=current_user.id,
        )
    except ValueError as e:
        raise _map_value_error(str(e))
    await db.commit()
    return await service.get_contract_with_milestones(contract.id)


@router.post(
    "/{contract_id}/pay-balance",
    response_model=ContractResponse,
    summary="Cobrar el saldo (CxC) del contrato",
    responses=responses(400, 404, 409),
    dependencies=[Depends(require_global_permission("b2b.manage_contracts"))],
)
async def pay_balance(
    contract_id: UUID,
    data: BalancePaymentRegister,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Cobra el saldo a crédito: mueve CxC → caja (no re-reconoce ingreso)."""
    service = ContractService(db)
    contract = await service.get(contract_id)
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contrato no encontrado",
        )
    try:
        receivable = await service.record_balance_payment(
            contract,
            amount=data.amount,
            payment_method=data.payment_method,
            receivable_id=data.receivable_id,
            payment_date=data.payment_date,
            user_id=current_user.id,
        )
        # Cierra el contrato si no quedan CxC abiertas de este contrato.
        if receivable.is_paid and not await service._has_open_receivables(contract):
            from app.services.contract.lifecycle import as_contract_status

            if as_contract_status(contract.status) in (
                ContractStatus.DELIVERED,
                ContractStatus.PARTIAL_DELIVERY,
            ):
                # Pasa por la FSM (no mutación directa de estado).
                service._assert_transition(contract.status, ContractStatus.CLOSED)
                contract.status = ContractStatus.CLOSED
    except ValueError as e:
        raise _map_value_error(str(e))
    await db.commit()
    return await service.get_contract_with_milestones(contract.id)


@router.post(
    "/{contract_id}/cancel",
    response_model=ContractResponse,
    summary="Cancelar contrato B2B",
    responses=responses(400, 404, 409),
    dependencies=[Depends(require_global_permission("b2b.void_contracts"))],
)
async def cancel_contract(
    contract_id: UUID,
    data: ContractCancel,
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """Cancela un contrato según la política de retención del anticipo."""
    service = ContractService(db)
    try:
        contract = await service.cancel_contract(
            contract_id,
            retain_deposit=data.retain_deposit,
            reason=data.reason,
            user_id=current_user.id,
        )
    except ValueError as e:
        raise _map_value_error(str(e))
    await db.commit()
    return await service.get_contract_with_milestones(contract.id)
