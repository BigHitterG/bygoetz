revoke all on sequence public.garden_auth_email_requests_id_seq
  from public, anon, authenticated;

grant usage, select on sequence public.garden_auth_email_requests_id_seq
  to service_role;
