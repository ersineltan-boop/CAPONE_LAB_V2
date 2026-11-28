begin;

create function public.capone_can_enroll_team_member(requester_id uuid)
  returns boolean
  language sql
  stable
  security invoker
  set search_path = ''
as $function$
  select exists (
    select 1
    from public.capone_team_members as member
    where member.user_id = requester_id and member.role = 'owner'
  );
$function$;

revoke all on function public.capone_can_enroll_team_member(uuid) from public, anon, authenticated, service_role;
grant execute on function public.capone_can_enroll_team_member(uuid) to service_role;

create function public.capone_apply_team_member_enrollment()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $function$
declare
  enrollment jsonb := new.raw_app_meta_data -> 'capone_member_enrollment';
  requester uuid;
  handle text;
  member_role text;
  member_name text;
begin
  if enrollment is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and (old.raw_app_meta_data -> 'capone_member_enrollment') is not null then
    return new;
  end if;

  if jsonb_typeof(enrollment) is distinct from 'object' then
    raise exception 'Invalid CAPONE enrollment' using errcode = '22023';
  end if;
  requester := (enrollment ->> 'requested_by')::uuid;
  handle := enrollment ->> 'username';
  member_role := enrollment ->> 'role';
  member_name := enrollment ->> 'display_name';

  if requester is null or handle is null or handle collate "C" !~ '^[a-z][a-z0-9_-]{2,31}$'
    or new.email is distinct from (handle || '@accounts.capone.invalid')
    or member_role is null or member_role not in ('partner', 'employee')
    or member_name is null
  then
    raise exception 'Invalid CAPONE enrollment' using errcode = '22023';
  end if;

  -- Hold the owner's membership through this transaction to serialize with revocation.
  perform member.user_id
  from public.capone_team_members as member
  where member.user_id = requester and member.role = 'owner'
  for share;
  if not found then
    raise exception 'CAPONE owner membership is required' using errcode = '42501';
  end if;

  insert into public.capone_team_members (user_id, display_name, role)
  values (new.id, member_name, member_role);
  return new;
end;
$function$;

revoke all on function public.capone_apply_team_member_enrollment() from public, anon, authenticated, service_role;

-- Auth writes custom app metadata after inserting the user, in the same transaction.
create trigger capone_team_member_enrollment
  after insert or update of raw_app_meta_data on auth.users
  for each row execute function public.capone_apply_team_member_enrollment();

commit;
