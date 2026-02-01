"""
Receipt Service - Generate HTML receipts for printing and email

Supports:
- Thermal printer receipts (80mm width)
- Email confirmations for orders

NOTE: Business info (name, contact, address) is now centralized in
the business_settings table. Templates in this file should be gradually
updated to use get_business_info_sync() from email.py instead of
hardcoded values.
"""
from datetime import datetime
from decimal import Decimal
from app.utils.timezone import get_colombia_now_naive
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.sale import Sale, SaleItem
from app.models.order import Order, OrderItem, OrderStatus, DeliveryType
from app.models.client import Client
from app.models.school import School


def format_currency(amount: float | Decimal) -> str:
    """Format amount as Colombian Pesos"""
    return f"${amount:,.0f}".replace(",", ".")


def format_date(dt: datetime) -> str:
    """Format datetime for display"""
    return dt.strftime("%d/%m/%Y %I:%M %p")


def format_date_short(dt: datetime) -> str:
    """Format datetime for receipt (shorter)"""
    return dt.strftime("%d/%m/%Y")


def get_status_text(status: OrderStatus) -> str:
    """Get human-readable status text in Spanish"""
    status_map = {
        OrderStatus.PENDING: "Pendiente",
        OrderStatus.IN_PRODUCTION: "En Produccion",
        OrderStatus.READY: "Listo para Entrega",
        OrderStatus.DELIVERED: "Entregado",
        OrderStatus.CANCELLED: "Cancelado",
    }
    return status_map.get(status, str(status))


def get_delivery_type_text(delivery_type: DeliveryType) -> str:
    """Get human-readable delivery type text"""
    if delivery_type == DeliveryType.PICKUP:
        return "Retiro en Tienda"
    return "Domicilio"


