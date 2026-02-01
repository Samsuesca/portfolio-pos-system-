'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  RefreshCw,
  Package,
  Filter,
  X,
  Building2,
  Globe,
  Tag,
  AlertCircle,
} from 'lucide-react';
import schoolService from '@/lib/services/schoolService';
import productService from '@/lib/services/productService';
import { useAdminAuth } from '@/lib/adminAuth';
import type { School, Product, GarmentType, GlobalProduct, GlobalGarmentType } from '@/lib/api';

// Import modals
import GarmentTypeModal from '@/components/products/GarmentTypeModal';
import SchoolProductModal from '@/components/products/SchoolProductModal';
import GlobalProductModal from '@/components/products/GlobalProductModal';
import InventoryAdjustmentModal from '@/components/products/InventoryAdjustmentModal';

type TabType = 'school' | 'global' | 'garment-types';
type GarmentTypeSubTab = 'school' | 'global';

export default function ProductsPage() {
  const { user } = useAdminAuth();
  const isSuperuser = user?.is_superuser ?? false;
  // Check if user is admin in any school (can adjust global inventory)
  const isAdminInAnySchool = user?.school_roles?.some(r => r.role === 'admin' || r.role === 'owner') ?? false;
  const canAdjustGlobalInventory = isSuperuser || isAdminInAnySchool;

  // Data state
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolProducts, setSchoolProducts] = useState<Product[]>([]);
  const [globalProducts, setGlobalProducts] = useState<GlobalProduct[]>([]);
  const [schoolGarmentTypes, setSchoolGarmentTypes] = useState<GarmentType[]>([]);
  const [globalGarmentTypes, setGlobalGarmentTypes] = useState<GlobalGarmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('school');
  const [garmentTypeSubTab, setGarmentTypeSubTab] = useState<GarmentTypeSubTab>('school');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<string>('all');
  const [selectedGarmentType, setSelectedGarmentType] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');

  // Modal states
  const [showSchoolProductModal, setShowSchoolProductModal] = useState(false);
  const [showGlobalProductModal, setShowGlobalProductModal] = useState(false);
  const [showGarmentTypeModal, setShowGarmentTypeModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);

  // Edit states
  const [editingSchoolProduct, setEditingSchoolProduct] = useState<Product | null>(null);
  const [editingGlobalProduct, setEditingGlobalProduct] = useState<GlobalProduct | null>(null);
  const [editingGarmentType, setEditingGarmentType] = useState<GarmentType | GlobalGarmentType | null>(null);
  const [isEditingGlobalType, setIsEditingGlobalType] = useState(false);
  const [inventoryProduct, setInventoryProduct] = useState<Product | GlobalProduct | null>(null);
  const [inventoryIsGlobal, setInventoryIsGlobal] = useState(false);

  // Selected school for creating new items
  const [createSchoolId, setCreateSchoolId] = useState<string>('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const schoolsData = await schoolService.list({ include_inactive: false });
      setSchools(schoolsData);

      if (schoolsData.length > 0 && !createSchoolId) {
        setCreateSchoolId(schoolsData[0].id);
      }

      // Load all data in parallel
      const allSchoolProducts: Product[] = [];
      const allSchoolGarmentTypes: GarmentType[] = [];

      // Load global products
      try {
        const globalProds = await productService.getGlobalProducts(true);
        setGlobalProducts(globalProds);
      } catch (e) {
        console.error('Error loading global products:', e);
      }

      // Load global garment types
      try {
        const globalTypes = await productService.listGlobalGarmentTypes();
        setGlobalGarmentTypes(globalTypes);
      } catch (e) {
        console.error('Error loading global garment types:', e);
      }

      // Load school products and garment types
      for (const school of schoolsData) {
        try {
          const schoolProducts = await productService.getProducts(school.id, true);
          allSchoolProducts.push(...schoolProducts.map(p => ({ ...p, school_id: school.id })));

          const schoolTypes = await productService.listGarmentTypes(school.id);
          schoolTypes.forEach(gt => {
            if (!allSchoolGarmentTypes.find(t => t.id === gt.id)) {
              allSchoolGarmentTypes.push({ ...gt, school_id: school.id });
            }
          });
        } catch (e) {
          console.error(`Error loading data for school ${school.name}:`, e);
        }
      }

      setSchoolProducts(allSchoolProducts);
      setSchoolGarmentTypes(allSchoolGarmentTypes);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter school products
  const filteredSchoolProducts = schoolProducts.filter((product) => {
    const matchesSearch =
      (product.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (product.garment_type_name?.toLowerCase() || '').includes(searchTerm.toLowerCase());

    const matchesSchool = selectedSchool === 'all' || product.school_id === selectedSchool;

    const matchesGarmentType =
      selectedGarmentType === 'all' || product.garment_type_id === selectedGarmentType;

    const stock = product.stock ?? product.inventory_quantity ?? 0;
    const matchesStock =
      stockFilter === 'all' ||
      (stockFilter === 'in_stock' && stock > 0) ||
      (stockFilter === 'low_stock' && stock > 0 && stock <= 5) ||
      (stockFilter === 'out_of_stock' && stock === 0);

    return matchesSearch && matchesSchool && matchesGarmentType && matchesStock;
  });

  // Filter global products
  const filteredGlobalProducts = globalProducts.filter((product) => {
    const matchesSearch =
      (product.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (product.garment_type_name?.toLowerCase() || '').includes(searchTerm.toLowerCase());

    const matchesGarmentType =
      selectedGarmentType === 'all' || product.garment_type_id === selectedGarmentType;

    const stock = product.inventory_quantity ?? 0;
    const matchesStock =
      stockFilter === 'all' ||
      (stockFilter === 'in_stock' && stock > 0) ||
      (stockFilter === 'low_stock' && stock > 0 && stock <= 5) ||
      (stockFilter === 'out_of_stock' && stock === 0);

    return matchesSearch && matchesGarmentType && matchesStock;
  });

  // Filter garment types
  const filteredSchoolGarmentTypes = schoolGarmentTypes.filter((type) => {
    const matchesSearch = (type.name?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesSchool = selectedSchool === 'all' || type.school_id === selectedSchool;
    return matchesSearch && matchesSchool;
  });

  const filteredGlobalGarmentTypes = globalGarmentTypes.filter((type) => {
    return (type.name?.toLowerCase() || '').includes(searchTerm.toLowerCase());
  });

  const getSchoolName = (schoolId: string | undefined) => {
    if (!schoolId) return '-';
    const school = schools.find((s) => s.id === schoolId);
    return school?.name || 'Desconocido';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedSchool('all');
    setSelectedGarmentType('all');
    setStockFilter('all');
  };

  const hasActiveFilters =
    searchTerm || selectedSchool !== 'all' || selectedGarmentType !== 'all' || stockFilter !== 'all';

  // Handlers for modals
  const openCreateSchoolProduct = () => {
    if (!createSchoolId && schools.length > 0) {
      setCreateSchoolId(schools[0].id);
    }
    setEditingSchoolProduct(null);
    setShowSchoolProductModal(true);
  };

  const openEditSchoolProduct = (product: Product) => {
    setEditingSchoolProduct(product);
    setCreateSchoolId(product.school_id);
    setShowSchoolProductModal(true);
  };

  const openCreateGlobalProduct = () => {
    setEditingGlobalProduct(null);
    setShowGlobalProductModal(true);
  };

  const openEditGlobalProduct = (product: GlobalProduct) => {
    setEditingGlobalProduct(product);
    setShowGlobalProductModal(true);
  };

  const openCreateGarmentType = (isGlobal: boolean) => {
    setEditingGarmentType(null);
    setIsEditingGlobalType(isGlobal);
    if (!isGlobal && !createSchoolId && schools.length > 0) {
      setCreateSchoolId(schools[0].id);
    }
    setShowGarmentTypeModal(true);
  };

  const openEditGarmentType = (type: GarmentType | GlobalGarmentType, isGlobal: boolean) => {
    setEditingGarmentType(type);
    setIsEditingGlobalType(isGlobal);
    if (!isGlobal && 'school_id' in type) {
      setCreateSchoolId(type.school_id);
    }
    setShowGarmentTypeModal(true);
  };

  const openInventory = (product: Product | GlobalProduct, isGlobal: boolean) => {
    setInventoryProduct(product);
    setInventoryIsGlobal(isGlobal);
    setShowInventoryModal(true);
  };

  const handleDeleteSchoolProduct = async (product: Product) => {
    if (!confirm(`¿Eliminar "${product.name}"?`)) return;
    try {
      await productService.delete(product.school_id, product.id);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al eliminar');
    }
  };

  const handleDeleteGlobalProduct = async (product: GlobalProduct) => {
    if (!confirm(`¿Eliminar "${product.name}"?`)) return;
    try {
      await productService.deleteGlobal(product.id);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al eliminar');
    }
  };

  const handleDeleteGarmentType = async (type: GarmentType | GlobalGarmentType, isGlobal: boolean) => {
    if (!confirm(`¿Eliminar tipo "${type.name}"?`)) return;
    try {
      if (isGlobal) {
        await productService.deleteGlobalGarmentType(type.id);
      } else if ('school_id' in type) {
        await productService.deleteGarmentType(type.school_id, type.id);
      }
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al eliminar');
    }
  };

  const genderLabels: Record<string, string> = {
    unisex: 'Unisex',
    male: 'Masculino',
    female: 'Femenino',
  };

  const categoryLabels: Record<string, string> = {
    uniforme_diario: 'Uniforme Diario',
    uniforme_deportivo: 'Uniforme Deportivo',
    accesorios: 'Accesorios',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display">
            Productos e Inventario
          </h1>
          <p className="text-slate-600 mt-1">
            {activeTab === 'school' && `${filteredSchoolProducts.length} productos de colegio`}
            {activeTab === 'global' && `${filteredGlobalProducts.length} productos globales`}
            {activeTab === 'garment-types' && (
              garmentTypeSubTab === 'school'
                ? `${filteredSchoolGarmentTypes.length} tipos de colegio`
                : `${filteredGlobalGarmentTypes.length} tipos globales`
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          {activeTab === 'school' && (
            <button onClick={openCreateSchoolProduct} className="btn-primary flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Nuevo Producto
            </button>
          )}
          {activeTab === 'global' && isSuperuser && (
            <button onClick={openCreateGlobalProduct} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition">
              <Plus className="w-5 h-5" />
              Nuevo Producto Global
            </button>
          )}
          {activeTab === 'garment-types' && (
            garmentTypeSubTab === 'school' ? (
              <button onClick={() => openCreateGarmentType(false)} className="btn-primary flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Nuevo Tipo
              </button>
            ) : isSuperuser && (
              <button onClick={() => openCreateGarmentType(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition">
                <Plus className="w-5 h-5" />
                Nuevo Tipo Global
              </button>
            )
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('school')}
            className={`flex items-center gap-2 px-6 py-4 font-medium transition ${
              activeTab === 'school'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Productos Colegio
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">
              {schoolProducts.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('global')}
            className={`flex items-center gap-2 px-6 py-4 font-medium transition ${
              activeTab === 'global'
                ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Globe className="w-4 h-4" />
            Productos Globales
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">
              {globalProducts.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('garment-types')}
            className={`flex items-center gap-2 px-6 py-4 font-medium transition ${
              activeTab === 'garment-types'
                ? 'text-slate-900 border-b-2 border-slate-900 bg-slate-50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Tag className="w-4 h-4" />
            Tipos de Prenda
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">
              {schoolGarmentTypes.length + globalGarmentTypes.length}
            </span>
          </button>
        </div>

        {/* Garment Types Sub-tabs */}
        {activeTab === 'garment-types' && (
          <div className="flex border-b border-slate-200 bg-slate-50">
            <button
              onClick={() => setGarmentTypeSubTab('school')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition ${
                garmentTypeSubTab === 'school'
                  ? 'text-blue-600 bg-white border-b-2 border-blue-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Building2 className="w-3 h-3" />
              Tipos del Colegio ({schoolGarmentTypes.length})
            </button>
            <button
              onClick={() => setGarmentTypeSubTab('global')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition ${
                garmentTypeSubTab === 'global'
                  ? 'text-purple-600 bg-white border-b-2 border-purple-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Globe className="w-3 h-3" />
              Tipos Globales ({globalGarmentTypes.length})
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
            <Filter className="w-4 h-4" />
            Filtros
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="ml-auto text-brand-600 hover:text-brand-700 flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Limpiar
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="admin-input pl-10"
              />
            </div>

            {/* School Filter (for school products and school garment types) */}
            {(activeTab === 'school' || (activeTab === 'garment-types' && garmentTypeSubTab === 'school')) && (
              <select
                value={selectedSchool}
                onChange={(e) => {
                  setSelectedSchool(e.target.value);
                  setSelectedGarmentType('all');
                }}
                className="admin-input"
              >
                <option value="all">Todos los colegios</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            )}

            {/* Stock Filter (for products only) */}
            {(activeTab === 'school' || activeTab === 'global') && (
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value)}
                className="admin-input"
              >
                <option value="all">Todo el stock</option>
                <option value="in_stock">En stock</option>
                <option value="low_stock">Stock bajo (≤5)</option>
                <option value="out_of_stock">Sin stock</option>
              </select>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 border-b border-red-200 text-red-600 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="overflow-x-auto">
          {/* School Products Table */}
          {activeTab === 'school' && (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Talla</th>
                  <th>Color</th>
                  <th>Precio</th>
                  <th>Stock</th>
                  <th>Estado</th>
                  <th>Colegio</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-brand-500"></div>
                      <p className="mt-2 text-slate-500">Cargando productos...</p>
                    </td>
                  </tr>
                ) : filteredSchoolProducts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-slate-500">
                      <Package className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      No se encontraron productos
                    </td>
                  </tr>
                ) : (
                  filteredSchoolProducts.map((product) => {
                    const stock = product.stock ?? product.inventory_quantity ?? 0;
                    return (
                      <tr key={product.id}>
                        <td className="font-medium">{product.name || '-'}</td>
                        <td className="text-sm text-slate-600">{product.garment_type_name || '-'}</td>
                        <td>{product.size}</td>
                        <td className="text-sm">{product.color || '-'}</td>
                        <td className="font-medium text-green-600">{formatCurrency(product.price)}</td>
                        <td>
                          <span className={`badge ${
                            stock === 0 ? 'badge-error' : stock <= 5 ? 'badge-warning' : 'badge-success'
                          }`}>
                            {stock}
                          </span>
                        </td>
                        <td>
                          {product.is_active ? (
                            <span className="badge badge-success">Activo</span>
                          ) : (
                            <span className="badge badge-error">Inactivo</span>
                          )}
                        </td>
                        <td className="text-sm text-slate-600">{getSchoolName(product.school_id)}</td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openInventory(product, false)}
                              className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Ajustar inventario"
                            >
                              <Package className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEditSchoolProduct(product)}
                              className="p-2 text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSchoolProduct(product)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* Global Products Table */}
          {activeTab === 'global' && (
            <table className="admin-table">
              <thead className="bg-purple-50">
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Talla</th>
                  <th>Color</th>
                  <th>Precio</th>
                  <th>Stock</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-purple-500"></div>
                      <p className="mt-2 text-slate-500">Cargando productos globales...</p>
                    </td>
                  </tr>
                ) : filteredGlobalProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-500">
                      <Globe className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      No se encontraron productos globales
                    </td>
                  </tr>
                ) : (
                  filteredGlobalProducts.map((product) => {
                    const stock = product.inventory_quantity ?? 0;
                    return (
                      <tr key={product.id}>
                        <td className="font-medium">{product.name || '-'}</td>
                        <td className="text-sm text-slate-600">{product.garment_type_name || '-'}</td>
                        <td>{product.size}</td>
                        <td className="text-sm">{product.color || '-'}</td>
                        <td className="font-medium text-green-600">{formatCurrency(product.price)}</td>
                        <td>
                          <span className={`badge ${
                            stock === 0 ? 'badge-error' : stock <= 5 ? 'badge-warning' : 'badge-success'
                          }`}>
                            {stock}
                          </span>
                        </td>
                        <td>
                          {product.is_active ? (
                            <span className="badge badge-success">Activo</span>
                          ) : (
                            <span className="badge badge-error">Inactivo</span>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            {canAdjustGlobalInventory && (
                              <button
                                onClick={() => openInventory(product, true)}
                                className="p-2 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                title="Ajustar inventario"
                              >
                                <Package className="w-4 h-4" />
                              </button>
                            )}
                            {isSuperuser && (
                              <>
                                <button
                                  onClick={() => openEditGlobalProduct(product)}
                                  className="p-2 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                  title="Editar"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteGlobalProduct(product)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* School Garment Types Table */}
          {activeTab === 'garment-types' && garmentTypeSubTab === 'school' && (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Descripcion</th>
                  <th>Categoria</th>
                  <th>Bordado</th>
                  <th>Medidas</th>
                  <th>Estado</th>
                  <th>Colegio</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-brand-500"></div>
                      <p className="mt-2 text-slate-500">Cargando tipos de prenda...</p>
                    </td>
                  </tr>
                ) : filteredSchoolGarmentTypes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-500">
                      <Tag className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      No se encontraron tipos de prenda
                    </td>
                  </tr>
                ) : (
                  filteredSchoolGarmentTypes.map((type) => (
                    <tr key={type.id}>
                      <td className="font-medium">{type.name}</td>
                      <td className="text-sm text-slate-600 max-w-xs truncate">{type.description || '-'}</td>
                      <td className="text-sm">{type.category ? categoryLabels[type.category] : '-'}</td>
                      <td>
                        {type.requires_embroidery ? (
                          <span className="badge badge-info">Si</span>
                        ) : (
                          <span className="text-slate-400">No</span>
                        )}
                      </td>
                      <td>
                        {type.has_custom_measurements ? (
                          <span className="badge badge-info">Si</span>
                        ) : (
                          <span className="text-slate-400">No</span>
                        )}
                      </td>
                      <td>
                        {type.is_active ? (
                          <span className="badge badge-success">Activo</span>
                        ) : (
                          <span className="badge badge-error">Inactivo</span>
                        )}
                      </td>
                      <td className="text-sm text-slate-600">{getSchoolName(type.school_id)}</td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditGarmentType(type, false)}
                            className="p-2 text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteGarmentType(type, false)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* Global Garment Types Table */}
          {activeTab === 'garment-types' && garmentTypeSubTab === 'global' && (
            <table className="admin-table">
              <thead className="bg-purple-50">
                <tr>
                  <th>Nombre</th>
                  <th>Descripcion</th>
                  <th>Categoria</th>
                  <th>Bordado</th>
                  <th>Medidas</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-purple-500"></div>
                      <p className="mt-2 text-slate-500">Cargando tipos globales...</p>
                    </td>
                  </tr>
                ) : filteredGlobalGarmentTypes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-500">
                      <Globe className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      No se encontraron tipos globales
                    </td>
                  </tr>
                ) : (
                  filteredGlobalGarmentTypes.map((type) => (
                    <tr key={type.id}>
                      <td className="font-medium">{type.name}</td>
                      <td className="text-sm text-slate-600 max-w-xs truncate">{type.description || '-'}</td>
                      <td className="text-sm">{type.category ? categoryLabels[type.category] : '-'}</td>
                      <td>
                        {type.requires_embroidery ? (
                          <span className="badge badge-info">Si</span>
                        ) : (
                          <span className="text-slate-400">No</span>
                        )}
                      </td>
                      <td>
                        {type.has_custom_measurements ? (
                          <span className="badge badge-info">Si</span>
                        ) : (
                          <span className="text-slate-400">No</span>
                        )}
                      </td>
                      <td>
                        {type.is_active ? (
                          <span className="badge badge-success">Activo</span>
                        ) : (
                          <span className="badge badge-error">Inactivo</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          {isSuperuser && (
                            <>
                              <button
                                onClick={() => openEditGarmentType(type, true)}
                                className="p-2 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteGarmentType(type, true)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modals */}
      <SchoolProductModal
        isOpen={showSchoolProductModal}
        onClose={() => {
          setShowSchoolProductModal(false);
          setEditingSchoolProduct(null);
        }}
        onSuccess={loadData}
        schoolId={createSchoolId}
        schoolName={getSchoolName(createSchoolId)}
        product={editingSchoolProduct}
      />

      <GlobalProductModal
        isOpen={showGlobalProductModal}
        onClose={() => {
          setShowGlobalProductModal(false);
          setEditingGlobalProduct(null);
        }}
        onSuccess={loadData}
        product={editingGlobalProduct}
      />

      <GarmentTypeModal
        isOpen={showGarmentTypeModal}
        onClose={() => {
          setShowGarmentTypeModal(false);
          setEditingGarmentType(null);
        }}
        onSuccess={loadData}
        garmentType={editingGarmentType}
        isGlobal={isEditingGlobalType}
        schoolId={createSchoolId}
      />

      {inventoryProduct && (
        <InventoryAdjustmentModal
          isOpen={showInventoryModal}
          onClose={() => {
            setShowInventoryModal(false);
            setInventoryProduct(null);
          }}
          onSuccess={loadData}
          product={inventoryProduct}
          isGlobal={inventoryIsGlobal}
          schoolId={!inventoryIsGlobal && 'school_id' in inventoryProduct ? inventoryProduct.school_id : undefined}
        />
      )}
    </div>
  );
}
