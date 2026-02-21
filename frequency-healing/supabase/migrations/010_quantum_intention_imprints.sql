create table if not exists public.intention_imprints (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  composition_id uuid references public.compositions(id) on delete set null,
  intention_text text not null,
  mapping jsonb not null,
  extracted_keywords text[] not null default '{}',
  mapped_frequencies jsonb not null,
  mapping_confidence numeric,
  modulation_rate_hz numeric,
  modulation_depth_hz numeric,
  ritual_intensity numeric,
  certificate_seed text,
  created_at timestamp with time zone default now()
);

create index if not exists idx_intention_imprints_user_created
  on public.intention_imprints(user_id, created_at desc);

create index if not exists idx_intention_imprints_composition
  on public.intention_imprints(composition_id);

create index if not exists idx_intention_imprints_mapping_gin
  on public.intention_imprints using gin (mapping jsonb_path_ops);

create index if not exists idx_intention_imprints_keywords_gin
  on public.intention_imprints using gin (extracted_keywords);

alter table if exists public.intention_imprints enable row level security;

drop policy if exists "Intention imprints are viewable by owner" on public.intention_imprints;
create policy "Intention imprints are viewable by owner"
  on public.intention_imprints
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own intention imprints" on public.intention_imprints;
create policy "Users can insert own intention imprints"
  on public.intention_imprints
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own intention imprints" on public.intention_imprints;
create policy "Users can update own intention imprints"
  on public.intention_imprints
  for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own intention imprints" on public.intention_imprints;
create policy "Users can delete own intention imprints"
  on public.intention_imprints
  for delete
  using (auth.uid() = user_id);
