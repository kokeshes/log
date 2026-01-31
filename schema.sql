-- 実行用SQL（Supabase SQL Editorに貼る）
create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('Counselling','Note','Analyse','Dream','Trace','ErrLog','Other')),
  title text not null default '',
  body text not null default '',
  tags text[] not null default '{}'::text[],
  mood int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists logs_user_id_idx on public.logs(user_id);
create index if not exists logs_kind_idx on public.logs(kind);
create index if not exists logs_created_at_idx on public.logs(created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_logs_updated_at on public.logs;
create trigger trg_logs_updated_at
before update on public.logs
for each row execute function public.set_updated_at();

alter table public.logs enable row level security;

drop policy if exists "read own logs" on public.logs;
create policy "read own logs"
on public.logs for select
using (auth.uid() = user_id);

drop policy if exists "insert own logs" on public.logs;
create policy "insert own logs"
on public.logs for insert
with check (auth.uid() = user_id);

drop policy if exists "update own logs" on public.logs;
create policy "update own logs"
on public.logs for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "delete own logs" on public.logs;
create policy "delete own logs"
on public.logs for delete
using (auth.uid() = user_id);
