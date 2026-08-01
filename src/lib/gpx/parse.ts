import { DOMParser } from "@xmldom/xmldom";
import { gpx } from "@tmcw/togeojson";
import type {
  Feature,
  FeatureCollection,
  LineString,
  MultiLineString,
  Position,
} from "geojson";
import { buildElevationProfile, haversineKm, type ElevationPoint } from "@/lib/geo/elevation-profile";

export type { ElevationPoint };

export interface MergedGpx {
  geojson: LineString;
  totalDistanceKm: number;
  elevationGainM: number | null;
  elevationProfile: ElevationPoint[] | null;
  /** Largest gap the chaining step had to bridge between two segments. */
  maxSegmentGapKm: number;
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
 * chainSegments), then distance/elevation are computed via buildElevationProfile
 * (with GPS-noise smoothing enabled, since raw GPX elevation is noisy).
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

  const { totalDistanceKm, elevationGainM, elevationProfile } = buildElevationProfile(
    allCoords,
    { smoothElevation: true },
  );

  return {
    geojson: { type: "LineString", coordinates: allCoords },
    totalDistanceKm,
    elevationGainM,
    elevationProfile,
    maxSegmentGapKm: Math.round(maxGapKm * 100) / 100,
  };
}
