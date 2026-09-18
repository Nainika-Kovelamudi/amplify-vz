-- One-shot delete for a published pipeline item: submission row + mirror catalog row (assets),
-- in a single transaction. SECURITY DEFINER so it works even when table-level DELETE RLS is missing
-- or returning rows is restricted.

create or replace function public.delete_published_catalog(p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  sid uuid;
  n_sub bigint;
begin
  begin
    sid := p_id::uuid;
  exception
    when invalid_text_representation then
      return jsonb_build_object('ok', false, 'error', 'invalid_uuid');
  end;

  delete from submissions where id = sid;
  get diagnostics n_sub = row_count;

  if n_sub = 0 then
    return jsonb_build_object('ok', false, 'error', 'submission_not_found');
  end if;

  delete from assets where id = p_id;

  return jsonb_build_object('ok', true, 'submissions_deleted', n_sub);
end;
$fn$;

revoke all on function public.delete_published_catalog(text) from public;
grant execute on function public.delete_published_catalog(text) to anon, authenticated;
