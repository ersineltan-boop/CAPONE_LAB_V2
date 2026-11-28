begin;

create table public.capone_team_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (
    char_length(display_name) between 1 and 120
    and display_name = btrim(display_name)
    and display_name ~ '[^[:space:]]'
    and display_name !~ '[[:cntrl:]]'
  ),
  role text not null check (role in ('owner', 'partner', 'employee'))
);

create table public.capone_team_notes (
  id uuid primary key default gen_random_uuid(),
  model_family_id text not null check (
    char_length(model_family_id) between 1 and 300
    and model_family_id !~ '[[:space:][:cntrl:]]'
  ),
  body text not null check (
    char_length(body) between 1 and 4000
    and body ~ '[^[:space:]]'
    and translate(body, E'\t\r\n', '') !~ '[[:cntrl:]]'
  ),
  -- Keep the recorded author after their login or membership is removed.
  author_id uuid not null,
  author_name text not null,
  author_role text not null check (author_role in ('owner', 'partner', 'employee')),
  created_at timestamptz not null default now()
);

create index capone_team_notes_model_family_created_idx
  on public.capone_team_notes (model_family_id, created_at desc, id);

alter table public.capone_team_members enable row level security;
alter table public.capone_team_notes enable row level security;

revoke all on public.capone_team_members from public, anon, authenticated, service_role;
revoke all on public.capone_team_notes from public, anon, authenticated, service_role;

grant select on public.capone_team_members to authenticated;
grant select, insert, update, delete on public.capone_team_members to service_role;
grant select on public.capone_team_notes to authenticated, service_role;
grant insert (model_family_id, body) on public.capone_team_notes to authenticated;

create policy capone_team_members_read_own
  on public.capone_team_members for select to authenticated
  using (user_id = (select auth.uid()));

create policy capone_team_notes_read_for_members
  on public.capone_team_notes for select to authenticated
  using (exists (
    select 1 from public.capone_team_members as member
    where member.user_id = (select auth.uid())
  ));

create policy capone_team_notes_insert_as_author
  on public.capone_team_notes for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.capone_team_members as member
      where member.user_id = (select auth.uid())
    )
  );

create function public.capone_set_team_note_author()
  returns trigger
  language plpgsql
  security invoker
  set search_path = ''
as $function$
begin
  select member.user_id, member.display_name, member.role
  into new.author_id, new.author_name, new.author_role
  from public.capone_team_members as member
  where member.user_id = (select auth.uid());

  if not found then
    raise exception 'Approved CAPONE team membership is required' using errcode = '42501';
  end if;

  return new;
end;
$function$;

revoke all on function public.capone_set_team_note_author() from public, anon, authenticated, service_role;

create trigger capone_team_notes_set_author
  before insert on public.capone_team_notes
  for each row execute function public.capone_set_team_note_author();

commit;
