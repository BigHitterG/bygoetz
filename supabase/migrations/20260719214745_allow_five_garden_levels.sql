alter table public.garden_member_progress
  drop constraint if exists garden_member_progress_plot_level_check;

alter table public.garden_member_progress
  add constraint garden_member_progress_plot_level_check
  check (plot_level between 1 and 5);
