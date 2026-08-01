"use client";

import { useEffect, useRef } from "react";
import { Map as MapLibreMap, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LineString } from "geojson";

// maplibre-gl's default worker-URL resolution (import.meta.url-based) doesn't
// survive Turbopack's dev bundling — the browser ends up requesting the
// current page itself as a JS module ("Failed to load module script...
// non-JavaScript MIME type text/html", confirmed via DevTools). Pointing it
// at a same-origin static copy (populated by scripts/copy-maplibre-worker.mjs
// on every `npm install`) sidesteps bundler resolution entirely.
setWorkerUrl("/maplibre-gl-worker.mjs");

// OpenFreeMap (openfreemap.org): free, no API key, no signup, production-grade
// vector tiles. MapLibre's own demotiles.maplibre.org was tried first but its
// style references a second-hop tiles.json whose vector tiles never actually
// loaded here — the map rendered nothing but a flat background color (verified
// via map.isStyleLoaded()/getSource() staying empty indefinitely). OpenFreeMap
// is a single-hop style and a well-known reliable replacement for exactly this.
const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

export function RouteMap({ geojson }: { geojson: LineString }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: MAP_STYLE,
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
