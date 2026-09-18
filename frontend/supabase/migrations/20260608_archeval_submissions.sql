-- ArchEval assessment results (separate from AIMPLIFY catalog `submissions` table)
create table if not exists archeval_submissions (
  id text primary key,
  user_name text not null default '',
  created_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb,
  score numeric not null default 0,
  max_score numeric not null default 260,
  decision text not null default '',
  ai_explanation text not null default '',
  hard_blocker text
);

create index if not exists archeval_submissions_created_at_idx
  on archeval_submissions (created_at desc);

alter table archeval_submissions enable row level security;

create policy "Allow public read archeval_submissions"
  on archeval_submissions for select
  using (true);

create policy "Allow public insert archeval_submissions"
  on archeval_submissions for insert
  with check (true);
