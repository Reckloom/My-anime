alter table public.user_preferences add column if not exists release_notifications_enabled boolean not null default true;
