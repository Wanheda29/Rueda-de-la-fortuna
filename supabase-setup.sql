create table if not exists public.wheels (
  id text primary key,
  name text not null,
  config_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wheels enable row level security;

drop policy if exists "Public wheels can be read" on public.wheels;
create policy "Public wheels can be read"
on public.wheels
for select
to anon
using (true);

drop policy if exists "Public wheels can be created" on public.wheels;
create policy "Public wheels can be created"
on public.wheels
for insert
to anon
with check (true);

drop policy if exists "Public wheels can be updated" on public.wheels;
create policy "Public wheels can be updated"
on public.wheels
for update
to anon
using (true)
with check (true);

insert into storage.buckets (id, name, public)
values ('wheel-images', 'wheel-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public wheel images can be read" on storage.objects;
create policy "Public wheel images can be read"
on storage.objects
for select
to anon
using (bucket_id = 'wheel-images');

drop policy if exists "Public wheel images can be uploaded" on storage.objects;
create policy "Public wheel images can be uploaded"
on storage.objects
for insert
to anon
with check (bucket_id = 'wheel-images');

drop policy if exists "Public wheel images can be updated" on storage.objects;
create policy "Public wheel images can be updated"
on storage.objects
for update
to anon
using (bucket_id = 'wheel-images')
with check (bucket_id = 'wheel-images');
