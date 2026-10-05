create table if not exists public.loyalty_rewards (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null,
  state text not null default 'available'
    check (state in ('available', 'reserved', 'redeemed')),
  earned_at timestamptz not null default now(),
  code_hash text,
  code_salt text,
  code_lookup_hash text,
  reserved_at timestamptz,
  expires_at timestamptz,
  redeemed_at timestamptz,
  redeemed_store text,
  redeemed_order text,
  redeemed_by text,
  legacy_source_key text unique,
  constraint loyalty_rewards_code_fields check (
    (state = 'available' and code_hash is null and code_salt is null and code_lookup_hash is null)
    or
    (state in ('reserved', 'redeemed') and code_hash is not null and code_salt is not null
      and code_lookup_hash is not null and reserved_at is not null and expires_at is not null)
  )
);

create index if not exists loyalty_rewards_customer_state_earned_idx
  on public.loyalty_rewards (customer_id, state, earned_at);
create unique index if not exists loyalty_rewards_lookup_hash_idx
  on public.loyalty_rewards (code_lookup_hash) where code_lookup_hash is not null;

create table if not exists public.loyalty_redeem_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  code_lookup_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists loyalty_redeem_attempts_ip_created_idx
  on public.loyalty_redeem_attempts (ip_hash, created_at desc);
create index if not exists loyalty_redeem_attempts_code_created_idx
  on public.loyalty_redeem_attempts (code_lookup_hash, created_at desc);

alter table public.loyalty_rewards enable row level security;
alter table public.loyalty_redeem_attempts enable row level security;
revoke all on public.loyalty_rewards, public.loyalty_redeem_attempts from anon, authenticated;
grant all on public.loyalty_rewards, public.loyalty_redeem_attempts to service_role;
grant usage, select on sequence public.loyalty_redeem_attempts_id_seq to service_role;

insert into public.loyalty_rewards (customer_id, state, earned_at, legacy_source_key)
select c.customer_id, 'available', now(), 'legacy:' || c.customer_id || ':' || reward_number::text
from public.cards c
cross join lateral generate_series(1, greatest(coalesce(c.free_drinks, 0), 0)) as rewards(reward_number)
on conflict (legacy_source_key) do nothing;

create or replace function public.loyalty_issue_reward(
  p_customer_id text,
  p_code_hash text,
  p_code_salt text,
  p_code_lookup_hash text
)
returns table (reward_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward_id uuid;
  v_expires_at timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended('loyalty-issue:' || p_customer_id, 0));

  update loyalty_rewards as r
     set state = 'available', code_hash = null, code_salt = null, code_lookup_hash = null,
         reserved_at = null, expires_at = null
   where r.customer_id = p_customer_id and r.state = 'reserved' and r.expires_at <= now();

  select r.id into v_reward_id
    from loyalty_rewards as r
   where r.customer_id = p_customer_id and r.state = 'reserved' and r.expires_at > now()
   order by r.reserved_at desc
   limit 1
   for update skip locked;

  if v_reward_id is null then
    select r.id into v_reward_id
      from loyalty_rewards as r
     where r.customer_id = p_customer_id and r.state = 'available'
     order by r.earned_at, r.id
     limit 1
     for update skip locked;
  end if;

  if v_reward_id is null then
    return;
  end if;

  update loyalty_rewards as r
     set state = 'reserved', code_hash = p_code_hash, code_salt = p_code_salt,
         code_lookup_hash = p_code_lookup_hash, reserved_at = now(),
         expires_at = now() + interval '10 minutes'
   where r.id = v_reward_id
   returning r.expires_at into v_expires_at;

  return query select v_reward_id, v_expires_at;
end;
$$;

