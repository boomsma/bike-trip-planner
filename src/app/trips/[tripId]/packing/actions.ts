"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

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
