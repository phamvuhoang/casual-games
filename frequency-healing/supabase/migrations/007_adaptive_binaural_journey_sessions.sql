create table if not exists public.journey_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  composition_id uuid references public.compositions(id) on delete set null,
  intent text not null,
  current_state text,
  progress numeric,
  last_beat_hz numeric,
  last_breath_bpm numeric,
  adaptive_offset_hz numeric,
  duration_minutes integer,
  mic_adaptation_enabled boolean default false,
  created_at timestamp with time zone default now()
);

create index if not exists idx_journey_sessions_user_created
  on public.journey_sessions(user_id, created_at desc);

create index if not exists idx_journey_sessions_composition
  on public.journey_sessions(composition_id);

alter table if exists public.journey_sessions enable row level security;

drop policy if exists "Journey sessions are viewable by owner" on public.journey_sessions;
create policy "Journey sessions are viewable by owner"
  on public.journey_sessions
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own journey sessions" on public.journey_sessions;
create policy "Users can insert own journey sessions"
  on public.journey_sessions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own journey sessions" on public.journey_sessions;
create policy "Users can update own journey sessions"
  on public.journey_sessions
  for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own journey sessions" on public.journey_sessions;
create policy "Users can delete own journey sessions"
  on public.journey_sessions
  for delete
  using (auth.uid() = user_id);

