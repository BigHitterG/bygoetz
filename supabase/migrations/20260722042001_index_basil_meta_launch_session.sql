create index basil_meta_purchase_events_launch_session_idx
  on public.basil_meta_purchase_events (launch_session_id)
  where launch_session_id is not null;
