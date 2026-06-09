"""
Quotation Document Mixin

Genera un documento comercial A4 self-contained (HTML + CSS embebido, cero
dependencias) para la cotizacion. El usuario imprime / guarda como PDF desde el
navegador (Ctrl+P). Espeja el patron de `ReceiptService` (f-strings + @page),
adaptado a un documento formal A4 en lugar de recibo termico 80mm.

Los campos provistos por el usuario (descripcion, customizacion, terms, notes,
nombre del cliente) se escapan con html.escape para evitar inyeccion en el
documento renderizado.
"""
from datetime import date
from decimal import Decimal
from html import escape
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.b2b import QuotationStatus


_STATUS_LABELS = {
    QuotationStatus.DRAFT: "Borrador",
    QuotationStatus.SENT: "Enviada",
    QuotationStatus.NEGOTIATION: "En Negociación",
    QuotationStatus.ACCEPTED: "Aceptada",
    QuotationStatus.REJECTED: "Rechazada",
    QuotationStatus.EXPIRED: "Vencida",
}


def _format_currency(amount: float | Decimal) -> str:
    """Formatea como pesos colombianos (mismo estilo que ReceiptService)."""
    return f"${amount:,.0f}".replace(",", ".")


def _format_date(value: date) -> str:
    return value.strftime("%d/%m/%Y")


def _status_label(status: QuotationStatus | str) -> str:
    if not isinstance(status, QuotationStatus):
        status = QuotationStatus(status)
    return _STATUS_LABELS.get(status, status.value)


