-- FRAME profile logo preference
alter table public.profiles
  add column if not exists frame_logo text not null default 'ultra-instinct';

update public.profiles
set frame_logo = 'ultra-instinct'
where frame_logo is null or btrim(frame_logo) = '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_frame_logo_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_frame_logo_check
      check (frame_logo in ('ultra-instinct','classic-f','minimal-ring'));
  end if;
end $$;