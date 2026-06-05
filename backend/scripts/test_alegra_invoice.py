"""
Prototipo end-to-end de emision de Factura Electronica via Alegra.

Subcomandos:
  --list-templates              Lista las numeraciones (resoluciones) de Alegra
  --list-sales [--limit N]      Lista N ventas recientes elegibles (default 10)
  --sale-id <uuid>              Emite la factura electronica para esa venta
  --check-config                Verifica que las settings esten cargadas

Uso:
  cd backend
  source venv/bin/activate
  python -m scripts.test_alegra_invoice --check-config
  python -m scripts.test_alegra_invoice --list-templates
  python -m scripts.test_alegra_invoice --list-sales --limit 5
  python -m scripts.test_alegra_invoice --sale-id <uuid>
"""
import argparse
import asyncio
import json
import os
import sys
from decimal import Decimal
from datetime import date, datetime
from pathlib import Path
from uuid import UUID

# Permitir ejecutar desde la raiz del backend
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, selectinload

from app.core.config import settings
from app.models.sale import Sale, SaleItem, SaleStatus
from app.models.client import Client
from app.models.product import Product
from app.services.alegra import AlegraService, AlegraAPIError


def _json_default(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    if isinstance(obj, UUID):
        return str(obj)
    raise TypeError(f"Type not serializable: {type(obj)}")


def _print_json(label: str, data) -> None:
    print(f"\n=== {label} ===")
    print(json.dumps(data, indent=2, ensure_ascii=False, default=_json_default))


async def _open_session() -> AsyncSession:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    session_maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return session_maker()


def cmd_check_config() -> int:
    print("Settings cargadas:")
    print(f"  ALEGRA_ENABLED            = {settings.ALEGRA_ENABLED}")
    print(f"  ALEGRA_ENVIRONMENT        = {settings.ALEGRA_ENVIRONMENT}")
    print(f"  ALEGRA_EMAIL              = {settings.ALEGRA_EMAIL}")
    print(f"  ALEGRA_TOKEN set?         = {bool(settings.ALEGRA_TOKEN)}")
    print(f"  ALEGRA_NUMBER_TEMPLATE_ID = {settings.ALEGRA_NUMBER_TEMPLATE_ID or '(vacio)'}")
    print(f"  ALEGRA_ISSUER_NIT         = {settings.ALEGRA_ISSUER_NIT}")
    print(f"  alegra_base_url           = {settings.alegra_base_url}")
    print(f"  DATABASE_URL host         = {settings.DATABASE_URL.split('@')[-1]}")
    return 0


async def cmd_list_templates() -> int:
    service = AlegraService()
    try:
        templates = await service.list_number_templates()
    except AlegraAPIError as e:
        print(f"ERROR: {e}")
        return 2
    except ValueError as e:
        print(f"ERROR de configuracion: {e}")
        return 2

    print(f"\nNumeraciones encontradas: {len(templates)}\n")
    for t in templates:
        print(
            f"  id={t.get('id')}  "
            f"name={t.get('name')!r}  "
            f"prefix={t.get('prefix')!r}  "
            f"isDefault={t.get('isDefault')}  "
            f"documentType={t.get('documentType')}"
        )
    print()
    print("Para usar una numeracion, coloca su id en ALEGRA_NUMBER_TEMPLATE_ID en .env")
    return 0


async def cmd_list_sales(limit: int) -> int:
    session = await _open_session()
    async with session as db:
        stmt = (
            select(Sale)
            .where(
                Sale.status == SaleStatus.COMPLETED,
                Sale.is_historical == False,  # noqa: E712
            )
            .order_by(desc(Sale.created_at))
            .limit(limit)
            .options(selectinload(Sale.client))
        )
        result = await db.execute(stmt)
        sales = list(result.scalars().all())

    if not sales:
        print("No se encontraron ventas elegibles.")
        return 1

    print(f"\nUltimas {len(sales)} ventas elegibles:\n")
    for s in sales:
        client_name = s.client.name if s.client else "(sin cliente)"
        client_email = (s.client.email if s.client else None) or "-"
        print(
            f"  id={s.id}  code={s.code}  total=${s.total:,.0f}  "
            f"date={s.sale_date.date()}  "
            f"client={client_name!r} email={client_email}"
        )
    print()
    return 0


async def cmd_emit_invoice(sale_id: str) -> int:
    try:
        sale_uuid = UUID(sale_id)
    except ValueError:
        print(f"sale-id invalido: {sale_id}")
        return 1

    session = await _open_session()
    async with session as db:
        stmt = (
            select(Sale)
            .where(Sale.id == sale_uuid)
            .options(
                selectinload(Sale.client),
                selectinload(Sale.items).selectinload(SaleItem.product),
            )
        )
        result = await db.execute(stmt)
        sale = result.scalar_one_or_none()

        if sale is None:
            print(f"Venta {sale_id} no encontrada")
            return 1

        print(f"Venta encontrada: {sale.code} - total ${sale.total:,.0f} - {len(sale.items)} items")
        service = AlegraService(db)

        # Construye y muestra payload primero (resuelve cliente e items en Alegra)
        try:
            payload = await service._build_invoice_payload(sale)
        except AlegraAPIError as e:
            print(f"\n!! Falla al resolver cliente/items en Alegra: HTTP {e.status_code}")
            _print_json("ERROR DE ALEGRA", e.payload)
            return 2
        except ValueError as e:
            print(f"ERROR de configuracion: {e}")
            return 2

        _print_json("PAYLOAD ENVIADO A ALEGRA", payload)

        try:
            response = await service.emit_invoice(sale)
        except AlegraAPIError as e:
            print(f"\n!! Alegra rechazo la emision: HTTP {e.status_code}")
            _print_json("ERROR DE ALEGRA", e.payload)
            return 2

        _print_json("RESPUESTA DE ALEGRA", response)
        stamp = response.get("stamp") or {}
        cufe = stamp.get("cufe") or stamp.get("uuid")
        full_number = (response.get("numberTemplate") or {}).get("fullNumber")
        legal_status = stamp.get("legalStatus") or stamp.get("status")
        warnings = stamp.get("warnings") or []

        print("\n--- RESUMEN ---")
        print(f"  Alegra invoice id: {response.get('id')}")
        print(f"  Numero factura:    {full_number}")
        print(f"  CUFE:              {cufe or '(no devuelto, revisar panel)'}")
        print(f"  Estado timbre:     {legal_status or '(no informado)'}")
        if warnings:
            print(f"  Warnings DIAN:")
            for w in warnings:
                print(f"    - {w}")
        if cufe:
            print(f"  Validar en DIAN:")
            print(f"    https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey={cufe}")

        # Obtener URLs descargables
        try:
            files = await service.get_invoice_files(response.get("id"))
            print("\n--- ARCHIVOS ---")
            if files.get("pdf"):
                print(f"  PDF: {files['pdf'][:120]}...")
            if files.get("xml"):
                print(f"  XML: {files['xml'][:120]}...")
        except AlegraAPIError as e:
            print(f"\n(no se pudieron obtener archivos: {e})")

        return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Prototipo end-to-end de emision FE DIAN via Alegra"
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--check-config", action="store_true", help="Verifica settings cargadas")
    group.add_argument("--list-templates", action="store_true", help="Lista numeraciones DIAN")
    group.add_argument("--list-sales", action="store_true", help="Lista ventas recientes elegibles")
    group.add_argument("--sale-id", type=str, help="UUID de la venta a emitir")
    parser.add_argument("--limit", type=int, default=10, help="Cantidad de ventas a listar (default 10)")
    args = parser.parse_args()

    if args.check_config:
        return cmd_check_config()
    if args.list_templates:
        return asyncio.run(cmd_list_templates())
    if args.list_sales:
        return asyncio.run(cmd_list_sales(args.limit))
    if args.sale_id:
        return asyncio.run(cmd_emit_invoice(args.sale_id))
    return 1


if __name__ == "__main__":
    sys.exit(main())
