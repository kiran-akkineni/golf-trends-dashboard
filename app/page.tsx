import { getTrendsData } from '@/lib/redis';
import { SEED_DATA } from '@/lib/seed-data';
import type { TrendsResponse } from '@/lib/types';
import Dashboard from '@/components/Dashboard';

export const revalidate = 3600;

async function getInitialData(): Promise<TrendsResponse> {
  try {
    const cached = await getTrendsData<TrendsResponse>();
    if (cached?.data?.monthly?.golfClubs) return cached;
  } catch {
    // Redis unavailable — use seed
  }
  return SEED_DATA;
}

export default async function Page() {
  const initialData = await getInitialData();
  return <Dashboard initialData={initialData} />;
}
