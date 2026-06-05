import { Suspense } from "react";
import { fetchSchools, fetchBusinessInfo } from "@/lib/serverApi";
import { HeroV3 } from "@/components/v3/HeroV3";
import { SchoolPickerV3 } from "@/components/v3/SchoolPickerV3";
import {
  EncargosBannerV3,
  PaymentSectionV3,
  HelpSectionV3,
} from "@/components/v3/HomeSectionsV3";
import { LoginRequiredDialog } from "@/components/v3/LoginRequiredDialog";

export const revalidate = 60;

export default async function Home(): Promise<React.JSX.Element> {
  const [schools, businessInfo] = await Promise.all([
    fetchSchools(),
    fetchBusinessInfo(),
  ]);

  return (
    <>
      <HeroV3 businessInfo={businessInfo} schools={schools} />
      <SchoolPickerV3 schools={schools} basePath="/" />
      <EncargosBannerV3 />
      <PaymentSectionV3 whatsappNumber={businessInfo?.whatsapp_number ?? null} />
      <HelpSectionV3 businessInfo={businessInfo} />
      {/* useSearchParams() en LoginRequiredDialog exige Suspense para el
          prerender estatico de "/" en next build. */}
      <Suspense fallback={null}>
        <LoginRequiredDialog />
      </Suspense>
    </>
  );
}