class QuotationDocumentMixin:
    """Mixin que genera el HTML comercial de la cotizacion."""

    db: AsyncSession  # Type hint for IDE support

    async def generate_quotation_html(self, quotation_id: UUID) -> str | None:
        """Genera el documento HTML A4 de la cotizacion. None si no existe."""
        quotation = await self.get_quotation_with_items(quotation_id)
        if not quotation:
            return None

        client = quotation.b2b_client
        client_name = escape(client.legal_name) if client else "Cliente"
        client_tax = escape(client.tax_id) if client and client.tax_id else ""
        client_contact = escape(client.contact_name) if client and client.contact_name else ""
        client_phone = escape(client.contact_phone) if client and client.contact_phone else ""
        client_email = escape(client.contact_email) if client and client.contact_email else ""

        rows_html = ""
        for idx, item in enumerate(quotation.items, start=1):
            description = escape(item.description)
            customization = (
                f"<br><span class='custom'>{escape(item.customization)}</span>"
                if item.customization
                else ""
            )
            rows_html += f"""
            <tr>
                <td class="center">{idx}</td>
                <td>{description}{customization}</td>
                <td class="center">{item.quantity}</td>
                <td class="right">{_format_currency(item.unit_price)}</td>
                <td class="right">{_format_currency(item.line_total)}</td>
            </tr>
            """

        deposit_amount = (
            quotation.total * quotation.deposit_pct / Decimal("100")
        ).quantize(Decimal("0.01"))
        balance_amount = quotation.total - deposit_amount

        delivery_html = ""
        if quotation.estimated_delivery_days is not None:
            delivery_html = (
                f"<p><strong>Tiempo estimado de entrega:</strong> "
                f"{quotation.estimated_delivery_days} días</p>"
            )

        terms_html = ""
        if quotation.terms:
            terms_html = (
                f"<div class='block'><h3>Términos y Condiciones</h3>"
                f"<p>{escape(quotation.terms)}</p></div>"
            )

        notes_html = ""
        if quotation.notes:
            notes_html = (
                f"<div class='block'><h3>Notas</h3>"
                f"<p>{escape(quotation.notes)}</p></div>"
            )

        return f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Cotización {escape(quotation.quotation_number)}</title>
    <style>
        @page {{ size: A4; margin: 16mm; }}
        * {{ box-sizing: border-box; }}
        body {{
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 12px;
            color: #1a1a1a;
            margin: 0;
            padding: 0;
        }}
        .doc {{ max-width: 720px; margin: 0 auto; padding: 24px; }}
        .header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 3px solid #1e3a8a;
            padding-bottom: 16px;
            margin-bottom: 20px;
        }}
        .header h1 {{ margin: 0; font-size: 22px; color: #1e3a8a; }}
        .header .biz p {{ margin: 2px 0; font-size: 11px; color: #555; }}
        .doc-meta {{ text-align: right; }}
        .doc-meta .number {{ font-size: 18px; font-weight: bold; color: #1e3a8a; }}
        .doc-meta .badge {{
            display: inline-block;
            margin-top: 6px;
            padding: 3px 10px;
            border-radius: 12px;
            background: #e0e7ff;
            color: #1e3a8a;
            font-size: 11px;
            font-weight: 600;
        }}
        .parties {{ display: flex; gap: 24px; margin-bottom: 20px; }}
        .parties .col {{ flex: 1; }}
        .parties h3 {{
            margin: 0 0 6px 0;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #1e3a8a;
        }}
        .parties p {{ margin: 2px 0; font-size: 12px; }}
        table {{ width: 100%; border-collapse: collapse; margin-bottom: 16px; }}
        thead th {{
            background: #1e3a8a;
            color: #fff;
            text-align: left;
            padding: 8px 10px;
            font-size: 11px;
            text-transform: uppercase;
        }}
        tbody td {{ padding: 8px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }}
        tbody tr:nth-child(even) {{ background: #f8fafc; }}
        .center {{ text-align: center; }}
        .right {{ text-align: right; }}
        .custom {{ color: #6b7280; font-size: 10px; font-style: italic; }}
        .totals {{ width: 280px; margin-left: auto; }}
        .totals tr td {{ padding: 6px 10px; border: none; }}
        .totals .label {{ text-align: right; color: #555; }}
        .totals .grand td {{
            border-top: 2px solid #1e3a8a;
            font-size: 15px;
            font-weight: bold;
            color: #1e3a8a;
        }}
        .payment {{
            margin-top: 18px;
            padding: 12px 16px;
            background: #f0f9ff;
            border-left: 4px solid #1e3a8a;
            font-size: 12px;
        }}
        .payment p {{ margin: 3px 0; }}
        .block {{ margin-top: 18px; }}
        .block h3 {{
            font-size: 12px;
            text-transform: uppercase;
            color: #1e3a8a;
            margin: 0 0 6px 0;
        }}
        .block p {{ margin: 0; white-space: pre-line; color: #333; }}
        .footer {{
            margin-top: 28px;
            padding-top: 12px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 10px;
            color: #9ca3af;
        }}
        @media print {{ .doc {{ padding: 0; }} }}
    </style>
</head>
<body>
    <div class="doc">
        <div class="header">
            <div class="biz">
                <h1>Uniformes Consuelo Rios</h1>
                <p>Dotación corporativa y empresarial</p>
                <p>Bogotá, Colombia</p>
            </div>
            <div class="doc-meta">
                <div class="number">COTIZACIÓN</div>
                <div class="number">{escape(quotation.quotation_number)}</div>
                <div class="badge">{_status_label(quotation.status)}</div>
            </div>
        </div>

        <div class="parties">
            <div class="col">
                <h3>Cliente</h3>
                <p><strong>{client_name}</strong></p>
                {f'<p>NIT: {client_tax}</p>' if client_tax else ''}
                {f'<p>{client_contact}</p>' if client_contact else ''}
                {f'<p>{client_phone}</p>' if client_phone else ''}
                {f'<p>{client_email}</p>' if client_email else ''}
            </div>
            <div class="col">
                <h3>Detalles</h3>
                <p><strong>Fecha de emisión:</strong> {_format_date(quotation.issue_date)}</p>
                <p><strong>Válida hasta:</strong> {_format_date(quotation.valid_until)}</p>
                {delivery_html}
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th class="center">#</th>
                    <th>Descripción</th>
                    <th class="center">Cant.</th>
                    <th class="right">Vr. Unit.</th>
                    <th class="right">Vr. Total</th>
                </tr>
            </thead>
            <tbody>
                {rows_html}
            </tbody>
        </table>

        <table class="totals">
            <tr>
                <td class="label">Subtotal</td>
                <td class="right">{_format_currency(quotation.subtotal)}</td>
            </tr>
            <tr>
                <td class="label">IVA</td>
                <td class="right">{_format_currency(quotation.tax_amount)}</td>
            </tr>
            <tr class="grand">
                <td class="label">Total</td>
                <td class="right">{_format_currency(quotation.total)}</td>
            </tr>
        </table>

        <div class="payment">
            <p><strong>Condiciones de pago:</strong> anticipo del {quotation.deposit_pct}% para iniciar producción.</p>
            <p>Anticipo: {_format_currency(deposit_amount)} &nbsp;·&nbsp; Saldo: {_format_currency(balance_amount)}</p>
        </div>

        {terms_html}
        {notes_html}

        <div class="footer">
            <p>Documento generado por Uniformes Consuelo Rios — cotización válida hasta {_format_date(quotation.valid_until)}.</p>
        </div>
    </div>
</body>
</html>"""