create or replace function public.loyalty_redeem_reward(
  p_code_hash text,
  p_store_id text,
  p_order_number text,
  p_staff_name text
)
returns table (ok boolean, reward_id uuid, customer_id text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward_id uuid;
  v_customer_id text;
begin
  update loyalty_rewards as r
     set state = 'redeemed', redeemed_at = now(), redeemed_store = p_store_id,
         redeemed_order = p_order_number, redeemed_by = p_staff_name
   where r.code_hash = p_code_hash and r.state = 'reserved' and r.expires_at > now()
   returning r.id, r.customer_id into v_reward_id, v_customer_id;

  if v_reward_id is null then
    return query select false, null::uuid, null::text;
    return;
  end if;

  update cards
     set free_drinks = greatest(coalesce(free_drinks, 0) - 1, 0),
         lifetime_redeemed = coalesce(lifetime_redeemed, 0) + 1,
         last_redeem_at = now()
   where cards.customer_id = v_customer_id;

  insert into events (customer_id, action) values (v_customer_id, 'reward_redeemed');
  return query select true, v_reward_id, v_customer_id;
end;
$$;

create or replace function public.loyalty_allow_redeem_attempt(
  p_ip_hash text,
  p_code_lookup_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip_lock bigint := hashtextextended('ip:' || p_ip_hash, 0);
  v_code_lock bigint := hashtextextended('code:' || p_code_lookup_hash, 0);
  v_ip_count integer;
  v_code_count integer;
begin
  perform pg_advisory_xact_lock(least(v_ip_lock, v_code_lock));
  if v_ip_lock <> v_code_lock then
    perform pg_advisory_xact_lock(greatest(v_ip_lock, v_code_lock));
  end if;

  select count(*) into v_ip_count from loyalty_redeem_attempts
   where ip_hash = p_ip_hash and created_at > now() - interval '1 minute';
  select count(*) into v_code_count from loyalty_redeem_attempts
   where code_lookup_hash = p_code_lookup_hash and created_at > now() - interval '1 minute';
  if v_ip_count >= 30 or v_code_count >= 5 then
    return false;
  end if;

  insert into loyalty_redeem_attempts (ip_hash, code_lookup_hash)
  values (p_ip_hash, p_code_lookup_hash);
  return true;
end;
$$;

create or replace function public.loyalty_add_stamp(p_customer_id text)
returns table (
  stamps integer,
  free_drinks integer,
  lifetime_stamps integer,
  lifetime_redeemed integer,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card cards%rowtype;
  v_stamps integer;
  v_free_drinks integer;
  v_lifetime_stamps integer;
  v_lifetime_redeemed integer;
  v_message text := '+1 stamp!';
  v_elapsed interval;
begin
  insert into cards (customer_id, stamps, free_drinks, lifetime_stamps, last_stamp_at)
  values (p_customer_id, 0, 0, 0, now() - interval '31 minutes')
  on conflict (customer_id) do nothing;

  select * into v_card from cards where customer_id = p_customer_id for update;
  v_elapsed := now() - coalesce(v_card.last_stamp_at, '-infinity'::timestamptz);
  if v_elapsed < interval '30 minutes' then
    return query select coalesce(v_card.stamps, 0), coalesce(v_card.free_drinks, 0),
      coalesce(v_card.lifetime_stamps, 0), coalesce(v_card.lifetime_redeemed, 0),
      'Already stamped. Next in ' || ceil(extract(epoch from (interval '30 minutes' - v_elapsed)) / 60)::integer || ' min.';
    return;
  end if;

  v_stamps := coalesce(v_card.stamps, 0) + 1;
  v_free_drinks := coalesce(v_card.free_drinks, 0);
  v_lifetime_stamps := coalesce(v_card.lifetime_stamps, 0) + 1;
  v_lifetime_redeemed := coalesce(v_card.lifetime_redeemed, 0);
  if v_stamps >= 5 then
    v_stamps := 0;
    v_free_drinks := v_free_drinks + 1;
    v_message := 'Free drink unlocked!';
    insert into loyalty_rewards (customer_id, state) values (p_customer_id, 'available');
    insert into events (customer_id, action) values (p_customer_id, 'reward_issued');
  end if;

  update cards set stamps = v_stamps, free_drinks = v_free_drinks,
      lifetime_stamps = v_lifetime_stamps, last_stamp_at = now()
    where customer_id = p_customer_id;
  insert into events (customer_id, action) values (p_customer_id, 'stamp');
  return query select v_stamps, v_free_drinks, v_lifetime_stamps, v_lifetime_redeemed, v_message;
end;
$$;

revoke all on function public.loyalty_issue_reward(text, text, text, text) from public, anon, authenticated;
revoke all on function public.loyalty_redeem_reward(text, text, text, text) from public, anon, authenticated;
revoke all on function public.loyalty_allow_redeem_attempt(text, text) from public, anon, authenticated;
revoke all on function public.loyalty_add_stamp(text) from public, anon, authenticated;
grant execute on function public.loyalty_issue_reward(text, text, text, text) to service_role;
grant execute on function public.loyalty_redeem_reward(text, text, text, text) to service_role;
grant execute on function public.loyalty_allow_redeem_attempt(text, text) to service_role;
grant execute on function public.loyalty_add_stamp(text) to service_role;