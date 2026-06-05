"""
Alegra Service - Facturacion Electronica DIAN

Wrapper sobre la API de Alegra (https://developer.alegra.com).
Resuelve cliente e items en Alegra (find-or-create), emite la factura de venta
apuntando a IDs de Alegra con stamp DIAN, recupera URLs PDF/XML, y emite notas
credito para anular facturas ya timbradas.

Soporta tres origenes de documento:
- Sale       (ventas de mostrador)
- Order      (encargos / pedidos)
- Alteration (arreglos — se factura como un unico item de servicio)

Hallazgos clave validados con prueba real (FE2 emitida con CUFE):
- 'client' debe ser un id numerico (POST /contacts inline rechazado con codigo 3003)
- 'items[].id' debe apuntar a un item existente en Alegra
- 'paymentForm' + 'paymentMethod' AMBOS son obligatorios
- 'stamp.generateStamp=true' dispara el envio a DIAN
- 'unit' en items debe ser el literal "unit" (no codigo DIAN)
- 'productKey' = codigo UNSPSC (uniformes = 53101502) evita warning FAZ09
- '?fields=pdf,xml' es requerido para obtener URLs descargables
- Status 'STAMPED_AND_ACCEPTED_WITH_OBSERVATIONS' cuenta como exito

Auth: HTTP Basic con base64("email:token") en header Authorization.

El cliente HTTP se reutiliza entre llamadas de una misma emision. Usar como
context manager para garantizar el cierre:

    async with AlegraService(db) as alegra:
        resp = await alegra.emit_invoice_for_sale(sale)
"""
import asyncio
import base64
import logging
from datetime import timedelta
from decimal import Decimal
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.alteration import Alteration
from app.models.client import Client
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.sale import Sale, PaymentMethod
from app.utils.timezone import get_colombia_date


logger = logging.getLogger(__name__)


# NIT/CC generico DIAN para consumidor final (sin identificacion capturada)
FINAL_CONSUMER_IDENTIFICATION = "222222222222"
FINAL_CONSUMER_NAME = "Consumidor Final"

# UNSPSC para uniformes escolares (evita warning FAZ09 de DIAN)
DEFAULT_UNSPSC_CODE = "53101502"
# UNSPSC para servicios de confeccion/arreglos textiles
ALTERATION_UNSPSC_CODE = "73151900"
# Referencia estable del item de servicio de arreglos en Alegra (el precio se
# fija por linea de factura, asi que un unico item de catalogo basta).
ALTERATION_ITEM_REFERENCE = "ARR-SERVICIO"

# Tipos de identificacion que acepta identificationObject.type en Alegra.
ALEGRA_IDENTIFICATION_TYPES = {"CC", "NIT", "CE", "TI", "PA", "PEP", "RC", "DIE"}

# Tipo de nota credito de Alegra para Colombia (exigido en numeracion electronica,
# codigo 9070 si falta). Catalogo: PARTIALL_DEVOLUTION | VOID_ELECTRONIC_INVOICE |
# REDUCTION_DISCOUNT_PARTIAL_TOTAL | PRICE_ADJUSTMENT | OTHER.
# VOID_ELECTRONIC_INVOICE = anulacion total de la factura electronica.
CREDIT_NOTE_TYPE_ANNULMENT = "VOID_ELECTRONIC_INVOICE"

# Mapeo PaymentMethod (UCR) -> (paymentForm, paymentMethod) de Alegra.
# paymentForm: CASH | CREDIT
# paymentMethod: CASH | DEBIT-CARD | CREDIT-CARD | TRANSFER | CHECK | OTHER
PAYMENT_MAP = {
    PaymentMethod.CASH: ("CASH", "CASH"),
    PaymentMethod.NEQUI: ("CASH", "TRANSFER"),
    PaymentMethod.TRANSFER: ("CASH", "TRANSFER"),
    PaymentMethod.CARD: ("CASH", "DEBIT-CARD"),
    PaymentMethod.CREDIT: ("CREDIT", "CASH"),
}

# Status HTTP transitorios que justifican reintento con backoff.
_TRANSIENT_STATUS = {429, 500, 502, 503, 504}
_MAX_RETRIES = 2
# Dias de plazo por defecto para el dueDate de facturas a credito.
_CREDIT_DUE_DAYS = 30


