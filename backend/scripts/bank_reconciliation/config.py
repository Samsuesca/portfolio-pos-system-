"""Configuración estática del sistema de conciliación bancaria.

Sin secretos. Sin paths absolutos. Sin estado runtime.
Todo lo que es "negocio" (cuentas conocidas, reglas de categorización) vive aquí
para que sea auditable en git, sin tener que tocar lógica.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal


@dataclass(frozen=True)
class BankAccount:
    """Cuenta bancaria propia conocida (de Carmen Consuelo Ríos).

    system_balance_account_id: UUID de balance_accounts en prod que representa
    esta cuenta en el sistema. Permite el matching contra balance_entries.
    """
    code: str
    bank: str
    account_number: str
    account_type: str
    holder_name: str
    system_balance_account_id: str
    aliases_in_other_account: tuple[str, ...] = field(default_factory=tuple)


KNOWN_ACCOUNTS: tuple[BankAccount, ...] = (
    BankAccount(
        code="BC_AHORROS_7338",
        bank="Bancolombia",
        account_number="54089567338",
        account_type="ahorros",
        holder_name="CARMEN CONSUELO RIOS CARTAGENA",
        # balance_accounts."Banco" en prod_snapshot (saldo $1.18M al 2026-05-16)
        system_balance_account_id="0a566699-57e2-4402-8294-c24f34d89a36",
        aliases_in_other_account=("Recarga desde Bancolombia", "Recarga desde: Bancolombia"),
    ),
    BankAccount(
        code="NEQUI_3001234567",
        bank="Nequi",
        account_number="3001234567",
        account_type="nequi",
        holder_name="CARMEN CONSUELO RIOS CARTAGENA",
        # balance_accounts."Nequi" en prod_snapshot (saldo $391K al 2026-05-16)
        system_balance_account_id="d4a62c38-7ddd-4194-a321-aedbdbcde911",
        aliases_in_other_account=("TRANSFERENCIAS A NEQUI", "TRANSFERENCIA A NEQUI"),
    ),
)


def get_account_by_code(code: str) -> BankAccount:
    for acc in KNOWN_ACCOUNTS:
        if acc.code == code:
            return acc
    raise KeyError(f"Cuenta no registrada: {code}")


# ---------------------------------------------------------------------------
# Categorías de transacción
# ---------------------------------------------------------------------------

CATEGORIES = (
    "bank_fee",                       # 4x1000, gravamen, cuotas de manejo
    "financial_income",               # intereses ganados de la cuenta
    "internal_transfer",              # candidato: movimiento entre cuentas propias conocidas
    "internal_transfer_no_pair",      # internal candidato que NO encontró contraparte → es external
    "transfer_external_via_nequi",    # cliente o tercero paga vía Nequi (no es interno)
    "sale_qr",                        # cobro por QR (cliente paga venta)
    "transfer_in_external",           # entra plata de tercero (no propio)
    "transfer_out_external",          # sale plata a tercero (no propio)
    "cash_deposit",                   # consignación en efectivo (corresponsal)
    "supplier_payment",               # pago a proveedor conocido (config KNOWN_SUPPLIERS)
    "credit_card_payment",            # pago a tarjeta de crédito propia
    "owner_drawing_candidate",        # heurística — owner decide manual
    "alteration_payment_candidate",   # ingreso de cliente individual recurrente — posible arreglo
    "needs_manual_review",            # no se pudo categorizar — requiere ojo humano
    "unknown",                        # default (será post-procesado a needs_manual_review)
)


# ---------------------------------------------------------------------------
# Clientes recurrentes — pendientes de catalogar como arreglo / venta
# ---------------------------------------------------------------------------
# Detectados por heurística (2+ ingresos en Nequi de personas individuales).
# Por ahora se marcan como "alteration_payment_candidate" para revisión humana.
# El owner indicó (2026-05-17): "podrían ser arreglos, aún no sé cómo marcarlos".

ALTERATION_CANDIDATE_CLIENTS: tuple[str, ...] = (
    "CINDY PAOLA PIZARRO",
    "DIEGO MAURICIO CUARTAS",
    "GENNY CELEN VALENCIA",
    "EDDY RAMOS HINCAPIE",
    "SOFIA MALDONADO",
)


# ---------------------------------------------------------------------------
# Catálogo de proveedores conocidos
# ---------------------------------------------------------------------------
# Nombres tal cual aparecen en extractos. Comparación case-insensitive con
# normalización (sin acentos). Agregar nombres aquí conforme se confirmen.

@dataclass(frozen=True)
class KnownSupplier:
    name: str           # nombre tal cual aparece en el extracto (o token reconocible)
    service: str        # qué presta (cortes, telas, hilos, marquillas, etc.)
    notes: str = ""


KNOWN_SUPPLIERS: tuple[KnownSupplier, ...] = (
    KnownSupplier(
        name="WILSON JAVIER SUESCA",
        service="cortes de tela",
        notes="Cortador tercerizado — se paga por corte",
    ),
    KnownSupplier(
        name="WILSON FELIPE SUESCA",
        service="proveedor (servicio sin clasificar)",
        notes="Distinto de Wilson Javier (confirmado). 24 pagos en ene-abr 2026.",
    ),
    KnownSupplier(
        name="LADY GIOVANNA GOMEZ",
        service="proveedor",
        notes="4 pagos en ene-abr 2026, $-700K total",
    ),
    KnownSupplier(
        name="MONICA YULIANA RAMOS",
        service="proveedor",
        notes="3 pagos recurrentes",
    ),
    KnownSupplier(
        name="JOSE MANUEL CETINA",
        service="proveedor",
        notes="2 pagos por $-860K",
    ),
    # Pendiente catalogar más:
    # - HENRY HURTADO HIGUERA (aparece en Nequi $900K, parece proveedor pero confirmar)
    # - ENLACE OPERATIVO S.A (PSE recurrente ~$519K mensual)
)


# ---------------------------------------------------------------------------
# Reglas de auto-categorización
# ---------------------------------------------------------------------------
# Orden importa: la primera regla que matchea gana. Cada regla es:
#   (categoría, lista_de_palabras_o_frases_case_insensitive, sign_filter)
# sign_filter: "+" solo si amount > 0, "-" solo si amount < 0, "any" sin filtro.

@dataclass(frozen=True)
class CategoryRule:
    category: str
    keywords: tuple[str, ...]
    sign: str = "any"
    notes: str = ""


CATEGORIZATION_RULES: tuple[CategoryRule, ...] = (
    # Comisiones bancarias e impuestos — siempre negativos
    CategoryRule("bank_fee", ("4x1000", "4 x 1000", "gravamen al movimiento", "impto gobierno", "cuota de manejo"), sign="-",
                 notes="Impuestos y comisiones del banco"),

    # Intereses ganados — positivos
    CategoryRule("financial_income", ("abono intereses ahorros", "pago de intereses", "rendimiento financiero"), sign="+",
                 notes="Intereses bancarios ganados"),

    # Transferencias internas — keywords aparecen en una cuenta cuando hablan de la otra.
    # Estas SOLO se confirman si el matcher de pares encuentra contraparte; aquí solo
    # marcamos el candidato para que el matcher lo procese.
    # Notas:
    #   - "TRANSFERENCIAS A NEQUI" (en BC, negativo)   ↔  "Recarga desde Bancolombia" (en Nequi, positivo)
    #   - "TRANSFERENCIA DESDE NEQUI" (en BC, positivo) ↔  "Para CARMEN..." o similar en Nequi (Nequi censura nombre)
    CategoryRule("internal_transfer", ("transferencias a nequi", "transferencia a nequi",
                                       "transferencia desde nequi", "transferencias desde nequi",
                                       "recarga desde bancolombia", "recarga desde: bancolombia"), sign="any",
                 notes="Candidato — confirmar via matcher de pares"),

    # Ventas QR
    CategoryRule("sale_qr", ("pago qr",), sign="+",
                 notes="Cobro por código QR (venta a cliente)"),

    # Consignaciones efectivo
    CategoryRule("cash_deposit", ("recarga en corresponsal", "consignacion", "consignación", "deposito en efectivo"), sign="+",
                 notes="Depósito de efectivo (corresponsal bancario)"),

    # Owner drawing candidates — gastos personales identificables
    # NO se marcan automáticamente como expense ni como drawing — owner decide.
    CategoryRule("owner_drawing_candidate", ("yanbal", "esika", "temu", "shein",
                                              "amazon", "rappi", "mercado libre",
                                              "ebay", "ali express", "temucom"), sign="any",
                 notes="Gasto potencialmente personal — revisar manual"),

    # Pagos a tarjeta de crédito (reduce pasivo TC, sale plata del banco)
    CategoryRule("credit_card_payment", ("pago suc virt tc master",
                                          "pago suc virt tc visa",
                                          "pago tarjeta credito"), sign="-",
                 notes="Pago a tarjeta de crédito propia"),
)


# Reglas derivadas dinámicamente desde KNOWN_SUPPLIERS (se aplican en categorizer)
def supplier_rules() -> tuple[CategoryRule, ...]:
    """Cada supplier genera una regla 'supplier_payment' con su nombre."""
    return tuple(
        CategoryRule(
            category="supplier_payment",
            keywords=(s.name,),
            sign="-",
            notes=f"Proveedor: {s.service}",
        )
        for s in KNOWN_SUPPLIERS
    )


def alteration_candidate_rules() -> tuple[CategoryRule, ...]:
    """Clientes recurrentes pendientes de confirmar como arreglo/venta."""
    return tuple(
        CategoryRule(
            category="alteration_payment_candidate",
            keywords=(name,),
            sign="+",
            notes="Cliente recurrente — owner debe confirmar si es arreglo o venta",
        )
        for name in ALTERATION_CANDIDATE_CLIENTS
    )


# ---------------------------------------------------------------------------
# Tolerancia de matching
# ---------------------------------------------------------------------------

# Para detectar transferencias internas BC<->Nequi
INTERNAL_TRANSFER_DATE_TOLERANCE_DAYS = 2
INTERNAL_TRANSFER_AMOUNT_EXACT = True   # mismo monto absoluto exacto

# Para matchear contra balance_entries del sistema
BALANCE_ENTRY_DATE_TOLERANCE_DAYS = 3
BALANCE_ENTRY_AMOUNT_TOLERANCE = Decimal("0.01")  # tolerancia centavos


# ---------------------------------------------------------------------------
# Rutas (relativas al repo root)
# ---------------------------------------------------------------------------

EXTRACTS_DIR = "documentos/Finanzas/Extractos"
REPORTS_DIR = "docs/v3/formalization"

# SQLite local volátil
DB_PATH = "/tmp/ucr-reconciliation/reconciliation.db"

# Postgres prod_snapshot (read-only via docker exec)
PG_CONTAINER = "uniformes-postgres"
PG_USER = "uniformes_user"
PG_DATABASE = "uniformes_prod_snapshot"
