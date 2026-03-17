import { NextResponse } from 'next/server';
import { getTrendsData } from '@/lib/redis';
import { SEED_DATA } from '@/lib/seed-data';
import type { TrendsResponse } from '@/lib/types';

export const runtime = 'nodejs';
export const revalidate = 3600; // ISR — revalidate the static cache hourly

export async function GET() {
  try {
    const cached = await getTrendsData<TrendsResponse>();

    if (cached && cached.data?.monthly?.golfClubs) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      });
    }
  } catch (err) {
    console.warn('[api/data] Redis read failed, falling back to seed:', String(err));
  }

  // Fallback: return seed data
  return NextResponse.json(SEED_DATA, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
    },
  });
}
