alter table public.user_preferences alter column theme set default 'sky';
alter table public.user_preferences alter column appearance_mode set default 'light';
update public.user_preferences
set theme='sky'
where theme not in ('sky','samsung','apple','oneplus','nothing','amoled');
