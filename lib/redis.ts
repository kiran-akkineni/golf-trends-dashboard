import { Redis } from '@upstash/redis';

const REDIS_KEYS = {
  trendsData:    'golf_trends_data',
  lastUpdated:   'golf_trends_last_updated',
} as const;

// Lazily instantiate so the module doesn't crash if env vars are missing.
let _client: Redis | null = null;

function getClient(): Redis | null {
  if (_client) return _client;
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.warn('[redis] UPSTASH env vars missing — Redis disabled');
    return null;
  }
  try {
    _client = new Redis({ url, token });
    return _client;
  } catch (err) {
    console.error('[redis] Failed to create client:', err);
    return null;
  }
}

export async function getCachedData<T>(key: keyof typeof REDIS_KEYS): Promise<T | null> {
  const client = getClient();
  if (!client) return null;
  try {
    const raw = await client.get<T>(REDIS_KEYS[key]);
    return raw ?? null;
  } catch (err) {
    console.error('[redis] GET error:', err);
    return null;
  }
}

export async function setCachedData<T>(
  key: keyof typeof REDIS_KEYS,
  value: T,
  ttlSeconds = 86400
): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  try {
    await client.set(REDIS_KEYS[key], JSON.stringify(value), { ex: ttlSeconds });
    return true;
  } catch (err) {
    console.error('[redis] SET error:', err);
    return false;
  }
}

export async function getTrendsData<T>(): Promise<T | null> {
  const client = getClient();
  if (!client) return null;
  try {
    const raw = await client.get<string>(REDIS_KEYS.trendsData);
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (err) {
    console.error('[redis] getTrendsData error:', err);
    return null;
  }
}

export async function setTrendsData(data: unknown, ttlSeconds = 86400): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  try {
    const ts = new Date().toISOString();
    await client.set(REDIS_KEYS.trendsData, JSON.stringify(data), { ex: ttlSeconds });
    await client.set(REDIS_KEYS.lastUpdated, ts, { ex: ttlSeconds + 3600 });
    return true;
  } catch (err) {
    console.error('[redis] setTrendsData error:', err);
    return false;
  }
}
