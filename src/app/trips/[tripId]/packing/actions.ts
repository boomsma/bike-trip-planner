"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { LineString } from "geojson";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { ensurePackingLists } from "@/lib/packing/ensure-lists";
import { getWeatherSummary } from "@/lib/weather/open-meteo";
import { reverseGeocodeCountry } from "@/lib/geocode/nominatim";
import { classifyTerrain, matchRules } from "@/lib/suggestions/engine";

async function requireTripAccess(tripId: string) {
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

export async function addCategory(tripId: string, listId: string, formData: FormData) {
  await requireTripAccess(tripId);

  const name = (formData.get("name") as string)?.trim();
  if (!name) return;

  const list = await prisma.packingList.findFirst({ where: { id: listId, tripId } });
  if (!list) return;

  const last = await prisma.packingCategory.findFirst({
    where: { packingListId: listId },
    orderBy: { orderIndex: "desc" },
  });

  await prisma.packingCategory.create({
    data: { packingListId: listId, name, orderIndex: (last?.orderIndex ?? -1) + 1 },
  });

  revalidatePath(`/trips/${tripId}/packing`);
}

export async function deleteCategory(tripId: string, categoryId: string) {
  await requireTripAccess(tripId);

  await prisma.packingCategory.deleteMany({
    where: { id: categoryId, packingList: { tripId } },
  });

  revalidatePath(`/trips/${tripId}/packing`);
}

export async function addItem(tripId: string, categoryId: string, formData: FormData) {
  const { userId } = await requireTripAccess(tripId);

  const name = (formData.get("name") as string)?.trim();
  if (!name) return;
  const quantity = Math.max(1, Number(formData.get("quantity")) || 1);

  const category = await prisma.packingCategory.findFirst({
    where: { id: categoryId, packingList: { tripId } },
  });
  if (!category) return;

  await prisma.packingItem.create({
    data: { categoryId, name, quantity, addedByUserId: userId },
  });

  revalidatePath(`/trips/${tripId}/packing`);
}

export async function toggleItem(tripId: string, itemId: string, isChecked: boolean) {
  await requireTripAccess(tripId);

  await prisma.packingItem.updateMany({
    where: { id: itemId, category: { packingList: { tripId } } },
    data: { isChecked },
  });

  revalidatePath(`/trips/${tripId}/packing`);
}

export async function deleteItem(tripId: string, itemId: string) {
  await requireTripAccess(tripId);

  await prisma.packingItem.deleteMany({
    where: { id: itemId, category: { packingList: { tripId } } },
  });

  revalidatePath(`/trips/${tripId}/packing`);
}

export type GenerateSuggestionsResult = {
  error: string | null;
  addedCount?: number;
  weatherSource?: "forecast" | "historical-average" | null;
};

export async function generatePackingSuggestions(
  tripId: string,
): Promise<GenerateSuggestionsResult> {
  const { userId, trip } = await requireTripAccess(tripId);

  const route = await prisma.route.findFirst({ where: { tripId, isActive: true } });
  if (!route) {
    return { error: "Add a route first so suggestions can be based on terrain and location" };
  }

  const coords = (route.geojson as unknown as LineString).coordinates;
  const [lon, lat] = coords[0];

  let countries = route.countries;
  if (countries.length === 0) {
    const country = await reverseGeocodeCountry(lat, lon).catch(() => null);
    countries = country ? [country] : [];
    if (countries.length > 0) {
      await prisma.route.update({ where: { id: route.id }, data: { countries } });
    }
  }

  const terrain = classifyTerrain(route.elevationGainM, route.totalDistanceKm);

  let weatherSource: "forecast" | "historical-average" | null = null;
  let likelyRain = false;
  let coldNights = false;
  let hotDays = false;

  if (trip.startDate) {
    const numDays = trip.endDate
      ? Math.round((trip.endDate.getTime() - trip.startDate.getTime()) / 86_400_000) + 1
      : (trip.numDays ?? 3);
    try {
      const weather = await getWeatherSummary(lat, lon, trip.startDate, numDays);
      weatherSource = weather.source;
      likelyRain = weather.likelyRain;
      coldNights = weather.coldNights;
      hotDays = weather.hotDays;
    } catch {
      // Weather is a nice-to-have here — terrain/country suggestions should
      // still work if the weather API has a hiccup.
    }
  }

  const rules = await prisma.packingSuggestionRule.findMany();
  const matched = matchRules(rules, { likelyRain, coldNights, hotDays, terrain, countries });

  if (matched.length === 0) {
    return { error: null, addedCount: 0, weatherSource };
  }

  const { shared } = await ensurePackingLists(tripId, userId);
  const existingNames = new Set(
    shared.categories.flatMap((c) => c.items.map((i) => i.name.toLowerCase())),
  );

  let addedCount = 0;
  for (const item of matched) {
    if (existingNames.has(item.itemName.toLowerCase())) continue;

    let category = shared.categories.find((c) => c.name === item.categoryName);
    if (!category) {
      const lastIndex = shared.categories.reduce((max, c) => Math.max(max, c.orderIndex), -1);
      const created = await prisma.packingCategory.create({
        data: { packingListId: shared.id, name: item.categoryName, orderIndex: lastIndex + 1 },
      });
      category = { ...created, items: [] };
      shared.categories.push(category);
    }

    await prisma.packingItem.create({
      data: {
        categoryId: category.id,
        name: item.itemName,
        isSuggested: true,
        suggestionReason: item.reason,
        addedByUserId: userId,
      },
    });
    existingNames.add(item.itemName.toLowerCase());
    addedCount++;
  }

  revalidatePath(`/trips/${tripId}/packing`);
  return { error: null, addedCount, weatherSource };
}
