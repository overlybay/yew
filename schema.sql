-- YEW schema — run once in the yew Supabase project's SQL editor.

-- Businesses (YEW customers)
create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  category text,              -- 'plumber', 'dental', 'salon', 'hvac', 'roofer', ...
  owner_email text,
  plan text default 'trial',  -- 'trial' | 'audit' | 'revive' | 'complete'
  twilio_number text,         -- the YEW number assigned to them (after Twilio setup)
  created_at timestamptz default now()
);

-- Secret-shopper audits
create table if not exists audits (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  scheduled_for date not null default current_date,
  status text default 'scheduled',  -- 'scheduled' | 'calling' | 'completed' | 'failed'
  answered boolean,
  time_to_answer_sec int,
  greeting_score int,        -- 1-5 (AI graded)
  hold_time_sec int,
  outcome text,              -- 'booked' | 'voicemail' | 'no_answer' | 'busy' | 'other'
  overall_score int,         -- 0-100
  recording_url text,
  transcript text,
  ai_notes text,             -- qualitative findings
  lost_revenue_estimate numeric,
  created_at timestamptz default now()
);

-- Revive campaigns (dead-lead resurrection)
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  status text default 'draft',  -- 'draft' | 'active' | 'paused' | 'done'
  msg_day0 text,
  msg_day4 text,
  msg_day10 text,
  created_at timestamptz default now()
);

-- Dead leads uploaded per campaign
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  name text,
  phone text not null,
  service text,
  quote_date date,
  quote_amount numeric,
  status text default 'pending',  -- 'pending' | 'sent_1' | 'sent_2' | 'sent_3' | 'replied' | 'booked' | 'dead' | 'opted_out'
  last_sent_at timestamptz,
  created_at timestamptz default now()
);

-- SMS thread per lead
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  direction text not null,   -- 'out' | 'in'
  body text not null,
  twilio_sid text,
  created_at timestamptz default now()
);

-- Contact form submissions (businesses + investors)
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

-- Public read not needed; app uses anon key with RLS. For v1, businesses manage
-- their own rows via a simple magic code. Service role used by webhooks/cron.
alter table businesses enable row level security;
alter table audits enable row level security;
alter table campaigns enable row level security;
alter table leads enable row level security;
alter table messages enable row level security;

-- v1: allow anon read/write scoped by a per-business access code passed by the app.
-- (Tighten with Supabase Auth before scaling.)
create table if not exists business_codes (
  business_id uuid primary key references businesses(id) on delete cascade,
  code text not null unique
);
alter table business_codes enable row level security;

-- Permissive v1 policies (replace with auth-based policies when adding login)
drop policy if exists "v1 all businesses" on businesses;
create policy "v1 all businesses" on businesses for all using (true) with check (true);
drop policy if exists "v1 all audits" on audits;
create policy "v1 all audits" on audits for all using (true) with check (true);
drop policy if exists "v1 all campaigns" on campaigns;
create policy "v1 all campaigns" on campaigns for all using (true) with check (true);
drop policy if exists "v1 all leads" on leads;
create policy "v1 all leads" on leads for all using (true) with check (true);
drop policy if exists "v1 all messages" on messages;
create policy "v1 all messages" on messages for all using (true) with check (true);
drop policy if exists "v1 all codes" on business_codes;
create policy "v1 all codes" on business_codes for all using (true) with check (true);
alter table contact_messages enable row level security;
drop policy if exists "v1 all contact" on contact_messages;
create policy "v1 all contact" on contact_messages for all using (true) with check (true);
