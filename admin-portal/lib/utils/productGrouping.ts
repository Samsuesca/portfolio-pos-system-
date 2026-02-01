/**
 * Product Grouping Utilities
 *
 * Functions to group products by garment type for a cleaner UI
 * Similar to the web portal's product display
 */

import type { Product, GarmentType, GlobalProduct, GlobalGarmentType } from '@/lib/api';

// ============================================
// Types
// ============================================

export interface ProductVariant {
  productId: string;
  productCode: string;
  size: string;
  color: string | null;
  price: number;
  stock: number;
  imageUrl: string | null;
}

export interface ProductGroup {
  garmentTypeId: string;
  garmentTypeName: string;
  garmentTypeImageUrl: string | null;
  basePrice: number; // Minimum price across variants
  maxPrice: number; // Maximum price across variants
  totalStock: number; // Sum of all variant stocks
  variants: ProductVariant[];
  sizes: string[]; // Unique sizes, sorted
  colors: string[]; // Unique colors
  hasCustomMeasurements: boolean;
}

// ============================================
// Size Ordering
// ============================================

// Standard size order for letters
const LETTER_SIZE_ORDER: Record<string, number> = {
  XXS: 1,
  XS: 2,
  S: 3,
  M: 4,
  L: 5,
  XL: 6,
  XXL: 7,
  XXXL: 8,
  '2XL': 7,
  '3XL': 8,
  '4XL': 9,
};

/**
 * Compare two sizes for sorting
 * Numbers are sorted numerically, letters by standard order
 */
export function compareSizes(a: string, b: string): number {
  const aUpper = a.toUpperCase();
  const bUpper = b.toUpperCase();

  // Check if both are numeric
  const aNum = parseFloat(a);
  const bNum = parseFloat(b);

  if (!isNaN(aNum) && !isNaN(bNum)) {
    return aNum - bNum;
  }

  // Check if both are letter sizes
  const aOrder = LETTER_SIZE_ORDER[aUpper];
  const bOrder = LETTER_SIZE_ORDER[bUpper];

  if (aOrder !== undefined && bOrder !== undefined) {
    return aOrder - bOrder;
  }

  // Numbers before letters
  if (!isNaN(aNum) && isNaN(bNum)) return -1;
  if (isNaN(aNum) && !isNaN(bNum)) return 1;

  // Known letters before unknown
  if (aOrder !== undefined && bOrder === undefined) return -1;
  if (aOrder === undefined && bOrder !== undefined) return 1;

  // Fallback to alphabetical
  return a.localeCompare(b);
}

// ============================================
// Emoji Fallbacks
// ============================================

const CATEGORY_KEYWORDS: Array<{ keywords: string[]; emoji: string }> = [
  { keywords: ['camisa', 'camiseta', 'polo'], emoji: '👕' },
  { keywords: ['blusa'], emoji: '👚' },
  { keywords: ['pantalon', 'jean'], emoji: '👖' },
  { keywords: ['falda', 'vestido'], emoji: '👗' },
  { keywords: ['sudadera', 'chompa', 'chaqueta', 'buzo', 'saco'], emoji: '🧥' },
  { keywords: ['zapato', 'tennis', 'tenis', 'calzado'], emoji: '👟' },
  { keywords: ['media', 'calcetin'], emoji: '🧦' },
  { keywords: ['yomber', 'medida'], emoji: '📏' },
  { keywords: ['corbata'], emoji: '👔' },
  { keywords: ['gorra', 'sombrero'], emoji: '🧢' },
  { keywords: ['mochila', 'morral', 'bolso'], emoji: '🎒' },
];

/**
 * Get emoji fallback for a garment type based on its name
 */
export function getEmojiForCategory(garmentTypeName: string): string {
  const nameLower = garmentTypeName.toLowerCase();

  for (const { keywords, emoji } of CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => nameLower.includes(keyword))) {
      return emoji;
    }
  }

  return '👔'; // Default
}

// ============================================
// Product Grouping
// ============================================

/**
 * Group products by garment type
 * Creates ProductGroup objects with all variants organized
 */
