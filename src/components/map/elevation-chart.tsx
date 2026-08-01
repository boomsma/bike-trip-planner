const WIDTH = 600;
const HEIGHT = 120;
const PADDING = 8;

export function ElevationChart({
  profile,
}: {
  profile: { distanceKm: number; elevationM: number }[];
}) {
  if (profile.length < 2) return null;

  const minEle = Math.min(...profile.map((p) => p.elevationM));
  const maxEle = Math.max(...profile.map((p) => p.elevationM));
  const maxDist = profile[profile.length - 1].distanceKm;
  const eleRange = Math.max(maxEle - minEle, 1);

  const points = profile
    .map((p) => {
      const x = PADDING + (p.distanceKm / maxDist) * (WIDTH - 2 * PADDING);
      const y =
        HEIGHT -
        PADDING -
        ((p.elevationM - minEle) / eleRange) * (HEIGHT - 2 * PADDING);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full h-auto border rounded"
      role="img"
      aria-label="Elevation profile"
    >
      <polyline points={points} fill="none" stroke="#e11d48" strokeWidth={2} />
      <text x={PADDING} y={14} fontSize={10} fill="currentColor">
        {Math.round(maxEle)}m
      </text>
      <text x={PADDING} y={HEIGHT - 2} fontSize={10} fill="currentColor">
        {Math.round(minEle)}m
      </text>
      <text
        x={WIDTH - PADDING}
        y={HEIGHT - 2}
        fontSize={10}
        fill="currentColor"
        textAnchor="end"
      >
        {maxDist.toFixed(1)}km
      </text>
    </svg>
  );
}
