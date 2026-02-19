create table if not exists public.room_scans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  composition_id uuid references public.compositions(id) on delete set null,
  mode text not null,
  dominant_frequencies jsonb not null,
  spectrum jsonb,
  confidence numeric,
  noise_floor_db numeric,
  peak_db numeric,
  created_at timestamp with time zone default now()
);

create index if not exists idx_room_scans_user_created
  on public.room_scans(user_id, created_at desc);

create index if not exists idx_room_scans_composition
  on public.room_scans(composition_id);

alter table if exists public.room_scans enable row level security;

drop policy if exists "Room scans are viewable by owner" on public.room_scans;
create policy "Room scans are viewable by owner"
  on public.room_scans
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own room scans" on public.room_scans;
create policy "Users can insert own room scans"
  on public.room_scans
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own room scans" on public.room_scans;
create policy "Users can update own room scans"
  on public.room_scans
  for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own room scans" on public.room_scans;
create policy "Users can delete own room scans"
  on public.room_scans
  for delete
  using (auth.uid() = user_id);

