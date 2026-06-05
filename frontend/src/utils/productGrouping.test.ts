import { describe, it, expect, vi } from 'vitest';
import {
  compareSizes,
  getEmojiForCategory,
  groupProductsByGarmentType,
  groupGlobalProductsByGarmentType,
  findVariant,
  getVariantsForSize,
  getColorsForSize,
  formatPriceRange,
  type ProductGroup,
  type ProductVariant,
} from './productGrouping';

vi.mock('./api-client', () => ({
  getImageUrlWithCacheBust: vi.fn((url: string | null) => url),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-1',
    code: 'P001',
    size: 'M',
    color: null,
    price: 10000,
    garment_type_id: 'gt-1',
    image_url: null,
    stock: 5,
    inventory_quantity: null,
    garment_type_images: null,
    garment_type_primary_image_url: null,
    ...overrides,
  } as any;
}

function makeGarmentType(overrides: Record<string, unknown> = {}) {
  return {
    id: 'gt-1',
    name: 'Camisa',
    has_custom_measurements: false,
    images: [],
    ...overrides,
  } as any;
}

function makeGlobalProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'gp-1',
    code: 'GP001',
    size: 'M',
    color: null,
    price: 10000,
    garment_type_id: 'gt-1',
    image_url: null,
    inventory_quantity: 5,
    ...overrides,
  } as any;
}

function makeGlobalGarmentType(overrides: Record<string, unknown> = {}) {
  return {
    id: 'gt-1',
    name: 'Zapato',
    images: [],
    ...overrides,
  } as any;
}

function makeGroup(overrides: Partial<ProductGroup> = {}): ProductGroup {
  return {
    garmentTypeId: 'gt-1',
    garmentTypeName: 'Camisa',
    schoolId: null,
    garmentTypeImageUrl: null,
    basePrice: 10000,
    maxPrice: 15000,
    totalStock: 10,
    variants: [],
    sizes: ['S', 'M', 'L'],
    colors: [],
    hasCustomMeasurements: false,
    ...overrides,
  };
}

function makeVariant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    productId: 'prod-1',
    productCode: 'P001',
    size: 'M',
    color: null,
    price: 10000,
    stock: 5,
    imageUrl: null,
    ...overrides,
  };
}

// ─── compareSizes ────────────────────────────────────────────────────────────

describe('compareSizes', () => {
  it('sorts two numeric sizes numerically', () => {
    expect(compareSizes('10', '8')).toBeGreaterThan(0);
    expect(compareSizes('8', '10')).toBeLessThan(0);
    expect(compareSizes('8', '8')).toBe(0);
  });

  it('sorts decimal numeric sizes', () => {
    expect(compareSizes('8.5', '8')).toBeGreaterThan(0);
    expect(compareSizes('7.5', '8')).toBeLessThan(0);
  });

  it('sorts known letter sizes in standard order', () => {
    expect(compareSizes('S', 'M')).toBeLessThan(0);
    expect(compareSizes('XXL', 'XL')).toBeGreaterThan(0);
    expect(compareSizes('XXS', 'XXXL')).toBeLessThan(0);
  });

  it('sorts letter sizes case-insensitively', () => {
    expect(compareSizes('s', 'M')).toBeLessThan(0);
    expect(compareSizes('xl', 'xxl')).toBeLessThan(0);
  });

  it('puts numeric sizes before letter sizes', () => {
    expect(compareSizes('10', 'M')).toBeLessThan(0);
    expect(compareSizes('M', '10')).toBeGreaterThan(0);
  });

  it('puts known letter sizes before unknown sizes', () => {
    expect(compareSizes('M', 'CUSTOM')).toBeLessThan(0);
    expect(compareSizes('CUSTOM', 'M')).toBeGreaterThan(0);
  });

  it('falls back to localeCompare for two unknown sizes', () => {
    const result = compareSizes('Alpha', 'Beta');
    expect(result).toBeLessThan(0);
  });
});

// ─── getEmojiForCategory ─────────────────────────────────────────────────────

