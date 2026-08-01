import { prisma } from "@/lib/db";

const packingListInclude = {
  categories: {
    orderBy: { orderIndex: "asc" as const },
    include: { items: { orderBy: { createdAt: "asc" as const } } },
  },
};

/**
 * Lazily creates a trip's shared list and the current user's personal list
 * the first time either is needed, rather than at trip-creation time.
 *
 * Note: the shared list isn't protected by a DB-level uniqueness guarantee —
 * Postgres treats every NULL as distinct, so a compound unique constraint
 * including the nullable owner_user_id column can't prevent two concurrent
 * requests from both creating one. Acceptable for now (single-user usage);
 * revisit with a partial unique index (WHERE owner_user_id IS NULL) if
 * concurrent creation ever becomes a real scenario.
 */
export async function ensurePackingLists(tripId: string, userId: string) {
  let shared = await prisma.packingList.findFirst({
    where: { tripId, scope: "shared" },
    include: packingListInclude,
  });
  if (!shared) {
    shared = await prisma.packingList.create({
      data: { tripId, scope: "shared" },
      include: packingListInclude,
    });
  }

  const personal = await prisma.packingList.upsert({
    where: {
      tripId_scope_ownerUserId: { tripId, scope: "personal", ownerUserId: userId },
    },
    update: {},
    create: { tripId, scope: "personal", ownerUserId: userId },
    include: packingListInclude,
  });

  return { shared, personal };
}
