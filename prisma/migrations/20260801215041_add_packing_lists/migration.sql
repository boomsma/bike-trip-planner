-- CreateEnum
CREATE TYPE "PackingListScope" AS ENUM ('shared', 'personal');

-- CreateTable
CREATE TABLE "packing_lists" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "scope" "PackingListScope" NOT NULL,
    "owner_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "packing_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packing_categories" (
    "id" UUID NOT NULL,
    "packing_list_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "packing_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packing_items" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "is_checked" BOOLEAN NOT NULL DEFAULT false,
    "is_suggested" BOOLEAN NOT NULL DEFAULT false,
    "suggestion_reason" TEXT,
    "added_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "packing_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "packing_lists_trip_id_scope_owner_user_id_key" ON "packing_lists"("trip_id", "scope", "owner_user_id");

-- AddForeignKey
ALTER TABLE "packing_lists" ADD CONSTRAINT "packing_lists_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_lists" ADD CONSTRAINT "packing_lists_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_categories" ADD CONSTRAINT "packing_categories_packing_list_id_fkey" FOREIGN KEY ("packing_list_id") REFERENCES "packing_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_items" ADD CONSTRAINT "packing_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "packing_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_items" ADD CONSTRAINT "packing_items_added_by_user_id_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security, mirroring the trip-membership access rules used elsewhere.
-- A packing list is visible if: it's the "shared" list for a trip the user
-- owns/is an accepted member of, OR it's a "personal" list owned by the user.
alter table public.packing_lists enable row level security;
alter table public.packing_categories enable row level security;
alter table public.packing_items enable row level security;

create policy "members can read packing lists" on public.packing_lists
  for select using (
    owner_user_id = auth.uid()
    or (
      scope = 'shared' and exists (
        select 1 from public.trips t
        where t.id = trip_id
          and (
            t.owner_id = auth.uid()
            or exists (
              select 1 from public.trip_memberships m
              where m.trip_id = t.id and m.user_id = auth.uid() and m.status = 'accepted'
            )
          )
      )
    )
  );

create policy "members can manage packing lists" on public.packing_lists
  for all using (
    owner_user_id = auth.uid()
    or (
      scope = 'shared' and exists (
        select 1 from public.trips t
        where t.id = trip_id
          and (
            t.owner_id = auth.uid()
            or exists (
              select 1 from public.trip_memberships m
              where m.trip_id = t.id and m.user_id = auth.uid() and m.status = 'accepted' and m.role in ('owner', 'editor')
            )
          )
      )
    )
  );

create policy "members can read packing categories" on public.packing_categories
  for select using (
    exists (
      select 1 from public.packing_lists pl
      where pl.id = packing_list_id
        and (
          pl.owner_user_id = auth.uid()
          or (
            pl.scope = 'shared' and exists (
              select 1 from public.trips t
              where t.id = pl.trip_id
                and (
                  t.owner_id = auth.uid()
                  or exists (
                    select 1 from public.trip_memberships m
                    where m.trip_id = t.id and m.user_id = auth.uid() and m.status = 'accepted'
                  )
                )
            )
          )
        )
    )
  );

create policy "members can manage packing categories" on public.packing_categories
  for all using (
    exists (
      select 1 from public.packing_lists pl
      where pl.id = packing_list_id
        and (
          pl.owner_user_id = auth.uid()
          or (
            pl.scope = 'shared' and exists (
              select 1 from public.trips t
              where t.id = pl.trip_id
                and (
                  t.owner_id = auth.uid()
                  or exists (
                    select 1 from public.trip_memberships m
                    where m.trip_id = t.id and m.user_id = auth.uid() and m.status = 'accepted' and m.role in ('owner', 'editor')
                  )
                )
            )
          )
        )
    )
  );

create policy "members can read packing items" on public.packing_items
  for select using (
    exists (
      select 1 from public.packing_categories c
      join public.packing_lists pl on pl.id = c.packing_list_id
      where c.id = category_id
        and (
          pl.owner_user_id = auth.uid()
          or (
            pl.scope = 'shared' and exists (
              select 1 from public.trips t
              where t.id = pl.trip_id
                and (
                  t.owner_id = auth.uid()
                  or exists (
                    select 1 from public.trip_memberships m
                    where m.trip_id = t.id and m.user_id = auth.uid() and m.status = 'accepted'
                  )
                )
            )
          )
        )
    )
  );

create policy "members can manage packing items" on public.packing_items
  for all using (
    exists (
      select 1 from public.packing_categories c
      join public.packing_lists pl on pl.id = c.packing_list_id
      where c.id = category_id
        and (
          pl.owner_user_id = auth.uid()
          or (
            pl.scope = 'shared' and exists (
              select 1 from public.trips t
              where t.id = pl.trip_id
                and (
                  t.owner_id = auth.uid()
                  or exists (
                    select 1 from public.trip_memberships m
                    where m.trip_id = t.id and m.user_id = auth.uid() and m.status = 'accepted' and m.role in ('owner', 'editor')
                  )
                )
            )
          )
        )
    )
  );
