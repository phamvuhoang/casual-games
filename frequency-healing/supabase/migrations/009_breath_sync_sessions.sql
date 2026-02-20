create table if not exists public.breath_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  composition_id uuid references public.compositions(id) on delete set null,
  mode text not null,
  target_bpm numeric,
  average_breath_bpm numeric,
  coherence_score numeric,
  peak_coherence_score numeric,
  time_in_coherence_pct numeric,
  inhale_ratio numeric,
  sensitivity numeric,
  calibration_noise_floor_db numeric,
  sample_count integer,
  created_at timestamp with time zone default now()
);

create index if not exists idx_breath_sessions_user_created
  on public.breath_sessions(user_id, created_at desc);

create index if not exists idx_breath_sessions_composition
  on public.breath_sessions(composition_id);

alter table if exists public.breath_sessions enable row level security;

drop policy if exists "Breath sessions are viewable by owner" on public.breath_sessions;
create policy "Breath sessions are viewable by owner"
  on public.breath_sessions
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own breath sessions" on public.breath_sessions;
create policy "Users can insert own breath sessions"
  on public.breath_sessions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own breath sessions" on public.breath_sessions;
create policy "Users can update own breath sessions"
  on public.breath_sessions
  for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own breath sessions" on public.breath_sessions;
create policy "Users can delete own breath sessions"
  on public.breath_sessions
  for delete
  using (auth.uid() = user_id);
