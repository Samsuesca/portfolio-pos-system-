import { fetchSchools, fetchPaymentAccounts } from '@/lib/serverApi';
import HomePageClient from '@/components/HomePageClient';

export default async function Home() {
  // Fetch data server-side in parallel
  const [schools, paymentAccounts] = await Promise.all([
    fetchSchools(),
    fetchPaymentAccounts(),
  ]);

  return (
    <HomePageClient
      schools={schools}
      paymentAccounts={paymentAccounts}
    />
  );
}
