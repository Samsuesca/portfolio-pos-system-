import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchSchoolBySlug, fetchSchoolProducts, fetchGlobalProducts } from '@/lib/serverApi';
import CatalogClient from '@/components/CatalogClient';

interface CatalogPageProps {
    params: Promise<{ school_slug: string }>;
}

export async function generateMetadata({ params }: CatalogPageProps): Promise<Metadata> {
    const { school_slug } = await params;
    const school = await fetchSchoolBySlug(school_slug);

    if (!school) {
        return { title: 'Colegio no encontrado' };
    }

    return {
        title: school.name,
        description: `Catalogo de uniformes para ${school.name}. Precios, tallas y pedidos online.`,
    };
}

export default async function CatalogPage({ params }: CatalogPageProps) {
    const { school_slug } = await params;

    // Fetch school data server-side
    const school = await fetchSchoolBySlug(school_slug);

    if (!school) {
        notFound();
    }

    // Fetch products server-side in parallel
    const [schoolProducts, globalProducts] = await Promise.all([
        fetchSchoolProducts(school.id),
        fetchGlobalProducts(),
    ]);

    return (
        <CatalogClient
            school={school}
            schoolSlug={school_slug}
            initialProducts={schoolProducts}
            initialGlobalProducts={globalProducts}
        />
    );
}
