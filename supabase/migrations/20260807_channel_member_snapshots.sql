create table if not exists public.gemassist_channel_member_snapshots (
  snapshot_date date primary key,
  member_count integer not null check (member_count >= 0),
  measured_at timestamptz not null default now(),
  source text not null default 'telegram_getChatMemberCount',
  detail jsonb not null default '{}'::jsonb
);

revoke all on public.gemassist_channel_member_snapshots from anon, authenticated;

create or replace function public.gemassist_channel_snapshot_gateway(p_raw text, p_signature text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pgsodium', 'pg_temp'
as $$
declare
  v_body jsonb;
  v_timestamp bigint;
  v_nonce text;
  v_public_key bytea;
  v_count integer;
  v_measured_at timestamptz;
  v_date date;
  v_previous integer;
begin
  if p_raw is null or p_signature is null or p_signature !~ '^[0-9a-fA-F]{128}$' then
    raise exception 'Unauthorized';
  end if;

  v_body := p_raw::jsonb;
  v_timestamp := nullif(v_body->>'timestamp','')::bigint;
  v_nonce := coalesce(v_body->>'nonce','');
  if v_timestamp is null or abs((extract(epoch from clock_timestamp())*1000)::bigint-v_timestamp)>300000 then
    raise exception 'Expired request';
  end if;
  if v_nonce !~ '^[A-Za-z0-9_-]{16,128}$' then raise exception 'Invalid nonce'; end if;

  select signing_public_key into v_public_key from public.gemassist_config where id=true;
  if v_public_key is null then raise exception 'Signing key is not initialized'; end if;
  if pgsodium.crypto_sign_verify_detached(decode(p_signature,'hex'),convert_to(p_raw,'UTF8'),v_public_key) is not true then
    raise exception 'Unauthorized';
  end if;

  insert into public.gemassist_request_nonces(nonce) values(v_nonce);
  delete from public.gemassist_request_nonces where created_at<now()-interval '1 day';

  v_count := nullif(v_body->>'member_count','')::integer;
  v_measured_at := coalesce(nullif(v_body->>'measured_at','')::timestamptz, now());
  if v_count is null or v_count < 0 then raise exception 'Invalid member count'; end if;
  v_date := (v_measured_at at time zone 'UTC')::date;

  select member_count into v_previous
  from public.gemassist_channel_member_snapshots
  where snapshot_date < v_date
  order by snapshot_date desc
  limit 1;

  insert into public.gemassist_channel_member_snapshots(snapshot_date,member_count,measured_at)
  values(v_date,v_count,v_measured_at)
  on conflict(snapshot_date) do update set member_count=excluded.member_count,measured_at=excluded.measured_at;

  return jsonb_build_object('ok',true,'snapshot_date',v_date,'member_count',v_count,'previous_member_count',v_previous,'net_daily_growth',case when v_previous is null then null else v_count-v_previous end);
exception
  when unique_violation then raise exception 'Replay rejected';
end;
$$;

revoke all on function public.gemassist_channel_snapshot_gateway(text,text) from public;
grant execute on function public.gemassist_channel_snapshot_gateway(text,text) to anon, authenticated;
