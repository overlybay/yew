-- YEW contact form table — run once in Supabase Dashboard → SQL Editor → New query → Run
create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  kind text not null,        -- 'business' | 'investor'
  name text,
  email text not null,
  company text,
  message text,
  read boolean default false,
  created_at timestamptz default now()
);
alter table contact_messages enable row level security;
drop policy if exists "v1 all contact" on contact_messages;
create policy "v1 all contact" on contact_messages for all using (true) with check (true);