describe('getEmojiForCategory', () => {
  it('returns shirt emoji for "camisa"', () => {
    expect(getEmojiForCategory('Camisa Escolar')).toBe('👕');
  });

  it('returns pants emoji for "pantalon"', () => {
    expect(getEmojiForCategory('Pantalon Azul')).toBe('👖');
  });

  it('returns shoe emoji for "zapato"', () => {
    expect(getEmojiForCategory('Zapato Colegial')).toBe('👟');
  });

  it('returns sock emoji for "media"', () => {
    expect(getEmojiForCategory('Media Blanca')).toBe('🧦');
  });

  it('returns backpack emoji for "mochila"', () => {
    expect(getEmojiForCategory('Mochila Escolar')).toBe('🎒');
  });

  it('is case-insensitive', () => {
    expect(getEmojiForCategory('CAMISA')).toBe('👕');
    expect(getEmojiForCategory('Zapato')).toBe('👟');
  });

  it('returns default tie emoji when no keyword matches', () => {
    expect(getEmojiForCategory('Uniforme Generico')).toBe('👔');
  });
});

// ─── groupProductsByGarmentType ──────────────────────────────────────────────

describe('groupProductsByGarmentType', () => {
  it('returns empty array when no products', () => {
    const result = groupProductsByGarmentType([], [makeGarmentType()]);
    expect(result).toEqual([]);
  });

  it('returns empty array when products reference unknown garment type', () => {
    const product = makeProduct({ garment_type_id: 'unknown-gt' });
    const result = groupProductsByGarmentType([product], [makeGarmentType()]);
    expect(result).toEqual([]);
  });

  it('groups products into a ProductGroup with correct fields', () => {
    const product = makeProduct();
    const garmentType = makeGarmentType();
    const [group] = groupProductsByGarmentType([product], [garmentType]);

    expect(group.garmentTypeId).toBe('gt-1');
    expect(group.garmentTypeName).toBe('Camisa');
    expect(group.totalStock).toBe(5);
    expect(group.basePrice).toBe(10000);
    expect(group.maxPrice).toBe(10000);
    expect(group.variants).toHaveLength(1);
  });

  it('computes min and max price across variants', () => {
    const gt = makeGarmentType();
    const products = [
      makeProduct({ id: 'p1', size: 'S', price: 8000 }),
      makeProduct({ id: 'p2', size: 'M', price: 12000 }),
    ];
    const [group] = groupProductsByGarmentType(products, [gt]);
    expect(group.basePrice).toBe(8000);
    expect(group.maxPrice).toBe(12000);
  });

  it('uses stock fallback to inventory_quantity', () => {
    const product = makeProduct({ stock: null, inventory_quantity: 7 });
    const [group] = groupProductsByGarmentType([product], [makeGarmentType()]);
    expect(group.totalStock).toBe(7);
  });

  it('uses 0 when both stock and inventory_quantity are null', () => {
    const product = makeProduct({ stock: null, inventory_quantity: null });
    const [group] = groupProductsByGarmentType([product], [makeGarmentType()]);
    expect(group.totalStock).toBe(0);
  });

  it('uses garment_type_primary_image_url when available', () => {
    const product = makeProduct({ garment_type_primary_image_url: 'http://img.com/primary.jpg' });
    const [group] = groupProductsByGarmentType([product], [makeGarmentType()]);
    expect(group.garmentTypeImageUrl).toBe('http://img.com/primary.jpg');
  });

  it('falls back to garment_type_images sorted by is_primary', () => {
    const product = makeProduct({
      garment_type_images: [
        { image_url: 'http://img.com/secondary.jpg', is_primary: false, display_order: 2 },
        { image_url: 'http://img.com/primary.jpg', is_primary: true, display_order: 1 },
      ],
    });
    const [group] = groupProductsByGarmentType([product], [makeGarmentType()]);
    expect(group.garmentTypeImageUrl).toBe('http://img.com/primary.jpg');
  });

  it('falls back to garmentType.images when product has no image data', () => {
    const garmentType = makeGarmentType({
      images: [{ image_url: 'http://gt.com/img.jpg', is_primary: true, display_order: 1 }],
    });
    const [group] = groupProductsByGarmentType([makeProduct()], [garmentType]);
    expect(group.garmentTypeImageUrl).toBe('http://gt.com/img.jpg');
  });

  it('sorts garmentType.images by is_primary and display_order', () => {
    const garmentType = makeGarmentType({
      images: [
        { image_url: 'http://gt.com/secondary.jpg', is_primary: false, display_order: 1 },
        { image_url: 'http://gt.com/primary.jpg', is_primary: true, display_order: 2 },
        { image_url: 'http://gt.com/third.jpg', is_primary: false, display_order: 0 },
      ],
    });
    const [group] = groupProductsByGarmentType([makeProduct()], [garmentType]);
    expect(group.garmentTypeImageUrl).toBe('http://gt.com/primary.jpg');
  });

  it('falls back to first product image when no garment type image', () => {
    const product = makeProduct({ image_url: 'http://prod.com/img.jpg' });
    const [group] = groupProductsByGarmentType([product], [makeGarmentType()]);
    expect(group.garmentTypeImageUrl).toBe('http://prod.com/img.jpg');
  });

  it('sets hasCustomMeasurements from garment type', () => {
    const gt = makeGarmentType({ has_custom_measurements: true });
    const [group] = groupProductsByGarmentType([makeProduct()], [gt]);
    expect(group.hasCustomMeasurements).toBe(true);
  });

  it('sorts sizes using compareSizes', () => {
    const gt = makeGarmentType();
    const products = [
      makeProduct({ id: 'p1', size: 'XL' }),
      makeProduct({ id: 'p2', size: 'S' }),
      makeProduct({ id: 'p3', size: 'M' }),
    ];
    const [group] = groupProductsByGarmentType(products, [gt]);
    expect(group.sizes).toEqual(['S', 'M', 'XL']);
  });

  it('collects unique colors excluding null', () => {
    const gt = makeGarmentType();
    const products = [
      makeProduct({ id: 'p1', size: 'S', color: 'Azul' }),
      makeProduct({ id: 'p2', size: 'M', color: 'Rojo' }),
      makeProduct({ id: 'p3', size: 'L', color: null }),
    ];
    const [group] = groupProductsByGarmentType(products, [gt]);
    expect(group.colors).toContain('Azul');
    expect(group.colors).toContain('Rojo');
    expect(group.colors).not.toContain(null);
  });

  it('sorts groups alphabetically by garment type name', () => {
    const gt1 = makeGarmentType({ id: 'gt-z', name: 'Zapato' });
    const gt2 = makeGarmentType({ id: 'gt-c', name: 'Camisa' });
    const products = [
      makeProduct({ garment_type_id: 'gt-z' }),
      makeProduct({ id: 'p2', garment_type_id: 'gt-c' }),
    ];
    const groups = groupProductsByGarmentType(products, [gt1, gt2]);
    expect(groups[0].garmentTypeName).toBe('Camisa');
    expect(groups[1].garmentTypeName).toBe('Zapato');
  });
});

