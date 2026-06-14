-- Add account settings used by the user details edit page.

alter table public.profiles
  add column if not exists address_text text,
  add column if not exists address_lat double precision,
  add column if not exists address_lng double precision,
  add column if not exists collection_view text not null default 'all',
  add column if not exists collection_radius_km integer;

alter table public.profiles
  drop constraint if exists profiles_collection_view_check,
  add constraint profiles_collection_view_check check (collection_view in ('all', 'nearby'));

alter table public.profiles
  drop constraint if exists profiles_address_pair_check,
  add constraint profiles_address_pair_check check ((address_lat is null and address_lng is null) or (address_lat is not null and address_lng is not null));

alter table public.profiles
  drop constraint if exists profiles_collection_radius_check,
  add constraint profiles_collection_radius_check check (collection_radius_km is null or (collection_radius_km between 1 and 100));