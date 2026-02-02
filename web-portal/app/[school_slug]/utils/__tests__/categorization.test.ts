/**
 * Tests for categorization utilities
 * Tests product categorization, filtering, and extraction functions
 */
import { describe, it, expect } from 'vitest';
import {
  CATEGORY_PATTERNS,
  getCategoryForProduct,
  productMatchesCategory,
  extractCategories,
  extractSizes,
} from '../categorization';

describe('CATEGORY_PATTERNS', () => {
  it('contains expected categories', () => {
    expect(CATEGORY_PATTERNS).toHaveProperty('Camisas');
    expect(CATEGORY_PATTERNS).toHaveProperty('Chompas');
    expect(CATEGORY_PATTERNS).toHaveProperty('Pantalones');
    expect(CATEGORY_PATTERNS).toHaveProperty('Sudaderas');
    expect(CATEGORY_PATTERNS).toHaveProperty('Yomber');
    expect(CATEGORY_PATTERNS).toHaveProperty('Calzado');
  });

  it('Camisas includes expected patterns', () => {
    expect(CATEGORY_PATTERNS.Camisas).toContain('camisa');
    expect(CATEGORY_PATTERNS.Camisas).toContain('blusa');
    expect(CATEGORY_PATTERNS.Camisas).toContain('camiseta');
  });

  it('Pantalones includes pants and skirts', () => {
    expect(CATEGORY_PATTERNS.Pantalones).toContain('pantalon');
    expect(CATEGORY_PATTERNS.Pantalones).toContain('falda');
  });
});

describe('getCategoryForProduct', () => {
  it('categorizes camisa products', () => {
    expect(getCategoryForProduct('Camisa blanca manga larga')).toBe('Camisas');
    expect(getCategoryForProduct('Blusa azul')).toBe('Camisas');
    expect(getCategoryForProduct('Camiseta deportiva')).toBe('Camisas');
  });

  it('categorizes pantalones', () => {
    // Note: uses "pantalon" without accent since includes() doesn't normalize accents
    expect(getCategoryForProduct('Pantalon azul oscuro')).toBe('Pantalones');
    expect(getCategoryForProduct('Falda plisada')).toBe('Pantalones');
  });

  it('categorizes sudaderas', () => {
    expect(getCategoryForProduct('Sudadera con capucha')).toBe('Sudaderas');
    expect(getCategoryForProduct('Buzo deportivo')).toBe('Sudaderas');
    expect(getCategoryForProduct('Chaqueta impermeable')).toBe('Sudaderas');
  });

  it('categorizes chompas', () => {
    expect(getCategoryForProduct('Chompa de lana')).toBe('Chompas');
  });

  it('categorizes yomber', () => {
    expect(getCategoryForProduct('Yomber personalizado')).toBe('Yomber');
  });

  it('categorizes calzado', () => {
    expect(getCategoryForProduct('Zapatos negros')).toBe('Calzado');
    expect(getCategoryForProduct('Tennis deportivos')).toBe('Calzado');
    expect(getCategoryForProduct('Medias blancas')).toBe('Calzado');
    expect(getCategoryForProduct('Jean clásico')).toBe('Calzado');
  });

  it('returns null for uncategorized products', () => {
    expect(getCategoryForProduct('Mochila escolar')).toBeNull();
    expect(getCategoryForProduct('Corbata')).toBeNull();
    expect(getCategoryForProduct('Cinturón')).toBeNull();
  });

  it('is case insensitive', () => {
    expect(getCategoryForProduct('CAMISA BLANCA')).toBe('Camisas');
    expect(getCategoryForProduct('PaNtAlOn AzUl')).toBe('Pantalones');
  });

  it('handles empty string', () => {
    expect(getCategoryForProduct('')).toBeNull();
  });
});

describe('productMatchesCategory', () => {
  describe('filter: all', () => {
    it('matches all school products', () => {
      expect(productMatchesCategory('Camisa blanca', 'all', false)).toBe(true);
      expect(productMatchesCategory('Random product', 'all', false)).toBe(true);
    });

    it('matches all global products', () => {
      expect(productMatchesCategory('Any product', 'all', true)).toBe(true);
    });
  });

  describe('filter: Otros', () => {
    it('matches only global products', () => {
      expect(productMatchesCategory('Any product', 'Otros', true)).toBe(true);
      expect(productMatchesCategory('Any product', 'otros', true)).toBe(true);
    });

    it('does not match school products', () => {
      expect(productMatchesCategory('Camisa blanca', 'Otros', false)).toBe(false);
    });
  });

  describe('specific categories', () => {
    it('matches Camisas correctly', () => {
      expect(productMatchesCategory('Camisa blanca', 'Camisas', false)).toBe(true);
      expect(productMatchesCategory('Blusa azul', 'Camisas', false)).toBe(true);
    });

    it('does not match wrong category', () => {
      expect(productMatchesCategory('Pantalon negro', 'Camisas', false)).toBe(false);
    });

    it('excludes global products from specific categories', () => {
      expect(productMatchesCategory('Camisa blanca', 'Camisas', true)).toBe(false);
    });

    it('returns false for unknown category', () => {
      expect(productMatchesCategory('Camisa blanca', 'Unknown', false)).toBe(false);
    });
  });
});

