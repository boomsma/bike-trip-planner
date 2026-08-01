"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return user.id;
}

export async function createTrip(formData: FormData) {
  const ownerId = await requireUserId();
  const name = (formData.get("name") as string)?.trim();

  if (!name) {
    return;
  }

  await prisma.trip.create({
    data: { name, ownerId },
  });

  revalidatePath("/trips");
}

export async function deleteTrip(tripId: string) {
  const ownerId = await requireUserId();

  await prisma.trip.deleteMany({
    where: { id: tripId, ownerId },
  });

  revalidatePath("/trips");
}
