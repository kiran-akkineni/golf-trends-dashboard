// Shared type definitions

export interface TrendsResponse {
  source: 'live' | 'seed';
  stale: boolean;
  lastUpdated: string | null; // ISO 8601
  data: {
    monthly: {
      golfClubs:     Record<string, number | null>;
      golfBalls:     Record<string, number | null>;
      golfBags:      Record<string, number | null>;
      golf:          Record<string, number | null>;
      golfEquipment: Record<string, number | null>;
      golfSimulator: Record<string, number | null>;
    };
    quarterly: {
      golfClubs:     Record<string, number>;
      golf:          Record<string, number>;
      golfEquipment: Record<string, number>;
      golfSimulator: Record<string, number>;
    };
    annual: {
      golfClubs:  Record<string, number>;
      summerPeak: Record<string, number>;
    };
  };
}

export interface RawTrendsRecord {
  [term: string]: Record<string, number> | { error: string };
}
