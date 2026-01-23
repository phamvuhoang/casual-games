create or replace function public.increment_play_count(composition_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  update compositions
  set play_count = coalesce(play_count, 0) + 1
  where id = composition_id
    and (is_public = true or user_id = auth.uid())
  returning play_count into next_count;

  return next_count;
end;
$$;

grant execute on function public.increment_play_count(uuid) to anon, authenticated;
