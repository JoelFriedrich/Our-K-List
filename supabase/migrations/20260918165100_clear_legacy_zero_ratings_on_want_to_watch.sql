-- The old add-show flow always wrote a rating, so "Want to Watch" entries were
-- saved with a 0 nobody chose. Those are artifacts, not scores: clear them so
-- unrated means NULL.
--
-- Scope is deliberately narrow: only want_to_watch rows sitting at exactly 0.
-- Rows with any other rating are left alone, since those may be real.

create table if not exists "Legacy_zero_ratings" as
select id as user_show_id, user_id, show_id, user_rating, status, added_at
from "User_shows"
where status = 'want_to_watch' and user_rating = 0;

alter table "Legacy_zero_ratings" enable row level security;
revoke all on table "Legacy_zero_ratings" from anon, authenticated;

update "User_shows"
set user_rating = null
where status = 'want_to_watch' and user_rating = 0;
