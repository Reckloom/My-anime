create policy profiles_read_authenticated on public.profiles
for select to authenticated
using (true);

drop policy if exists prefs_own_write on public.user_preferences;
create policy prefs_own_select on public.user_preferences
for select to authenticated using (user_id=(select auth.uid()));
create policy prefs_own_insert on public.user_preferences
for insert to authenticated with check (user_id=(select auth.uid()));
create policy prefs_own_update on public.user_preferences
for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy prefs_own_delete on public.user_preferences
for delete to authenticated using (user_id=(select auth.uid()));