// ─── groupGlobalProductsByGarmentType ────────────────────────────────────────

describe('groupGlobalProductsByGarmentType', () => {
  it('returns empty array when no products', () => {
    const result = groupGlobalProductsByGarmentType([], [makeGlobalGarmentType()]);
    expect(result).toEqual([]);
  });

  it('returns empty array when garment type not found', () => {
    const product = makeGlobalProduct({ garment_type_id: 'unknown' });
    const result = groupGlobalProductsByGarmentType([product], [makeGlobalGarmentType()]);
    expect(result).toEqual([]);
  });

  it('creates group with correct stock from inventory_quantity', () => {
    const [group] = groupGlobalProductsByGarmentType(
      [makeGlobalProduct()],
      [makeGlobalGarmentType()]
    );
    expect(group.totalStock).toBe(5);
  });

  it('always sets hasCustomMeasurements to false', () => {
    const [group] = groupGlobalProductsByGarmentType(
      [makeGlobalProduct()],
      [makeGlobalGarmentType()]
    );
    expect(group.hasCustomMeasurements).toBe(false);
  });

  it('uses garment type images sorted by is_primary', () => {
    const gt = makeGlobalGarmentType({
      images: [
        { image_url: 'http://img.com/b.jpg', is_primary: false, display_order: 2 },
        { image_url: 'http://img.com/a.jpg', is_primary: true, display_order: 1 },
      ],
    });
    const [group] = groupGlobalProductsByGarmentType([makeGlobalProduct()], [gt]);
    expect(group.garmentTypeImageUrl).toBe('http://img.com/a.jpg');
  });

  it('falls back to product image when no garment type images', () => {
    const product = makeGlobalProduct({ image_url: 'http://prod.com/img.jpg' });
    const [group] = groupGlobalProductsByGarmentType([product], [makeGlobalGarmentType()]);
    expect(group.garmentTypeImageUrl).toBe('http://prod.com/img.jpg');
  });
});

