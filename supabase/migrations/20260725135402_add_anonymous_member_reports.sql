alter table public.garden_feedback
  alter column steward_id drop not null;

alter table public.garden_feedback
  add column if not exists submission_kind text not null default 'member_idea',
  add column if not exists attachment_path text,
  add column if not exists attachment_mime_type text,
  add column if not exists attachment_size_bytes integer;

alter table public.garden_feedback
  drop constraint if exists garden_feedback_message_length,
  add constraint garden_feedback_message_length
    check (char_length(message) between 1 and 1200),
  add constraint garden_feedback_submission_kind_check
    check (submission_kind in ('member_idea', 'anonymous_bug', 'anonymous_idea')),
  add constraint garden_feedback_identity_check
    check (
      (submission_kind = 'member_idea' and steward_id is not null)
      or
      (submission_kind in ('anonymous_bug', 'anonymous_idea') and steward_id is null)
    ),
  add constraint garden_feedback_attachment_size_check
    check (
      attachment_size_bytes is null
      or attachment_size_bytes between 1 and 2500000
    ),
  add constraint garden_feedback_attachment_metadata_check
    check (
      (
        attachment_path is null
        and attachment_mime_type is null
        and attachment_size_bytes is null
      )
      or
      (
        submission_kind in ('anonymous_bug', 'anonymous_idea')
        and attachment_path is not null
        and attachment_mime_type in ('image/jpeg', 'image/png', 'image/webp')
        and attachment_size_bytes is not null
      )
    );

create index if not exists garden_feedback_kind_created_idx
  on public.garden_feedback (submission_kind, created_at desc);

alter table public.garden_feedback enable row level security;

revoke all on table public.garden_feedback from public, anon, authenticated;
grant select, insert, update, delete on table public.garden_feedback to service_role;

comment on table public.garden_feedback is
  'Private Basil feedback. Account-menu ideas are steward-linked; quick bug and idea reports are membership-gated but stored without a steward, user, name, or email.';

comment on column public.garden_feedback.attachment_path is
  'Random server-generated path in the private garden-feedback-attachments bucket. Original filenames are not retained.';

create table if not exists public.garden_feedback_rate_limits (
  member_key text not null,
  window_start timestamptz not null,
  submission_count integer not null default 1,
  primary key (member_key, window_start),
  constraint garden_feedback_rate_limit_count_check
    check (submission_count between 1 and 10),
  constraint garden_feedback_rate_limit_member_key_check
    check (member_key ~ '^[0-9a-f]{64}$')
);

alter table public.garden_feedback_rate_limits enable row level security;

revoke all on table public.garden_feedback_rate_limits
  from public, anon, authenticated;
grant select, insert, update, delete on table public.garden_feedback_rate_limits
  to service_role;

comment on table public.garden_feedback_rate_limits is
  'Short-lived one-way member keys used only to limit anonymous quick-report spam. This table is not joined to individual reports.';

create or replace function public.claim_garden_feedback_report_slot(
  p_member_key text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window_start timestamptz := date_trunc('hour', now());
  v_accepted boolean := false;
begin
  if p_member_key is null or p_member_key !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  delete from public.garden_feedback_rate_limits
  where window_start < now() - interval '48 hours';

  insert into public.garden_feedback_rate_limits (
    member_key,
    window_start,
    submission_count
  )
  values (p_member_key, v_window_start, 1)
  on conflict (member_key, window_start) do update
    set submission_count =
      public.garden_feedback_rate_limits.submission_count + 1
    where public.garden_feedback_rate_limits.submission_count < 10
  returning true into v_accepted;

  return coalesce(v_accepted, false);
end;
$$;

revoke all on function public.claim_garden_feedback_report_slot(text)
  from public, anon, authenticated;
grant execute on function public.claim_garden_feedback_report_slot(text)
  to service_role;
