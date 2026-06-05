"""vendor normalization step B: populate vendors and link existing records

Revision ID: vendor_norm_b
Revises: vendor_norm_a
Create Date: 2026-04-13
"""
from typing import Sequence, Union
from alembic import op
from sqlalchemy import text

revision: str = "vendor_norm_b"
down_revision: Union[str, None] = "vendor_norm_a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Clusters confirmed by owner (2026-04-13)
# Format: (canonical_name, type, [raw_values])
VENDOR_CLUSTERS = [
    ("Felipe Suesca", "person", [
        "felipe", "Felipe", "FELIPE", "pipe", "el FELIPE", "felipe suesca", "FELIPE SUESCA",
        "felipe adelanto nomina", "adelanto felipe", "felipe pero el gasto es mio",
        "felipe gasto del negocio", "felipe y salo", "felipe y yo",
        "dollar cyty felipe prestamo nomina", "tigo felipe cuadrar todos los meses anteriores",
    ]),
    ("Samuel", "person", [
        "samuel", "Samuel", "samu", "Samu", "samuel....", "me debe samuel elpatro",
        "samuel por botar las llaves", "prestamo a samuel", "samul prestamo",
        "Tarjeta Bancolombia Samuel", "Tarjeta Bancolombia", "pipe y samu",
        "samu,pipe y yo", "pipe y yo", "pipey yo",
    ]),
    ("Santiago Mazo", "person", [
        "santiago", "Santiago", "santy mazo", "SANTY MAZO", "santiago canole",
        "santiago suesca", "prestamo a santiago", "favor a santiago mazo",
        "mazo", "Mazo", "MAZO", "Maza", "manza", "mazo pasajes", "pago de mazo",
        "mazo se los dio a garcia",
    ]),
    ("Lady Gomez", "person", [
        "lady", "laidy", "lady gomez", "lady goez", "LAYDY GOEZ", "lady confeccion",
    ]),
    ("Victor", "person", [
        "victor", "Victor", "VICTOR", "victor bermudez", "adelanto nomina victor",
    ]),
    ("Milton", "person", [
        "milton", "milton abono a factura", "milton marini", "milton zapatos",
    ]),
    ("Wilson Suesca", "person", [
        "wilson", "Wilson Suesca", "wilson suesca", "wilson gasto mio", "WILSONPAGO 4",
    ]),
    ("Andres Garcia", "person", [
        "andres garcia", "por culpa de garcia",
    ]),
    ("Supermercado / Tienda", "business", [
        "supermercado", "supermercado ochoa", "la perla", "D1", "d1", "d1 y tienda",
        "tienda", "8a", "Mercado", "ara", "macrosurtido", "macpollo",
    ]),
    ("Servicios Publicos", "business", [
        "GNC", "Gobierno de Colombia", "Epm", "epm", "tigo", "tigo para mazo",
        "Velonet", "velonet", "comfama", "sura", "SURA-",
    ]),
    ("Hangar Textil", "business", [
        "hangar", "hangar textil",
        "hangar textil .....digite mal eran 456 puse 256 aca se completan l",
    ]),
    ("Boston", "business", ["Boston", "boston"]),
    ("Esika", "business", ["Esika", "esika"]),
    ("William Telas", "business", ["william telas", "WILLIAM TELAS"]),
    ("Yambal", "business", ["yambal"]),
    ("Temu", "business", ["temu"]),
    ("Jose Jaras", "person", ["Jose Jaras", "jose jaras"]),
    ("Bombay", "business", ["BOMBAY", "bombay"]),
    ("Freddy Papeleria", "business", ["FREDDY PAPELERIA", "freddy papeleria", "freddy"]),
    ("Camara de Comercio", "business", ["camara de comercio"]),
    ("Tigre", "business", ["Tigre", "tigre", "el tiger", "72jean tiger"]),
    ("Texkilos", "business", ["texkilos", "tex kilos"]),
    ("La Bodega Textil", "business", ["la bodega textil", "la bodega texti"]),
    ("Bodega del Confeccionista", "business", ["bodega del confeccionista"]),
    ("Retacon", "business", ["retacon", "retacon lina"]),
    ("Las Escalas", "business", ["las escalas"]),
    ("Elkinplast", "business", ["elkinplast"]),
    ("Pamplemuza", "business", ["pamplemuza"]),
    ("Don Evelio", "person", ["Don Evelio", "don uver", "evelio y daniela"]),
    ("Gloria a Dios las Motos", "business", ["gloria a dios las motos"]),
    ("Consuelo y Felipe", "person", ["CONSU Y PIPE", "consuelo y felipe", "pipe y consu"]),
    ("Martin Malaleche", "person", ["martin malaleche"]),
    ("Martin Andrade", "person", ["martin andrade"]),
    ("Martin Quintas", "person", ["martin quintas", "quintas"]),
    ("Betty", "person", ["betty"]),
    ("Belki", "person", ["belki", "belki sesgos"]),
    ("Kamilo Bello", "person", ["kamilo", "kamilo bello", "camilo bello", "Amparo bello"]),
    ("Cristina Londono", "person", ["cristina londoño", "Cris"]),
    ("Daniela Vallejo", "person", ["daniela vallejo"]),
    ("Diana Zingapur", "person", ["diana", "DIANA ZINGAPUR", "diana zingapur"]),
    ("Dario Cuellos", "person", ["dario cuellos"]),
    ("Esteban Martinez", "person", ["esteban martinez"]),
    ("Elizabeth", "person", ["elizabeth"]),
    ("Elvia Luz", "person", ["Elvia Luz"]),
    ("Giovany Moreno", "person", ["giovany moreno"]),
    ("Ingri", "person", ["INGRI"]),
    ("Jhon Fredy Arguello", "person", ["Jhon", "jhon fredy arguello"]),
    ("Marina Quintero", "person", ["marina quintero", "MARINA MONTERO"]),
    ("Salome", "person", ["salome"]),
    ("Luz", "person", ["luz"]),
    ("Maria", "person", ["maria"]),
    ("Marycris", "person", ["marycris"]),
    ("Daniel", "person", ["daniel", "ir daniel", "JUAN de sandra", "pago nequi para daniel"]),
    ("Santiago Canole", "person", ["canole"]),
    ("Ines", "person", ["ines"]),
    ("Diego", "person", ["diego"]),
    ("Ochoa", "person", ["ochoa"]),
    ("Alonzo", "person", ["ALONZO"]),
    ("Didi", "person", ["didi"]),
    ("Elifia Cartagena", "person", ["ELIFIA CARTAGENA"]),
    ("Wompi", "internal", []),
    ("Empleados - Nomina Consolidada", "internal", []),
    # Business misc
    ("Drogueria Tododrogas", "business", ["drogueria tododrogas"]),
    ("Distribrisas", "business", ["DISTRIBRISAS"]),
    ("Sellos Colombia", "business", ["sellos colombia"]),
    ("Telas y Telas", "business", ["TELAS Y TELAS"]),
    ("Mercantil de Textiles", "business", ["mercantil de textiles"]),
    ("Textiles Cundinamarca", "business", ["textiles cundinamarca"]),
    ("Tekas Facil", "business", ["Tekas facil", "teks antes portofino"]),
    ("Antioqueña de Maquinas", "business", ["antioqueña de maquinas", "alexis antioqueña de maquinas"]),
    ("Insumos el Mayorista", "business", ["insumos el mayorista 3118715811"]),
    ("Hotmat", "business", ["hotmat"]),
    ("Fargo", "business", ["fargo"]),
    ("My QR Code", "business", ["My QRCODE"]),
    ("Super Expres", "business", ["Super expres", "superexpres"]),
    ("Dollar City", "business", ["dolar city", "dollar city gasto mio"]),
    ("Vultr", "business", ["Vultr"]),
    ("Contadora", "person", ["contadora"]),
]

