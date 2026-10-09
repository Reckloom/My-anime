-- Only reconcile episode parents when a new arc is created or an arc boundary ID changes.
-- Ordinary progress/description/artwork updates must not scan every episode row.
drop trigger if exists frame_one_piece_reconcile_arc_episodes on public.media_items;

create trigger frame_one_piece_reconcile_arc_episodes_insert
after insert on public.media_items
for each row execute function public.frame_one_piece_reconcile_arc_episodes();

create trigger frame_one_piece_reconcile_arc_episodes_boundary
after update of id on public.media_items
for each row execute function public.frame_one_piece_reconcile_arc_episodes();
