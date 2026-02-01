import type { GarmentTypeImage, School, Product } from './api';

/**
 * Representa una variante de producto (una talla específica)
 */
export interface ProductVariant {
  id: string;
  size: string;
  price: number;
  stock: number;
  isOrder: boolean; // true = sin stock (encargo)
}

/**
 * Representa un grupo de productos del mismo tipo de prenda
 * (agrupa todas las tallas de un mismo producto)
 */
export interface ProductGroup {
  garmentTypeId: string;
  name: string;              // Nombre base sin talla, ej: "Camiseta Escolar"
  basePrice: number;         // Precio mínimo del grupo
  maxPrice: number;          // Precio máximo (para mostrar rango si difieren)
  images: GarmentTypeImage[];
  primaryImageUrl: string | null;
  variants: ProductVariant[];
  school: School;
  isYomber: boolean;
  isGlobal: boolean;         // true = producto global, false = producto de colegio
}

/**
 * Ordena tallas de forma natural: 4, 6, 8, 10... XS, S, M, L, XL...
 * Los números van primero (ordenados numéricamente), luego las letras
 */
export function compareSizes(a: string, b: string): number {
  const numA = parseInt(a);
  const numB = parseInt(b);

  // Si ambos son números, ordenar numéricamente
  if (!isNaN(numA) && !isNaN(numB)) return numA - numB;

  // Orden estándar de tallas de letras
  const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'];
  const idxA = sizeOrder.indexOf(a.toUpperCase());
  const idxB = sizeOrder.indexOf(b.toUpperCase());

  // Si uno es número y otro es letra, el número va primero
  if (!isNaN(numA) && isNaN(numB)) return -1;  // a es número, b es letra
  if (isNaN(numA) && !isNaN(numB)) return 1;   // a es letra, b es número

  // Si ambos están en el orden de letras definido
  if (idxA !== -1 && idxB !== -1) return idxA - idxB;

  // Si solo uno está en el orden, ese va primero
  if (idxA !== -1) return -1;
  if (idxB !== -1) return 1;

  // Fallback: orden alfabético
  return a.localeCompare(b);
}

/**
 * Extrae el nombre base del producto sin la talla
 * "Camiseta Escolar Talla 4" → "Camiseta Escolar"
 * "Zapatos Goma T27-T34" → "Zapatos Goma"
 */
export function getBaseName(name: string): string {
  return name
    // Remover "Talla X" o "talla X" al final
    .replace(/\s*-?\s*[Tt]alla\s*\d+\s*$/i, '')
    // Remover patrones como "T27-T34" o "T27"
    .replace(/\s*-?\s*T\d+(-T\d+)?\s*$/i, '')
    // Remover solo números al final (ej: "Camiseta 4")
    .replace(/\s+\d+\s*$/, '')
    .trim();
}

/**
 * Agrupa productos por tipo de prenda
 */
export function groupProductsByGarmentType(
  products: Product[],
  school: School,
  isGlobal: boolean = false
): ProductGroup[] {
  const groups = new Map<string, ProductGroup>();

  products.forEach(product => {
    const key = product.garment_type_id;

    if (!groups.has(key)) {
      // Usar garment_type_name del backend si está disponible,
      // de lo contrario derivar del nombre del producto
      const groupName = product.garment_type_name || getBaseName(product.name);

      groups.set(key, {
        garmentTypeId: key,
        name: groupName,
        basePrice: product.price,
        maxPrice: product.price,
        images: product.garment_type_images || [],
        primaryImageUrl: product.garment_type_primary_image_url || null,
        variants: [],
        school,
        isYomber: groupName.toLowerCase().includes('yomber'),
        isGlobal
      });
    }

    const group = groups.get(key)!;
    const stock = product.stock ?? product.inventory_quantity ?? 0;

    group.variants.push({
      id: product.id,
      size: product.size || 'Única',
      price: product.price,
      stock,
      isOrder: stock === 0
    });

    // Actualizar rango de precios
    group.basePrice = Math.min(group.basePrice, product.price);
    group.maxPrice = Math.max(group.maxPrice, product.price);
  });

  // Ordenar variantes por talla dentro de cada grupo
  groups.forEach(group => {
    group.variants.sort((a, b) => compareSizes(a.size, b.size));
  });

  return Array.from(groups.values());
}