class AlegraAPIError(Exception):
    """Raised when the Alegra API returns a non-2xx response."""
    def __init__(self, status_code: int, payload: Any, hint: str = ""):
        self.status_code = status_code
        self.payload = payload
        self.hint = hint
        super().__init__(f"Alegra API error {status_code}: {payload}{' | ' + hint if hint else ''}")


class AlegraService:
    """Cliente sobre la API de Alegra (FE DIAN)."""

    def __init__(self, db: AsyncSession | None = None):
        self.db = db
        self._client: httpx.AsyncClient | None = None

    # ─── Ciclo de vida del cliente HTTP ──────────────────────────────

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=60.0)
        return self._client

    async def aclose(self) -> None:
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
        self._client = None

    async def __aenter__(self) -> "AlegraService":
        return self

    async def __aexit__(self, *exc_info) -> None:
        await self.aclose()

    @staticmethod
    def _auth_header() -> dict[str, str]:
        if not settings.ALEGRA_EMAIL or not settings.ALEGRA_TOKEN:
            raise ValueError(
                "ALEGRA_EMAIL y ALEGRA_TOKEN deben estar configurados en .env"
            )
        token = base64.b64encode(
            f"{settings.ALEGRA_EMAIL}:{settings.ALEGRA_TOKEN}".encode()
        ).decode()
        return {
            "Authorization": f"Basic {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict | None = None,
        json_body: dict | list | None = None,
    ) -> Any:
        url = f"{settings.alegra_base_url}{path}"
        last_error: Exception | None = None

        for attempt in range(_MAX_RETRIES + 1):
            try:
                client = await self._get_client()
                resp = await client.request(
                    method,
                    url,
                    headers=self._auth_header(),
                    params=params,
                    json=json_body,
                )
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                last_error = exc
                if attempt < _MAX_RETRIES:
                    await asyncio.sleep(0.5 * (2 ** attempt))
                    continue
                raise AlegraAPIError(
                    0, str(exc), hint="Error de red al contactar Alegra"
                ) from exc

            if resp.status_code in _TRANSIENT_STATUS and attempt < _MAX_RETRIES:
                await asyncio.sleep(0.5 * (2 ** attempt))
                continue

            if resp.status_code not in (200, 201):
                try:
                    payload = resp.json()
                except Exception:
                    payload = resp.text
                raise AlegraAPIError(resp.status_code, payload)

            return resp.json()

        # Solo se alcanza si todos los intentos devolvieron status transitorio.
        raise AlegraAPIError(
            503,
            str(last_error) if last_error else "Alegra no respondio tras reintentos",
            hint="Servicio Alegra no disponible",
        )

    # ─── Numeraciones (resoluciones DIAN) ────────────────────────────

    async def list_number_templates(self) -> list[dict]:
        return await self._request("GET", "/number-templates")

    # ─── Contactos (clientes) ────────────────────────────────────────

    @staticmethod
    def _alegra_id_type(raw_type: Any) -> str:
        """Normaliza el tipo de identificacion al vocabulario de Alegra."""
        value = getattr(raw_type, "value", raw_type)
        if isinstance(value, str):
            value = value.upper().strip()
            if value in ALEGRA_IDENTIFICATION_TYPES:
                return value
        return "CC"

    async def find_contact_by_identification(self, identification: str) -> dict | None:
        results = await self._request(
            "GET",
            "/contacts",
            params={"identification": identification, "limit": 1},
        )
        if isinstance(results, list) and results:
            return results[0]
        return None

    async def create_contact(self, *, name: str, identification: str,
                             id_type: str = "CC", email: str | None = None,
                             phone: str | None = None,
                             address: str | None = None) -> dict:
        kind_of_person = "LEGAL_ENTITY" if id_type == "NIT" else "PERSON_ENTITY"
        body: dict[str, Any] = {
            "name": name,
            "identification": identification,
            "identificationObject": {"type": id_type, "number": identification},
            "kindOfPerson": kind_of_person,
            "regime": "SIMPLIFIED_REGIME",
            "type": ["client"],
        }
        if email:
            body["email"] = email
        if phone:
            body["phonePrimary"] = phone
        if address:
            body["address"] = {"address": address, "city": "Bogotá D.C."}
        return await self._request("POST", "/contacts", json_body=body)

    async def resolve_contact(self, sale_client: Client | None) -> int:
        """Find-or-create contact en Alegra. Retorna su id (int).

        Usa la identificacion real del cliente cuando esta capturada; de lo
        contrario emite a 'Consumidor Final' (222222222222), nunca falla por
        falta de cedula/NIT.
        """
        identification = FINAL_CONSUMER_IDENTIFICATION
        id_type = "CC"
        name = FINAL_CONSUMER_NAME
        email = phone = address = None

        client_ident = (getattr(sale_client, "identification_number", None) or "").strip() \
            if sale_client else ""
        if sale_client and sale_client.name and client_ident:
            name = sale_client.name
            identification = client_ident
            id_type = self._alegra_id_type(getattr(sale_client, "identification_type", None))
            email = sale_client.email
            phone = sale_client.phone
            address = sale_client.address

        existing = await self.find_contact_by_identification(identification)
        if existing:
            contact_id = int(existing["id"])
            logger.debug("Alegra contact reused: id=%s", contact_id)
            return contact_id

        created = await self.create_contact(
            name=name,
            identification=identification,
            id_type=id_type,
            email=email,
            phone=phone,
            address=address,
        )
        contact_id = int(created["id"])
        logger.debug("Alegra contact created: id=%s", contact_id)
        return contact_id

    # ─── Items (productos / servicios) ───────────────────────────────

    async def find_item_by_reference(self, reference: str) -> dict | None:
        results = await self._request(
            "GET",
            "/items",
            params={"query": reference, "limit": 30},
        )
        if isinstance(results, list):
            for item in results:
                if item.get("reference") == reference:
                    return item
        return None

    async def create_item(self, *, name: str, reference: str, price: Decimal,
                          unspsc: str = DEFAULT_UNSPSC_CODE) -> dict:
        body = {
            "name": name[:200],
            "reference": reference,
            "price": float(price),
            "productKey": unspsc,
            "inventory": {"unit": "unit"},
            "tax": [],
        }
        return await self._request("POST", "/items", json_body=body)

    async def _resolve_item(self, *, reference: str, name: str, price: Decimal,
                            unspsc: str = DEFAULT_UNSPSC_CODE) -> int:
        """Find-or-create item en Alegra por reference. Retorna su id (int)."""
        existing = await self.find_item_by_reference(reference)
        if existing:
            item_id = int(existing["id"])
            logger.debug("Alegra item reused: id=%s ref=%s", item_id, reference)
            return item_id
        created = await self.create_item(
            name=name, reference=reference, price=price, unspsc=unspsc
        )
        item_id = int(created["id"])
        logger.debug("Alegra item created: id=%s ref=%s", item_id, reference)
        return item_id

    async def resolve_item(self, product: Product, unit_price: Decimal) -> int:
        """Resuelve un item desde un Product (compat). Retorna su id (int)."""
        return await self._resolve_item(
            reference=product.code,
            name=product.name or product.code,
            price=unit_price,
        )

    # ─── Construccion de payloads ────────────────────────────────────

    @staticmethod
    def _payment_codes_from_method(payment_method: PaymentMethod | None) -> tuple[str, str]:
        if payment_method:
            return PAYMENT_MAP.get(payment_method, ("CASH", "CASH"))
        return ("CASH", "CASH")

    @staticmethod
    def _payment_codes_from_balance(total: Decimal, paid: Decimal | None) -> tuple[str, str]:
        if paid is not None and paid < total:
            return ("CREDIT", "CASH")
        return ("CASH", "CASH")

    def _assemble_payload(
        self,
        *,
        contact_id: int,
        items_block: list[dict],
        payment_form: str,
        payment_method: str,
        annotation: str,
    ) -> dict:
        emission_date = get_colombia_date()
        due_date = emission_date
        if payment_form == "CREDIT":
            due_date = emission_date + timedelta(days=_CREDIT_DUE_DAYS)

        payload: dict[str, Any] = {
            "date": emission_date.isoformat(),
            "dueDate": due_date.isoformat(),
            "client": contact_id,
            "items": items_block,
            "paymentForm": payment_form,
            "paymentMethod": payment_method,
            "stamp": {"generateStamp": True},
            "anotation": annotation,
        }
        if settings.ALEGRA_NUMBER_TEMPLATE_ID:
            payload["numberTemplate"] = {"id": settings.ALEGRA_NUMBER_TEMPLATE_ID}
        return payload

    async def _build_sale_payload(self, sale: Sale) -> dict:
        contact_id = await self.resolve_contact(sale.client)

        items_block: list[dict] = []
        for sale_item in sale.items:
            net_unit_price = sale_item.unit_price
            if sale_item.quantity > 0 and sale_item.discount and sale_item.discount > 0:
                net_unit_price = sale_item.unit_price - (
                    sale_item.discount / Decimal(sale_item.quantity)
                )
            if net_unit_price < 0:
                net_unit_price = Decimal("0")
            item_id = await self.resolve_item(sale_item.product, net_unit_price)
            items_block.append({
                "id": item_id,
                "price": float(net_unit_price),
                "quantity": sale_item.quantity,
            })

        payment_form, payment_method = self._payment_codes_from_method(sale.payment_method)
        original_sale_date = sale.sale_date.date().isoformat()
        annotation = (
            sale.notes
            or f"Venta UCR {sale.code} (fecha venta: {original_sale_date})"
        )
        return self._assemble_payload(
            contact_id=contact_id,
            items_block=items_block,
            payment_form=payment_form,
            payment_method=payment_method,
            annotation=annotation,
        )

    @staticmethod
    def _order_item_descriptor(order_item: OrderItem) -> tuple[str, str, str]:
        """Retorna (reference, name, unspsc) para una linea de encargo."""
        if order_item.product is not None:
            reference = order_item.product.code
            name = order_item.product.name or order_item.product.code
        else:
            garment_name = getattr(order_item.garment_type, "name", None) or "Prenda personalizada"
            reference = f"ENC-{order_item.garment_type_id or order_item.id}"
            name = garment_name
        extras = [x for x in (order_item.size, order_item.color) if x]
        if extras:
            name = f"{name} ({', '.join(extras)})"
        return reference, name, DEFAULT_UNSPSC_CODE

    async def _build_order_payload(self, order: Order) -> dict:
        contact_id = await self.resolve_contact(order.client)

        items_block: list[dict] = []
        for order_item in order.items:
            reference, name, unspsc = self._order_item_descriptor(order_item)
            unit_price = order_item.unit_price if order_item.unit_price >= 0 else Decimal("0")
            item_id = await self._resolve_item(
                reference=reference, name=name, price=unit_price, unspsc=unspsc
            )
            items_block.append({
                "id": item_id,
                "price": float(unit_price),
                "quantity": order_item.quantity,
            })

        payment_form, payment_method = self._payment_codes_from_balance(
            order.total, order.paid_amount
        )
        annotation = order.notes or f"Encargo UCR {order.code}"
        return self._assemble_payload(
            contact_id=contact_id,
            items_block=items_block,
            payment_form=payment_form,
            payment_method=payment_method,
            annotation=annotation,
        )

    async def _build_alteration_payload(self, alteration: Alteration) -> dict:
        contact_id = await self.resolve_contact(alteration.client)

        item_id = await self._resolve_item(
            reference=ALTERATION_ITEM_REFERENCE,
            name="Servicio de arreglo de prendas",
            price=alteration.cost,
            unspsc=ALTERATION_UNSPSC_CODE,
        )
        items_block = [{
            "id": item_id,
            "price": float(alteration.cost),
            "quantity": 1,
        }]

        payment_form, payment_method = self._payment_codes_from_balance(
            alteration.cost, alteration.amount_paid
        )
        annotation = f"Arreglo {alteration.code}: {alteration.garment_name}"
        return self._assemble_payload(
            contact_id=contact_id,
            items_block=items_block,
            payment_form=payment_form,
            payment_method=payment_method,
            annotation=annotation,
        )

    # Compat con el script de prototipo (scripts/test_alegra_invoice.py).
    async def _build_invoice_payload(self, sale: Sale) -> dict:
        return await self._build_sale_payload(sale)

    # ─── Emision de facturas ─────────────────────────────────────────

    async def _emit(self, payload: dict, *, label: str) -> dict:
        logger.info("Emitiendo factura Alegra (%s)", label)
        response = await self._request("POST", "/invoices", json_body=payload)
        logger.info(
            "Factura Alegra emitida (%s): id=%s number=%s legalStatus=%s",
            label,
            response.get("id"),
            (response.get("numberTemplate") or {}).get("fullNumber"),
            (response.get("stamp") or {}).get("legalStatus"),
        )
        return response

    async def emit_invoice_for_sale(self, sale: Sale) -> dict:
        payload = await self._build_sale_payload(sale)
        return await self._emit(payload, label=f"venta {sale.code}")

    async def emit_invoice_for_order(self, order: Order) -> dict:
        payload = await self._build_order_payload(order)
        return await self._emit(payload, label=f"encargo {order.code}")

    async def emit_invoice_for_alteration(self, alteration: Alteration) -> dict:
        payload = await self._build_alteration_payload(alteration)
        return await self._emit(payload, label=f"arreglo {alteration.code}")

    # Compat con el script de prototipo.
    async def emit_invoice(self, sale: Sale) -> dict:
        return await self.emit_invoice_for_sale(sale)

    async def get_invoice_files(self, invoice_id: str | int) -> dict:
        """Retorna {pdf, xml, attachedDocument} URLs de una factura emitida."""
        data = await self._request(
            "GET",
            f"/invoices/{invoice_id}",
            params={"fields": "pdf,xml,attachedDocument"},
        )
        return {
            "pdf": data.get("pdf"),
            "xml": data.get("xml"),
            "attachedDocument": data.get("attachedDocument"),
        }

    # ─── Notas credito (anulacion) ───────────────────────────────────

    async def emit_credit_note(self, *, alegra_invoice_id: str | int,
                               reason: str | None = None,
                               note_type: str = CREDIT_NOTE_TYPE_ANNULMENT) -> dict:
        """Emite una nota credito total que anula la factura indicada.

        Recupera los items y el cliente de la factura original desde Alegra
        para reflejarlos uno a uno, y dispara el timbre DIAN.
        """
        invoice = await self._request(
            "GET",
            f"/invoices/{alegra_invoice_id}",
            params={"fields": "items,client"},
        )

        raw_client = invoice.get("client")
        client_id = raw_client.get("id") if isinstance(raw_client, dict) else raw_client

        items_block: list[dict] = []
        total = 0.0
        for item in invoice.get("items", []) or []:
            price = item.get("price") or 0
            quantity = item.get("quantity") or 0
            items_block.append({
                "id": int(item["id"]),
                "price": price,
                "quantity": quantity,
            })
            total += float(price) * float(quantity)

        cause = reason or "Anulacion de factura electronica"
        body: dict[str, Any] = {
            "date": get_colombia_date().isoformat(),
            "client": int(client_id),
            "items": items_block,
            # Asocia la factura original con su monto (la suma debe igualar el
            # total de la NC al timbrar) y el tipo + motivo de la nota credito.
            # Alegra exige 'type' y 'cause' en numeracion electronica.
            "invoices": [{"id": int(alegra_invoice_id), "amount": total}],
            "type": note_type,
            "cause": cause,
            "stamp": {"generateStamp": True},
            "observations": cause,
        }
        if settings.ALEGRA_CREDIT_NOTE_TEMPLATE_ID:
            body["numberTemplate"] = {"id": settings.ALEGRA_CREDIT_NOTE_TEMPLATE_ID}

        logger.info("Emitiendo nota credito Alegra para factura %s", alegra_invoice_id)
        response = await self._request("POST", "/credit-notes", json_body=body)
        logger.info(
            "Nota credito Alegra emitida: id=%s number=%s",
            response.get("id"),
            (response.get("numberTemplate") or {}).get("fullNumber"),
        )
        return response

    async def get_credit_note_files(self, credit_note_id: str | int) -> dict:
        data = await self._request(
            "GET",
            f"/credit-notes/{credit_note_id}",
            params={"fields": "pdf,xml"},
        )
        return {"pdf": data.get("pdf"), "xml": data.get("xml")}
