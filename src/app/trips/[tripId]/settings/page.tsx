import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { TripDetailsForm } from "@/components/trip-details-form";
import { updateTripDetails } from "../actions";

export default async function TripSettingsPage({
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
  });

  if (!trip) {
    notFound();
  }

  const boundUpdateTripDetails = updateTripDetails.bind(null, tripId);

  return (
    <main className="flex flex-col gap-8 p-8 max-w-3xl mx-auto">
      <div>
        <Link href={`/trips/${tripId}`} className="text-sm underline">
          ← {trip.name}
        </Link>
        <h1 className="text-2xl font-semibold mt-1">Trip settings</h1>
      </div>

      <TripDetailsForm
        action={boundUpdateTripDetails}
        initialNumCyclists={trip.numCyclists}
        initialStartDate={trip.startDate}
        initialEndDate={trip.endDate}
        initialNumDays={trip.numDays}
      />
    </main>
  );
}
