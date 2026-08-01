"use client";

import { useState } from "react";
import type { Position } from "geojson";
import { RouteInputMap, type PreviewLine } from "@/components/map/route-input-map";
import { GpxUploadForm } from "@/components/gpx-upload-form";
import type {
  GenerateLoopCandidatesResult,
  GenerateRouteResult,
  LoopCandidate,
  UploadGpxState,
} from "@/app/trips/[tripId]/actions";

type Mode = "upload" | "points" | "distance";

const CANDIDATE_COLORS = ["#e11d48", "#2563eb", "#16a34a"];

export function RouteBuilder({
  uploadAction,
  generatePointsAction,
  generateLoopCandidatesAction,
  selectLoopAction,
}: {
  uploadAction: (state: UploadGpxState, formData: FormData) => Promise<UploadGpxState>;
  generatePointsAction: (start: Position, end: Position) => Promise<GenerateRouteResult>;
  generateLoopCandidatesAction: (
    start: Position,
    targetDistanceKm: number,
  ) => Promise<GenerateLoopCandidatesResult>;
  selectLoopAction: (candidate: LoopCandidate) => Promise<GenerateRouteResult>;
}) {
  const [mode, setMode] = useState<Mode>("upload");
  const [points, setPoints] = useState<Position[]>([]);
  const [targetKm, setTargetKm] = useState("40");
  const [candidates, setCandidates] = useState<LoopCandidate[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setPoints([]);
    setCandidates(null);
    setError(null);
  }

  function handleMapClick(lngLat: Position) {
    if (mode === "points") {
      const next = points.length >= 2 ? [lngLat] : [...points, lngLat];
      setPoints(next);
      if (next.length === 2) {
        setPending(true);
        setError(null);
        generatePointsAction(next[0], next[1]).then((res) => {
          setPending(false);
          if (res.error) setError(res.error);
        });
      }
    } else if (mode === "distance") {
      setPoints([lngLat]);
      setCandidates(null);
    }
  }

  async function handleGenerateLoops() {
    if (points.length === 0) {
      setError("Click a start point on the map first");
      return;
    }
    const km = Number(targetKm);
    if (!(km > 0)) {
      setError("Enter a valid target distance");
      return;
    }
    setPending(true);
    setError(null);
    setCandidates(null);
    const res = await generateLoopCandidatesAction(points[0], km);
    setPending(false);
    if (res.error !== null) setError(res.error);
    else setCandidates(res.candidates);
  }

  async function handleSelectCandidate(candidate: LoopCandidate) {
    setPending(true);
    setError(null);
    const res = await selectLoopAction(candidate);
    setPending(false);
    if (res.error) setError(res.error);
  }

  const previewLines: PreviewLine[] =
    mode === "distance" && candidates
      ? candidates.map((c, i) => ({
          id: String(i),
          coordinates: c.geojson.coordinates,
          color: CANDIDATE_COLORS[i % CANDIDATE_COLORS.length],
        }))
      : [];

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex gap-4 text-sm">
        <button
          onClick={() => switchMode("upload")}
          className={mode === "upload" ? "font-semibold underline" : "underline text-gray-500"}
        >
          Upload GPX
        </button>
        <button
          onClick={() => switchMode("points")}
          className={mode === "points" ? "font-semibold underline" : "underline text-gray-500"}
        >
          Click start &amp; finish
        </button>
        <button
          onClick={() => switchMode("distance")}
          className={mode === "distance" ? "font-semibold underline" : "underline text-gray-500"}
        >
          Start point + distance loop
        </button>
      </div>

      {mode === "upload" && <GpxUploadForm action={uploadAction} />}

      {mode === "points" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-500">
            Click a start point, then a finish point on the map.
          </p>
          <RouteInputMap markers={points} previewLines={[]} onClick={handleMapClick} />
          {pending && <p className="text-sm text-gray-500">Generating route…</p>}
        </div>
      )}

      {mode === "distance" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-500">
            Click a start point on the map, set a target distance, then generate loop
            options. Distances are approximate — pick whichever candidate looks best.
          </p>
          <RouteInputMap markers={points} previewLines={previewLines} onClick={handleMapClick} />
          <div className="flex gap-2 items-center">
            <input
              type="number"
              min={1}
              value={targetKm}
              onChange={(e) => setTargetKm(e.target.value)}
              className="border rounded px-3 py-2 w-24"
            />
            <span className="text-sm">km</span>
            <button
              type="button"
              onClick={handleGenerateLoops}
              disabled={pending}
              className="bg-black text-white rounded px-3 py-2 disabled:opacity-50"
            >
              {pending ? "Generating…" : "Generate loop options"}
            </button>
          </div>
          {candidates && (
            <ul className="flex flex-col gap-2">
              {candidates.map((c, i) => (
                <li
                  key={i}
                  className="border rounded px-3 py-2 flex justify-between items-center"
                >
                  <span style={{ color: CANDIDATE_COLORS[i % CANDIDATE_COLORS.length] }}>
                    Option {i + 1}: {c.totalDistanceKm.toFixed(1)} km
                    {c.elevationGainM != null && ` · ${c.elevationGainM} m gain`}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSelectCandidate(c)}
                    disabled={pending}
                    className="text-sm underline"
                  >
                    Use this route
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <p className="text-red-600 text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
