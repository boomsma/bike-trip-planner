-- Auto-create a profiles row whenever a new user signs up via Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Row Level Security: users can only see/edit their own profile and trips they belong to.
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_memberships enable row level security;

create policy "profiles are self-readable" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles are self-updatable" on public.profiles
  for update using (auth.uid() = id);

create policy "members can read their trips" on public.trips
  for select using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.trip_memberships m
      where m.trip_id = trips.id and m.user_id = auth.uid() and m.status = 'accepted'
    )
  );

create policy "owners can insert trips" on public.trips
  for insert with check (owner_id = auth.uid());

create policy "owners can update their trips" on public.trips
  for update using (owner_id = auth.uid());

create policy "owners can delete their trips" on public.trips
  for delete using (owner_id = auth.uid());

create policy "members can read their memberships" on public.trip_memberships
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())
  );

create policy "owners can manage memberships" on public.trip_memberships
  for all using (
    exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())
  );
