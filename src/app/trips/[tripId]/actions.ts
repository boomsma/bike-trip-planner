"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mergeGpxFiles } from "@/lib/gpx/parse";

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

  await prisma.$transaction(async (tx) => {
    await tx.route.updateMany({
      where: { tripId, isActive: true },
      data: { isActive: false },
    });

    await tx.route.create({
      data: {
        id: routeId,
        tripId,
        source: "imported_gpx",
        isActive: true,
        geojson: merged.geojson as unknown as Prisma.InputJsonValue,
        totalDistanceKm: merged.totalDistanceKm,
        elevationGainM: merged.elevationGainM,
        elevationProfile: (merged.elevationProfile ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        gpxSources: {
          create: files.map((file, i) => ({
            originalFilename: file.name,
            storageUrl: uploadedPaths[i],
          })),
        },
      },
    });
  });

  revalidatePath(`/trips/${tripId}`);

  const warning =
    merged.maxSegmentGapKm > GAP_WARNING_THRESHOLD_KM
      ? `Note: had to bridge a ${merged.maxSegmentGapKm.toFixed(1)} km gap between two track segments — double check these files belong to the same continuous route.`
      : null;

  return { error: null, warning };
}
