import { fetchSchools } from '@/lib/serverApi';
import HomePageClient from '@/components/HomePageClient';

export default async function Home() {
  const schools = await fetchSchools();

  return (
    <HomePageClient
      schools={schools}
    />
  );
}
