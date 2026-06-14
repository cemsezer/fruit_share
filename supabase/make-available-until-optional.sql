-- One-time migration to make listing available_until optional.
-- Run this in the Supabase SQL editor for an existing Fruit Share database.

alter table public.listings
alter column available_until drop not null;

alter table public.listings
drop constraint if exists valid_window;

alter table public.listings
add constraint valid_window
check (available_until is null or available_until > available_from);
