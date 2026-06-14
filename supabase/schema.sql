-- Fruit Share schema (run in Supabase SQL editor)

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 140),
  category text not null check (category in ('Fruit', 'Vegetable', 'Herbs', 'Other')),
  description text not null default '',
  quantity_note text not null default '',
  available_from timestamptz not null,
  available_until timestamptz not null,
  location_lat double precision not null,
  location_lng double precision not null,
  status text not null default 'active' check (status in ('active', 'reserved', 'collected', 'expired', 'flagged', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_window check (available_until > available_from)
);

create table if not exists public.collection_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, requester_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists listings_updated_at on public.listings;
create trigger listings_updated_at
before update on public.listings
for each row execute function public.set_updated_at();

drop trigger if exists collection_requests_updated_at on public.collection_requests;
create trigger collection_requests_updated_at
before update on public.collection_requests
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.collection_requests enable row level security;

-- Profiles: user can read/update own profile; admins can read all
create policy "profiles_select_self_or_admin"
on public.profiles
for select
using (auth.uid() = id or exists (
  select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
));

create policy "profiles_update_self"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- Listings read: everyone can read active listings
create policy "listings_read_active"
on public.listings
for select
using (status = 'active' or owner_id = auth.uid() or exists (
  select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
));

create policy "listings_insert_owner"
on public.listings
for insert
with check (owner_id = auth.uid());

create policy "listings_update_owner_or_admin"
on public.listings
for update
using (owner_id = auth.uid() or exists (
  select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
))
with check (owner_id = auth.uid() or exists (
  select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
));

-- Requests: requester can create/read own; listing owner can read related
create policy "requests_insert_requester"
on public.collection_requests
for insert
with check (requester_id = auth.uid());

create policy "requests_select_related"
on public.collection_requests
for select
using (
  requester_id = auth.uid() or exists (
    select 1 from public.listings l
    where l.id = listing_id and l.owner_id = auth.uid()
  ) or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "requests_update_listing_owner_or_admin"
on public.collection_requests
for update
using (
  exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
)
with check (
  exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Helpful indexes
create index if not exists idx_listings_status_available_until on public.listings(status, available_until);
create index if not exists idx_listings_owner on public.listings(owner_id);
create index if not exists idx_requests_listing on public.collection_requests(listing_id);
create index if not exists idx_requests_requester on public.collection_requests(requester_id);
