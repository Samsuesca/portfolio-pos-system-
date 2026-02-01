# Convenciones de Codigo

Estandares de codigo para Uniformes System.

---

## Python (Backend)

### Estilo General

- Seguir PEP 8
- Usar type hints en todo
- Async/await obligatorio para operaciones de BD
- Docstrings para funciones publicas

### Ejemplo

```python
from typing import Optional
from uuid import UUID

async def get_product_by_id(
    db: AsyncSession,
    product_id: UUID,
    school_id: Optional[UUID] = None
) -> Optional[Product]:
    """
    Obtiene un producto por su ID.

    Args:
        db: Sesion de base de datos
        product_id: ID del producto
        school_id: ID del colegio (opcional)

    Returns:
        Producto encontrado o None
    """
    query = select(Product).where(Product.id == product_id)
    if school_id:
        query = query.where(Product.school_id == school_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()
```

### SQLAlchemy 2.0

```python
# Correcto - SQLAlchemy 2.0 style
from sqlalchemy import select

result = await db.execute(select(Product).where(Product.id == id))
product = result.scalar_one_or_none()

# Incorrecto - SQLAlchemy 1.x style
product = db.query(Product).filter(Product.id == id).first()
```

### Pydantic v2

```python
from pydantic import BaseModel, ConfigDict

class ProductCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    price: float
    school_id: UUID
```

---

## TypeScript (Frontend)

### Estilo General

- Componentes funcionales + hooks
- Types estrictos, evitar `any`
- Preferir interfaces sobre types para objetos
- Usar Zustand para estado global

### Componentes React

```typescript
interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onSelect }) => {
  const handleClick = () => {
    onSelect(product);
  };

  return (
    <div onClick={handleClick} className="p-4 border rounded">
      <h3>{product.name}</h3>
      <p>${product.price}</p>
    </div>
  );
};

export default ProductCard;
```

### Servicios API

```typescript
// Usar axios con tipos
import axios from 'axios';
import { Product, ProductCreate } from '../types/api';

const API_URL = import.meta.env.VITE_API_URL;

export const productService = {
  async getAll(schoolId: string): Promise<Product[]> {
    const response = await axios.get(`${API_URL}/schools/${schoolId}/products`);
    return response.data;
  },

  async create(schoolId: string, data: ProductCreate): Promise<Product> {
    const response = await axios.post(
      `${API_URL}/schools/${schoolId}/products`,
      data
    );
    return response.data;
  },
};
```

### Estado con Zustand

```typescript
import { create } from 'zustand';

interface SchoolState {
  currentSchool: School | null;
  setCurrentSchool: (school: School) => void;
}

export const useSchoolStore = create<SchoolState>((set) => ({
  currentSchool: null,
  setCurrentSchool: (school) => set({ currentSchool: school }),
}));
```

---

## Nombres y Convenciones

### Archivos

| Tipo | Convencion | Ejemplo |
|------|------------|---------|
| Python modules | snake_case | `global_accounting.py` |
| React components | PascalCase | `ProductCard.tsx` |
| TypeScript services | camelCase | `productService.ts` |
| CSS/Styles | kebab-case | `product-card.css` |

### Variables

| Lenguaje | Convencion | Ejemplo |
|----------|------------|---------|
| Python | snake_case | `school_id`, `product_name` |
| TypeScript | camelCase | `schoolId`, `productName` |

### Funciones

| Lenguaje | Convencion | Ejemplo |
|----------|------------|---------|
| Python | snake_case | `get_product_by_id()` |
| TypeScript | camelCase | `getProductById()` |

---

## Commits

Usar Conventional Commits:

```
feat: add new product modal
fix: resolve inventory update bug
docs: update API documentation
refactor: simplify sale service logic
test: add tests for accounting service
```

Tipos permitidos:
- `feat`: Nueva funcionalidad
- `fix`: Correccion de bug
- `docs`: Documentacion
- `refactor`: Refactorizacion
- `test`: Tests
- `chore`: Tareas de mantenimiento

---

## Imports

### Python

```python
# Orden: stdlib, terceros, locales
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product
from app.services.product import ProductService
```

### TypeScript

```typescript
// Orden: React, terceros, locales
import React, { useState, useEffect } from 'react';

import axios from 'axios';
import { useQuery } from '@tanstack/react-query';

import { Product } from '../types/api';
import { useSchoolStore } from '../stores/schoolStore';
```

---

[← Volver al indice](./README.md)
