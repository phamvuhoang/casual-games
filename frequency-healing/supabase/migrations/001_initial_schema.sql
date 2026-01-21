create extension if not exists "uuid-ossp";

create table if not exists profiles (
  id uuid references auth.users primary key,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists compositions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  title text not null,
  description text,
  frequencies integer[] not null,
  frequency_volumes jsonb,
  duration integer default 300,
  waveform text default 'sine',
  ambient_sound text,
  effects jsonb,
  visualization_type text,
  visualization_config jsonb,
  audio_url text,
  video_url text,
  thumbnail_url text,
  is_public boolean default true,
  play_count integer default 0,
  like_count integer default 0,
  tags text[],
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists composition_likes (
  id uuid primary key default uuid_generate_v4(),
  composition_id uuid references compositions(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique(composition_id, user_id)
);

create table if not exists comments (
  id uuid primary key default uuid_generate_v4(),
  composition_id uuid references compositions(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  content text not null,
  created_at timestamp with time zone default now()
);

create table if not exists collections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  description text,
  is_public boolean default false,
  created_at timestamp with time zone default now()
);

create table if not exists collection_items (
  collection_id uuid references collections(id) on delete cascade,
  composition_id uuid references compositions(id) on delete cascade,
  added_at timestamp with time zone default now(),
  primary key (collection_id, composition_id)
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_set_updated_at
before update on profiles
for each row execute function public.set_updated_at();

create trigger compositions_set_updated_at
before update on compositions
for each row execute function public.set_updated_at();

create index if not exists idx_compositions_user_id on compositions(user_id);
create index if not exists idx_compositions_created_at on compositions(created_at desc);
create index if not exists idx_compositions_public on compositions(is_public) where is_public = true;
create index if not exists idx_compositions_tags on compositions using gin(tags);
create index if not exists idx_likes_composition on composition_likes(composition_id);
create index if not exists idx_comments_composition on comments(composition_id);

alter table profiles enable row level security;
alter table compositions enable row level security;
alter table composition_likes enable row level security;
alter table comments enable row level security;
alter table collections enable row level security;
alter table collection_items enable row level security;

create policy "Public profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Public compositions are viewable by everyone"
  on compositions for select using (is_public = true or user_id = auth.uid());

create policy "Users can insert own compositions"
  on compositions for insert with check (auth.uid() = user_id);

create policy "Users can update own compositions"
  on compositions for update using (auth.uid() = user_id);

create policy "Users can delete own compositions"
  on compositions for delete using (auth.uid() = user_id);

create policy "Likes are viewable by everyone"
  on composition_likes for select using (true);

create policy "Users can like compositions"
  on composition_likes for insert with check (auth.uid() = user_id);

create policy "Users can remove own likes"
  on composition_likes for delete using (auth.uid() = user_id);

create policy "Comments are viewable by everyone"
  on comments for select using (true);

create policy "Users can add comments"
  on comments for insert with check (auth.uid() = user_id);

create policy "Users can update own comments"
  on comments for update using (auth.uid() = user_id);

create policy "Users can delete own comments"
  on comments for delete using (auth.uid() = user_id);

create policy "Collections are viewable by owner or public"
  on collections for select using (is_public = true or user_id = auth.uid());

create policy "Users can insert own collections"
  on collections for insert with check (auth.uid() = user_id);

create policy "Users can update own collections"
  on collections for update using (auth.uid() = user_id);

create policy "Users can delete own collections"
  on collections for delete using (auth.uid() = user_id);

create policy "Collection items are viewable by owner or public"
  on collection_items for select using (
    exists (
      select 1 from collections
      where collections.id = collection_items.collection_id
      and (collections.is_public = true or collections.user_id = auth.uid())
    )
  );

create policy "Users can add to own collections"
  on collection_items for insert with check (
    exists (
      select 1 from collections
      where collections.id = collection_items.collection_id
      and collections.user_id = auth.uid()
    )
  );

create policy "Users can remove from own collections"
  on collection_items for delete using (
    exists (
      select 1 from collections
      where collections.id = collection_items.collection_id
      and collections.user_id = auth.uid()
    )
  );
