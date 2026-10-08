-- FRAME no longer exposes AI features; remove the obsolete per-user AI provider setting.
alter table public.user_preferences drop column if exists ai_provider;