describe('extractCategories', () => {
  it('extracts categories from school products', () => {
    const schoolProducts = [
      { name: 'Camisa blanca' },
      { name: 'Pantalon negro' }, // Note: without accent
      { name: 'Sudadera azul' },
    ];
    const result = extractCategories(schoolProducts, []);

    expect(result).toContain('all');
    expect(result).toContain('Camisas');
    expect(result).toContain('Pantalones');
    expect(result).toContain('Sudaderas');
  });

  it('always includes "all" first', () => {
    const result = extractCategories([{ name: 'Camisa' }], []);
    expect(result[0]).toBe('all');
  });

  it('adds "Otros" when global products exist', () => {
    const schoolProducts = [{ name: 'Camisa blanca' }];
    const globalProducts = [{ name: 'Producto global' }];
    const result = extractCategories(schoolProducts, globalProducts);

    expect(result).toContain('Otros');
  });

  it('does not add "Otros" when no global products', () => {
    const result = extractCategories([{ name: 'Camisa' }], []);
    expect(result).not.toContain('Otros');
  });

  it('returns only "all" for empty products', () => {
    const result = extractCategories([], []);
    expect(result).toEqual(['all']);
  });

  it('sorts categories alphabetically', () => {
    const schoolProducts = [
      { name: 'Sudadera' },
      { name: 'Camisa' },
      { name: 'Pantalon' },
    ];
    const result = extractCategories(schoolProducts, []);

    // After 'all', should be sorted
    const categories = result.slice(1);
    const sorted = [...categories].sort();
    expect(categories).toEqual(sorted);
  });

  it('does not duplicate categories', () => {
    const schoolProducts = [
      { name: 'Camisa blanca' },
      { name: 'Camisa azul' },
      { name: 'Blusa verde' },
    ];
    const result = extractCategories(schoolProducts, []);

    const camisasCount = result.filter((c) => c === 'Camisas').length;
    expect(camisasCount).toBe(1);
  });
});

describe('extractSizes', () => {
  it('extracts unique sizes', () => {
    const products = [
      { size: 'S' },
      { size: 'M' },
      { size: 'L' },
      { size: 'M' }, // duplicate
    ];
    const result = extractSizes(products);

    expect(result).toHaveLength(3);
    expect(result).toContain('S');
    expect(result).toContain('M');
    expect(result).toContain('L');
  });

  it('excludes "Única" size', () => {
    const products = [
      { size: 'S' },
      { size: 'Única' },
      { size: 'M' },
    ];
    const result = extractSizes(products);

    expect(result).not.toContain('Única');
    expect(result).toHaveLength(2);
  });

  it('sorts numeric sizes first', () => {
    const products = [
      { size: 'XL' },
      { size: '10' },
      { size: '8' },
      { size: 'S' },
      { size: '12' },
    ];
    const result = extractSizes(products);

    // Numeric sizes should come first, in order
    expect(result[0]).toBe('8');
    expect(result[1]).toBe('10');
    expect(result[2]).toBe('12');
  });

  it('sorts letter sizes alphabetically', () => {
    const products = [
      { size: 'XL' },
      { size: 'S' },
      { size: 'L' },
      { size: 'M' },
    ];
    const result = extractSizes(products);

    expect(result).toEqual(['L', 'M', 'S', 'XL']);
  });

  it('handles products without size', () => {
    const products = [
      { size: 'S' },
      { size: undefined },
      { size: 'M' },
      {},
    ];
    const result = extractSizes(products as { size?: string }[]);

    expect(result).toHaveLength(2);
    expect(result).toContain('S');
    expect(result).toContain('M');
  });

  it('returns empty array for no products', () => {
    expect(extractSizes([])).toEqual([]);
  });

  it('returns empty array when all products have "Única"', () => {
    const products = [{ size: 'Única' }, { size: 'Única' }];
    expect(extractSizes(products)).toEqual([]);
  });
});
