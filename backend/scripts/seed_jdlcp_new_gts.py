"""Puebla los garment types nuevos de Juan de la Cruz Posada (Camiseta Diario,
Jumper Bachillerato, Jumper Primaria) con productos/tallas, tomando como
referencia los productos de Caracas. Stock 0 (visibles como "Por encargo").

Idempotente: solo crea productos para GTs que actualmente tienen 0 productos
activos. Re-correrlo no duplica.

Uso (en el server):
    backend/venv/bin/python backend/scripts/seed_jdlcp_new_gts.py
"""

from __future__ import annotations

import asyncio
import os
import re
import sys
import uuid as uuid_lib

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://uniformes_user:dev_password@localhost:5432/uniformes_db",
)

JDLCP = "95ae55cd-a8e4-416e-b973-c53b2226be36"

# target_gt_id -> (nombre, reference_gt_id de Caracas)
TARGETS: list[tuple[str, str, str]] = [
    ("369199e9-d233-4b99-ac51-b91114a0a6f6", "Camiseta Diario", "3d9ed414-ecba-4d19-9823-3a91198ce1b0"),
    ("b54d9afc-2865-427a-ad6e-8f341f2c4947", "Jumper Bachillerato", "dc3f3558-9b7e-4be7-b220-e4057b673fc1"),
    ("b11d91f4-4f7e-4be2-b283-edb7779203fc", "Jumper Primaria", "dc3f3558-9b7e-4be7-b220-e4057b673fc1"),
]


async def next_code_seq(conn) -> int:
    rows = (
        await conn.execute(
            text("SELECT code FROM products WHERE school_id = :s"),
            {"s": JDLCP},
        )
    ).all()
    mx = 0
    for r in rows:
        m = re.match(r"PRD-(\d+)$", r.code or "")
        if m:
            mx = max(mx, int(m.group(1)))
    return mx + 1


async def main() -> int:
    engine = create_async_engine(DATABASE_URL)
    created = 0
    skipped: list[str] = []

    async with engine.begin() as conn:
        seq = await next_code_seq(conn)
        for gt_id, gt_name, ref_gt in TARGETS:
            n = (
                await conn.execute(
                    text("SELECT COUNT(*) FROM products WHERE garment_type_id = :g AND is_active"),
                    {"g": gt_id},
                )
            ).scalar()
            if n and n > 0:
                skipped.append(f"{gt_name} (ya tiene {n} productos)")
                continue

            ref = (
                await conn.execute(
                    text(
                        "SELECT size, price, cost, color, gender FROM products "
                        "WHERE garment_type_id = :g AND is_active ORDER BY price, size"
                    ),
                    {"g": ref_gt},
                )
            ).all()
            if not ref:
                skipped.append(f"{gt_name} (referencia vacía)")
                continue

            for row in ref:
                pid = str(uuid_lib.uuid4())
                code = f"PRD-{seq:04d}"
                seq += 1
                await conn.execute(
                    text(
                        "INSERT INTO products "
                        "(id, school_id, garment_type_id, code, name, size, color, gender, "
                        " price, cost, is_active, created_at, updated_at) "
                        "VALUES (:id, :sch, :gt, :code, :name, :size, :color, :gender, "
                        " :price, :cost, true, now(), now())"
                    ),
                    {
                        "id": pid,
                        "sch": JDLCP,
                        "gt": gt_id,
                        "code": code,
                        "name": gt_name,
                        "size": row.size,
                        "color": row.color,
                        "gender": row.gender,
                        "price": row.price,
                        "cost": row.cost,
                    },
                )
                await conn.execute(
                    text(
                        "INSERT INTO inventory "
                        "(id, school_id, product_id, quantity, reserved_quantity, min_stock_alert, last_updated) "
                        "VALUES (:id, :sch, :pid, 0, 0, 5, now())"
                    ),
                    {"id": str(uuid_lib.uuid4()), "sch": JDLCP, "pid": pid},
                )
                created += 1
            print(f"  OK  {gt_name}: {len(ref)} productos (tallas {', '.join(r.size for r in ref)})")

    print("\n=== RESUMEN ===")
    print(f"Productos creados: {created}")
    for s in skipped:
        print(f"   - saltado: {s}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
