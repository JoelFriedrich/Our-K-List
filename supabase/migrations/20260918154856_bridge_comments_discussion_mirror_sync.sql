-- Bring the mirror in line with the review comments that now own the text.
update "User_shows" us
set comments = coalesce(c.body, ''),
    is_spoiler = coalesce(c.is_spoiler, false)
from (select user_show_id, body, is_spoiler from "Comments" where is_review) c
where c.user_show_id = us.id
  and (us.comments is distinct from c.body or us.is_spoiler is distinct from c.is_spoiler);
