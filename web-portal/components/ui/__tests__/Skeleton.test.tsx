/**
 * Tests for Skeleton loading components
 * Tests rendering and accessibility of skeleton placeholders
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Skeleton,
  ProductCardSkeleton,
  ProductGridSkeleton,
  CatalogHeaderSkeleton,
  SearchBarSkeleton,
  CategoryFiltersSkeleton,
  CatalogPageSkeleton,
  CartItemSkeleton,
  CartSkeleton,
  ProductDetailSkeleton,
} from '../Skeleton';

describe('Skeleton (base)', () => {
  it('renders with default shimmer animation', () => {
    render(<Skeleton />);
    const skeleton = document.querySelector('.animate-shimmer');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveClass('rounded');
  });

  it('renders with pulse animation when shimmer is false', () => {
    render(<Skeleton shimmer={false} />);
    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveClass('bg-gray-200', 'rounded');
  });

  it('accepts custom className', () => {
    render(<Skeleton className="h-10 w-full" />);
    const skeleton = document.querySelector('.animate-shimmer');
    expect(skeleton).toHaveClass('h-10', 'w-full');
  });

  it('accepts custom style', () => {
    render(<Skeleton style={{ width: '100px' }} />);
    const skeleton = document.querySelector('.animate-shimmer');
    expect(skeleton).toHaveStyle({ width: '100px' });
  });

  it('has aria-hidden for accessibility', () => {
    render(<Skeleton />);
    const skeleton = document.querySelector('.animate-shimmer');
    expect(skeleton).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('ProductCardSkeleton', () => {
  it('renders image placeholder', () => {
    render(<ProductCardSkeleton />);
    const imagePlaceholder = document.querySelector('.aspect-square');
    expect(imagePlaceholder).toBeInTheDocument();
  });

  it('renders size button placeholders', () => {
    render(<ProductCardSkeleton />);
    const sizeButtons = document.querySelectorAll('.h-7.w-10');
    expect(sizeButtons.length).toBe(5);
  });

  it('renders price and button placeholders', () => {
    render(<ProductCardSkeleton />);
    const priceButton = document.querySelector('.h-9.w-28');
    expect(priceButton).toBeInTheDocument();
  });
});

describe('ProductGridSkeleton', () => {
  it('renders default 8 cards', () => {
    render(<ProductGridSkeleton />);
    const cards = document.querySelectorAll('.aspect-square');
    expect(cards.length).toBe(8);
  });

  it('respects custom count', () => {
    render(<ProductGridSkeleton count={4} />);
    const cards = document.querySelectorAll('.aspect-square');
    expect(cards.length).toBe(4);
  });

  it('applies correct grid columns for 2 columns', () => {
    const { container } = render(<ProductGridSkeleton columns={2} />);
    const grid = container.firstChild;
    expect(grid).toHaveClass('sm:grid-cols-2');
    expect(grid).not.toHaveClass('lg:grid-cols-3');
  });

  it('applies correct grid columns for 3 columns', () => {
    const { container } = render(<ProductGridSkeleton columns={3} />);
    const grid = container.firstChild;
    expect(grid).toHaveClass('lg:grid-cols-3');
  });

  it('applies correct grid columns for 4 columns', () => {
    const { container } = render(<ProductGridSkeleton columns={4} />);
    const grid = container.firstChild;
    expect(grid).toHaveClass('xl:grid-cols-4');
  });
});

describe('CatalogHeaderSkeleton', () => {
  it('renders logo placeholder', () => {
    render(<CatalogHeaderSkeleton />);
    const logo = document.querySelector('.w-12.h-12.rounded-full');
    expect(logo).toBeInTheDocument();
  });

  it('renders school name placeholders', () => {
    render(<CatalogHeaderSkeleton />);
    const namePlaceholders = document.querySelectorAll('.h-5, .h-3');
    expect(namePlaceholders.length).toBeGreaterThan(0);
  });

  it('renders cart button placeholder', () => {
    render(<CatalogHeaderSkeleton />);
    const cartButton = document.querySelector('.h-10.w-10.rounded-full');
    expect(cartButton).toBeInTheDocument();
  });

  it('is sticky positioned', () => {
    const { container } = render(<CatalogHeaderSkeleton />);
    const header = container.firstChild;
    expect(header).toHaveClass('sticky', 'top-0');
  });
});

describe('SearchBarSkeleton', () => {
  it('renders search input placeholder', () => {
    render(<SearchBarSkeleton />);
    const searchInput = document.querySelector('.h-12.flex-1');
    expect(searchInput).toBeInTheDocument();
  });

  it('renders filter button placeholder', () => {
    render(<SearchBarSkeleton />);
    const filterButton = document.querySelector('.h-12.w-12');
    expect(filterButton).toBeInTheDocument();
  });
});

describe('CategoryFiltersSkeleton', () => {
  it('renders 6 category placeholders', () => {
    render(<CategoryFiltersSkeleton />);
    const categories = document.querySelectorAll('.h-9.rounded-full');
    expect(categories.length).toBe(6);
  });

  it('has varying widths for visual variety', () => {
    render(<CategoryFiltersSkeleton />);
    const categories = document.querySelectorAll('.h-9.rounded-full');
    categories.forEach((cat) => {
      // Each category chip has an inline style with a random width
      const style = cat.getAttribute('style');
      expect(style).toMatch(/width:/);
    });
  });
});

describe('CatalogPageSkeleton', () => {
  it('renders all catalog sections', () => {
    render(<CatalogPageSkeleton />);

    // Header section
    expect(document.querySelector('.w-12.h-12.rounded-full')).toBeInTheDocument();

    // Search section
    expect(document.querySelector('.h-12.flex-1')).toBeInTheDocument();

    // Category section
    expect(document.querySelectorAll('.h-9.rounded-full').length).toBe(6);

    // Product grid
    expect(document.querySelectorAll('.aspect-square').length).toBe(8);
  });

  it('has minimum height for full page', () => {
    const { container } = render(<CatalogPageSkeleton />);
    expect(container.firstChild).toHaveClass('min-h-screen');
  });
});

describe('CartItemSkeleton', () => {
  it('renders image placeholder', () => {
    render(<CartItemSkeleton />);
    const image = document.querySelector('.w-20.h-20');
    expect(image).toBeInTheDocument();
  });

  it('renders product info placeholders', () => {
    render(<CartItemSkeleton />);
    const container = document.querySelector('.flex-1.space-y-2');
    expect(container).toBeInTheDocument();
  });

  it('renders quantity controls placeholder', () => {
    render(<CartItemSkeleton />);
    const controls = document.querySelector('.h-8.w-24');
    expect(controls).toBeInTheDocument();
  });
});

describe('CartSkeleton', () => {
  it('renders default 3 cart items', () => {
    render(<CartSkeleton />);
    const items = document.querySelectorAll('.w-20.h-20');
    expect(items.length).toBe(3);
  });

  it('respects custom items count', () => {
    render(<CartSkeleton items={5} />);
    const items = document.querySelectorAll('.w-20.h-20');
    expect(items.length).toBe(5);
  });

  it('renders summary section', () => {
    render(<CartSkeleton />);
    // Checkout button placeholder
    const checkoutButton = document.querySelector('.h-12.w-full');
    expect(checkoutButton).toBeInTheDocument();
  });
});

describe('ProductDetailSkeleton', () => {
  it('renders image gallery placeholder', () => {
    render(<ProductDetailSkeleton />);
    const gallery = document.querySelector('.aspect-square.rounded-xl');
    expect(gallery).toBeInTheDocument();
  });

  it('renders size selector placeholders', () => {
    render(<ProductDetailSkeleton />);
    const sizes = document.querySelectorAll('.h-10.w-12');
    expect(sizes.length).toBe(6);
  });

  it('renders add to cart button placeholder', () => {
    render(<ProductDetailSkeleton />);
    const addButton = document.querySelector('.h-12.w-40');
    expect(addButton).toBeInTheDocument();
  });
});
