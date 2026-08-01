"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma, RouteSource } from "@prisma/client";
import type { LineString, Position } from "geojson";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mergeGpxFiles } from "@/lib/gpx/parse";
import {
  generateDistanceLoopCandidates,
  generatePointToPointRoute,
  type GeneratedRoute,
} from "@/lib/routing/ors";

export type UploadGpxState = { error: string | null; warning?: string | null };

const GAP_WARNING_THRESHOLD_KM = 1;

async function requireTripOwner(tripId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const trip = await prisma.trip.findFirst({
    where: { id: tripId, ownerId: user.id },
  });

  if (!trip) {
    throw new Error("Trip not found");
  }

  return { userId: user.id, trip };
}

async function persistActiveRoute(params: {
  tripId: string;
  source: RouteSource;
  geojson: LineString;
  totalDistanceKm: number;
  elevationGainM: number | null;
  elevationProfile: { distanceKm: number; elevationM: number }[] | null;
  gpxSources?: { originalFilename: string; storageUrl: string }[];
  /** Reuse a pre-generated id — needed when other work (e.g. storage upload
   * paths) already depends on knowing the id before the DB row is created. */
  routeId?: string;
}) {
  const routeId = params.routeId ?? randomUUID();

  await prisma.$transaction(async (tx) => {
    await tx.route.updateMany({
      where: { tripId: params.tripId, isActive: true },
      data: { isActive: false },
    });

    await tx.route.create({
      data: {
        id: routeId,
        tripId: params.tripId,
        source: params.source,
        isActive: true,
        geojson: params.geojson as unknown as Prisma.InputJsonValue,
        totalDistanceKm: params.totalDistanceKm,
        elevationGainM: params.elevationGainM,
        elevationProfile: (params.elevationProfile ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        ...(params.gpxSources && { gpxSources: { create: params.gpxSources } }),
      },
    });
  });

  revalidatePath(`/trips/${params.tripId}`);
  return routeId;
}

export async function uploadGpx(
  tripId: string,
  _prevState: UploadGpxState,
  formData: FormData,
): Promise<UploadGpxState> {
  await requireTripOwner(tripId);

  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length === 0) {
    return { error: "Choose at least one .gpx file" };
  }

  let merged;
  try {
    const xmlContents = await Promise.all(files.map((f) => f.text()));
    merged = mergeGpxFiles(xmlContents);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not parse GPX file(s)" };
  }

  const routeId = randomUUID();
  const admin = createAdminClient();

  const uploadedPaths: string[] = [];
  for (const file of files) {
    const path = `${tripId}/${routeId}/${file.name}`;
    const { error: uploadError } = await admin.storage
      .from("gpx-files")
      .upload(path, await file.arrayBuffer(), {
        contentType: "application/gpx+xml",
        upsert: false,
      });

    if (uploadError) {
      return { error: `Upload failed: ${uploadError.message}` };
    }
    uploadedPaths.push(path);
  }

  await persistActiveRoute({
    tripId,
    routeId,
    source: "imported_gpx",
    geojson: merged.geojson,
    totalDistanceKm: merged.totalDistanceKm,
    elevationGainM: merged.elevationGainM,
    elevationProfile: merged.elevationProfile,
    gpxSources: files.map((file, i) => ({
      originalFilename: file.name,
      storageUrl: uploadedPaths[i],
    })),
  });

  const warning =
    merged.maxSegmentGapKm > GAP_WARNING_THRESHOLD_KM
      ? `Note: had to bridge a ${merged.maxSegmentGapKm.toFixed(1)} km gap between two track segments — double check these files belong to the same continuous route.`
      : null;

  return { error: null, warning };
}

export type GenerateRouteResult = { error: string | null };

export async function generateRouteBetweenPoints(
  tripId: string,
  start: Position,
  end: Position,
): Promise<GenerateRouteResult> {
  await requireTripOwner(tripId);

  let route: GeneratedRoute;
  try {
    route = await generatePointToPointRoute(start, end);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not generate route" };
  }

  await persistActiveRoute({
    tripId,
    source: "point_to_point",
    geojson: route.geojson,
    totalDistanceKm: route.totalDistanceKm,
    elevationGainM: route.elevationGainM,
    elevationProfile: route.elevationProfile,
  });

  return { error: null };
}

export type LoopCandidate = GeneratedRoute;

export type GenerateLoopCandidatesResult =
  | { error: string; candidates?: undefined }
  | { error: null; candidates: LoopCandidate[] };

export async function generateDistanceLoopCandidatesAction(
  tripId: string,
  start: Position,
  targetDistanceKm: number,
): Promise<GenerateLoopCandidatesResult> {
  await requireTripOwner(tripId);

  if (!(targetDistanceKm > 0)) {
    return { error: "Enter a target distance greater than 0" };
  }

  try {
    const candidates = await generateDistanceLoopCandidates(start, targetDistanceKm);
    return { error: null, candidates };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not generate loop candidates" };
  }
}

export async function selectDistanceLoop(
  tripId: string,
  candidate: LoopCandidate,
): Promise<GenerateRouteResult> {
  await requireTripOwner(tripId);

  await persistActiveRoute({
    tripId,
    source: "distance_target",
    geojson: candidate.geojson,
    totalDistanceKm: candidate.totalDistanceKm,
    elevationGainM: candidate.elevationGainM,
    elevationProfile: candidate.elevationProfile,
  });

  return { error: null };
}

export type UpdateTripDetailsState = { error: string | null };

export async function updateTripDetails(
  tripId: string,
  _prevState: UpdateTripDetailsState,
  formData: FormData,
): Promise<UpdateTripDetailsState> {
  await requireTripOwner(tripId);

  const numCyclists = Number(formData.get("numCyclists"));
  if (!Number.isInteger(numCyclists) || numCyclists < 1) {
    return { error: "Number of cyclists must be at least 1" };
  }

  const planningMode = formData.get("planningMode");

  let startDate: Date | null = null;
  let endDate: Date | null = null;
  let numDays: number | null = null;

  if (planningMode === "dates") {
    const startRaw = formData.get("startDate");
    const endRaw = formData.get("endDate");
    if (!startRaw || !endRaw) {
      return { error: "Enter both a start and end date" };
    }
    startDate = new Date(startRaw as string);
    endDate = new Date(endRaw as string);
    if (endDate < startDate) {
      return { error: "End date must be on or after the start date" };
    }
  } else {
    const numDaysRaw = Number(formData.get("numDays"));
    if (!Number.isInteger(numDaysRaw) || numDaysRaw < 1) {
      return { error: "Number of days must be at least 1" };
    }
    numDays = numDaysRaw;
  }

  await prisma.trip.update({
    where: { id: tripId },
    data: { numCyclists, startDate, endDate, numDays },
  });

  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/settings`);

  return { error: null };
}
