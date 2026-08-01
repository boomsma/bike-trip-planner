import "server-only";

// Nominatim usage policy: max 1 req/sec, requires a descriptive User-Agent
// (no default/browser-like UA), no bulk geocoding. We only call this once
// per route (result cached on Route.countries afterward), plus this
// process-local cache rounds coordinates to a coarse grid so nearby points
// within one request don't re-hit the API.
const USER_AGENT = "bike-trip-planner (https://github.com/boomsma/bike-trip-planner)";
const CACHE_GRID_DECIMALS = 1; // ~11km grid — plenty precise for country lookup

const cache = new Map<string, string | null>();

function cacheKey(lat: number, lon: number): string {
  const factor = 10 ** CACHE_GRID_DECIMALS;
  return `${Math.round(lat * factor) / factor},${Math.round(lon * factor) / factor}`;
}

/** Reverse-geocodes a point to its country name, or null if not resolvable. */
export async function reverseGeocodeCountry(lat: number, lon: number): Promise<string | null> {
  const key = cacheKey(lat, lon);
  if (cache.has(key)) {
    return cache.get(key)!;
  }

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("zoom", "3"); // country-level detail only
  // Without this, Nominatim returns the country name in its own local
  // language (e.g. "Österreich" for Austria) — silently breaks matching
  // against the English country names used in packing_suggestion_rules.
  url.searchParams.set("accept-language", "en");

  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    cache.set(key, null);
    return null;
  }

  const data = await res.json();
  const country: string | null = data?.address?.country ?? null;
  cache.set(key, country);
  return country;
}
