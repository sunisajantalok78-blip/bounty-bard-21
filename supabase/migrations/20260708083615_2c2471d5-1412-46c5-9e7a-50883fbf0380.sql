
alter table public.scraper_config drop constraint if exists scraper_config_singleton_key;

do $$
declare admin_uid uuid;
begin
  select id into admin_uid from auth.users where lower(email) = 'sunisajantalok78@gmail.com' limit 1;

  alter table public.my_portfolio
    add column if not exists user_id uuid references auth.users(id) on delete cascade;
  update public.my_portfolio set user_id = admin_uid where user_id is null and admin_uid is not null;

  drop policy if exists "Authenticated read portfolio" on public.my_portfolio;
  drop policy if exists "Authenticated insert portfolio" on public.my_portfolio;
  drop policy if exists "Authenticated update portfolio" on public.my_portfolio;
  drop policy if exists "Authenticated delete portfolio" on public.my_portfolio;

  create policy "own portfolio read" on public.my_portfolio
    for select to authenticated using (user_id = auth.uid());
  create policy "own portfolio insert" on public.my_portfolio
    for insert to authenticated with check (user_id = auth.uid());
  create policy "own portfolio update" on public.my_portfolio
    for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  create policy "own portfolio delete" on public.my_portfolio
    for delete to authenticated using (user_id = auth.uid());

  alter table public.scraper_config
    add column if not exists user_id uuid references auth.users(id) on delete cascade;
  update public.scraper_config set user_id = admin_uid where user_id is null and admin_uid is not null;

  drop policy if exists "Authenticated read scraper_config" on public.scraper_config;
  drop policy if exists "Authenticated insert scraper_config" on public.scraper_config;
  drop policy if exists "Authenticated update scraper_config" on public.scraper_config;

  create policy "own scraper read" on public.scraper_config
    for select to authenticated using (user_id = auth.uid());
  create policy "own scraper insert" on public.scraper_config
    for insert to authenticated with check (user_id = auth.uid());
  create policy "own scraper update" on public.scraper_config
    for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
end $$;

create unique index if not exists scraper_config_user_id_key
  on public.scraper_config(user_id) where user_id is not null;
