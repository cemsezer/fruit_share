-- One-time migration to make listing location entry more user-friendly.
-- Run this in the Supabase SQL editor for an existing Fruit Share database.

alter table public.listings
add column if not exists pickup_area text not null default 'Pickup area not specified';

alter table public.listings
alter column location_lat drop not null,
alter column location_lng drop not null;

alter table public.listings
drop constraint if exists listings_pickup_area_length;

alter table public.listings
add constraint listings_pickup_area_length
check (char_length(pickup_area) between 2 and 160);

alter table public.listings
drop constraint if exists location_pair;

alter table public.listings
add constraint location_pair
check (
  (location_lat is null and location_lng is null)
  or (location_lat is not null and location_lng is not null)
);
