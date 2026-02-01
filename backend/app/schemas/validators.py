"""
Shared Validators for Pydantic Schemas

Reusable validation functions for common data types.
"""
import re


# Colombian phone pattern: 10 digits starting with 3
COLOMBIAN_PHONE_PATTERN = re.compile(r'^3\d{9}$')


def validate_colombian_phone(phone: str | None) -> str | None:
    """
    Validate and clean Colombian phone number.

    Colombian mobile phones:
    - 10 digits total
    - Start with 3 (mobile prefix)
    - Example: 3001234567

    Args:
        phone: Phone number string (may contain spaces, dashes, etc.)

    Returns:
        Cleaned phone number (only digits) or None

    Raises:
        ValueError: If phone format is invalid
    """
    if phone is None:
        return None

    # Remove all non-digit characters
    clean = re.sub(r'\D', '', phone)

    # Empty after cleaning means no phone
    if not clean:
        return None

    # Validate Colombian format
    if not COLOMBIAN_PHONE_PATTERN.match(clean):
        raise ValueError(
            'Telefono debe ser 10 digitos e iniciar con 3 (ej: 3001234567)'
        )

    return clean
