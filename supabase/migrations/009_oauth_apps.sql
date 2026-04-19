-- OAuth apps configured from within the CRM.
-- Admins paste client_id / client_secret here instead of editing env files.
-- Frontend reads only safe fields (client_id, redirect_uri) via a SECURITY
-- DEFINER function. The service-role worker reads the full row.

create table if not exists public.oauth_apps (
  provider      text primary key check (provider in ('google','facebook','instagram')),
  client_id     text not null,
  client_secret text not null,
  redirect_uri  text,
  extra         jsonb not null default '{}',
  updated_by    uuid references public.users(id),
  updated_at    timestamptz not null default now()
);

alter table public.oauth_apps enable row level security;

-- Admins can see & edit everything.
drop policy if exists "oauth_apps admin all" on public.oauth_apps;
create policy "oauth_apps admin all"
  on public.oauth_apps
  for all
  using (
    exists (select 1 from public.users up
            where up.id = auth.uid() and up.role = 'admin')
  )
  with check (
    exists (select 1 from public.users up
            where up.id = auth.uid() and up.role = 'admin')
  );

-- Helper for the frontend: returns public (non-secret) parts so the OAuth
-- redirect can be built without exposing the secret.
create or replace function public.get_oauth_app_public(p_provider text)
returns table (provider text, client_id text, redirect_uri text, extra jsonb)
language sql
security definer
set search_path = public
as $$
  select provider, client_id, redirect_uri, extra
  from public.oauth_apps
  where provider = p_provider;
$$;

grant execute on function public.get_oauth_app_public(text) to authenticated;

-- Updated_at trigger.
create or replace function public.oauth_apps_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists oauth_apps_touch on public.oauth_apps;
create trigger oauth_apps_touch before update on public.oauth_apps
for each row execute function public.oauth_apps_touch();
