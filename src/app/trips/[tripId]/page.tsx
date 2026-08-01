import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { LineString } from "geojson";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { RouteBuilder } from "@/components/route-builder";
import { RouteMap } from "@/components/map/route-map";
import { ElevationChart } from "@/components/map/elevation-chart";
import {
  generateDistanceLoopCandidatesAction,
  generateRouteBetweenPoints,
  selectDistanceLoop,
  uploadGpx,
} from "./actions";

const SOURCE_LABEL: Record<string, string> = {
  imported_gpx: "Imported GPX",
  point_to_point: "Generated route",
  distance_target: "Generated loop",
};

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const trip = await prisma.trip.findFirst({
    where: { id: tripId, ownerId: user.id },
    include: {
      routes: {
        where: { isActive: true },
        include: { gpxSources: true },
        take: 1,
      },
    },
  });

  if (!trip) {
    notFound();
  }

  const activeRoute = trip.routes[0] ?? null;

  const boundUploadGpx = uploadGpx.bind(null, tripId);
  const boundGeneratePoints = generateRouteBetweenPoints.bind(null, tripId);
  const boundGenerateLoopCandidates = generateDistanceLoopCandidatesAction.bind(null, tripId);
  const boundSelectLoop = selectDistanceLoop.bind(null, tripId);

  return (
    <main className="flex flex-col gap-8 p-8 max-w-3xl mx-auto">
      <div>
        <Link href="/trips" className="text-sm underline">
          ← Your trips
        </Link>
        <h1 className="text-2xl font-semibold mt-1">{trip.name}</h1>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Route</h2>
        <RouteBuilder
          uploadAction={boundUploadGpx}
          generatePointsAction={boundGeneratePoints}
          generateLoopCandidatesAction={boundGenerateLoopCandidates}
          selectLoopAction={boundSelectLoop}
        />

        {activeRoute && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-500">
              {activeRoute.totalDistanceKm.toFixed(1)} km
              {activeRoute.elevationGainM != null &&
                ` · ${Math.round(activeRoute.elevationGainM)} m elevation gain`}{" "}
              ·{" "}
              {activeRoute.gpxSources.length > 0
                ? `from ${activeRoute.gpxSources.map((s) => s.originalFilename).join(", ")}`
                : SOURCE_LABEL[activeRoute.source] ?? activeRoute.source}
            </p>
            <RouteMap geojson={activeRoute.geojson as unknown as LineString} />
            {activeRoute.elevationProfile != null && (
              <ElevationChart
                profile={
                  activeRoute.elevationProfile as unknown as {
                    distanceKm: number;
                    elevationM: number;
                  }[]
                }
              />
            )}
          </div>
        )}
      </section>
    </main>
  );
}
