-- Harden Telegram channel member snapshots without changing server-side behavior.
-- The table is accessed only by postgres/service_role; no anon/authenticated grants exist.
alter table public.gemassist_channel_member_snapshots enable row level security;
