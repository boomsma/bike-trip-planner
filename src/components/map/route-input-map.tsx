"use client";

import { useEffect, useRef } from "react";
import { Map as MapLibreMap, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Position } from "geojson";

// See src/components/map/route-map.tsx for why this is needed under Turbopack.
setWorkerUrl("/maplibre-gl-worker.mjs");

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const NETHERLANDS_CENTER: [number, number] = [5.2913, 52.1326];

export interface PreviewLine {
  id: string;
  coordinates: Position[];
  color: string;
}

/** Interactive map for picking points: click handler + live-updating markers
 * and preview route line(s). Distinct from RouteMap, which just displays a
 * finalized, saved route. */
export function RouteInputMap({
  markers,
  previewLines,
  onClick,
}: {
  markers: Position[];
  previewLines: PreviewLine[];
  onClick: (lngLat: Position) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onClickRef = useRef(onClick);

  useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: MAP_STYLE,
      center: NETHERLANDS_CENTER,
      zoom: 6,
    });
    mapRef.current = map;

    map.on("click", (e) => {
      onClickRef.current([e.lngLat.lng, e.lngLat.lat]);
    });

    map.on("load", () => {
      map.addSource("input-markers", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "input-markers-layer",
        type: "circle",
        source: "input-markers",
        paint: {
          "circle-radius": 7,
          "circle-color": "#111827",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.addSource("input-preview-lines", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "input-preview-lines-layer",
        type: "line",
        source: "input-preview-lines",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": ["get", "color"], "line-width": 4 },
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => {
      const source = map.getSource("input-markers") as GeoJSONSource | undefined;
      source?.setData({
        type: "FeatureCollection",
        features: markers.map((m) => ({
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: m },
        })),
      });
    };
    if (map.isStyleLoaded()) update();
    else map.once("load", update);
  }, [markers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => {
      const source = map.getSource("input-preview-lines") as GeoJSONSource | undefined;
      source?.setData({
        type: "FeatureCollection",
        features: previewLines.map((l) => ({
          type: "Feature",
          properties: { color: l.color },
          geometry: { type: "LineString", coordinates: l.coordinates },
        })),
      });
    };
    if (map.isStyleLoaded()) update();
    else map.once("load", update);
  }, [previewLines]);

  return <div ref={containerRef} className="w-full h-[400px] rounded border" />;
}
