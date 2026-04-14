// Shared type definitions

export interface TrendsResponse {
  source: 'live' | 'seed';
  stale: boolean;
  lastUpdated: string | null; // ISO 8601
  data: {
    monthly: {
      // Chart 2 group (normalized together): broad/participation
      golfClubs:     Record<string, number | null>;
      golf:          Record<string, number | null>;
      golfEquipment: Record<string, number | null>;
      golfSimulator: Record<string, number | null>;
      // Chart 3 group (normalized together): equipment breakdown
      golfClubsEquip: Record<string, number | null>;  // clubs relative to balls/bags
      golfBalls:     Record<string, number | null>;
      golfBags:      Record<string, number | null>;
      // Chart 7 group (normalized together): OEM brands
      callaway:      Record<string, number | null>;
      taylormade:    Record<string, number | null>;
      titleist:      Record<string, number | null>;
      ping:          Record<string, number | null>;
      mizuno:        Record<string, number | null>;
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
