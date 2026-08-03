update public.basil_agent_profiles
set disclosure_label = U&'WREN \\00B7 AI GARDEN STEWARD',
    updated_at = now()
where code = 'wren'
  and disclosure_label <> U&'WREN \\00B7 AI GARDEN STEWARD';
