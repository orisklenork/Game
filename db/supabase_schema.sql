-- Nightfall: Two-Player 3D Horror Survival Shooter
-- PostgreSQL / Supabase Relational Schema Migration

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  player_code text not null unique,
  username text not null unique,
  avatar_seed text not null default 'default',
  coins integer not null default 250 check (coins >= 0),
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  rank text not null default 'Recruit',
  equipped_weapon text not null default 'pistol',
  equipped_loadout jsonb not null default '{}'::jsonb,
  last_daily_claim timestamptz,
  daily_streak integer not null default 0,
  is_online boolean not null default false,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_username_lower on public.profiles (lower(username));

create table if not exists public.player_stats (
  player_id uuid primary key references public.profiles(id) on delete cascade,
  total_kills integer not null default 0,
  boss_kills integer not null default 0,
  matches_played integer not null default 0,
  matches_won integer not null default 0,
  highest_wave integer not null default 0,
  total_coins_earned integer not null default 0,
  favorite_weapon text not null default 'pistol',
  weapon_kills jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (player_id, friend_id),
  check (player_id <> friend_id)
);

create index if not exists idx_friends_player on public.friends (player_id);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (sender_id, receiver_id),
  check (sender_id <> receiver_id)
);

create table if not exists public.rooms (
  id text primary key,
  host_id uuid not null references public.profiles(id) on delete cascade,
  map_id text not null default 'hospital',
  difficulty text not null default 'normal',
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  max_players integer not null default 2 check (max_players = 2),
  created_at timestamptz not null default now()
);

create table if not exists public.room_members (
  room_id text not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  is_ready boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (room_id, player_id)
);

create table if not exists public.weapons (
  id text primary key,
  name text not null,
  category text not null,
  cost integer not null default 0
);

create table if not exists public.player_weapons (
  player_id uuid not null references public.profiles(id) on delete cascade,
  weapon_id text not null references public.weapons(id) on delete cascade,
  upgrade_level integer not null default 1 check (upgrade_level between 1 and 5),
  unlocked_at timestamptz not null default now(),
  primary key (player_id, weapon_id)
);

create table if not exists public.customization_items (
  id text primary key,
  name text not null,
  category text not null,
  cost integer not null default 0
);

create table if not exists public.player_customizations (
  player_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references public.customization_items(id) on delete cascade,
  equipped boolean not null default false,
  purchased_at timestamptz not null default now(),
  primary key (player_id, item_id)
);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in ('weapon', 'customization')),
  item_ref text not null,
  acquired_at timestamptz not null default now(),
  unique (player_id, item_type, item_ref)
);

create table if not exists public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_coin_tx_player on public.coin_transactions (player_id, created_at desc);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  room_id text,
  map_id text not null,
  difficulty text not null,
  waves_cleared integer not null default 0,
  victory boolean not null default false,
  duration_seconds integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.match_players (
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  kills integer not null default 0,
  boss_kills integer not null default 0,
  score integer not null default 0,
  coins_earned integer not null default 0,
  xp_earned integer not null default 0,
  survived boolean not null default true,
  primary key (match_id, player_id)
);

create table if not exists public.achievements (
  player_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key (player_id, achievement_id)
);

-- Enable Row Level Security across all tables
alter table public.profiles enable row level security;
alter table public.player_stats enable row level security;
alter table public.friends enable row level security;
alter table public.friend_requests enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.inventory enable row level security;
alter table public.weapons enable row level security;
alter table public.player_weapons enable row level security;
alter table public.customization_items enable row level security;
alter table public.player_customizations enable row level security;
alter table public.coin_transactions enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.achievements enable row level security;

-- Public read policies for leaderboards & catalog; writes routed through server-side RPC/Edge Functions
create policy "Public read profiles" on public.profiles for select using (true);
create policy "Public read stats" on public.player_stats for select using (true);
create policy "Public read weapons" on public.weapons for select using (true);
create policy "Public read customizations" on public.customization_items for select using (true);
