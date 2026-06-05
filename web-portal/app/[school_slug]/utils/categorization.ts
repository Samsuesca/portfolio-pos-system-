/**
 * Product Categorization Utilities
 *
 * Centralized logic for categorizing products by name patterns.
 * This eliminates duplicate categorization code in the catalog page.
 */

/**
 * Category definitions with their keyword patterns
 * Each category is matched against the product name (lowercase)
 */
export const CATEGORY_PATTERNS: Record<string, string[]> = {
  Camisas: ['camisa', 'blusa', 'camiseta'],
  Chompas: ['chompa'],
  Pantalones: ['pantalon', 'falda'],
  Sudaderas: ['sudadera', 'buzo', 'chaqueta'],
  Jumper: ['jumper', 'yomber'],
  Delantales: ['delantal'],
  // 'mono' cubre 'moño' y 'mono' (con o sin accent en la data)
  Moños: ['moño', 'mono'],
  Calzado: ['zapato', 'tennis', 'media', 'jean'],
};

/**
 * Get the category for a product based on its name
 * @param productName - The product name to categorize
 * @returns The category name or null if no match
 */
export function getCategoryForProduct(productName: string): string | null {
  const nameLower = productName.toLowerCase();

  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    if (patterns.some((pattern) => nameLower.includes(pattern))) {
      return category;
    }
  }

  return null;
}

/**
 * Check if a product matches a given category filter
 * @param productName - The product name to check
 * @param filterCategory - The category filter to match against
 * @param isGlobalProduct - Whether this is a global product
 * @returns true if the product matches the filter
 */
export function productMatchesCategory(
  productName: string,
  filterCategory: string,
  isGlobalProduct: boolean
): boolean {
  // 'all' matches everything
  if (filterCategory === 'all') return true;

  const filterLower = filterCategory.toLowerCase();

  // 'Otros' category shows ONLY global products
  if (filterLower === 'otros') {
    return isGlobalProduct;
  }

  // For other categories, exclude global products and match by patterns
  if (isGlobalProduct) return false;

  const patterns = CATEGORY_PATTERNS[filterCategory];
  if (!patterns) return false;

  const nameLower = productName.toLowerCase();
  return patterns.some((pattern) => nameLower.includes(pattern));
}

/**
 * Extract unique categories from a list of products
 * Only categorizes school products (not global)
 * @param schoolProducts - School-specific products
 * @param globalProducts - Global products (used to add 'Otros' category)
 * @returns Array of category names including 'all'
 */
export function extractCategories(
  schoolProducts: { name: string }[],
  globalProducts: { name: string }[]
): string[] {
  const uniqueCategories = new Set<string>();

  // Categorize ONLY school products
  schoolProducts.forEach((product) => {
    const category = getCategoryForProduct(product.name);
    if (category) {
      uniqueCategories.add(category);
    }
  });

  // Add "Otros" category if there are global products
  if (globalProducts.length > 0) {
    uniqueCategories.add('Otros');
  }

  return ['all', ...Array.from(uniqueCategories).sort()];
}

/**
 * Extract and sort unique sizes from products
 * @param products - Array of products with size property
 * @returns Sorted array of sizes (numbers first, then letters)
 */
export function extractSizes(products: { size?: string }[]): string[] {
  // Normalizar case: 'pequeño', 'pequeña', 'PEQUEÑO' deben colapsar a una sola entrada.
  // Usar el primer formato visto como canonico.
  const canonicalByKey = new Map<string, string>();

  products.forEach((product) => {
    if (product.size && product.size !== 'Única') {
      const trimmed = product.size.trim();
      const key = trimmed.toLowerCase();
      if (!canonicalByKey.has(key)) {
        // Mantener mayusculas en sizes cortos tipo letra (S, M, L, XL, XXL).
        // Solo Title Case para palabras descriptivas (pequeño, mediano, grande).
        const isShortAlpha = /^[A-Za-z]{1,4}$/.test(trimmed);
        const display = isShortAlpha
          ? trimmed.toUpperCase()
          : trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
        canonicalByKey.set(key, display);
      }
    }
  });

  // Sort sizes: numbers first (asc), size ranges (4-6, 6-8, ...), then letters
  return Array.from(canonicalByKey.values()).sort((a, b) => {
    const aIsNum = /^\d+$/.test(a);
    const bIsNum = /^\d+$/.test(b);
    if (aIsNum && bIsNum) return parseInt(a) - parseInt(b);
    if (aIsNum) return -1;
    if (bIsNum) return 1;
    const aIsRange = /^\d+-\d+$/.test(a);
    const bIsRange = /^\d+-\d+$/.test(b);
    if (aIsRange && bIsRange) return parseInt(a) - parseInt(b);
    if (aIsRange) return -1;
    if (bIsRange) return 1;
    return a.localeCompare(b);
  });
}