# Values that are notes, not vendors — move to expense.notes, vendor_id stays NULL
NOTES_ONLY = [
    "30 para cenar 20 para tanquiar 10 mas para ajustar todo en prestamo",
    "dos veces pasteles de pollo en el abeato",
    "para 6 pagados de capital de los primeros 10",
    "adelanto sin liquidar el total",
    "camiseta compra prueva wompi",
    "REGALO NAVIDEÑO",
    "efectivo",
    "confeccion",
    "corte",
    "centro", "Calle", "calle", "la calle", "LA CALLE",
    "nequi", "girando", "todos", "tri", "JJ",
    "la barriga", "la loca", "la 39", "la virgen24 horas",
    "el carmen", "el trece", "san cristobal", "san javier", "zabaneta",
    "minorista", "textiles", "indrive y gasolina", "medico examenes",
]

# Values with vendor + note mixed — extract note to append
NOTES_EXTRACTION = {
    "hangar textil .....digite mal eran 456 puse 256 aca se completan l": "Digite mal, eran 456 puse 256. Aca se completan",
    "felipe adelanto nomina": "Adelanto de nomina",
    "adelanto felipe": "Adelanto",
    "felipe pero el gasto es mio": "El gasto es del registrador",
    "felipe gasto del negocio": "Gasto del negocio",
    "dollar cyty felipe prestamo nomina": "Dollar City - prestamo nomina",
    "tigo felipe cuadrar todos los meses anteriores": "Tigo - cuadrar meses anteriores",
    "samuel por botar las llaves": "Por botar las llaves",
    "prestamo a samuel": "Prestamo",
    "samul prestamo": "Prestamo",
    "me debe samuel elpatro": "Me debe el patro",
    "milton abono a factura": "Abono a factura",
    "milton zapatos": "Zapatos",
    "milton marini": "Marini",
    "mazo se los dio a garcia": "Se los dio a Garcia",
    "mazo pasajes": "Pasajes",
    "pago de mazo": "Pago",
    "favor a santiago mazo": "Favor",
    "prestamo a santiago": "Prestamo",
    "adelanto nomina victor": "Adelanto de nomina",
    "wilson gasto mio": "Gasto mio",
    "WILSONPAGO 4": "Pago 4",
    "por culpa de garcia": "Por culpa de Garcia",
    "dollar city gasto mio": "Gasto mio",
    "tigo para mazo": "Para Mazo",
    "alexis antioqueña de maquinas": "Alexis",
    "insumos el mayorista 3118715811": "Tel: 3118715811",
    "retacon lina": "Lina",
    "belki sesgos": "Sesgos",
    "pago nequi para daniel": "Pago Nequi",
    "ir daniel": "Ir a ver",
    "JUAN de sandra": "Juan de Sandra",
    "pipe y consu": None,
    "pipe y samu": None,
    "pipe y yo": None,
    "pipey yo": None,
    "felipe y salo": "Y Salo",
    "felipe y yo": "Y yo",
    "samu,pipe y yo": None,
}


