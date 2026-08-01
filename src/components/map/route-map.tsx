"use client";

import { useEffect, useRef } from "react";
import { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LineString } from "geojson";

// Free, no-API-key demo style — swap for a MapTiler/Stadia style + API key
// (see plan) once you've signed up for one; this is enough to render routes now.
const DEMO_STYLE = "https://demotiles.maplibre.org/style.json";

export function RouteMap({ geojson }: { geojson: LineString }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: DEMO_STYLE,
      bounds: boundsOf(geojson.coordinates),
      fitBoundsOptions: { padding: 40 },
    });
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("route", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: geojson },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#e11d48", "line-width": 3 },
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [geojson]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[400px] rounded border"
      data-testid="route-map"
    />
  );
}

function boundsOf(
  coordinates: number[][],
): [[number, number], [number, number]] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const [lng, lat] of coordinates) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}
