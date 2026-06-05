import { notFound } from "next/navigation";
import {
  fetchBusinessInfo,
  fetchSchoolBySlug,
  fetchSchoolProducts,
  fetchGlobalProducts,
} from "@/lib/serverApi";
import { groupProductsByGarmentType } from "@/lib/types";
import { ProductDetailV3 } from "@/components/v3/ProductDetailV3";

export const revalidate = 30;

interface PageProps {
  params: Promise<{ school_slug: string; product_slug: string }>;
}

export default async function ProductDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { school_slug, product_slug } = await params;

  const school = await fetchSchoolBySlug(school_slug);
  if (!school) notFound();

  const [schoolProducts, globalProducts, businessInfo] = await Promise.all([
    fetchSchoolProducts(school.id),
    fetchGlobalProducts(),
    fetchBusinessInfo(),
  ]);

  // product_slug es el garment_type_id (UUID) para v3.0. Buscamos tanto en el
  // catalogo del colegio como en los globales (Tennis, Jean, Medias).
  const schoolGroups = groupProductsByGarmentType(schoolProducts, school, false);
  const globalGroups = groupProductsByGarmentType(globalProducts, school, true);

  const group =
    schoolGroups.find((g) => g.garmentTypeId === product_slug) ??
    globalGroups.find((g) => g.garmentTypeId === product_slug);

  if (!group) notFound();

  return (
    <ProductDetailV3
      school={school}
      group={group}
      basePath="/"
      whatsappNumber={businessInfo?.whatsapp_number ?? null}
    />
  );
}
