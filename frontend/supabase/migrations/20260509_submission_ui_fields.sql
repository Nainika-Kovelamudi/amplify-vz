alter table submissions add column if not exists category text not null default 'Process Automation';
alter table submissions add column if not exists solution text not null default 'Agent Orchestration';
alter table submissions add column if not exists owner_email text;
alter table submissions add column if not exists repo_url text;
alter table submissions add column if not exists demo_url text;
alter table submissions add column if not exists video_url text;
alter table submissions add column if not exists clouds jsonb not null default '["AWS"]';
alter table submissions add column if not exists maturity text not null default 'Demo-ready';
alter table submissions add column if not exists dependencies text not null default 'Not applicable';
alter table submissions add column if not exists prerequisites text not null default 'Not applicable';
alter table submissions add column if not exists commands text not null default 'Not applicable';
alter table submissions add column if not exists architecture text not null default 'Not applicable';
alter table submissions add column if not exists architectures text not null default 'Not applicable';
alter table submissions add column if not exists attachments jsonb not null default '[]';
alter table submissions add column if not exists gov_reviewer text;
alter table submissions add column if not exists gov_notes text;
alter table submissions add column if not exists approved_at date;
alter table submissions add column if not exists published_at date;

alter table assets add column if not exists video_url text;

update submissions
set video_url = demo_url
where video_url is null
  and demo_url is not null;

update submissions
set demo_url = attachments -> 0 ->> 'url'
where jsonb_typeof(attachments) = 'array'
  and attachments -> 0 ->> 'url' is not null;
