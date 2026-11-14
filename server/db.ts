import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  ACHIEVEMENTS,
  CUSTOMIZATION_ITEMS,
  DEFAULT_LOADOUT,
  getLevelFromXp,
  getWeaponUpgradeCost,
  WEAPONS,
} from '../src/shared/gameData.ts';
import type { EquippedLoadout, WeaponId } from '../src/shared/gameData.ts';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'nightfall.db');
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize all 15 relational tables matching the Supabase schema
db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    player_code TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    session_token TEXT NOT NULL UNIQUE,
    avatar_seed TEXT NOT NULL DEFAULT 'crimson',
    coins INTEGER NOT NULL DEFAULT 300 CHECK (coins >= 0),
    xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
    level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
    rank TEXT NOT NULL DEFAULT 'Recruit',
    equipped_weapon TEXT NOT NULL DEFAULT 'pistol',
    equipped_loadout TEXT NOT NULL DEFAULT '{}',
    last_daily_claim TEXT,
    daily_streak INTEGER NOT NULL DEFAULT 0,
    is_online INTEGER NOT NULL DEFAULT 0,
    last_seen TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles (username);

  CREATE TABLE IF NOT EXISTS player_stats (
    player_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    total_kills INTEGER NOT NULL DEFAULT 0,
    boss_kills INTEGER NOT NULL DEFAULT 0,
    matches_played INTEGER NOT NULL DEFAULT 0,
    matches_won INTEGER NOT NULL DEFAULT 0,
    highest_wave INTEGER NOT NULL DEFAULT 0,
    total_coins_earned INTEGER NOT NULL DEFAULT 0,
    favorite_weapon TEXT NOT NULL DEFAULT 'pistol',
    weapon_kills TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS friends (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    friend_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (player_id, friend_id),
    CHECK (player_id <> friend_id)
  );

  CREATE TABLE IF NOT EXISTS friend_requests (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    receiver_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (sender_id, receiver_id),
    CHECK (sender_id <> receiver_id)
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    host_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    map_id TEXT NOT NULL DEFAULT 'hospital',
    difficulty TEXT NOT NULL DEFAULT 'normal',
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
    max_players INTEGER NOT NULL DEFAULT 2,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS room_members (
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    player_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    is_ready INTEGER NOT NULL DEFAULT 0,
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (room_id, player_id)
  );

  CREATE TABLE IF NOT EXISTS weapons (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    cost INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS player_weapons (
    player_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    weapon_id TEXT NOT NULL REFERENCES weapons(id) ON DELETE CASCADE,
    upgrade_level INTEGER NOT NULL DEFAULT 1 CHECK (upgrade_level BETWEEN 1 AND 5),
    unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (player_id, weapon_id)
  );

  CREATE TABLE IF NOT EXISTS customization_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    cost INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS player_customizations (
    player_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES customization_items(id) ON DELETE CASCADE,
    equipped INTEGER NOT NULL DEFAULT 0,
    purchased_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (player_id, item_id)
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('weapon', 'customization')),
    item_ref TEXT NOT NULL,
    acquired_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (player_id, item_type, item_ref)
  );

  CREATE TABLE IF NOT EXISTS coin_transactions (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    room_id TEXT,
    map_id TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    waves_cleared INTEGER NOT NULL DEFAULT 0,
    victory INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS match_players (
    match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    player_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    kills INTEGER NOT NULL DEFAULT 0,
    boss_kills INTEGER NOT NULL DEFAULT 0,
    score INTEGER NOT NULL DEFAULT 0,
    coins_earned INTEGER NOT NULL DEFAULT 0,
    xp_earned INTEGER NOT NULL DEFAULT 0,
    survived INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (match_id, player_id)
  );

  CREATE TABLE IF NOT EXISTS achievements (
    player_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL,
    unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (player_id, achievement_id)
  );

  CREATE TABLE IF NOT EXISTS daily_missions (
    player_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    mission_date TEXT NOT NULL,
    kills_today INTEGER NOT NULL DEFAULT 0,
    matches_today INTEGER NOT NULL DEFAULT 0,
    claimed_kills INTEGER NOT NULL DEFAULT 0,
    claimed_matches INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (player_id, mission_date)
  );
`);

// Seed weapons & customization catalogs
const upsertWeapon = db.prepare(`
  INSERT INTO weapons (id, name, category, cost) VALUES (?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET name=excluded.name, category=excluded.category, cost=excluded.cost
`);
for (const w of Object.values(WEAPONS)) {
  upsertWeapon.run(w.id, w.name, w.category, w.cost);
}

const upsertCustom = db.prepare(`
  INSERT INTO customization_items (id, name, category, cost) VALUES (?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET name=excluded.name, category=excluded.category, cost=excluded.cost
`);
for (const item of CUSTOMIZATION_ITEMS) {
  upsertCustom.run(item.id, item.name, item.category, item.cost);
}

function generatePlayerCode(): string {
  const num = crypto.randomInt(100000, 999999);
  return `NF-${num}`;
}

export interface FullPlayerProfile {
  id: string;
  playerCode: string;
  username: string;
  avatarSeed: string;
  coins: number;
  xp: number;
  level: number;
  rank: string;
  equippedWeapon: WeaponId;
  equippedLoadout: EquippedLoadout;
  lastDailyClaim: string | null;
  dailyStreak: number;
  stats: {
    totalKills: number;
    bossKills: number;
    matchesPlayed: number;
    matchesWon: number;
    highestWave: number;
    totalCoinsEarned: number;
    favoriteWeapon: string;
  };
  weapons: Record<string, { upgradeLevel: number }>;
  customizations: string[];
  achievements: string[];
  dailyMission: {
    date: string;
    killsToday: number;
    matchesToday: number;
    claimedKills: boolean;
    claimedMatches: boolean;
  };
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isUsernameAvailable(username: string): { valid: boolean; available: boolean; reason?: string } {
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 18) {
    return { valid: false, available: false, reason: 'Username must be 3–18 characters.' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return { valid: false, available: false, reason: 'Only letters, numbers, underscores, and hyphens allowed.' };
  }
  const row = db.prepare('SELECT id FROM profiles WHERE username = ? COLLATE NOCASE').get(trimmed);
  return { valid: true, available: !row, reason: row ? 'Username already taken.' : undefined };
}

export function createAccount(username: string): { token: string; profile: FullPlayerProfile } {
  const trimmed = username.trim();
  const check = isUsernameAvailable(trimmed);
  if (!check.valid || !check.available) {
    throw new Error(check.reason || 'Username unavailable');
  }

  const id = crypto.randomUUID();
  let playerCode = generatePlayerCode();
  while (db.prepare('SELECT id FROM profiles WHERE player_code = ?').get(playerCode)) {
    playerCode = generatePlayerCode();
  }
  const token = crypto.randomBytes(32).toString('hex');
  const avatarSeeds = ['crimson', 'obsidian', 'cobalt', 'bone', 'ember', 'ash'];
  const avatarSeed = avatarSeeds[crypto.randomInt(0, avatarSeeds.length)];

  const createTx = db.transaction(() => {
    db.prepare(`
      INSERT INTO profiles (id, player_code, username, session_token, avatar_seed, coins, xp, level, rank, equipped_weapon, equipped_loadout, is_online)
      VALUES (?, ?, ?, ?, ?, 350, 0, 1, 'Recruit', 'pistol', ?, 1)
    `).run(id, playerCode, trimmed, token, avatarSeed, JSON.stringify(DEFAULT_LOADOUT));

    db.prepare(`INSERT INTO player_stats (player_id) VALUES (?)`).run(id);

    // Starter weapon & free customization items
    db.prepare(`INSERT INTO player_weapons (player_id, weapon_id, upgrade_level) VALUES (?, 'pistol', 1)`).run(id);
    db.prepare(`INSERT INTO inventory (id, player_id, item_type, item_ref) VALUES (?, ?, 'weapon', 'pistol')`).run(crypto.randomUUID(), id);

    for (const item of CUSTOMIZATION_ITEMS) {
      if (item.cost === 0) {
        const isDefault = Object.values(DEFAULT_LOADOUT).includes(item.id);
        db.prepare(`INSERT INTO player_customizations (player_id, item_id, equipped) VALUES (?, ?, ?)`).run(id, item.id, isDefault ? 1 : 0);
        db.prepare(`INSERT INTO inventory (id, player_id, item_type, item_ref) VALUES (?, ?, 'customization', ?)`).run(crypto.randomUUID(), id, item.id);
      }
    }

    db.prepare(`INSERT INTO coin_transactions (id, player_id, amount, reason) VALUES (?, ?, 350, 'starter_grant')`).run(crypto.randomUUID(), id);
  });

  createTx();
  const profile = getFullProfileById(id);
  if (!profile) throw new Error('Failed to create profile');
  return { token, profile };
}

export function getProfileByToken(token: string): FullPlayerProfile | null {
  if (!token) return null;
  const row = db.prepare('SELECT id FROM profiles WHERE session_token = ?').get(token) as { id: string } | undefined;
  if (!row) return null;
  db.prepare(`UPDATE profiles SET last_seen = datetime('now'), is_online = 1 WHERE id = ?`).run(row.id);
  return getFullProfileById(row.id);
}

export function getFullProfileById(playerId: string): FullPlayerProfile | null {
  const p = db.prepare('SELECT * FROM profiles WHERE id = ?').get(playerId) as any;
  if (!p) return null;

  const s = db.prepare('SELECT * FROM player_stats WHERE player_id = ?').get(playerId) as any;
  const weaponRows = db.prepare('SELECT weapon_id, upgrade_level FROM player_weapons WHERE player_id = ?').all(playerId) as any[];
  const customRows = db.prepare('SELECT item_id FROM player_customizations WHERE player_id = ?').all(playerId) as any[];
  const achRows = db.prepare('SELECT achievement_id FROM achievements WHERE player_id = ?').all(playerId) as any[];

  const date = todayKey();
  db.prepare(`INSERT OR IGNORE INTO daily_missions (player_id, mission_date) VALUES (?, ?)`).run(playerId, date);
  const dm = db.prepare('SELECT * FROM daily_missions WHERE player_id = ? AND mission_date = ?').get(playerId, date) as any;

  const weapons: Record<string, { upgradeLevel: number }> = {};
  for (const w of weaponRows) {
    weapons[w.weapon_id] = { upgradeLevel: w.upgrade_level };
  }

  let loadout: EquippedLoadout = { ...DEFAULT_LOADOUT };
  try {
    loadout = { ...DEFAULT_LOADOUT, ...JSON.parse(p.equipped_loadout || '{}') };
  } catch {
    loadout = { ...DEFAULT_LOADOUT };
  }

  return {
    id: p.id,
    playerCode: p.player_code,
    username: p.username,
    avatarSeed: p.avatar_seed,
    coins: p.coins,
    xp: p.xp,
    level: p.level,
    rank: p.rank,
    equippedWeapon: (p.equipped_weapon || 'pistol') as WeaponId,
    equippedLoadout: loadout,
    lastDailyClaim: p.last_daily_claim,
    dailyStreak: p.daily_streak,
    stats: {
      totalKills: s?.total_kills || 0,
      bossKills: s?.boss_kills || 0,
      matchesPlayed: s?.matches_played || 0,
      matchesWon: s?.matches_won || 0,
      highestWave: s?.highest_wave || 0,
      totalCoinsEarned: s?.total_coins_earned || 0,
      favoriteWeapon: s?.favorite_weapon || 'pistol',
    },
    weapons,
    customizations: customRows.map((c) => c.item_id),
    achievements: achRows.map((a) => a.achievement_id),
    dailyMission: {
      date,
      killsToday: dm?.kills_today || 0,
      matchesToday: dm?.matches_today || 0,
      claimedKills: Boolean(dm?.claimed_kills),
      claimedMatches: Boolean(dm?.claimed_matches),
    },
  };
}

export function buyWeapon(playerId: string, weaponId: WeaponId): FullPlayerProfile {
  const def = WEAPONS[weaponId];
  if (!def) throw new Error('Invalid weapon');

  const tx = db.transaction(() => {
    const owned = db.prepare('SELECT 1 FROM player_weapons WHERE player_id = ? AND weapon_id = ?').get(playerId, weaponId);
    if (owned) throw new Error('Weapon already unlocked');

    const p = db.prepare('SELECT coins FROM profiles WHERE id = ?').get(playerId) as { coins: number } | undefined;
    if (!p || p.coins < def.cost) throw new Error('Insufficient coins');

    db.prepare('UPDATE profiles SET coins = coins - ?, equipped_weapon = ? WHERE id = ?').run(def.cost, weaponId, playerId);
    db.prepare('INSERT INTO player_weapons (player_id, weapon_id, upgrade_level) VALUES (?, ?, 1)').run(playerId, weaponId);
    db.prepare('INSERT OR IGNORE INTO inventory (id, player_id, item_type, item_ref) VALUES (?, ?, ?, ?)').run(
      crypto.randomUUID(),
      playerId,
      'weapon',
      weaponId
    );
    db.prepare('INSERT INTO coin_transactions (id, player_id, amount, reason, metadata) VALUES (?, ?, ?, ?, ?)').run(
      crypto.randomUUID(),
      playerId,
      -def.cost,
      'weapon_purchase',
      JSON.stringify({ weaponId })
    );
    checkAndUnlockAchievements(playerId);
  });

  tx();
  return getFullProfileById(playerId)!;
}

export function upgradeWeapon(playerId: string, weaponId: WeaponId): FullPlayerProfile {
  const tx = db.transaction(() => {
    const pw = db.prepare('SELECT upgrade_level FROM player_weapons WHERE player_id = ? AND weapon_id = ?').get(playerId, weaponId) as
      | { upgrade_level: number }
      | undefined;
    if (!pw) throw new Error('Weapon not owned');
    if (pw.upgrade_level >= 5) throw new Error('Weapon is already max level');

    const cost = getWeaponUpgradeCost(pw.upgrade_level);
    const p = db.prepare('SELECT coins FROM profiles WHERE id = ?').get(playerId) as { coins: number };
    if (p.coins < cost) throw new Error('Insufficient coins');

    db.prepare('UPDATE profiles SET coins = coins - ? WHERE id = ?').run(cost, playerId);
    db.prepare('UPDATE player_weapons SET upgrade_level = upgrade_level + 1 WHERE player_id = ? AND weapon_id = ?').run(playerId, weaponId);
    db.prepare('INSERT INTO coin_transactions (id, player_id, amount, reason, metadata) VALUES (?, ?, ?, ?, ?)').run(
      crypto.randomUUID(),
      playerId,
      -cost,
      'weapon_upgrade',
      JSON.stringify({ weaponId, newLevel: pw.upgrade_level + 1 })
    );
  });

  tx();
  return getFullProfileById(playerId)!;
}

export function equipWeapon(playerId: string, weaponId: WeaponId): FullPlayerProfile {
  const owned = db.prepare('SELECT 1 FROM player_weapons WHERE player_id = ? AND weapon_id = ?').get(playerId, weaponId);
  if (!owned) throw new Error('Weapon not unlocked');
  db.prepare('UPDATE profiles SET equipped_weapon = ? WHERE id = ?').run(weaponId, playerId);
  return getFullProfileById(playerId)!;
}

export function buyCustomization(playerId: string, itemId: string): FullPlayerProfile {
  const def = CUSTOMIZATION_ITEMS.find((i) => i.id === itemId);
  if (!def) throw new Error('Invalid customization item');

  const tx = db.transaction(() => {
    const owned = db.prepare('SELECT 1 FROM player_customizations WHERE player_id = ? AND item_id = ?').get(playerId, itemId);
    if (owned) throw new Error('Item already owned');

    const p = db.prepare('SELECT coins, equipped_loadout FROM profiles WHERE id = ?').get(playerId) as any;
    if (!p || p.coins < def.cost) throw new Error('Insufficient coins');

    const loadout = { ...DEFAULT_LOADOUT, ...JSON.parse(p.equipped_loadout || '{}'), [def.category]: itemId };
    db.prepare('UPDATE profiles SET coins = coins - ?, equipped_loadout = ? WHERE id = ?').run(def.cost, JSON.stringify(loadout), playerId);
    db.prepare('INSERT INTO player_customizations (player_id, item_id, equipped) VALUES (?, ?, 1)').run(playerId, itemId);
    db.prepare('INSERT OR IGNORE INTO inventory (id, player_id, item_type, item_ref) VALUES (?, ?, ?, ?)').run(
      crypto.randomUUID(),
      playerId,
      'customization',
      itemId
    );
    db.prepare('INSERT INTO coin_transactions (id, player_id, amount, reason, metadata) VALUES (?, ?, ?, ?, ?)').run(
      crypto.randomUUID(),
      playerId,
      -def.cost,
      'customization_purchase',
      JSON.stringify({ itemId })
    );
  });

  tx();
  return getFullProfileById(playerId)!;
}

export function equipCustomization(playerId: string, itemId: string): FullPlayerProfile {
  const def = CUSTOMIZATION_ITEMS.find((i) => i.id === itemId);
  if (!def) throw new Error('Invalid item');
  const owned = db.prepare('SELECT 1 FROM player_customizations WHERE player_id = ? AND item_id = ?').get(playerId, itemId);
  if (!owned) throw new Error('Item not owned');

  const p = db.prepare('SELECT equipped_loadout FROM profiles WHERE id = ?').get(playerId) as any;
  const loadout = { ...DEFAULT_LOADOUT, ...JSON.parse(p?.equipped_loadout || '{}'), [def.category]: itemId };
  db.prepare('UPDATE profiles SET equipped_loadout = ? WHERE id = ?').run(JSON.stringify(loadout), playerId);
  return getFullProfileById(playerId)!;
}

export function claimDailyReward(playerId: string): { profile: FullPlayerProfile; rewardCoins: number } {
  const today = todayKey();
  let rewardCoins = 0;

  const tx = db.transaction(() => {
    const p = db.prepare('SELECT last_daily_claim, daily_streak FROM profiles WHERE id = ?').get(playerId) as any;
    if (!p) throw new Error('Player not found');
    if (p.last_daily_claim === today) throw new Error('Daily reward already claimed today');

    const newStreak = (p.daily_streak || 0) + 1;
    rewardCoins = 120 + Math.min(newStreak, 7) * 30;
    db.prepare('UPDATE profiles SET coins = coins + ?, last_daily_claim = ?, daily_streak = ? WHERE id = ?').run(
      rewardCoins,
      today,
      newStreak,
      playerId
    );
    db.prepare('UPDATE player_stats SET total_coins_earned = total_coins_earned + ? WHERE player_id = ?').run(rewardCoins, playerId);
    db.prepare('INSERT INTO coin_transactions (id, player_id, amount, reason) VALUES (?, ?, ?, ?)').run(
      crypto.randomUUID(),
      playerId,
      rewardCoins,
      'daily_reward'
    );
  });

  tx();
  return { profile: getFullProfileById(playerId)!, rewardCoins };
}

export function claimDailyMission(playerId: string, missionType: 'kills' | 'matches'): { profile: FullPlayerProfile; rewardCoins: number } {
  const today = todayKey();
  let rewardCoins = 0;

  const tx = db.transaction(() => {
    db.prepare('INSERT OR IGNORE INTO daily_missions (player_id, mission_date) VALUES (?, ?)').run(playerId, today);
    const dm = db.prepare('SELECT * FROM daily_missions WHERE player_id = ? AND mission_date = ?').get(playerId, today) as any;

    if (missionType === 'kills') {
      if (dm.claimed_kills) throw new Error('Mission already claimed');
      if (dm.kills_today < 25) throw new Error('Eliminate 25 monsters today to claim');
      rewardCoins = 180;
      db.prepare('UPDATE daily_missions SET claimed_kills = 1 WHERE player_id = ? AND mission_date = ?').run(playerId, today);
    } else {
      if (dm.claimed_matches) throw new Error('Mission already claimed');
      if (dm.matches_today < 2) throw new Error('Complete 2 matches today to claim');
      rewardCoins = 200;
      db.prepare('UPDATE daily_missions SET claimed_matches = 1 WHERE player_id = ? AND mission_date = ?').run(playerId, today);
    }

    db.prepare('UPDATE profiles SET coins = coins + ? WHERE id = ?').run(rewardCoins, playerId);
    db.prepare('UPDATE player_stats SET total_coins_earned = total_coins_earned + ? WHERE player_id = ?').run(rewardCoins, playerId);
    db.prepare('INSERT INTO coin_transactions (id, player_id, amount, reason, metadata) VALUES (?, ?, ?, ?, ?)').run(
      crypto.randomUUID(),
      playerId,
      rewardCoins,
      'daily_mission',
      JSON.stringify({ missionType })
    );
  });

  tx();
  return { profile: getFullProfileById(playerId)!, rewardCoins };
}

export function spendMatchHealthCoin(playerId: string, cost: number): number {
  const tx = db.transaction(() => {
    const p = db.prepare('SELECT coins FROM profiles WHERE id = ?').get(playerId) as { coins: number } | undefined;
    if (!p || p.coins < cost) throw new Error('Not enough coins for emergency medkit');
    db.prepare('UPDATE profiles SET coins = coins - ? WHERE id = ?').run(cost, playerId);
    db.prepare('INSERT INTO coin_transactions (id, player_id, amount, reason) VALUES (?, ?, ?, ?)').run(
      crypto.randomUUID(),
      playerId,
      -cost,
      'match_health_purchase'
    );
    return p.coins - cost;
  });
  return tx();
}

export function checkAndUnlockAchievements(playerId: string) {
  const stats = db.prepare('SELECT * FROM player_stats WHERE player_id = ?').get(playerId) as any;
  const weaponCount = (db.prepare('SELECT COUNT(*) as cnt FROM player_weapons WHERE player_id = ?').get(playerId) as any).cnt;
  const owned = new Set(
    (db.prepare('SELECT achievement_id FROM achievements WHERE player_id = ?').all(playerId) as any[]).map((r) => r.achievement_id)
  );

  for (const ach of ACHIEVEMENTS) {
    if (owned.has(ach.id)) continue;
    let val = 0;
    if (ach.statKey === 'total_kills') val = stats?.total_kills || 0;
    else if (ach.statKey === 'boss_kills') val = stats?.boss_kills || 0;
    else if (ach.statKey === 'matches_won') val = stats?.matches_won || 0;
    else if (ach.statKey === 'matches_played') val = stats?.matches_played || 0;
    else if (ach.statKey === 'weapons_unlocked') val = weaponCount;

    if (val >= ach.target) {
      db.prepare('INSERT OR IGNORE INTO achievements (player_id, achievement_id) VALUES (?, ?)').run(playerId, ach.id);
      db.prepare('UPDATE profiles SET coins = coins + ? WHERE id = ?').run(ach.rewardCoins, playerId);
      db.prepare('UPDATE player_stats SET total_coins_earned = total_coins_earned + ? WHERE player_id = ?').run(ach.rewardCoins, playerId);
      db.prepare('INSERT INTO coin_transactions (id, player_id, amount, reason, metadata) VALUES (?, ?, ?, ?, ?)').run(
        crypto.randomUUID(),
        playerId,
        ach.rewardCoins,
        'achievement_reward',
        JSON.stringify({ achievementId: ach.id })
      );
    }
  }
}

export function recordMatchResult(params: {
  roomId: string | null;
  mapId: string;
  difficulty: string;
  wavesCleared: number;
  victory: boolean;
  durationSeconds: number;
  players: Array<{
    playerId: string;
    kills: number;
    bossKills: number;
    score: number;
    coinsEarned: number;
    xpEarned: number;
    survived: boolean;
    weaponKills: Record<string, number>;
  }>;
}) {
  const matchId = crypto.randomUUID();
  const today = todayKey();

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO matches (id, room_id, map_id, difficulty, waves_cleared, victory, duration_seconds)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(matchId, params.roomId, params.mapId, params.difficulty, params.wavesCleared, params.victory ? 1 : 0, params.durationSeconds);

    for (const mp of params.players) {
      db.prepare(`
        INSERT INTO match_players (match_id, player_id, kills, boss_kills, score, coins_earned, xp_earned, survived)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(matchId, mp.playerId, mp.kills, mp.bossKills, mp.score, mp.coinsEarned, mp.xpEarned, mp.survived ? 1 : 0);

      const profile = db.prepare('SELECT xp FROM profiles WHERE id = ?').get(mp.playerId) as { xp: number } | undefined;
      if (!profile) continue;

      const newXp = profile.xp + mp.xpEarned;
      const lvlInfo = getLevelFromXp(newXp);

      db.prepare('UPDATE profiles SET coins = coins + ?, xp = ?, level = ?, rank = ? WHERE id = ?').run(
        mp.coinsEarned,
        newXp,
        lvlInfo.level,
        lvlInfo.rank,
        mp.playerId
      );

      const oldStats = db.prepare('SELECT * FROM player_stats WHERE player_id = ?').get(mp.playerId) as any;
      const mergedWeaponKills: Record<string, number> = JSON.parse(oldStats?.weapon_kills || '{}');
      for (const [w, k] of Object.entries(mp.weaponKills)) {
        mergedWeaponKills[w] = (mergedWeaponKills[w] || 0) + k;
      }
      let favWeapon = oldStats?.favorite_weapon || 'pistol';
      let maxWepKills = -1;
      for (const [w, k] of Object.entries(mergedWeaponKills)) {
        if (k > maxWepKills) {
          maxWepKills = k;
          favWeapon = w;
        }
      }

      db.prepare(`
        UPDATE player_stats
        SET total_kills = total_kills + ?,
            boss_kills = boss_kills + ?,
            matches_played = matches_played + 1,
            matches_won = matches_won + ?,
            highest_wave = MAX(highest_wave, ?),
            total_coins_earned = total_coins_earned + ?,
            favorite_weapon = ?,
            weapon_kills = ?,
            updated_at = datetime('now')
        WHERE player_id = ?
      `).run(
        mp.kills,
        mp.bossKills,
        params.victory ? 1 : 0,
        params.wavesCleared,
        mp.coinsEarned,
        favWeapon,
        JSON.stringify(mergedWeaponKills),
        mp.playerId
      );

      if (mp.coinsEarned > 0) {
        db.prepare('INSERT INTO coin_transactions (id, player_id, amount, reason, metadata) VALUES (?, ?, ?, ?, ?)').run(
          crypto.randomUUID(),
          mp.playerId,
          mp.coinsEarned,
          'match_reward',
          JSON.stringify({ matchId, wavesCleared: params.wavesCleared, victory: params.victory })
        );
      }

      db.prepare('INSERT OR IGNORE INTO daily_missions (player_id, mission_date) VALUES (?, ?)').run(mp.playerId, today);
      db.prepare(`
        UPDATE daily_missions
        SET kills_today = kills_today + ?, matches_today = matches_today + 1
        WHERE player_id = ? AND mission_date = ?
      `).run(mp.kills, mp.playerId, today);

      checkAndUnlockAchievements(mp.playerId);
    }
  });

  tx();
  return matchId;
}

// Friends & Social
export function searchPlayers(query: string, excludeId: string) {
  const q = `%${query.trim()}%`;
  return db
    .prepare(
      `SELECT p.id, p.player_code, p.username, p.avatar_seed, p.level, p.rank, p.is_online,
              s.total_kills, s.matches_won
       FROM profiles p
       JOIN player_stats s ON s.player_id = p.id
       WHERE p.id <> ? AND (p.username LIKE ? OR p.player_code LIKE ?)
       ORDER BY p.is_online DESC, s.total_kills DESC
       LIMIT 15`
    )
    .all(excludeId, q, q);
}

export function getFriendsData(playerId: string, onlineIds: Set<string>) {
  const friends = db
    .prepare(
      `SELECT p.id, p.player_code, p.username, p.avatar_seed, p.level, p.rank, p.coins,
              s.total_kills, s.matches_played, s.matches_won, s.highest_wave
       FROM friends f
       JOIN profiles p ON p.id = f.friend_id
       JOIN player_stats s ON s.player_id = p.id
       WHERE f.player_id = ?`
    )
    .all(playerId) as any[];

  const incoming = db
    .prepare(
      `SELECT fr.id, p.id as sender_id, p.username, p.player_code, p.level, p.rank
       FROM friend_requests fr
       JOIN profiles p ON p.id = fr.sender_id
       WHERE fr.receiver_id = ? AND fr.status = 'pending'`
    )
    .all(playerId);

  const outgoing = db
    .prepare(
      `SELECT fr.id, p.id as receiver_id, p.username, p.player_code, p.level
       FROM friend_requests fr
       JOIN profiles p ON p.id = fr.receiver_id
       WHERE fr.sender_id = ? AND fr.status = 'pending'`
    )
    .all(playerId);

  return {
    friends: friends.map((f) => ({ ...f, is_online: onlineIds.has(f.id) })),
    incoming,
    outgoing,
  };
}

export function sendFriendRequest(senderId: string, targetUsernameOrId: string) {
  const target = db
    .prepare('SELECT id FROM profiles WHERE id = ? OR username = ? COLLATE NOCASE')
    .get(targetUsernameOrId, targetUsernameOrId) as { id: string } | undefined;
  if (!target) throw new Error('Player not found');
  if (target.id === senderId) throw new Error('Cannot add yourself');

  const alreadyFriend = db.prepare('SELECT 1 FROM friends WHERE player_id = ? AND friend_id = ?').get(senderId, target.id);
  if (alreadyFriend) throw new Error('Already friends');

  const existing = db
    .prepare('SELECT id, status FROM friend_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)')
    .get(senderId, target.id, target.id, senderId) as any;

  if (existing && existing.status === 'pending') {
    throw new Error('Friend request already pending');
  }

  if (existing) {
    db.prepare('DELETE FROM friend_requests WHERE id = ?').run(existing.id);
  }

  db.prepare('INSERT INTO friend_requests (id, sender_id, receiver_id, status) VALUES (?, ?, ?, ?)').run(
    crypto.randomUUID(),
    senderId,
    target.id,
    'pending'
  );
  return target.id;
}

export function respondFriendRequest(playerId: string, requestId: string, accept: boolean) {
  const req = db.prepare('SELECT * FROM friend_requests WHERE id = ? AND receiver_id = ?').get(requestId, playerId) as any;
  if (!req) throw new Error('Friend request not found');

  const tx = db.transaction(() => {
    if (accept) {
      db.prepare('UPDATE friend_requests SET status = ? WHERE id = ?').run('accepted', requestId);
      db.prepare('INSERT OR IGNORE INTO friends (id, player_id, friend_id) VALUES (?, ?, ?)').run(
        crypto.randomUUID(),
        req.sender_id,
        req.receiver_id
      );
      db.prepare('INSERT OR IGNORE INTO friends (id, player_id, friend_id) VALUES (?, ?, ?)').run(
        crypto.randomUUID(),
        req.receiver_id,
        req.sender_id
      );
    } else {
      db.prepare('UPDATE friend_requests SET status = ? WHERE id = ?').run('declined', requestId);
    }
  });
  tx();
}

export function removeFriend(playerId: string, friendId: string) {
  db.prepare('DELETE FROM friends WHERE (player_id = ? AND friend_id = ?) OR (player_id = ? AND friend_id = ?)').run(
    playerId,
    friendId,
    friendId,
    playerId
  );
}

export function getLeaderboard(playerId: string, scope: 'global' | 'friends') {
  if (scope === 'friends') {
    return db
      .prepare(
        `SELECT p.id, p.player_code, p.username, p.level, p.xp, p.rank, p.coins,
                s.total_kills, s.matches_won, s.highest_wave
         FROM profiles p
         JOIN player_stats s ON s.player_id = p.id
         WHERE p.id = ? OR p.id IN (SELECT friend_id FROM friends WHERE player_id = ?)
         ORDER BY s.total_kills DESC, p.xp DESC
         LIMIT 50`
      )
      .all(playerId, playerId);
  }
  return db
    .prepare(
      `SELECT p.id, p.player_code, p.username, p.level, p.xp, p.rank, p.coins,
              s.total_kills, s.matches_won, s.highest_wave
       FROM profiles p
       JOIN player_stats s ON s.player_id = p.id
       ORDER BY s.total_kills DESC, p.xp DESC
       LIMIT 50`
    )
    .all();
}

export function getMatchHistory(playerId: string) {
  return db
    .prepare(
      `SELECT m.id, m.map_id, m.difficulty, m.waves_cleared, m.victory, m.duration_seconds, m.created_at,
              mp.kills, mp.boss_kills, mp.score, mp.coins_earned, mp.xp_earned, mp.survived
       FROM match_players mp
       JOIN matches m ON m.id = mp.match_id
       WHERE mp.player_id = ?
       ORDER BY m.created_at DESC
       LIMIT 20`
    )
    .all(playerId);
}