def upgrade() -> None:
    conn = op.get_bind()

    # Step 1: Insert all canonical vendors
    for name, vtype, raw_values in VENDOR_CLUSTERS:
        normalized = name.strip().lower()
        is_system = vtype == "internal"
        conn.execute(text("""
            INSERT INTO vendors (id, name, normalized_name, type, is_system, created_at, updated_at)
            VALUES (gen_random_uuid(), :name, :normalized, CAST(:vtype AS vendor_type_enum), :is_system, now(), now())
            ON CONFLICT (normalized_name) DO NOTHING
        """), {"name": name, "normalized": normalized, "vtype": vtype, "is_system": is_system})

    # Step 2: Link expenses to vendors via raw values
    for name, vtype, raw_values in VENDOR_CLUSTERS:
        if not raw_values:
            continue
        normalized = name.strip().lower()
        for raw in raw_values:
            # Update expenses
            conn.execute(text("""
                UPDATE expenses SET vendor_id = v.id
                FROM vendors v
                WHERE v.normalized_name = :normalized
                AND LOWER(TRIM(expenses.vendor)) = LOWER(TRIM(:raw))
                AND expenses.vendor_id IS NULL
            """), {"normalized": normalized, "raw": raw})

            # Update accounts_payable
            conn.execute(text("""
                UPDATE accounts_payable SET vendor_id = v.id
                FROM vendors v
                WHERE v.normalized_name = :normalized
                AND LOWER(TRIM(accounts_payable.vendor)) = LOWER(TRIM(:raw))
                AND accounts_payable.vendor_id IS NULL
            """), {"normalized": normalized, "raw": raw})

            # Update fixed_expenses
            conn.execute(text("""
                UPDATE fixed_expenses SET vendor_id = v.id
                FROM vendors v
                WHERE v.normalized_name = :normalized
                AND LOWER(TRIM(fixed_expenses.vendor)) = LOWER(TRIM(:raw))
                AND fixed_expenses.vendor_id IS NULL
            """), {"normalized": normalized, "raw": raw})

    # Step 3: Extract notes from vendor+note mixed values
    for raw, note in NOTES_EXTRACTION.items():
        if note:
            conn.execute(text("""
                UPDATE expenses
                SET notes = CASE
                    WHEN notes IS NOT NULL AND notes != '' THEN notes || ' | ' || :note
                    ELSE :note
                END
                WHERE LOWER(TRIM(vendor)) = LOWER(TRIM(:raw))
            """), {"raw": raw, "note": note})

    # Step 4: Handle NOTES_ONLY — move vendor text to notes, clear vendor string, leave vendor_id NULL
    for raw in NOTES_ONLY:
        conn.execute(text("""
            UPDATE expenses
            SET notes = CASE
                WHEN notes IS NOT NULL AND notes != '' THEN notes || ' | [vendor era: ' || vendor || ']'
                ELSE '[vendor era: ' || vendor || ']'
            END,
            vendor = NULL,
            vendor_id = NULL
            WHERE LOWER(TRIM(vendor)) = LOWER(TRIM(:raw))
        """), {"raw": raw})

    # Step 5: Auto-create vendors for any remaining unmatched (vendor IS NOT NULL AND vendor_id IS NULL)
    conn.execute(text("""
        INSERT INTO vendors (id, name, normalized_name, type, created_at, updated_at)
        SELECT gen_random_uuid(),
               INITCAP(TRIM(e.vendor)),
               LOWER(TRIM(e.vendor)),
               'person'::vendor_type_enum,
               now(), now()
        FROM (
            SELECT DISTINCT vendor FROM expenses
            WHERE vendor IS NOT NULL AND vendor != '' AND vendor_id IS NULL
        ) e
        ON CONFLICT (normalized_name) DO NOTHING
    """))

    # Link the auto-created vendors
    conn.execute(text("""
        UPDATE expenses SET vendor_id = v.id
        FROM vendors v
        WHERE LOWER(TRIM(expenses.vendor)) = v.normalized_name
        AND expenses.vendor IS NOT NULL
        AND expenses.vendor != ''
        AND expenses.vendor_id IS NULL
    """))

    # Same for accounts_payable
    conn.execute(text("""
        INSERT INTO vendors (id, name, normalized_name, type, created_at, updated_at)
        SELECT gen_random_uuid(),
               INITCAP(TRIM(ap.vendor)),
               LOWER(TRIM(ap.vendor)),
               'person'::vendor_type_enum,
               now(), now()
        FROM (
            SELECT DISTINCT vendor FROM accounts_payable
            WHERE vendor IS NOT NULL AND vendor != '' AND vendor_id IS NULL
        ) ap
        WHERE NOT EXISTS (
            SELECT 1 FROM vendors v WHERE v.normalized_name = LOWER(TRIM(ap.vendor))
        )
    """))
    conn.execute(text("""
        UPDATE accounts_payable SET vendor_id = v.id
        FROM vendors v
        WHERE LOWER(TRIM(accounts_payable.vendor)) = v.normalized_name
        AND accounts_payable.vendor IS NOT NULL
        AND accounts_payable.vendor != ''
        AND accounts_payable.vendor_id IS NULL
    """))

    # Same for fixed_expenses
    conn.execute(text("""
        INSERT INTO vendors (id, name, normalized_name, type, created_at, updated_at)
        SELECT gen_random_uuid(),
               INITCAP(TRIM(fe.vendor)),
               LOWER(TRIM(fe.vendor)),
               'person'::vendor_type_enum,
               now(), now()
        FROM (
            SELECT DISTINCT vendor FROM fixed_expenses
            WHERE vendor IS NOT NULL AND vendor != '' AND vendor_id IS NULL
        ) fe
        WHERE NOT EXISTS (
            SELECT 1 FROM vendors v WHERE v.normalized_name = LOWER(TRIM(fe.vendor))
        )
    """))
    conn.execute(text("""
        UPDATE fixed_expenses SET vendor_id = v.id
        FROM vendors v
        WHERE LOWER(TRIM(fixed_expenses.vendor)) = v.normalized_name
        AND fixed_expenses.vendor IS NOT NULL
        AND fixed_expenses.vendor != ''
        AND fixed_expenses.vendor_id IS NULL
    """))


def downgrade() -> None:
    # Clear all vendor_id references
    op.execute(text("UPDATE expenses SET vendor_id = NULL"))
    op.execute(text("UPDATE accounts_payable SET vendor_id = NULL"))
    op.execute(text("UPDATE fixed_expenses SET vendor_id = NULL"))
    # Delete all vendor records
    op.execute(text("DELETE FROM vendors"))
