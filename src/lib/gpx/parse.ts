import { DOMParser } from "@xmldom/xmldom";
import { gpx } from "@tmcw/togeojson";
import type {
  Feature,
  FeatureCollection,
  LineString,
  MultiLineString,
  Position,
} from "geojson";

export interface ElevationPoint {
  distanceKm: number;
  elevationM: number;
}

export interface MergedGpx {
  geojson: LineString;
  totalDistanceKm: number;
  elevationGainM: number | null;
  elevationProfile: ElevationPoint[] | null;
  /** Largest gap the chaining step had to bridge between two segments. */
  maxSegmentGapKm: number;
}

const EARTH_RADIUS_KM = 6371;

function haversineKm(a: Position, b: Position): number {
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

/** Each <trk>/<rte> (or sub-line of a MultiLineString) becomes its own segment
 * — segments are never assumed to already be in travel order or orientation. */
function extractLineSegments(featureCollection: FeatureCollection): Position[][] {
  const segments: Position[][] = [];
  for (const feature of featureCollection.features as Feature[]) {
    const geom = feature.geometry;
    if (!geom) continue;
    if (geom.type === "LineString") {
      segments.push((geom as LineString).coordinates);
    } else if (geom.type === "MultiLineString") {
      for (const line of (geom as MultiLineString).coordinates) {
        segments.push(line);
      }
    }
  }
  return segments;
}

/** Parses one GPX file's XML into its constituent track/route segments. */
export function parseGpxToSegments(xml: string): Position[][] {
  const doc = new DOMParser().parseFromString(
    xml,
    "text/xml",
  ) as unknown as Document;
  const featureCollection = gpx(doc) as FeatureCollection;
  return extractLineSegments(featureCollection);
}

/**
 * Greedily chains disjoint segments (from one or more uploaded files) into a
 * single ordered track, at each step attaching whichever remaining segment
 * (in either orientation) is closest to either open end of the chain so far.
 * File/track upload order is not trusted — GPX exports commonly split a route
 * into named sub-files (e.g. "-noord"/"-zuid") whose alphabetical order has
 * no relation to travel direction.
 */
function chainSegments(segments: Position[][]): {
  coords: Position[];
  maxGapKm: number;
} {
  const remaining = segments.map((coords) => coords.slice());
  let chain = remaining.shift()!;
  let maxGapKm = 0;

  while (remaining.length > 0) {
    const chainStart = chain[0];
    const chainEnd = chain[chain.length - 1];

    let bestIdx = 0;
    let bestGap = Infinity;
    let bestMode: "append" | "append-rev" | "prepend" | "prepend-rev" = "append";

    remaining.forEach((seg, idx) => {
      const segStart = seg[0];
      const segEnd = seg[seg.length - 1];
      const candidates: [number, typeof bestMode][] = [
        [haversineKm(chainEnd, segStart), "append"],
        [haversineKm(chainEnd, segEnd), "append-rev"],
        [haversineKm(chainStart, segEnd), "prepend"],
        [haversineKm(chainStart, segStart), "prepend-rev"],
      ];
      for (const [gap, mode] of candidates) {
        if (gap < bestGap) {
          bestGap = gap;
          bestIdx = idx;
          bestMode = mode;
        }
      }
    });

    const [seg] = remaining.splice(bestIdx, 1);
    maxGapKm = Math.max(maxGapKm, bestGap);

    if (bestMode === "append") chain = chain.concat(seg);
    else if (bestMode === "append-rev") chain = chain.concat([...seg].reverse());
    else if (bestMode === "prepend") chain = seg.concat(chain);
    else chain = [...seg].reverse().concat(chain);
  }

  return { coords: chain, maxGapKm };
}

/**
 * Merges one or more GPX files into a single combined track: every track/route
 * segment across all files is pooled and chained by nearest endpoint (see
 * chainSegments), then total distance (haversine over consecutive points) and,
 * when every point has elevation data, total gain and a distance/elevation
 * profile are computed over the resulting order.
 */
export function mergeGpxFiles(xmlContents: string[]): MergedGpx {
  const segments: Position[][] = [];

  for (const xml of xmlContents) {
    const fileSegments = parseGpxToSegments(xml).filter((s) => s.length > 0);
    if (fileSegments.length === 0) {
      throw new Error(
        "One of the GPX files has no track points (no <trk> or <rte> data found)",
      );
    }
    segments.push(...fileSegments);
  }

  const { coords: allCoords, maxGapKm } = chainSegments(segments);

  if (allCoords.length < 2) {
    throw new Error("Not enough track points to build a route");
  }

  const hasElevation = allCoords.every((c) => typeof c[2] === "number");

  let totalDistanceKm = 0;
  let cumulativeKm = 0;
  let elevationGainM = 0;
  const elevationProfile: ElevationPoint[] = hasElevation
    ? [{ distanceKm: 0, elevationM: allCoords[0][2]! }]
    : [];

  for (let i = 1; i < allCoords.length; i++) {
    const segmentKm = haversineKm(allCoords[i - 1], allCoords[i]);
    cumulativeKm += segmentKm;
    totalDistanceKm += segmentKm;

    if (hasElevation) {
      const gain = allCoords[i][2]! - allCoords[i - 1][2]!;
      if (gain > 0) elevationGainM += gain;
      elevationProfile.push({ distanceKm: cumulativeKm, elevationM: allCoords[i][2]! });
    }
  }

  return {
    geojson: { type: "LineString", coordinates: allCoords },
    totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
    elevationGainM: hasElevation ? Math.round(elevationGainM) : null,
    elevationProfile: hasElevation ? elevationProfile : null,
    maxSegmentGapKm: Math.round(maxGapKm * 100) / 100,
  };
}
