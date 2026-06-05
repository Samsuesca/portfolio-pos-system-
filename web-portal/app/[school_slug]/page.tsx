import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
    fetchSchoolBySlug,
    fetchSchoolProducts,
    fetchGlobalProducts,
    fetchBusinessInfo,
    fetchCatalogOrder,
} from '@/lib/serverApi';
import { CatalogClientV3 } from '@/components/v3/CatalogClientV3';
import { groupProductsByGarmentType } from '@/lib/types';
import { ProductListJsonLd } from '@/components/JsonLd';

interface CatalogPageProps {
    params: Promise<{ school_slug: string }>;
}

export async function generateMetadata({ params }: CatalogPageProps): Promise<Metadata> {
    const { school_slug } = await params;
    const school = await fetchSchoolBySlug(school_slug);

    if (!school) {
        return { title: 'Colegio no encontrado' };
    }

    const title = `Uniformes ${school.name} en Medellin`;
    const description = `Uniformes escolares para ${school.name} en Medellin. Blusas, pantalones, medias y calzado aprobados. Precios, tallas y pedidos online.`;

    return {
        title,
        description,
        alternates: {
            canonical: `/${school.slug}`,
        },
        openGraph: {
            title,
            description,
            url: `https://yourdomain.com/${school.slug}`,
            siteName: 'Uniformes Consuelo Rios',
            locale: 'es_CO',
            type: 'website',
            images: school.logo_url
                ? [{ url: school.logo_url, alt: `Escudo ${school.name}` }]
                : [{ url: '/logo.png', width: 1261, height: 908, alt: 'Uniformes Consuelo Rios' }],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
        },
    };
}

export default async function CatalogPage({ params }: CatalogPageProps) {
    const { school_slug } = await params;

    const school = await fetchSchoolBySlug(school_slug);
    if (!school) notFound();

    const [schoolProducts, globalProducts, businessInfo, catalogOrder] = await Promise.all([
        fetchSchoolProducts(school.id),
        fetchGlobalProducts(school.id),
        fetchBusinessInfo(),
        fetchCatalogOrder(school.id),
    ]);

    const allProducts = [...schoolProducts, ...globalProducts];
    const schoolGroups = groupProductsByGarmentType(schoolProducts, school, false);
    // Productos globales se inyectan en cada catálogo de colegio como
    // ítems compartidos (Tennis, Jean, Medias).
    const globalGroups = groupProductsByGarmentType(globalProducts, school, true);

    // Orden del catálogo definido por colegio (issue #8). Los grupos con orden
    // van primero (por display_order); los demás conservan su posición actual
    // (escolares y luego globales) — Array.sort es estable.
    const orderMap = new Map(catalogOrder.map((e) => [e.garment_type_id, e.display_order]));
    const allGroups = [...schoolGroups, ...globalGroups]
        .map((g, i) => ({ g, i }))
        .sort((a, b) => {
            const oa = orderMap.has(a.g.garmentTypeId) ? (orderMap.get(a.g.garmentTypeId) as number) : Number.POSITIVE_INFINITY;
            const ob = orderMap.has(b.g.garmentTypeId) ? (orderMap.get(b.g.garmentTypeId) as number) : Number.POSITIVE_INFINITY;
            return oa !== ob ? oa - ob : a.i - b.i;
        })
        .map((x) => x.g);

    return (
        <>
            <ProductListJsonLd schoolName={school.name} products={allProducts} />
            <CatalogClientV3
                school={school}
                productGroups={allGroups}
                basePath="/"
                whatsappNumber={businessInfo?.whatsapp_number ?? null}
            />
        </>
    );
}
