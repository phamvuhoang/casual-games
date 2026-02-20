create table if not exists public.harmonic_field_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  composition_id uuid references public.compositions(id) on delete set null,
  preset_id text not null,
  layer_frequencies jsonb not null,
  interference_frequencies jsonb,
  intensity numeric,
  include_interference boolean default true,
  spatial_motion_enabled boolean default false,
  motion_speed numeric,
  created_at timestamp with time zone default now()
);

create index if not exists idx_harmonic_field_sessions_user_created
  on public.harmonic_field_sessions(user_id, created_at desc);

create index if not exists idx_harmonic_field_sessions_composition
  on public.harmonic_field_sessions(composition_id);

create index if not exists idx_harmonic_field_sessions_preset
  on public.harmonic_field_sessions(preset_id);

alter table if exists public.harmonic_field_sessions enable row level security;

drop policy if exists "Harmonic field sessions are viewable by owner" on public.harmonic_field_sessions;
create policy "Harmonic field sessions are viewable by owner"
  on public.harmonic_field_sessions
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own harmonic field sessions" on public.harmonic_field_sessions;
create policy "Users can insert own harmonic field sessions"
  on public.harmonic_field_sessions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own harmonic field sessions" on public.harmonic_field_sessions;
create policy "Users can update own harmonic field sessions"
  on public.harmonic_field_sessions
  for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own harmonic field sessions" on public.harmonic_field_sessions;
create policy "Users can delete own harmonic field sessions"
  on public.harmonic_field_sessions
  for delete
  using (auth.uid() = user_id);
