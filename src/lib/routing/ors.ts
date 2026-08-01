import "server-only";
import type { LineString, Position } from "geojson";
import { buildElevationProfile } from "@/lib/geo/elevation-profile";

const ORS_BASE_URL = "https://api.openrouteservice.org/v2/directions";
// Cycling-touring-friendly default: prefers cycle infrastructure over busy
// roads, unlike "cycling-road". Revisit if/when a per-trip terrain/surface
// preference is added.
const DEFAULT_PROFILE = "cycling-regular";

export interface GeneratedRoute {
  geojson: LineString;
  totalDistanceKm: number;
  elevationGainM: number | null;
  elevationProfile: { distanceKm: number; elevationM: number }[] | null;
}

class OrsError extends Error {}

async function callOrs(body: Record<string, unknown>): Promise<LineString> {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) {
    throw new OrsError("ORS_API_KEY is not configured");
  }

  const res = await fetch(`${ORS_BASE_URL}/${DEFAULT_PROFILE}/geojson`, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
      Accept: "application/geo+json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 429) {
      throw new OrsError("Routing service rate limit reached — try again shortly.");
    }
    if (res.status === 403) {
      throw new OrsError("Routing service rejected the API key. Check ORS_API_KEY.");
    }
    throw new OrsError(`Routing request failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const geometry = data?.features?.[0]?.geometry as LineString | undefined;
  if (!geometry || geometry.type !== "LineString") {
    throw new OrsError("Routing service returned an unexpected response");
  }
  return geometry;
}

function toGeneratedRoute(geojson: LineString): GeneratedRoute {
  const { totalDistanceKm, elevationGainM, elevationProfile } = buildElevationProfile(
    geojson.coordinates,
  );
  return { geojson, totalDistanceKm, elevationGainM, elevationProfile };
}

/** Routes between two clicked points. */
export async function generatePointToPointRoute(
  start: Position,
  end: Position,
): Promise<GeneratedRoute> {
  const geojson = await callOrs({
    coordinates: [start, end],
    elevation: true,
  });
  return toGeneratedRoute(geojson);
}

/**
 * Generates round-trip loop candidates from a single start point targeting a
 * given distance. ORS's round_trip mode uses a seeded heuristic, not an exact
 * solver — actual length commonly lands +/-20% off target on sparse roads, so
 * callers should present multiple seeded candidates rather than promise an
 * exact distance. Seeds are requested in parallel; failures for individual
 * seeds are dropped rather than failing the whole batch.
 */
export async function generateDistanceLoopCandidates(
  start: Position,
  targetDistanceKm: number,
  count = 3,
): Promise<GeneratedRoute[]> {
  const seeds = Array.from({ length: count }, (_, i) => i + 1);

  const results = await Promise.allSettled(
    seeds.map((seed) =>
      callOrs({
        coordinates: [start],
        elevation: true,
        options: {
          round_trip: {
            length: Math.round(targetDistanceKm * 1000),
            points: 3,
            seed,
          },
        },
      }),
    ),
  );

  const routes = results
    .filter((r): r is PromiseFulfilledResult<LineString> => r.status === "fulfilled")
    .map((r) => toGeneratedRoute(r.value));

  if (routes.length === 0) {
    const firstError = results.find(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );
    throw firstError?.reason instanceof Error
      ? firstError.reason
      : new OrsError("Could not generate a loop route");
  }

  return routes;
}
