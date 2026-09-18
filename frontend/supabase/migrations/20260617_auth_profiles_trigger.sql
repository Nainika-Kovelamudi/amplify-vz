-- Link profiles to Supabase Auth users and auto-create on first sign-in.

alter table profiles
  alter column id drop default;

-- Existing rows may not match auth.users; new sign-ins use auth user id.
-- Run only on fresh installs or after clearing orphan profiles.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    'viewer'
  )
  on conflict (email) do update
    set id = excluded.id,
        full_name = excluded.full_name;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
