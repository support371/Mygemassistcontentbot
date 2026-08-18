-- Preserve the original tracked acquisition source when lifecycle actions
-- (membership verification or update opt-in) reuse the subscriber upsert path.
-- This keeps source-level conversion analytics intact without changing consent,
-- referral, delivery, or publishing behavior.

create or replace function public.gemassist_preserve_acquisition_source()
returns trigger
language plpgsql
set search_path = 'public', 'pg_temp'
as $$
begin
  if coalesce(old.source, '') <> ''
     and new.source in ('verified', 'telegram') then
    new.source := old.source;
  end if;
  return new;
end;
$$;

drop trigger if exists gemassist_preserve_acquisition_source_trg
  on public.gemassist_subscribers;

create trigger gemassist_preserve_acquisition_source_trg
before update of source on public.gemassist_subscribers
for each row
execute function public.gemassist_preserve_acquisition_source();

comment on function public.gemassist_preserve_acquisition_source() is
  'Preserves first tracked acquisition source when verification or opt-in lifecycle updates reuse subscriber upsert.';
