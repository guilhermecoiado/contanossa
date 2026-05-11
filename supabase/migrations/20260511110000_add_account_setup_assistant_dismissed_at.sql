alter table public.members
add column if not exists account_setup_assistant_dismissed_at timestamptz;