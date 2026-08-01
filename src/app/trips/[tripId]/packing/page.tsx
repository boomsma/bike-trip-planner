import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { ensurePackingLists } from "@/lib/packing/ensure-lists";
import { PackingListView } from "@/components/packing/packing-list-view";
import { addCategory, addItem, deleteCategory, deleteItem, toggleItem } from "./actions";

export default async function PackingPage({
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

  const trip = await prisma.trip.findFirst({ where: { id: tripId, ownerId: user.id } });
  if (!trip) {
    notFound();
  }

  const { shared, personal } = await ensurePackingLists(tripId, user.id);

  const boundAddCategory = addCategory.bind(null, tripId);
  const boundDeleteCategory = deleteCategory.bind(null, tripId);
  const boundAddItem = addItem.bind(null, tripId);
  const boundToggleItem = toggleItem.bind(null, tripId);
  const boundDeleteItem = deleteItem.bind(null, tripId);

  return (
    <main className="flex flex-col gap-8 p-8 max-w-3xl mx-auto">
      <div>
        <Link href={`/trips/${tripId}`} className="text-sm underline">
          ← {trip.name}
        </Link>
        <h1 className="text-2xl font-semibold mt-1">Packing list</h1>
      </div>

      <div className="flex flex-col gap-6">
        <PackingListView
          title="Shared gear"
          listId={shared.id}
          categories={shared.categories}
          addCategoryAction={boundAddCategory}
          deleteCategoryAction={boundDeleteCategory}
          addItemAction={boundAddItem}
          toggleItemAction={boundToggleItem}
          deleteItemAction={boundDeleteItem}
        />
        <PackingListView
          title="Your personal list"
          listId={personal.id}
          categories={personal.categories}
          addCategoryAction={boundAddCategory}
          deleteCategoryAction={boundDeleteCategory}
          addItemAction={boundAddItem}
          toggleItemAction={boundToggleItem}
          deleteItemAction={boundDeleteItem}
        />
      </div>
    </main>
  );
}
