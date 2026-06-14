-- One-time fix for Fruit Share RLS policy recursion.
-- Run this in the Supabase SQL editor after the original schema has been applied.

create or replace function public.current_user_is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
on public.profiles
for select
using (auth.uid() = id or public.current_user_is_admin());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "listings_read_active" on public.listings;
create policy "listings_read_active"
on public.listings
for select
using (status = 'active' or owner_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "listings_insert_owner" on public.listings;
create policy "listings_insert_owner"
on public.listings
for insert
with check (owner_id = auth.uid());

drop policy if exists "listings_update_owner_or_admin" on public.listings;
create policy "listings_update_owner_or_admin"
on public.listings
for update
using (owner_id = auth.uid() or public.current_user_is_admin())
with check (owner_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "requests_insert_requester" on public.collection_requests;
create policy "requests_insert_requester"
on public.collection_requests
for insert
with check (requester_id = auth.uid());

drop policy if exists "requests_select_related" on public.collection_requests;
create policy "requests_select_related"
on public.collection_requests
for select
using (
  requester_id = auth.uid()
  or exists (
    select 1
    from public.listings l
    where l.id = listing_id
      and l.owner_id = auth.uid()
  )
  or public.current_user_is_admin()
);

drop policy if exists "requests_update_listing_owner_or_admin" on public.collection_requests;
create policy "requests_update_listing_owner_or_admin"
on public.collection_requests
for update
using (
  exists (
    select 1
    from public.listings l
    where l.id = listing_id
      and l.owner_id = auth.uid()
  )
  or public.current_user_is_admin()
)
with check (
  exists (
    select 1
    from public.listings l
    where l.id = listing_id
      and l.owner_id = auth.uid()
  )
  or public.current_user_is_admin()
);
