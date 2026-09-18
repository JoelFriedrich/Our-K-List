-- Move every existing per-show review note into the discussion as the owner's
-- opening ("review") comment, preserving author, spoiler flag and timestamp.
with migrated as (
  insert into "Comments" (user_id, user_show_id, show_id, parent_id, body, is_spoiler, is_review, created_at, updated_at)
  select us.user_id, us.id, us.show_id, null, trim(us.comments), us.is_spoiler, true, us.added_at, us.added_at
  from "User_shows" us
  where coalesce(trim(us.comments), '') <> ''
  returning id, user_show_id
)
update "Comment_likes" cl
set comment_id = migrated.id
from migrated
where cl.comment_id is null and cl.user_show_id = migrated.user_show_id;

-- Any like that could not be re-pointed had nothing to point at.
delete from "Comment_likes" where comment_id is null;

alter table "Comment_likes" alter column comment_id set not null;

create unique index if not exists comment_likes_user_comment_uniq
  on "Comment_likes"(user_id, comment_id);

update "Comments" c
set likes_count = (select count(*) from "Comment_likes" cl where cl.comment_id = c.id);
