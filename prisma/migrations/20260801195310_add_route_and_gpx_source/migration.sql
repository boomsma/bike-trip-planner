-- CreateEnum
CREATE TYPE "RouteSource" AS ENUM ('imported_gpx', 'point_to_point', 'distance_target');

-- CreateTable
CREATE TABLE "routes" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "source" "RouteSource" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "geojson" JSONB NOT NULL,
    "total_distance_km" DOUBLE PRECISION NOT NULL,
    "elevation_gain_m" DOUBLE PRECISION,
    "elevation_profile" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gpx_sources" (
    "id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "original_filename" TEXT NOT NULL,
    "storage_url" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gpx_sources_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gpx_sources" ADD CONSTRAINT "gpx_sources_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security, mirroring the trip-membership access rules used for "trips".
alter table public.routes enable row level security;
alter table public.gpx_sources enable row level security;

create policy "members can read trip routes" on public.routes
  for select using (
    exists (
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
  );

create policy "members can manage trip routes" on public.routes
  for all using (
    exists (
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
  );

create policy "members can read gpx sources" on public.gpx_sources
  for select using (
    exists (
      select 1 from public.routes r
      join public.trips t on t.id = r.trip_id
      where r.id = route_id
        and (
          t.owner_id = auth.uid()
          or exists (
            select 1 from public.trip_memberships m
            where m.trip_id = t.id and m.user_id = auth.uid() and m.status = 'accepted'
          )
        )
    )
  );

create policy "members can manage gpx sources" on public.gpx_sources
  for all using (
    exists (
      select 1 from public.routes r
      join public.trips t on t.id = r.trip_id
      where r.id = route_id
        and (
          t.owner_id = auth.uid()
          or exists (
            select 1 from public.trip_memberships m
            where m.trip_id = t.id and m.user_id = auth.uid() and m.status = 'accepted' and m.role in ('owner', 'editor')
          )
        )
    )
  );
