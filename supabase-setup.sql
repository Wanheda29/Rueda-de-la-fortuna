-- Local preparation only. Review LOCAL-TESTING.md before applying.
-- No app script executes this file. Back up the database first.
begin;
create table if not exists public.wheels (
  id text primary key,
  name text not null,
  config_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wheels add column if not exists owner_id uuid references auth.users(id);
alter table public.wheels enable row level security;

drop policy if exists "Public wheels can be read" on public.wheels;
drop policy if exists "Shared wheels are readable" on public.wheels;
create policy "Shared wheels are readable"
on public.wheels
for select
to anon, authenticated
using (true);

drop policy if exists "Public wheels can be created" on public.wheels;
drop policy if exists "Editors create own wheels" on public.wheels;
create policy "Editors create own wheels"
on public.wheels
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "Public wheels can be updated" on public.wheels;
drop policy if exists "Editors update own wheels" on public.wheels;
create policy "Editors update own wheels"
on public.wheels
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

insert into storage.buckets (id, name, public)
values ('wheel-images', 'wheel-images', true)
on conflict (id) do nothing;

drop policy if exists "Public wheel images can be read" on storage.objects;
drop policy if exists "Wheel images are readable" on storage.objects;
create policy "Wheel images are readable"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'wheel-images');

drop policy if exists "Public wheel images can be uploaded" on storage.objects;
drop policy if exists "Editors upload own images" on storage.objects;
create policy "Editors upload own images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'wheel-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Public wheel images can be updated" on storage.objects;
drop policy if exists "Editors update own images" on storage.objects;
create policy "Editors update own images"
on storage.objects
for update
to authenticated
using (bucket_id = 'wheel-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'wheel-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
-- Old wheels keep owner_id = null. They remain readable but cannot be claimed
-- by visitors. Saving an old/shared wheel creates a new owned copy.
-- Existing image URLs remain readable; new uploads use user-id/wheel-id paths.