export function groupProductsByGarmentType(
  products: Product[],
  garmentTypes: GarmentType[]
): ProductGroup[] {
  // Create a map for quick garment type lookup
  const garmentTypeMap = new Map<string, GarmentType>();
  garmentTypes.forEach((gt) => garmentTypeMap.set(gt.id, gt));

  // Group products by garment_type_id
  const groupsMap = new Map<string, ProductVariant[]>();

  products.forEach((product) => {
    const gtId = product.garment_type_id;
    if (!gtId) return;

    if (!groupsMap.has(gtId)) {
      groupsMap.set(gtId, []);
    }

    const stock = product.stock ?? product.inventory_quantity ?? 0;

    groupsMap.get(gtId)!.push({
      productId: product.id,
      productCode: product.code,
      size: product.size,
      color: product.color || null,
      price: Number(product.price),
      stock: stock,
      imageUrl: product.image_url || null,
    });
  });

  // Convert to ProductGroup array
  const groups: ProductGroup[] = [];

  groupsMap.forEach((variants, garmentTypeId) => {
    const garmentType = garmentTypeMap.get(garmentTypeId);
    if (!garmentType) return;

    // Sort variants by size
    const sortedVariants = [...variants].sort((a, b) => compareSizes(a.size, b.size));

    // Get unique sizes and colors
    const sizesSet = new Set<string>();
    const colorsSet = new Set<string>();
    let minPrice = Infinity;
    let maxPrice = 0;
    let totalStock = 0;

    sortedVariants.forEach((v) => {
      sizesSet.add(v.size);
      if (v.color) colorsSet.add(v.color);
      if (v.price < minPrice) minPrice = v.price;
      if (v.price > maxPrice) maxPrice = v.price;
      totalStock += v.stock;
    });

    // Get image from garment type or first product
    let imageUrl: string | null = garmentType.image_url || null;

    // Fallback: first product's image
    if (!imageUrl) {
      imageUrl = sortedVariants.find((v) => v.imageUrl)?.imageUrl || null;
    }

    groups.push({
      garmentTypeId,
      garmentTypeName: garmentType.name,
      garmentTypeImageUrl: imageUrl,
      basePrice: minPrice === Infinity ? 0 : minPrice,
      maxPrice: maxPrice,
      totalStock,
      variants: sortedVariants,
      sizes: Array.from(sizesSet).sort(compareSizes),
      colors: Array.from(colorsSet).sort(),
      hasCustomMeasurements: garmentType.has_custom_measurements || false,
    });
  });

  // Sort groups by name
  return groups.sort((a, b) => a.garmentTypeName.localeCompare(b.garmentTypeName));
}

/**
 * Find a specific variant within a group by size and optionally color
 */
export function findVariant(
  group: ProductGroup,
  size: string,
  color?: string | null
): ProductVariant | undefined {
  return group.variants.find((v) => {
    if (v.size !== size) return false;
    if (color !== undefined && v.color !== color) return false;
    return true;
  });
}

/**
 * Get variants for a specific size (may have multiple colors)
 */
export function getVariantsForSize(group: ProductGroup, size: string): ProductVariant[] {
  return group.variants.filter((v) => v.size === size);
}

/**
 * Get colors available for a specific size
 */
export function getColorsForSize(group: ProductGroup, size: string): string[] {
  const colors = new Set<string>();
  group.variants
    .filter((v) => v.size === size && v.color)
    .forEach((v) => colors.add(v.color!));
  return Array.from(colors).sort();
}

/**
 * Format price display
 */
export function formatPriceRange(basePrice: number, maxPrice: number): string {
  if (basePrice === maxPrice) {
    return `$${basePrice.toLocaleString('es-CO')}`;
  }
  return `$${basePrice.toLocaleString('es-CO')} - $${maxPrice.toLocaleString('es-CO')}`;
}

// ============================================
// Global Products Grouping
// ============================================

/**
 * Group global products by garment type
 * Similar to groupProductsByGarmentType but for GlobalProduct type
 */
export function groupGlobalProductsByGarmentType(
  products: GlobalProduct[],
  garmentTypes: GlobalGarmentType[]
): ProductGroup[] {
  // Create a map for quick garment type lookup
  const garmentTypeMap = new Map<string, GlobalGarmentType>();
  garmentTypes.forEach((gt) => garmentTypeMap.set(gt.id, gt));

  // Group products by garment_type_id
  const groupsMap = new Map<string, ProductVariant[]>();

  products.forEach((product) => {
    const gtId = product.garment_type_id;
    if (!groupsMap.has(gtId)) {
      groupsMap.set(gtId, []);
    }

    const stock = product.inventory_quantity ?? 0;

    groupsMap.get(gtId)!.push({
      productId: product.id,
      productCode: product.code,
      size: product.size,
      color: product.color || null,
      price: Number(product.price),
      stock: stock,
      imageUrl: product.image_url || null,
    });
  });

  // Convert to ProductGroup array
  const groups: ProductGroup[] = [];

  groupsMap.forEach((variants, garmentTypeId) => {
    const garmentType = garmentTypeMap.get(garmentTypeId);
    if (!garmentType) return;

    // Sort variants by size
    const sortedVariants = [...variants].sort((a, b) => compareSizes(a.size, b.size));

    // Get unique sizes and colors
    const sizesSet = new Set<string>();
    const colorsSet = new Set<string>();
    let minPrice = Infinity;
    let maxPrice = 0;
    let totalStock = 0;

    sortedVariants.forEach((v) => {
      sizesSet.add(v.size);
      if (v.color) colorsSet.add(v.color);
      if (v.price < minPrice) minPrice = v.price;
      if (v.price > maxPrice) maxPrice = v.price;
      totalStock += v.stock;
    });

    // Get image from garment type or first product
    let imageUrl: string | null = garmentType.image_url || null;

    // Fallback: first product's image
    if (!imageUrl) {
      imageUrl = sortedVariants.find((v) => v.imageUrl)?.imageUrl || null;
    }

    groups.push({
      garmentTypeId,
      garmentTypeName: garmentType.name,
      garmentTypeImageUrl: imageUrl,
      basePrice: minPrice === Infinity ? 0 : minPrice,
      maxPrice: maxPrice,
      totalStock,
      variants: sortedVariants,
      sizes: Array.from(sizesSet).sort(compareSizes),
      colors: Array.from(colorsSet).sort(),
      hasCustomMeasurements: false, // Global products don't have custom measurements
    });
  });

  // Sort groups by name
  return groups.sort((a, b) => a.garmentTypeName.localeCompare(b.garmentTypeName));
}
