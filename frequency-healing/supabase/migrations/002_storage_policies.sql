insert into storage.buckets (id, name, public)
values
  ('frequency-audio', 'frequency-audio', true),
  ('frequency-video', 'frequency-video', true),
  ('frequency-thumbnails', 'frequency-thumbnails', true)
on conflict (id) do nothing;

drop policy if exists "Public read frequency audio" on storage.objects;
drop policy if exists "Public read frequency video" on storage.objects;
drop policy if exists "Public read frequency thumbnails" on storage.objects;
drop policy if exists "Authenticated upload frequency audio" on storage.objects;
drop policy if exists "Authenticated upload frequency video" on storage.objects;
drop policy if exists "Authenticated upload frequency thumbnails" on storage.objects;
drop policy if exists "Authenticated delete frequency audio" on storage.objects;
drop policy if exists "Authenticated delete frequency video" on storage.objects;
drop policy if exists "Authenticated delete frequency thumbnails" on storage.objects;

create policy "Public read frequency audio"
  on storage.objects for select
  using (bucket_id = 'frequency-audio');

create policy "Public read frequency video"
  on storage.objects for select
  using (bucket_id = 'frequency-video');

create policy "Public read frequency thumbnails"
  on storage.objects for select
  using (bucket_id = 'frequency-thumbnails');

create policy "Authenticated upload frequency audio"
  on storage.objects for insert
  with check (
    bucket_id = 'frequency-audio'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Authenticated upload frequency video"
  on storage.objects for insert
  with check (
    bucket_id = 'frequency-video'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Authenticated upload frequency thumbnails"
  on storage.objects for insert
  with check (
    bucket_id = 'frequency-thumbnails'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Authenticated delete frequency audio"
  on storage.objects for delete
  using (
    bucket_id = 'frequency-audio'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Authenticated delete frequency video"
  on storage.objects for delete
  using (
    bucket_id = 'frequency-video'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Authenticated delete frequency thumbnails"
  on storage.objects for delete
  using (
    bucket_id = 'frequency-thumbnails'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