class ReceiptService:
    """Service for generating receipt HTML"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_sale_with_details(self, sale_id: UUID) -> Sale | None:
        """Get sale with all related data"""
        result = await self.db.execute(
            select(Sale)
            .options(
                selectinload(Sale.client),
                selectinload(Sale.school),
                selectinload(Sale.user),
                selectinload(Sale.items).selectinload(SaleItem.product),
            )
            .where(Sale.id == sale_id)
        )
        return result.scalar_one_or_none()

    async def get_order_with_details(self, order_id: UUID) -> Order | None:
        """Get order with all related data"""
        result = await self.db.execute(
            select(Order)
            .options(
                selectinload(Order.client),
                selectinload(Order.school),
                selectinload(Order.user),
                selectinload(Order.items).selectinload(OrderItem.garment_type),
            )
            .where(Order.id == order_id)
        )
        return result.scalar_one_or_none()

    async def generate_sale_receipt_html(self, sale_id: UUID) -> str | None:
        """
        Generate HTML receipt for a sale (thermal printer format).
        Returns None if sale not found.
        """
        sale = await self.get_sale_with_details(sale_id)
        if not sale:
            return None

        # Build items HTML
        items_html = ""
        for item in sale.items:
            product_name = item.product.name if item.product else "Producto"
            size = item.size or ""
            qty = item.quantity
            price = format_currency(item.unit_price)
            subtotal = format_currency(item.subtotal)
            items_html += f"""
            <tr>
                <td style="text-align: left; padding: 4px 0;">{qty}x {product_name} {size}</td>
                <td style="text-align: right; padding: 4px 0;">{subtotal}</td>
            </tr>
            """

        # Client info
        client_name = sale.client.name if sale.client else "Cliente General"
        student_name = sale.client.student_name if sale.client and sale.client.student_name else ""
        student_info = f"<br>Estudiante: {student_name}" if student_name else ""

        # Payment method text
        payment_methods = {
            "cash": "Efectivo",
            "nequi": "Nequi",
            "transfer": "Transferencia",
            "card": "Tarjeta",
            "credit": "Credito",
        }
        payment_text = payment_methods.get(sale.payment_method, sale.payment_method)

        return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Recibo #{sale.code}</title>
    <style>
        @page {{
            size: 80mm auto;
            margin: 0;
        }}
        body {{
            font-family: 'Courier New', monospace;
            font-size: 12px;
            width: 72mm;
            margin: 4mm auto;
            padding: 0;
            color: #000;
        }}
        .header {{
            text-align: center;
            border-bottom: 1px dashed #000;
            padding-bottom: 8px;
            margin-bottom: 8px;
        }}
        .header h1 {{
            margin: 0;
            font-size: 14px;
            font-weight: bold;
        }}
        .header p {{
            margin: 4px 0 0 0;
            font-size: 10px;
        }}
        .info {{
            margin: 8px 0;
            font-size: 11px;
        }}
        .info p {{
            margin: 2px 0;
        }}
        .divider {{
            border-top: 1px dashed #000;
            margin: 8px 0;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
        }}
        .totals {{
            margin-top: 8px;
            font-size: 12px;
        }}
        .totals .total-row {{
            font-weight: bold;
            font-size: 14px;
        }}
        .footer {{
            margin-top: 12px;
            text-align: center;
            font-size: 10px;
            border-top: 1px dashed #000;
            padding-top: 8px;
        }}
        @media print {{
            body {{
                width: 72mm;
            }}
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>UNIFORMES CONSUELO RIOS</h1>
        <p>Tel: 311-XXX-XXXX</p>
        <p>Bogota, Colombia</p>
    </div>

    <div class="info">
        <p><strong>RECIBO DE VENTA #{sale.code}</strong></p>
        <p>Fecha: {format_date(sale.sale_date)}</p>
        <p>Cliente: {client_name}{student_info}</p>
    </div>

    <div class="divider"></div>

    <table>
        <tbody>
            {items_html}
        </tbody>
    </table>

    <div class="divider"></div>

    <div class="totals">
        <table>
            <tr>
                <td>Subtotal:</td>
                <td style="text-align: right;">{format_currency(sale.subtotal)}</td>
            </tr>
            {"<tr><td>Descuento:</td><td style='text-align: right;'>-" + format_currency(sale.discount) + "</td></tr>" if sale.discount > 0 else ""}
            <tr class="total-row">
                <td>TOTAL:</td>
                <td style="text-align: right;">{format_currency(sale.total)}</td>
            </tr>
            <tr>
                <td>Pago:</td>
                <td style="text-align: right;">{payment_text}</td>
            </tr>
        </table>
    </div>

    <div class="footer">
        <p>Gracias por su compra!</p>
        <p>Cambios dentro de 8 dias con</p>
        <p>recibo y producto sin uso.</p>
    </div>

    <script>
        window.onload = function() {{
            window.print();
        }};
    </script>
</body>
</html>
"""

    async def generate_order_receipt_html(self, order_id: UUID) -> str | None:
        """
        Generate HTML receipt for an order (thermal printer format).
        Returns None if order not found.
        """
        order = await self.get_order_with_details(order_id)
        if not order:
            return None

        # Build items HTML
        items_html = ""
        for item in order.items:
            garment_name = item.garment_type.name if item.garment_type else "Prenda"
            size = item.size or ""
            qty = item.quantity
            subtotal = format_currency(item.subtotal)
            items_html += f"""
            <tr>
                <td style="text-align: left; padding: 4px 0;">{qty}x {garment_name} {size}</td>
                <td style="text-align: right; padding: 4px 0;">{subtotal}</td>
            </tr>
            """

        # Client info
        client_name = order.client.name if order.client else "Cliente"
        student_name = order.client.student_name if order.client and order.client.student_name else ""
        student_info = f"<br>Estudiante: {student_name}" if student_name else ""

        # Delivery info
        delivery_text = get_delivery_type_text(order.delivery_type)
        delivery_info = ""
        if order.delivery_type == DeliveryType.DELIVERY and order.delivery_address:
            delivery_info = f"<p>Direccion: {order.delivery_address}</p>"
            if order.delivery_neighborhood:
                delivery_info += f"<p>Barrio: {order.delivery_neighborhood}</p>"

        # Balance info
        balance_html = ""
        if order.paid_amount > 0:
            balance_html = f"""
            <tr>
                <td>Abonado:</td>
                <td style="text-align: right;">{format_currency(order.paid_amount)}</td>
            </tr>
            <tr class="total-row">
                <td>SALDO:</td>
                <td style="text-align: right;">{format_currency(order.balance)}</td>
            </tr>
            """
        else:
            balance_html = f"""
            <tr class="total-row">
                <td>PENDIENTE:</td>
                <td style="text-align: right;">{format_currency(order.total)}</td>
            </tr>
            """

        return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Encargo #{order.code}</title>
    <style>
        @page {{
            size: 80mm auto;
            margin: 0;
        }}
        body {{
            font-family: 'Courier New', monospace;
            font-size: 12px;
            width: 72mm;
            margin: 4mm auto;
            padding: 0;
            color: #000;
        }}
        .header {{
            text-align: center;
            border-bottom: 1px dashed #000;
            padding-bottom: 8px;
            margin-bottom: 8px;
        }}
        .header h1 {{
            margin: 0;
            font-size: 14px;
            font-weight: bold;
        }}
        .header p {{
            margin: 4px 0 0 0;
            font-size: 10px;
        }}
        .info {{
            margin: 8px 0;
            font-size: 11px;
        }}
        .info p {{
            margin: 2px 0;
        }}
        .status {{
            background: #f0f0f0;
            padding: 4px;
            text-align: center;
            font-weight: bold;
            margin: 8px 0;
        }}
        .divider {{
            border-top: 1px dashed #000;
            margin: 8px 0;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
        }}
        .totals {{
            margin-top: 8px;
            font-size: 12px;
        }}
        .totals .total-row {{
            font-weight: bold;
            font-size: 14px;
        }}
        .footer {{
            margin-top: 12px;
            text-align: center;
            font-size: 10px;
            border-top: 1px dashed #000;
            padding-top: 8px;
        }}
        @media print {{
            body {{
                width: 72mm;
            }}
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>UNIFORMES CONSUELO RIOS</h1>
        <p>Tel: 311-XXX-XXXX</p>
        <p>Bogota, Colombia</p>
    </div>

    <div class="info">
        <p><strong>ENCARGO #{order.code}</strong></p>
        <p>Fecha: {format_date(order.order_date)}</p>
        <p>Cliente: {client_name}{student_info}</p>
        <p>Entrega: {delivery_text}</p>
        {delivery_info}
    </div>

    <div class="status">
        Estado: {get_status_text(order.status)}
    </div>

    <div class="divider"></div>

    <table>
        <tbody>
            {items_html}
        </tbody>
    </table>

    <div class="divider"></div>

    <div class="totals">
        <table>
            <tr>
                <td>Subtotal:</td>
                <td style="text-align: right;">{format_currency(order.subtotal)}</td>
            </tr>
            {"<tr><td>Envio:</td><td style='text-align: right;'>+" + format_currency(order.delivery_fee) + "</td></tr>" if order.delivery_fee > 0 else ""}
            <tr>
                <td>Total:</td>
                <td style="text-align: right;">{format_currency(order.total)}</td>
            </tr>
            {balance_html}
        </table>
    </div>

    <div class="footer">
        <p>Gracias por su preferencia!</p>
        <p>Le notificaremos cuando</p>
        <p>su encargo este listo.</p>
    </div>

    <script>
        window.onload = function() {{
            window.print();
        }};
    </script>
</body>
</html>
"""

    def generate_order_email_html(
        self,
        order: Order,
        school_name: str = "Uniformes Consuelo Rios",
    ) -> str:
        """
        Generate HTML email for order confirmation.
        This is a nicer format for email, not thermal printing.
        """
        # Build items HTML
        items_html = ""
        for item in order.items:
            garment_name = item.garment_type.name if item.garment_type else "Prenda"
            size = item.size or ""
            qty = item.quantity
            price = format_currency(item.unit_price)
            subtotal = format_currency(item.subtotal)
            items_html += f"""
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">{garment_name} {size}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">{qty}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">{price}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">{subtotal}</td>
            </tr>
            """

        # Client info
        client_name = order.client.name if order.client else "Cliente"
        student_name = order.client.student_name if order.client and order.client.student_name else None

        # Delivery info
        delivery_html = ""
        if order.delivery_type == DeliveryType.DELIVERY:
            delivery_html = f"""
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 16px 0;">
                <strong>Envio a Domicilio</strong><br>
                {order.delivery_address or ''}<br>
                {order.delivery_neighborhood + ', ' if order.delivery_neighborhood else ''}{order.delivery_city or 'Bogota'}
                {('<br><em>' + order.delivery_references + '</em>') if order.delivery_references else ''}
            </div>
            """
        else:
            delivery_html = """
            <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 12px; margin: 16px 0;">
                <strong>Retiro en Tienda</strong><br>
                Te notificaremos cuando tu pedido este listo para recoger.
            </div>
            """

        # Payment status
        if order.paid_amount >= order.total:
            payment_html = """
            <div style="background: #d1fae5; color: #065f46; padding: 12px; border-radius: 8px; text-align: center; margin: 16px 0;">
                <strong>PAGADO</strong>
            </div>
            """
        elif order.paid_amount > 0:
            payment_html = f"""
            <div style="background: #fef3c7; color: #92400e; padding: 12px; border-radius: 8px; margin: 16px 0;">
                <strong>Abono:</strong> {format_currency(order.paid_amount)}<br>
                <strong>Saldo pendiente:</strong> {format_currency(order.balance)}
            </div>
            """
        else:
            payment_html = f"""
            <div style="background: #fee2e2; color: #991b1b; padding: 12px; border-radius: 8px; margin: 16px 0;">
                <strong>Pendiente de pago:</strong> {format_currency(order.total)}
            </div>
            """

        return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 40px auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%); padding: 30px 20px; text-align: center;">
            <h1 style="color: #C9A227; margin: 0 0 8px 0; font-size: 20px;">Uniformes Consuelo Rios</h1>
            <p style="color: #9ca3af; margin: 0; font-size: 14px;">{school_name}</p>
        </div>

        <!-- Content -->
        <div style="padding: 30px;">
            <h2 style="color: #1f2937; margin: 0 0 8px 0;">Confirmacion de Encargo</h2>
            <p style="color: #6b7280; margin: 0 0 24px 0;">Pedido <strong>#{order.code}</strong></p>

            <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px 0; color: #374151;">
                    <strong>Cliente:</strong> {client_name}
                </p>
                {f'<p style="margin: 0 0 8px 0; color: #374151;"><strong>Estudiante:</strong> {student_name}</p>' if student_name else ''}
                <p style="margin: 0 0 8px 0; color: #374151;">
                    <strong>Fecha:</strong> {format_date(order.order_date)}
                </p>
                <p style="margin: 0; color: #374151;">
                    <strong>Estado:</strong> <span style="background: #e5e7eb; padding: 2px 8px; border-radius: 4px;">{get_status_text(order.status)}</span>
                </p>
            </div>

            {delivery_html}

            <!-- Products Table -->
            <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
                <thead>
                    <tr style="background: #f3f4f6;">
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Producto</th>
                        <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Cant.</th>
                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Precio</th>
                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    {items_html}
                </tbody>
            </table>

            <!-- Totals -->
            <div style="text-align: right; margin: 24px 0;">
                <p style="margin: 4px 0; color: #6b7280;">Subtotal: {format_currency(order.subtotal)}</p>
                {f'<p style="margin: 4px 0; color: #6b7280;">Envio: {format_currency(order.delivery_fee)}</p>' if order.delivery_fee > 0 else ''}
                <p style="margin: 8px 0 0 0; font-size: 20px; font-weight: bold; color: #1f2937;">Total: {format_currency(order.total)}</p>
            </div>

            {payment_html}

            <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                Si tienes alguna pregunta sobre tu pedido, no dudes en contactarnos.
            </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #1f2937; padding: 20px; text-align: center;">
            <p style="color: #9ca3af; margin: 0 0 8px 0; font-size: 14px;">
                Uniformes Consuelo Rios
            </p>
            <p style="color: #6b7280; margin: 0; font-size: 12px;">
                Tel: 300 123 4567 | WhatsApp: 300 123 4567
            </p>
            <p style="color: #6b7280; margin: 4px 0 0 0; font-size: 12px;">
                Calle 56 D #26 BE 04, Boston - Medellin, Antioquia
            </p>
            <p style="color: #6b7280; margin: 8px 0 0 0; font-size: 11px;">
                {get_colombia_now_naive().year} Todos los derechos reservados.
            </p>
        </div>
    </div>
</body>
</html>
"""

    def generate_sale_email_html(
        self,
        sale: Sale,
        school_name: str = "Uniformes Consuelo Rios",
    ) -> str:
        """
        Generate HTML email for sale confirmation.
        Professional email format (not thermal printing).
        """
        # Build items HTML
        items_html = ""
        for item in sale.items:
            product_name = item.product.name if item.product else "Producto"
            size = item.size or ""
            qty = item.quantity
            price = format_currency(item.unit_price)
            subtotal = format_currency(item.subtotal)
            items_html += f"""
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">{product_name} {size}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">{qty}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">{price}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">{subtotal}</td>
            </tr>
            """

        # Client info
        client_name = sale.client.name if sale.client else "Cliente General"
        student_name = sale.client.student_name if sale.client and sale.client.student_name else None

        # Payment method
        payment_methods = {
            "cash": "Efectivo",
            "nequi": "Nequi",
            "transfer": "Transferencia",
            "card": "Tarjeta",
            "credit": "Credito",
        }
        payment_method_text = payment_methods.get(sale.payment_method, sale.payment_method) if sale.payment_method else "No especificado"

        # Payment status
        paid_amount = float(sale.paid_amount or 0)
        total = float(sale.total)
        balance = total - paid_amount

        if balance <= 0:
            payment_html = """
            <div style="background: #d1fae5; color: #065f46; padding: 12px; border-radius: 8px; text-align: center; margin: 16px 0;">
                <strong>PAGADO</strong>
            </div>
            """
        elif paid_amount > 0:
            payment_html = f"""
            <div style="background: #fef3c7; color: #92400e; padding: 12px; border-radius: 8px; margin: 16px 0;">
                <strong>Abono:</strong> {format_currency(paid_amount)}<br>
                <strong>Saldo pendiente:</strong> {format_currency(balance)}
            </div>
            """
        else:
            payment_html = f"""
            <div style="background: #fee2e2; color: #991b1b; padding: 12px; border-radius: 8px; margin: 16px 0;">
                <strong>Pendiente de pago:</strong> {format_currency(total)}
            </div>
            """

        # Status text
        status_map = {
            "pending": "Pendiente",
            "completed": "Completada",
            "cancelled": "Cancelada",
        }
        status_text = status_map.get(sale.status, sale.status)

        return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 40px auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%); padding: 30px 20px; text-align: center;">
            <h1 style="color: #C9A227; margin: 0 0 8px 0; font-size: 20px;">Uniformes Consuelo Rios</h1>
            <p style="color: #9ca3af; margin: 0; font-size: 14px;">{school_name}</p>
        </div>

        <!-- Content -->
        <div style="padding: 30px;">
            <h2 style="color: #1f2937; margin: 0 0 8px 0;">Recibo de Venta</h2>
            <p style="color: #6b7280; margin: 0 0 24px 0;">Venta <strong>#{sale.code}</strong></p>

            <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px 0; color: #374151;">
                    <strong>Cliente:</strong> {client_name}
                </p>
                {f'<p style="margin: 0 0 8px 0; color: #374151;"><strong>Estudiante:</strong> {student_name}</p>' if student_name else ''}
                <p style="margin: 0 0 8px 0; color: #374151;">
                    <strong>Fecha:</strong> {format_date(sale.sale_date)}
                </p>
                <p style="margin: 0 0 8px 0; color: #374151;">
                    <strong>Estado:</strong> <span style="background: #e5e7eb; padding: 2px 8px; border-radius: 4px;">{status_text}</span>
                </p>
                <p style="margin: 0; color: #374151;">
                    <strong>Metodo de pago:</strong> {payment_method_text}
                </p>
            </div>

            <!-- Products Table -->
            <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
                <thead>
                    <tr style="background: #f3f4f6;">
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Producto</th>
                        <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Cant.</th>
                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Precio</th>
                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    {items_html}
                </tbody>
            </table>

            <!-- Totals -->
            <div style="text-align: right; margin: 24px 0;">
                <p style="margin: 4px 0; color: #6b7280;">Subtotal: {format_currency(sale.subtotal)}</p>
                {f'<p style="margin: 4px 0; color: #6b7280;">Descuento: -{format_currency(sale.discount)}</p>' if sale.discount and sale.discount > 0 else ''}
                <p style="margin: 8px 0 0 0; font-size: 20px; font-weight: bold; color: #1f2937;">Total: {format_currency(sale.total)}</p>
            </div>

            {payment_html}

            <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                Gracias por su compra. Cambios dentro de 8 dias con recibo y producto sin uso.
            </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #1f2937; padding: 20px; text-align: center;">
            <p style="color: #9ca3af; margin: 0 0 8px 0; font-size: 14px;">
                Uniformes Consuelo Rios
            </p>
            <p style="color: #6b7280; margin: 0; font-size: 12px;">
                Tel: 300 123 4567 | WhatsApp: 300 123 4567
            </p>
            <p style="color: #6b7280; margin: 4px 0 0 0; font-size: 12px;">
                Calle 56 D #26 BE 04, Boston - Medellin, Antioquia
            </p>
            <p style="color: #6b7280; margin: 8px 0 0 0; font-size: 11px;">
                {get_colombia_now_naive().year} Todos los derechos reservados.
            </p>
        </div>
    </div>
</body>
</html>
"""
