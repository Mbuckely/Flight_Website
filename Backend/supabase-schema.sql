alter table profiles
drop constraint if exists profiles_role_check;

alter table profiles
add constraint profiles_role_check
check (role in ('employee', 'approver', 'manager', 'admin'));

alter table profiles
alter column role set default 'employee';

insert into public.profiles (
  id,
  email,
  phone,
  first_name,
  last_name,
  role
)
select
  auth_user.id,
  lower(auth_user.email),
  auth_user.phone,
  coalesce(
    nullif(auth_user.raw_user_meta_data ->> 'first_name', ''),
    split_part(auth_user.email, '@', 1),
    'User'
  ),
  coalesce(
    nullif(auth_user.raw_user_meta_data ->> 'last_name', ''),
    'Account'
  ),
  'employee'
from auth.users auth_user
where auth_user.email is not null
on conflict (id) do update
set
  email = excluded.email,
  phone = coalesce(public.profiles.phone, excluded.phone),
  first_name = coalesce(nullif(public.profiles.first_name, ''), excluded.first_name),
  last_name = coalesce(nullif(public.profiles.last_name, ''), excluded.last_name),
  role = coalesce(public.profiles.role, 'employee');

update public.profiles profile
set id = auth_user.id
from auth.users auth_user
where lower(profile.email) = lower(auth_user.email)
  and profile.id <> auth_user.id;

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    phone,
    first_name,
    last_name,
    role
  )
  values (
    new.id,
    lower(new.email),
    new.phone,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'first_name', ''),
      split_part(new.email, '@', 1),
      'User'
    ),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'last_name', ''),
      'Account'
    ),
    'employee'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    phone = coalesce(public.profiles.phone, excluded.phone),
    first_name = coalesce(nullif(public.profiles.first_name, ''), excluded.first_name),
    last_name = coalesce(nullif(public.profiles.last_name, ''), excluded.last_name),
    role = coalesce(public.profiles.role, 'employee');

  return new;
end;
$$;

drop trigger if exists create_profile_after_auth_signup on auth.users;

create trigger create_profile_after_auth_signup
after insert on auth.users
for each row execute function public.create_profile_for_auth_user();

create table if not exists approval_requests (
  id text primary key,
  title text not null,
  submitted_by text not null,
  approver_email text,
  approver_name text,
  from_location text not null,
  to_location text not null,
  route text not null,
  travel_dates text not null,
  room_requirement text not null,
  travelers jsonb not null default '[]'::jsonb,
  booking_details jsonb not null default '{}'::jsonb,
  reason text not null,
  status text not null default 'Pending'
    check (
      status in (
        'Pending',
        'Finance Review',
        'Leadership Review',
        'Changes Requested',
        'Approved',
        'Cancelled'
      )
    ),
  requested_at text not null,
  itinerary_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists approval_requests_status_idx
on approval_requests (status);

create index if not exists approval_requests_submitted_by_idx
on approval_requests (submitted_by);

alter table approval_requests
add column if not exists approver_email text;

alter table approval_requests
add column if not exists approver_name text;

alter table approval_requests
add column if not exists booking_details jsonb not null default '{}'::jsonb;

alter table approval_requests
add column if not exists approved_at timestamptz;

alter table approval_requests
add column if not exists approved_by_email text;

alter table approval_requests
add column if not exists approved_by_name text;

alter table approval_requests
add column if not exists approved_total_price numeric not null default 0;

alter table approval_requests
drop constraint if exists approval_requests_status_check;

alter table approval_requests
add constraint approval_requests_status_check
check (
  status in (
    'Pending',
    'Finance Review',
    'Leadership Review',
    'Changes Requested',
    'Approved',
    'Cancelled'
  )
);

create index if not exists approval_requests_approver_email_idx
on approval_requests (approver_email);

create index if not exists approval_requests_approved_at_idx
on approval_requests (approved_at);

create index if not exists approval_requests_approved_by_email_idx
on approval_requests (approved_by_email);

update approval_requests
set
  approved_at = coalesce(approved_at, updated_at, created_at, now()),
  approved_by_email = coalesce(approved_by_email, approver_email),
  approved_by_name = coalesce(approved_by_name, approver_name),
  approved_total_price =
    coalesce(
      case
        when booking_details #>> '{flight,price}' ~ '^[0-9]+(\.[0-9]+)?$'
          then (booking_details #>> '{flight,price}')::numeric
        else 0
      end,
      0
    )
    +
    coalesce(
      case
        when booking_details #>> '{stay,priceValue}' ~ '^[0-9]+(\.[0-9]+)?$'
          then (booking_details #>> '{stay,priceValue}')::numeric
        when regexp_replace(coalesce(booking_details #>> '{stay,price}', ''), '[^0-9.]', '', 'g') ~ '^[0-9]+(\.[0-9]+)?$'
          then regexp_replace(coalesce(booking_details #>> '{stay,price}', ''), '[^0-9.]', '', 'g')::numeric
        else 0
      end,
      0
    )
where status = 'Approved';
