-- Safety net: snapshot the legacy per-show review notes before bridging them
-- into the Comments table. Service-role only (RLS on, no policies).
create table if not exists "Legacy_user_show_comments" as
select id as user_show_id, user_id, show_id, comments, is_spoiler, added_at
from "User_shows"
where coalesce(trim(comments), '') <> '';

alter table "Legacy_user_show_comments" enable row level security;

-- Comments gains the columns the app has always assumed existed.
alter table "Comments" add column if not exists show_id uuid;
alter table "Comments" add column if not exists likes_count integer not null default 0;
alter table "Comments" add column if not exists is_review boolean not null default false;

update "Comments" c
set show_id = us.show_id
from "User_shows" us
where us.id = c.user_show_id and c.show_id is null;

alter table "Comments" alter column show_id set not null;

alter table "Comments"
  add constraint "Comments_show_id_fkey"
  foreign key (show_id) references "Show_data"(id) on delete cascade;

create index if not exists comments_user_show_id_idx on "Comments"(user_show_id);
create index if not exists comments_show_id_idx on "Comments"(show_id);
create index if not exists comments_parent_id_idx on "Comments"(parent_id);

-- At most one "review" (the owner's own opening comment) per list entry.
create unique index if not exists comments_one_review_per_user_show
  on "Comments"(user_show_id) where is_review;

-- Comment_likes becomes purely comment-scoped: the old show-level heart
-- turns into a like on the owner's review comment.
alter table "Comment_likes" alter column user_show_id drop not null;
alter table "Comment_likes" drop constraint if exists "Comment_likes_user_id_user_show_id_key";
