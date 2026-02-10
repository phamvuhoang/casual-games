alter table if exists public.compositions
  add column if not exists audio_config jsonb,
  add column if not exists visualization_layers jsonb;

create index if not exists idx_compositions_audio_config_gin
  on public.compositions
  using gin (audio_config jsonb_path_ops);

create index if not exists idx_compositions_visualization_layers_gin
  on public.compositions
  using gin (visualization_layers jsonb_path_ops);
