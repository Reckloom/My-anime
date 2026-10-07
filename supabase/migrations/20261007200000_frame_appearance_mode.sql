alter table public.user_preferences add column if not exists appearance_mode text not null default 'light' check (appearance_mode in ('light','dark','system'));
