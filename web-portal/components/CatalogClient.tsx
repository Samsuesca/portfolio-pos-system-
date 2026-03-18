'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, ArrowLeft, Filter, Phone, MessageCircle, Package, X, Search, SlidersHorizontal, Globe, Clock, ChevronUp, ChevronDown, FileText } from 'lucide-react';
import { productsApi, type Product, type School } from '@/lib/api';
import { useCartStore } from '@/lib/store';
import { formatNumber } from '@/lib/utils';
import { groupProductsByGarmentType, type ProductGroup } from '@/lib/types';
import ProductGroupCard from '@/components/ProductGroupCard';
import ProductDetailModal from '@/components/ProductDetailModal';
import PriceListModal from '@/components/PriceListModal';
import QuotationBanner from '@/components/QuotationBanner';
import FloatingCartSummary from '@/components/FloatingCartSummary';
import { useSearchHistory } from '@/app/[school_slug]/hooks/useSearchHistory';
import {
    extractCategories,
    extractSizes,
    productMatchesCategory,
} from '@/app/[school_slug]/utils/categorization';

interface CatalogClientProps {
    school: School;
    schoolSlug: string;
    initialProducts: Product[];
    initialGlobalProducts: Product[];
}

export default function CatalogClient({
    school,
    schoolSlug,
    initialProducts,
    initialGlobalProducts,
}: CatalogClientProps) {
    const router = useRouter();

    const [products, setProducts] = useState<Product[]>(initialProducts);
    const [globalProducts, setGlobalProducts] = useState<Product[]>(initialGlobalProducts);
    const [productGroups, setProductGroups] = useState<ProductGroup[]>(() =>
        [
            ...groupProductsByGarmentType(initialProducts, school, false),
            ...groupProductsByGarmentType(initialGlobalProducts, school, true),
        ]
    );
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('all');
    const [sizeFilter, setSizeFilter] = useState('all');
    const [error, setError] = useState<string | null>(null);
    const [categories, setCategories] = useState<string[]>(() =>
        extractCategories(initialProducts, initialGlobalProducts)
    );
    const [sizes, setSizes] = useState<string[]>(() =>
        extractSizes([...initialProducts, ...initialGlobalProducts])
    );
    const [mounted, setMounted] = useState(false);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [globalSearch, setGlobalSearch] = useState(false);
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000]);
    const [showInStock, setShowInStock] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    // Search history from localStorage (uses extracted hook)
    const { history: searchHistory, addToHistory } = useSearchHistory(schoolSlug);
    const [priceStats, setPriceStats] = useState<{ min_price: number; max_price: number } | null>(null);
    const [showSizeDropdown, setShowSizeDropdown] = useState(false);
    const [searchFocused, setSearchFocused] = useState(false);

    // Calculate if there are active filters
    const hasActiveFilters = filter !== 'all' || sizeFilter !== 'all' || showInStock || globalSearch ||
        (priceStats && (priceRange[0] !== priceStats.min_price || priceRange[1] !== priceStats.max_price));

    const { addItem, getTotalItems } = useCartStore();

    // Modal state for yomber/custom products info
    const [showYomberModal, setShowYomberModal] = useState(false);
    const [selectedYomberProduct, setSelectedYomberProduct] = useState<Product | null>(null);

    // Product detail modal state
    const [showProductModal, setShowProductModal] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<ProductGroup | null>(null);
    const [selectedInitialSize, setSelectedInitialSize] = useState<string | undefined>(undefined);

    // Price list modal state
    const [showPriceListModal, setShowPriceListModal] = useState(false);

    // Prevent hydration mismatch by only showing cart count after mount
    useEffect(() => {
        setMounted(true);
    }, []);

    // Check if product is a yomber (requires custom measurements - presencial)
    const isYomberProduct = (product: Product): boolean => {
        const name = product.name.toLowerCase();
        return name.includes('yomber');
    };

    // Handle yomber product click - show info modal
    const handleYomberClick = (product: Product) => {
        setSelectedYomberProduct(product);
        setShowYomberModal(true);
    };

    // Handle group click - open detail modal with the group
    const handleGroupClick = (group: ProductGroup, initialSize?: string) => {
        setSelectedGroup(group);
        setSelectedInitialSize(initialSize);
        setShowProductModal(true);
    };

    // Compute price stats from initial products (avoid duplicate API fetch)
    useEffect(() => {
        const allProducts = [...initialProducts, ...initialGlobalProducts];
        if (allProducts.length > 0) {
            const prices = allProducts.map(p => p.price);
            const stats = {
                min_price: Math.min(...prices),
                max_price: Math.max(...prices),
            };
            setPriceStats(stats);
            setPriceRange([stats.min_price, stats.max_price]);
        }
    }, [initialProducts, initialGlobalProducts]);

    // Debounced search effect - ONLY when searchQuery changes
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchQuery.trim().length > 0) {
                setIsSearching(true);
                try {
                    const results = await productsApi.search(school.id, {
                        query: searchQuery,
                        category: filter !== 'all' ? filter : undefined,
                        size: sizeFilter !== 'all' ? sizeFilter : undefined,
                        min_price: priceRange[0],
                        max_price: priceRange[1],
                        in_stock: showInStock || undefined,
                        global_search: globalSearch
                    });

                    // Update products with search results
                    setProducts(results);
                    setGlobalProducts([]); // Clear global products when searching

                    // Update product groups
                    const searchGroups = groupProductsByGarmentType(results, school, false);
                    setProductGroups(searchGroups);

                    // Save to search history (using extracted hook)
                    addToHistory(searchQuery);
                } catch (error) {
                    console.error('Search error:', error);
                } finally {
                    setIsSearching(false);
                }
            } else if (searchQuery.length === 0 && products !== initialProducts) {
                // Search was cleared - restore initial products
                setProducts(initialProducts);
                setGlobalProducts(initialGlobalProducts);
                const schoolGroups = groupProductsByGarmentType(initialProducts, school, false);
                const globalGroups = groupProductsByGarmentType(initialGlobalProducts, school, true);
                setProductGroups([...schoolGroups, ...globalGroups]);
                setCategories(extractCategories(initialProducts, initialGlobalProducts));
                setSizes(extractSizes([...initialProducts, ...initialGlobalProducts]));
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery, globalSearch]);

    const loadAllProducts = async () => {
        try {
            setLoading(true);
            setError(null);

            // Load both school products and global products in parallel
            const [schoolProductsResponse, globalProductsResponse] = await Promise.allSettled([
                productsApi.list(school.id),
                productsApi.listGlobal({ with_inventory: true, limit: 500 })
            ]);

            // Extract school products
            const schoolProductsData = schoolProductsResponse.status === 'fulfilled'
                ? schoolProductsResponse.value.data
                : [];

            // Extract global products (optional, don't fail if error)
            const globalProductsData = globalProductsResponse.status === 'fulfilled'
                ? globalProductsResponse.value.data
                : [];

            if (globalProductsResponse.status === 'rejected') {
                console.error('Error loading global products:', globalProductsResponse.reason);
            }

            // Update state
            setProducts(schoolProductsData);
            setGlobalProducts(globalProductsData);

            // Create product groups
            const schoolGroups = groupProductsByGarmentType(schoolProductsData, school, false);
            const globalGroups = groupProductsByGarmentType(globalProductsData, school, true);
            setProductGroups([...schoolGroups, ...globalGroups]);

            // Update categories and sizes with BOTH loaded
            setCategories(extractCategories(schoolProductsData, globalProductsData));
            setSizes(extractSizes([...schoolProductsData, ...globalProductsData]));

        } catch (error: any) {
            console.error('Error loading products:', error);
            setError(error.response?.data?.detail || 'Error al cargar los productos. Por favor, intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    const loadProducts = async () => {
        // Reload just in case (for retry button)
        await loadAllProducts();
    };

    // Combine school products and global products
    const allProducts = [...products, ...globalProducts];

    const filteredProducts = allProducts.filter(p => {
        // Check if product is global (exists in globalProducts array)
        const isGlobalProduct = globalProducts.some(gp => gp.id === p.id);

        // Filter by search query (client-side text filtering when searching)
        let searchMatch = true;
        if (searchQuery.trim().length > 0) {
            const query = searchQuery.toLowerCase();
            const name = p.name.toLowerCase();
            const description = (p.description || '').toLowerCase();
            searchMatch = name.includes(query) || description.includes(query) || (p.code || '').toLowerCase().includes(query);
        }

        // Filter by category using centralized utility
        const categoryMatch = productMatchesCategory(p.name, filter, isGlobalProduct);

        // Filter by size
        const sizeMatch = sizeFilter === 'all' || p.size === sizeFilter;

        // Filter by price range (only if priceStats loaded and range changed from default)
        let priceMatch = true;
        if (priceStats && (priceRange[0] !== priceStats.min_price || priceRange[1] !== priceStats.max_price)) {
            priceMatch = p.price >= priceRange[0] && p.price <= priceRange[1];
        }

        // Filter by stock (only if checkbox is checked)
        let stockMatch = true;
        if (showInStock) {
            const stock = p.stock ?? p.stock_quantity ?? p.inventory_quantity ?? 0;
            stockMatch = stock > 0;
        }

        return searchMatch && categoryMatch && sizeMatch && priceMatch && stockMatch;
    });

    // Filter product groups (similar logic but for groups)
    const filteredGroups = productGroups.filter(group => {
        // Filter by search query
        let searchMatch = true;
        if (searchQuery.trim().length > 0) {
            const query = searchQuery.toLowerCase();
            searchMatch = group.name.toLowerCase().includes(query);
        }

        // Filter by category using centralized utility
        const categoryMatch = productMatchesCategory(group.name, filter, group.isGlobal);

        // Filter by size - check if any variant matches the size filter
        const sizeMatch = sizeFilter === 'all' || group.variants.some(v => v.size === sizeFilter);

        // Filter by price range
        let priceMatch = true;
        if (priceStats && (priceRange[0] !== priceStats.min_price || priceRange[1] !== priceStats.max_price)) {
            priceMatch = group.basePrice <= priceRange[1] && group.maxPrice >= priceRange[0];
        }

        // Filter by stock - check if any variant has stock
        let stockMatch = true;
        if (showInStock) {
            stockMatch = group.variants.some(v => v.stock > 0);
        }

        return searchMatch && categoryMatch && sizeMatch && priceMatch && stockMatch;
    });

    const handleAddToCart = (product: Product, isOrder: boolean = false) => {
        const isGlobal = globalProducts.some(gp => gp.id === product.id);
        addItem(product, school, isOrder, isGlobal);
    };

    // Handle add to cart by product ID (used by ProductGroupCard)
    const handleAddToCartById = (productId: string, isOrder: boolean = false) => {
        const allProds = [...products, ...globalProducts];
        const product = allProds.find(p => p.id === productId);
        if (product) {
            const isGlobal = globalProducts.some(gp => gp.id === productId);
            addItem(product, school, isOrder, isGlobal);
        }
    };


    return (
        <div className="min-h-screen bg-surface-50 pb-20 lg:pb-0">
            {/* Quotation Banner */}
            <QuotationBanner />

            {/* Header */}
            <header className="bg-white border-b border-surface-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => router.push('/')}
                            className="flex items-center text-slate-600 hover:text-primary transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 mr-2" />
                            Volver
                        </button>
                        <div className="text-center">
                            <h1 className="text-2xl font-bold text-primary font-display">
                                {school.name}
                            </h1>
                            <p className="text-sm text-slate-500">
                                Catalogo de Uniformes
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Price List Button */}
                            <button
                                onClick={() => setShowPriceListModal(true)}
                                className="flex items-center gap-2 px-3 py-2 border-2 border-brand-600 text-brand-600 rounded-xl hover:bg-brand-50 transition-colors"
                                title="Ver Lista de Precios"
                            >
                                <FileText className="w-5 h-5" />
                                <span className="hidden sm:inline text-sm font-medium">Precios</span>
                            </button>

                            {/* Cart Button */}
                            <button
                                onClick={() => router.push(`/${schoolSlug}/cart`)}
                                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors relative"
                            >
                                <ShoppingCart className="w-5 h-5" />
                                {mounted && getTotalItems() > 0 && (
                                    <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                                        {getTotalItems()}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Compact Search Bar Section */}
            <div className="bg-white border-b border-surface-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                    <div className="flex gap-2">
                        {/* Search Input - Compact */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => setSearchFocused(true)}
                                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                                placeholder="Buscar productos..."
                                className="w-full pl-9 pr-9 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                            />
                            {isSearching && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <div className="animate-spin w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full" />
                                </div>
                            )}
                            {searchQuery && !isSearching && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}

                            {/* Search History Dropdown */}
                            {searchFocused && !searchQuery && searchHistory.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border z-30">
                                    <div className="px-3 py-2 text-xs text-gray-500 border-b">Busquedas recientes</div>
                                    {searchHistory.slice(0, 5).map((query, idx) => (
                                        <button
                                            key={idx}
                                            onMouseDown={() => setSearchQuery(query)}
                                            className="w-full px-3 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2"
                                        >
                                            <Clock className="w-3 h-3 text-gray-400" />
                                            {query}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Filters Button */}
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors relative"
                        >
                            <SlidersHorizontal className="w-4 h-4 text-gray-600" />
                            {hasActiveFilters && (
                                <span className="absolute -top-1 -right-1 w-3 h-3 bg-brand-600 rounded-full" />
                            )}
                        </button>
                    </div>

                    {/* Search Results Count */}
                    {searchQuery && (
                        <div className="mt-2 text-xs text-gray-500">
                            {filteredGroups.length} resultado{filteredGroups.length !== 1 ? 's' : ''}
                        </div>
                    )}
                </div>
            </div>

            {/* Compact Category + Size Filters - Single Row */}
            <div className="bg-white border-b border-surface-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
                    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                        {/* Category Chips */}
                        {categories.map((category) => (
                            <button
                                key={category}
                                onClick={() => setFilter(category)}
                                className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-all ${
                                    filter === category
                                        ? 'bg-brand-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {category === 'all' ? 'Todos' : category}
                            </button>
                        ))}

                        {/* Separator */}
                        {sizes.length > 0 && (
                            <div className="w-px h-5 bg-gray-300 flex-shrink-0 mx-1" />
                        )}

                        {/* Size Dropdown */}
                        {sizes.length > 0 && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowSizeDropdown(!showSizeDropdown)}
                                    className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap flex items-center gap-1 transition-all ${
                                        sizeFilter !== 'all'
                                            ? 'bg-brand-600 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {sizeFilter === 'all' ? 'Talla' : `T. ${sizeFilter}`}
                                    <ChevronDown className="w-3 h-3" />
                                </button>

                                {showSizeDropdown && (
                                    <div className="absolute top-full mt-1 left-0 bg-white rounded-lg shadow-lg border py-1 z-30 min-w-[120px] max-h-48 overflow-y-auto">
                                        <button
                                            onClick={() => { setSizeFilter('all'); setShowSizeDropdown(false); }}
                                            className={`w-full px-3 py-1.5 text-xs text-left hover:bg-gray-100 ${
                                                sizeFilter === 'all' ? 'bg-brand-50 text-brand-600' : ''
                                            }`}
                                        >
                                            Todas las tallas
                                        </button>
                                        {sizes.map((size) => (
                                            <button
                                                key={size}
                                                onClick={() => { setSizeFilter(size); setShowSizeDropdown(false); }}
                                                className={`w-full px-3 py-1.5 text-xs text-left hover:bg-gray-100 ${
                                                    sizeFilter === size ? 'bg-brand-50 text-brand-600' : ''
                                                }`}
                                            >
                                                {/^\d+$/.test(size) ? `Talla ${size}` : size}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Advanced Filters - Mobile Drawer / Desktop Panel */}
            {showFilters && (
                <>
                    {/* Mobile Overlay */}
                    <div
                        className="fixed inset-0 bg-black/40 z-40 md:hidden"
                        onClick={() => setShowFilters(false)}
                    />

                    {/* Mobile Drawer */}
                    <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 md:hidden">
                        <div className="p-4 max-h-[60vh] overflow-y-auto">
                            {/* Drawer Handle */}
                            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4" />

                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-semibold text-gray-900">Filtros</h3>
                                <button onClick={() => setShowFilters(false)}>
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>

                            {/* Price Range */}
                            {priceStats && (
                                <div className="mb-4">
                                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                                        Precio: ${priceRange[0].toLocaleString()} - ${priceRange[1].toLocaleString()}
                                    </label>
                                    <div className="space-y-3">
                                        <div>
                                            <span className="text-xs text-gray-500">Minimo</span>
                                            <input
                                                type="range"
                                                min={priceStats.min_price}
                                                max={priceStats.max_price}
                                                value={priceRange[0]}
                                                onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                                                className="w-full"
                                            />
                                        </div>
                                        <div>
                                            <span className="text-xs text-gray-500">Maximo</span>
                                            <input
                                                type="range"
                                                min={priceStats.min_price}
                                                max={priceStats.max_price}
                                                value={priceRange[1]}
                                                onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                                                className="w-full"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Stock Filter */}
                            <label className="flex items-center gap-2 mb-4 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showInStock}
                                    onChange={(e) => setShowInStock(e.target.checked)}
                                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                                />
                                <Package className="w-4 h-4 text-gray-600" />
                                <span className="text-sm">Solo productos en stock</span>
                            </label>

                            {/* Global Search */}
                            <label className="flex items-center gap-2 mb-4 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={globalSearch}
                                    onChange={(e) => setGlobalSearch(e.target.checked)}
                                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                                />
                                <Globe className="w-4 h-4 text-gray-600" />
                                <span className="text-sm">Buscar en todos los colegios</span>
                            </label>

                            {/* Action Buttons */}
                            <div className="flex gap-2 pt-3 border-t">
                                <button
                                    onClick={() => {
                                        if (priceStats) {
                                            setPriceRange([priceStats.min_price, priceStats.max_price]);
                                        }
                                        setShowInStock(false);
                                        setSearchQuery('');
                                        setFilter('all');
                                        setSizeFilter('all');
                                        setGlobalSearch(false);
                                    }}
                                    className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                                >
                                    Limpiar
                                </button>
                                <button
                                    onClick={() => setShowFilters(false)}
                                    className="flex-1 py-2.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700"
                                >
                                    Aplicar
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Desktop Panel */}
                    {priceStats && (
                        <div className="hidden md:block bg-white border-b border-surface-200">
                            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                                <div className="flex items-center gap-6 flex-wrap">
                                    {/* Price Range */}
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-medium text-gray-700">Precio:</span>
                                        <span className="text-sm text-gray-600">
                                            ${priceRange[0].toLocaleString()} - ${priceRange[1].toLocaleString()}
                                        </span>
                                        <input
                                            type="range"
                                            min={priceStats.min_price}
                                            max={priceStats.max_price}
                                            value={priceRange[0]}
                                            onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                                            className="w-24"
                                        />
                                        <input
                                            type="range"
                                            min={priceStats.min_price}
                                            max={priceStats.max_price}
                                            value={priceRange[1]}
                                            onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                                            className="w-24"
                                        />
                                    </div>

                                    {/* Stock Filter */}
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showInStock}
                                            onChange={(e) => setShowInStock(e.target.checked)}
                                            className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                                        />
                                        <span className="text-sm text-gray-700">Solo en stock</span>
                                    </label>

                                    {/* Global Search */}
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={globalSearch}
                                            onChange={(e) => setGlobalSearch(e.target.checked)}
                                            className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                                        />
                                        <Globe className="w-4 h-4 text-gray-600" />
                                        <span className="text-sm text-gray-700">Todos los colegios</span>
                                    </label>

                                    {/* Clear Button */}
                                    {hasActiveFilters && (
                                        <button
                                            onClick={() => {
                                                if (priceStats) {
                                                    setPriceRange([priceStats.min_price, priceStats.max_price]);
                                                }
                                                setShowInStock(false);
                                                setSearchQuery('');
                                                setFilter('all');
                                                setSizeFilter('all');
                                                setGlobalSearch(false);
                                            }}
                                            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                                        >
                                            Limpiar filtros
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Products Grid */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {error ? (
                    <div className="text-center py-12 bg-red-50 rounded-xl border border-red-200">
                        <p className="text-red-600 font-semibold mb-2">Error al cargar el catalogo</p>
                        <p className="text-sm text-red-500">{error}</p>
                        <button
                            onClick={loadProducts}
                            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                            Reintentar
                        </button>
                    </div>
                ) : loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-brand-200 border-t-brand-600"></div>
                        <p className="mt-4 text-slate-600">Cargando productos...</p>
                    </div>
                ) : filteredGroups.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl border border-surface-200">
                        {searchQuery ? (
                            <>
                                <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                                    No se encontraron productos
                                </h3>
                                <p className="text-gray-500 mb-4">
                                    No hay resultados para &quot;{searchQuery}&quot;
                                    {globalSearch && ' en ningun colegio'}
                                </p>
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setGlobalSearch(false);
                                    }}
                                    className="text-brand-600 hover:text-brand-700 font-medium"
                                >
                                    Limpiar busqueda
                                </button>
                            </>
                        ) : (
                            <>
                                <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                                    No hay productos disponibles
                                </h3>
                                <p className="text-gray-500">
                                    {filter !== 'all' || sizeFilter !== 'all'
                                        ? 'Intenta cambiar los filtros para ver mas productos'
                                        : 'No hay productos en el catalogo actualmente'}
                                </p>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredGroups.map((group) => (
                            <ProductGroupCard
                                key={group.garmentTypeId}
                                group={group}
                                onAddToCart={handleAddToCartById}
                                onOpenDetail={(size) => handleGroupClick(group, size)}
                            />
                        ))}
                    </div>
                )}
            </main>

            {/* Product Detail Modal */}
            {selectedGroup && (
                <ProductDetailModal
                    group={selectedGroup}
                    isOpen={showProductModal}
                    onClose={() => {
                        setShowProductModal(false);
                        setSelectedGroup(null);
                        setSelectedInitialSize(undefined);
                    }}
                    onAddToCart={handleAddToCartById}
                    initialSize={selectedInitialSize}
                />
            )}

            {/* Yomber Info Modal */}
            {showYomberModal && selectedYomberProduct && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div
                        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
                        onClick={() => setShowYomberModal(false)}
                    />
                    <div className="flex min-h-screen items-center justify-center p-4">
                        <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
                            {/* Close button */}
                            <button
                                onClick={() => setShowYomberModal(false)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-6 h-6" />
                            </button>

                            {/* Header */}
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="text-3xl">&#x2702;&#xFE0F;</span>
                                </div>
                                <h3 className="text-xl font-bold text-primary font-display">
                                    {selectedYomberProduct.name}
                                </h3>
                                <p className="text-2xl font-bold text-purple-600 mt-2">
                                    Desde ${formatNumber(selectedYomberProduct.price)}
                                </p>
                            </div>

                            {/* Info */}
                            <div className="bg-purple-50 rounded-xl p-4 mb-6">
                                <h4 className="font-semibold text-purple-900 mb-2">
                                    Confeccion Personalizada
                                </h4>
                                <p className="text-sm text-purple-700 mb-3">
                                    Los yombers se confeccionan a medida para garantizar el mejor ajuste.
                                    Para este producto necesitamos tomar las siguientes medidas:
                                </p>
                                <ul className="text-sm text-purple-700 space-y-1 ml-4">
                                    <li>- Talle delantero</li>
                                    <li>- Talle trasero</li>
                                    <li>- Cintura</li>
                                    <li>- Largo</li>
                                </ul>
                            </div>

                            {/* Contact options */}
                            <div className="space-y-3">
                                <p className="text-sm text-slate-600 text-center mb-4">
                                    Contactanos para agendar tu cita de medidas:
                                </p>

                                <a
                                    href="https://wa.me/573001234567?text=Hola, estoy interesado en un yomber personalizado"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors font-semibold"
                                >
                                    <MessageCircle className="w-5 h-5" />
                                    WhatsApp
                                </a>

                                <a
                                    href="tel:+573001234567"
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors font-semibold"
                                >
                                    <Phone className="w-5 h-5" />
                                    Llamar
                                </a>

                                <button
                                    onClick={() => router.push('/soporte')}
                                    className="w-full py-3 text-slate-600 hover:text-slate-800 transition-colors text-sm"
                                >
                                    Ver mas opciones de contacto
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Price List Modal */}
            <PriceListModal
                isOpen={showPriceListModal}
                onClose={() => setShowPriceListModal(false)}
                school={school}
                products={products}
                globalProducts={globalProducts}
            />

            {/* Floating Cart Summary (mobile only) */}
            <FloatingCartSummary />
        </div>
    );
}
