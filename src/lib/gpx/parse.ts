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

function extractLineCoordinates(featureCollection: FeatureCollection): Position[] {
  const coords: Position[] = [];
  for (const feature of featureCollection.features as Feature[]) {
    const geom = feature.geometry;
    if (!geom) continue;
    if (geom.type === "LineString") {
      coords.push(...(geom as LineString).coordinates);
    } else if (geom.type === "MultiLineString") {
      for (const line of (geom as MultiLineString).coordinates) {
        coords.push(...line);
      }
    }
  }
  return coords;
}

/** Parses one GPX file's XML into an ordered list of [lon, lat, ele?] coordinates. */
export function parseGpxToCoordinates(xml: string): Position[] {
  const doc = new DOMParser().parseFromString(
    xml,
    "text/xml",
  ) as unknown as Document;
  const featureCollection = gpx(doc) as FeatureCollection;
  return extractLineCoordinates(featureCollection);
}

/**
 * Merges one or more GPX files (in upload order) into a single combined track,
 * computing total distance (haversine over consecutive points) and, when every
 * point has elevation data, total gain and a distance/elevation profile.
 */
export function mergeGpxFiles(xmlContents: string[]): MergedGpx {
  const allCoords: Position[] = [];

  for (const xml of xmlContents) {
    const coords = parseGpxToCoordinates(xml);
    if (coords.length === 0) {
      throw new Error(
        "One of the GPX files has no track points (no <trk> or <rte> data found)",
      );
    }
    allCoords.push(...coords);
  }

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
  };
}
