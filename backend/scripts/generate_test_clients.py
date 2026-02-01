#!/usr/bin/env python3
"""
Script para generar clientes de prueba aleatorios.
Ejecutar desde el directorio backend:
    python scripts/generate_test_clients.py

Requiere que el backend esté configurado con la base de datos.
"""
import asyncio
import random
import sys
from pathlib import Path

# Agregar el directorio backend al path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.client import Client

# Nombres colombianos comunes
NOMBRES = [
    "María", "Juan", "Carlos", "Ana", "Luis", "Carmen", "José", "Rosa",
    "Pedro", "Laura", "Miguel", "Patricia", "Antonio", "Sandra", "Francisco",
    "Diana", "Jorge", "Luz", "Ricardo", "Gloria", "Fernando", "Martha",
    "Andrés", "Adriana", "Rafael", "Claudia", "Daniel", "Mónica", "Eduardo",
    "Paola", "Alejandro", "Carolina", "Mauricio", "Andrea", "Sergio", "Natalia",
    "Diego", "Catalina", "Oscar", "Marcela", "Fabián", "Liliana", "Héctor",
    "Ángela", "Javier", "Esperanza", "Camilo", "Beatriz", "Nicolás", "Isabel"
]

APELLIDOS = [
    "García", "Rodríguez", "Martínez", "López", "González", "Hernández",
    "Pérez", "Sánchez", "Ramírez", "Torres", "Flores", "Rivera", "Gómez",
    "Díaz", "Reyes", "Morales", "Jiménez", "Ruiz", "Álvarez", "Romero",
    "Vargas", "Castro", "Ortiz", "Rubio", "Molina", "Delgado", "Moreno",
    "Muñoz", "Gutiérrez", "Alonso", "Navarro", "Domínguez", "Vásquez",
    "Ramos", "Gil", "Serrano", "Blanco", "Suárez", "Iglesias", "Medina",
    "Aguilar", "Garrido", "Santos", "Castillo", "Cortés", "Guerrero",
    "Prieto", "Méndez", "Cruz", "Calvo"
]

GRADOS = [
    "Preescolar", "1°", "2°", "3°", "4°", "5°",
    "6°", "7°", "8°", "9°", "10°", "11°"
]

DOMINIOS_EMAIL = ["gmail.com", "hotmail.com", "yahoo.com", "outlook.com"]


def generar_telefono() -> str:
    """Genera un número de teléfono colombiano válido (10 dígitos, empieza con 3)."""
    prefijos = ["300", "301", "302", "303", "304", "305", "310", "311", "312",
                "313", "314", "315", "316", "317", "318", "319", "320", "321"]
    prefijo = random.choice(prefijos)
    resto = "".join([str(random.randint(0, 9)) for _ in range(7)])
    return f"{prefijo}{resto}"


def generar_email(nombre: str, apellido: str) -> str:
    """Genera un email basado en el nombre."""
    nombre_limpio = nombre.lower().replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u").replace("ñ", "n")
    apellido_limpio = apellido.lower().replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u").replace("ñ", "n")

    formatos = [
        f"{nombre_limpio}.{apellido_limpio}",
        f"{nombre_limpio}{apellido_limpio}",
        f"{nombre_limpio}_{apellido_limpio}",
        f"{nombre_limpio[0]}{apellido_limpio}",
        f"{nombre_limpio}{random.randint(1, 99)}",
    ]

    base = random.choice(formatos)
    dominio = random.choice(DOMINIOS_EMAIL)
    return f"{base}@{dominio}"


def generar_cliente() -> dict:
    """Genera datos de un cliente aleatorio."""
    nombre = random.choice(NOMBRES)
    apellido1 = random.choice(APELLIDOS)
    apellido2 = random.choice(APELLIDOS)
    nombre_completo = f"{nombre} {apellido1} {apellido2}"

    # 80% tienen teléfono
    telefono = generar_telefono() if random.random() < 0.8 else None

    # 60% tienen email
    email = generar_email(nombre, apellido1) if random.random() < 0.6 else None

    # 70% tienen estudiante asociado
    tiene_estudiante = random.random() < 0.7
    nombre_estudiante = None
    grado_estudiante = None

    if tiene_estudiante:
        nombre_estudiante_base = random.choice(NOMBRES)
        # 50% mismo apellido que el cliente
        if random.random() < 0.5:
            nombre_estudiante = f"{nombre_estudiante_base} {apellido1}"
        else:
            nombre_estudiante = f"{nombre_estudiante_base} {random.choice(APELLIDOS)}"
        grado_estudiante = random.choice(GRADOS)

    return {
        "name": nombre_completo,
        "phone": telefono,
        "email": email,
        "student_name": nombre_estudiante,
        "student_grade": grado_estudiante,
        "is_active": True,
        "client_type": "regular",
    }


async def generar_clientes(cantidad: int = 100):
    """Genera clientes de prueba en la base de datos."""
    print(f"Generando {cantidad} clientes de prueba...")

    async with AsyncSessionLocal() as db:
        # Verificar cuántos clientes ya existen
        result = await db.execute(select(Client))
        clientes_existentes = len(result.scalars().all())
        print(f"Clientes existentes: {clientes_existentes}")

        clientes_creados = 0
        for i in range(cantidad):
            datos = generar_cliente()

            # Generar código único
            codigo = f"CLI-TEST-{clientes_existentes + i + 1:04d}"

            cliente = Client(
                code=codigo,
                name=datos["name"],
                phone=datos["phone"],
                email=datos["email"],
                student_name=datos["student_name"],
                student_grade=datos["student_grade"],
                is_active=datos["is_active"],
                client_type=datos["client_type"],
            )

            db.add(cliente)
            clientes_creados += 1

            if (i + 1) % 10 == 0:
                print(f"  Creados: {i + 1}/{cantidad}")

        await db.commit()
        print(f"\n✓ Se crearon {clientes_creados} clientes de prueba exitosamente!")
        print(f"  Total de clientes ahora: {clientes_existentes + clientes_creados}")


async def eliminar_clientes_test():
    """Elimina todos los clientes de prueba (código empieza con CLI-TEST)."""
    print("Eliminando clientes de prueba...")

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Client).where(Client.code.like("CLI-TEST-%"))
        )
        clientes_test = result.scalars().all()

        cantidad = len(clientes_test)
        if cantidad == 0:
            print("No hay clientes de prueba para eliminar.")
            return

        for cliente in clientes_test:
            await db.delete(cliente)

        await db.commit()
        print(f"✓ Se eliminaron {cantidad} clientes de prueba.")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generar clientes de prueba")
    parser.add_argument(
        "--cantidad", "-n",
        type=int,
        default=100,
        help="Cantidad de clientes a generar (default: 100)"
    )
    parser.add_argument(
        "--eliminar", "-d",
        action="store_true",
        help="Eliminar clientes de prueba en lugar de crearlos"
    )

    args = parser.parse_args()

    if args.eliminar:
        asyncio.run(eliminar_clientes_test())
    else:
        asyncio.run(generar_clientes(args.cantidad))
