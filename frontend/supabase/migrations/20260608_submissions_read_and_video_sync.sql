-- `submissions` is the app's source of truth (catalog, pipeline, video_url, attachments, metadata).
-- Run in Supabase SQL Editor if the site shows empty catalog/pipeline despite rows in Table Editor.

alter table submissions enable row level security;

drop policy if exists "public read submissions" on submissions;
create policy "public read submissions"
  on submissions for select to anon, authenticated
  using (true);

-- Mirror Firebase demo links from submissions → assets so catalog reads work even without a join.
update assets a
set
  video_url = s.video_url,
  updated_at = now()
from submissions s
where s.video_url is not null
  and btrim(s.video_url) <> ''
  and s.gov_notes ilike '%Catalog id ' || a.id || '%'
  and (a.video_url is null or btrim(a.video_url) = '');