// ─── findVariant ─────────────────────────────────────────────────────────────

describe('findVariant', () => {
  const group = makeGroup({
    variants: [
      makeVariant({ size: 'S', color: 'Azul' }),
      makeVariant({ size: 'M', color: null }),
      makeVariant({ size: 'M', color: 'Rojo' }),
    ],
  });

  it('finds variant by size only (color undefined)', () => {
    const v = findVariant(group, 'M');
    expect(v).toBeDefined();
    expect(v?.size).toBe('M');
  });

  it('finds variant by size and color', () => {
    const v = findVariant(group, 'M', 'Rojo');
    expect(v?.color).toBe('Rojo');
  });

  it('returns undefined when size not found', () => {
    expect(findVariant(group, 'XL')).toBeUndefined();
  });

  it('returns undefined when color does not match', () => {
    expect(findVariant(group, 'M', 'Verde')).toBeUndefined();
  });

  it('finds variant with null color when searching for null', () => {
    const v = findVariant(group, 'M', null);
    expect(v).toBeDefined();
    expect(v?.color).toBeNull();
  });
});

// ─── getVariantsForSize ───────────────────────────────────────────────────────

describe('getVariantsForSize', () => {
  const group = makeGroup({
    variants: [
      makeVariant({ productId: 'p1', size: 'M', color: 'Azul' }),
      makeVariant({ productId: 'p2', size: 'M', color: 'Rojo' }),
      makeVariant({ productId: 'p3', size: 'L', color: null }),
    ],
  });

  it('returns all variants for a given size', () => {
    const variants = getVariantsForSize(group, 'M');
    expect(variants).toHaveLength(2);
    expect(variants.every(v => v.size === 'M')).toBe(true);
  });

  it('returns empty array when no variants match', () => {
    expect(getVariantsForSize(group, 'XL')).toEqual([]);
  });
});

// ─── getColorsForSize ─────────────────────────────────────────────────────────

describe('getColorsForSize', () => {
  const group = makeGroup({
    variants: [
      makeVariant({ size: 'M', color: 'Azul' }),
      makeVariant({ size: 'M', color: 'Rojo' }),
      makeVariant({ size: 'M', color: null }),
      makeVariant({ size: 'L', color: 'Verde' }),
    ],
  });

  it('returns sorted unique colors for a given size', () => {
    const colors = getColorsForSize(group, 'M');
    expect(colors).toEqual(['Azul', 'Rojo']);
  });

  it('excludes null colors', () => {
    const colors = getColorsForSize(group, 'M');
    expect(colors.includes(null as unknown as string)).toBe(false);
  });

  it('returns empty array when no colors for size', () => {
    expect(getColorsForSize(group, 'XL')).toEqual([]);
  });
});

// ─── formatPriceRange ─────────────────────────────────────────────────────────

describe('formatPriceRange', () => {
  it('returns a single price when base equals max', () => {
    const result = formatPriceRange(10000, 10000);
    expect(result).toBe('$10,000');
  });

  it('returns a range when prices differ', () => {
    const result = formatPriceRange(10000, 15000);
    expect(result).toContain(' - ');
    expect(result).toContain('$10,000');
    expect(result).toContain('$15,000');
  });

  it('handles zero prices', () => {
    const result = formatPriceRange(0, 0);
    expect(result).toBe('$0');
  });
});
