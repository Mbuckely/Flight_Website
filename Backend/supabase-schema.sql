alter table profiles
drop constraint if exists profiles_role_check;

alter table profiles
add constraint profiles_role_check
check (role in ('employee', 'approver', 'manager', 'admin'));

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
