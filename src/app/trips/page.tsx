import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { createTrip, deleteTrip } from "./actions";

export default async function TripsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const trips = await prisma.trip.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="flex flex-col items-center gap-8 p-8 max-w-lg mx-auto">
      <div className="w-full flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Your trips</h1>
        <form action={logout}>
          <button type="submit" className="text-sm underline">
            Log out
          </button>
        </form>
      </div>

      <form action={createTrip} className="w-full flex gap-2">
        <input
          type="text"
          name="name"
          placeholder="e.g. Alps loop, 2027"
          required
          className="border rounded px-3 py-2 flex-1"
        />
        <button type="submit" className="bg-black text-white rounded px-3 py-2">
          Create trip
        </button>
      </form>

      <ul className="w-full flex flex-col gap-2">
        {trips.length === 0 && (
          <li className="text-sm text-gray-500">No trips yet — create one above.</li>
        )}
        {trips.map((trip) => (
          <li
            key={trip.id}
            className="border rounded px-3 py-2 flex justify-between items-center"
          >
            <Link href={`/trips/${trip.id}`} className="underline">
              {trip.name}
            </Link>
            <form
              action={async () => {
                "use server";
                await deleteTrip(trip.id);
              }}
            >
              <button type="submit" className="text-sm text-red-600 underline">
                Delete
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
