import type { Position } from "geojson";

export interface ElevationPoint {
  distanceKm: number;
  elevationM: number;
}

export interface ElevationProfileResult {
  totalDistanceKm: number;
  elevationGainM: number | null;
  elevationProfile: ElevationPoint[] | null;
}

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: Position, b: Position): number {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Consumer GPS/barometric elevation is notoriously noisy — dropouts that snap
 * to 0 for a few points before recovering are common (seen firsthand in real
 * GPX data: bursts like 0 -> 82m -> 0 across ~13 points). A rolling median
 * (not a moving average) rejects these short outlier bursts instead of just
 * diluting them, while still tracking genuine gradual elevation change.
 * Not needed for server-computed elevation (e.g. routing APIs), which isn't
 * subject to this class of noise.
 */
export function medianFilter(values: number[], halfWindow: number): number[] {
  return values.map((_, i) => {
    const lo = Math.max(0, i - halfWindow);
    const hi = Math.min(values.length - 1, i + halfWindow);
    const window = values.slice(lo, hi + 1).sort((a, b) => a - b);
    return window[Math.floor(window.length / 2)];
  });
}

/**
 * Computes cumulative distance (haversine over consecutive points) and, when
 * every point has elevation, total gain and a distance/elevation profile.
 * Set `smoothElevation` for noisy sources (raw GPX); leave off for elevation
 * that's already clean (e.g. routing API responses).
 */
export function buildElevationProfile(
  coords: Position[],
  { smoothElevation = false }: { smoothElevation?: boolean } = {},
): ElevationProfileResult {
  const hasElevation = coords.every((c) => typeof c[2] === "number");
  const elevations = hasElevation
    ? smoothElevation
      ? medianFilter(coords.map((c) => c[2]!), 15)
      : coords.map((c) => c[2]!)
    : null;

  let totalDistanceKm = 0;
  let cumulativeKm = 0;
  let elevationGainM = 0;
  const elevationProfile: ElevationPoint[] = elevations
    ? [{ distanceKm: 0, elevationM: elevations[0] }]
    : [];

  for (let i = 1; i < coords.length; i++) {
    const segmentKm = haversineKm(coords[i - 1], coords[i]);
    cumulativeKm += segmentKm;
    totalDistanceKm += segmentKm;

    if (elevations) {
      const gain = elevations[i] - elevations[i - 1];
      if (gain > 0) elevationGainM += gain;
      elevationProfile.push({ distanceKm: cumulativeKm, elevationM: elevations[i] });
    }
  }

  return {
    totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
    elevationGainM: elevations ? Math.round(elevationGainM) : null,
    elevationProfile: elevations ? elevationProfile : null,
  };
}
