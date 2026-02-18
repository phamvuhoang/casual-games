alter table if exists public.compositions
  add column if not exists innovation_config jsonb,
  add column if not exists innovation_flags text[],
  add column if not exists scientific_disclaimer_ack boolean default false,
  add column if not exists voice_profile_id uuid;

create table if not exists public.voice_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  profile jsonb not null,
  confidence numeric,
  capture_duration_ms integer,
  analysis_duration_ms integer,
  created_at timestamp with time zone default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'compositions_voice_profile_id_fkey'
  ) then
    alter table public.compositions
      add constraint compositions_voice_profile_id_fkey
      foreign key (voice_profile_id)
      references public.voice_profiles(id)
      on delete set null;
  end if;
end
$$;

create index if not exists idx_compositions_innovation_config_gin
  on public.compositions using gin (innovation_config jsonb_path_ops);

create index if not exists idx_compositions_innovation_flags_gin
  on public.compositions using gin (innovation_flags);

create index if not exists idx_voice_profiles_user_created
  on public.voice_profiles(user_id, created_at desc);

alter table if exists public.voice_profiles enable row level security;

drop policy if exists "Voice profiles are viewable by owner" on public.voice_profiles;
create policy "Voice profiles are viewable by owner"
  on public.voice_profiles
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own voice profiles" on public.voice_profiles;
create policy "Users can insert own voice profiles"
  on public.voice_profiles
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own voice profiles" on public.voice_profiles;
create policy "Users can update own voice profiles"
  on public.voice_profiles
  for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own voice profiles" on public.voice_profiles;
create policy "Users can delete own voice profiles"
  on public.voice_profiles
  for delete
  using (auth.uid() = user_id);
