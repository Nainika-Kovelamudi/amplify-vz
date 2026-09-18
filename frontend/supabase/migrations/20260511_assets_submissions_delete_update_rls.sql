-- Published pipeline items may mirror into `assets` (same id as `submissions.id`).
-- Allow the app to clear video_url on both tables, delete mirror assets, and delete submissions.

drop policy if exists "public update assets" on assets;
create policy "public update assets"
  on assets for update to anon, authenticated
  using (true) with check (true);

drop policy if exists "public delete assets" on assets;
create policy "public delete assets"
  on assets for delete to anon, authenticated
  using (true);

drop policy if exists "public delete submissions" on submissions;
create policy "public delete submissions"
  on submissions for delete to anon, authenticated
  using (true);
