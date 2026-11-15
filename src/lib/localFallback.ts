import {
  ACHIEVEMENTS,
  CUSTOMIZATION_ITEMS,
  DEFAULT_LOADOUT,
  getLevelFromXp,
  getWeaponUpgradeCost,
  WEAPONS,
  WeaponId,
} from '../shared/gameData';
import type { PlayerProfile } from './api';

const LOCAL_PROFILE_KEY = 'nightfall_local_profile_v1';
const LOCAL_HISTORY_KEY = 'nightfall_local_history_v1';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getStoredProfile(): PlayerProfile | null {
  try {
    const raw = localStorage.getItem(LOCAL_PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PlayerProfile;
    const today = todayKey();
    if (!p.dailyMission || p.dailyMission.date !== today) {
      p.dailyMission = {
        date: today,
        killsToday: 0,
        matchesToday: 0,
        claimedKills: false,
        claimedMatches: false,
      };
    }
    return p;
  } catch {
    return null;
  }
}

function saveStoredProfile(profile: PlayerProfile): PlayerProfile {
  localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

function createLocalProfile(username: string): { token: string; profile: PlayerProfile } {
  const clean = username.trim();
  if (clean.length < 3 || clean.length > 18 || !/^[a-zA-Z0-9_-]+$/.test(clean)) {
    throw new Error('Username must be 3–18 characters using letters, numbers, _ or -.');
  }
  const id = `local-${Math.random().toString(36).slice(2, 10)}`;
  const codeNum = Math.floor(100000 + Math.random() * 900000);
  const avatarSeeds = ['crimson', 'obsidian', 'cobalt', 'bone', 'ember', 'ash'];
  const avatarSeed = avatarSeeds[Math.floor(Math.random() * avatarSeeds.length)];
  const defaultCustomIds = CUSTOMIZATION_ITEMS.filter((i) => i.cost === 0).map((i) => i.id);

  const profile: PlayerProfile = {
    id,
    playerCode: `NF-${codeNum}`,
    username: clean,
    avatarSeed,
    coins: 350,
    xp: 0,
    level: 1,
    rank: 'Recruit',
    equippedWeapon: 'pistol',
    equippedLoadout: { ...DEFAULT_LOADOUT },
    lastDailyClaim: null,
    dailyStreak: 0,
    stats: {
      totalKills: 0,
      bossKills: 0,
      matchesPlayed: 0,
      matchesWon: 0,
      highestWave: 0,
      totalCoinsEarned: 350,
      favoriteWeapon: 'pistol',
    },
    weapons: { pistol: { upgradeLevel: 1 } },
    customizations: defaultCustomIds,
    achievements: [],
    dailyMission: {
      date: todayKey(),
      killsToday: 0,
      matchesToday: 0,
      claimedKills: false,
      claimedMatches: false,
    },
  };
  saveStoredProfile(profile);
  return { token: `local-token-${id}`, profile };
}

function checkAchievements(profile: PlayerProfile) {
  for (const ach of ACHIEVEMENTS) {
    if (profile.achievements.includes(ach.id)) continue;
    let current = 0;
    if (ach.statKey === 'total_kills') current = profile.stats.totalKills;
    else if (ach.statKey === 'boss_kills') current = profile.stats.bossKills;
    else if (ach.statKey === 'matches_won') current = profile.stats.matchesWon;
    else if (ach.statKey === 'matches_played') current = profile.stats.matchesPlayed;
    else if (ach.statKey === 'weapons_unlocked') current = Object.keys(profile.weapons).length;
    if (current >= ach.target) {
      profile.achievements.push(ach.id);
      profile.coins += ach.rewardCoins;
      profile.stats.totalCoinsEarned += ach.rewardCoins;
    }
  }
}

export function recordLocalMatchOutcome(params: {
  mapId: string;
  difficulty: string;
  wavesCleared: number;
  victory: boolean;
  durationSeconds: number;
  kills: number;
  bossKills: number;
  score: number;
  coinsEarned: number;
  xpEarned: number;
}): PlayerProfile | null {
  const profile = getStoredProfile();
  if (!profile) return null;

  profile.coins += params.coinsEarned;
  profile.xp += params.xpEarned;
  const lvlInfo = getLevelFromXp(profile.xp);
  profile.level = lvlInfo.level;
  profile.rank = lvlInfo.rank;

  profile.stats.totalKills += params.kills;
  profile.stats.bossKills += params.bossKills;
  profile.stats.matchesPlayed += 1;
  if (params.victory) profile.stats.matchesWon += 1;
  profile.stats.highestWave = Math.max(profile.stats.highestWave, params.wavesCleared);
  profile.stats.totalCoinsEarned += params.coinsEarned;
  profile.stats.favoriteWeapon = profile.equippedWeapon;

  profile.dailyMission.killsToday += params.kills;
  profile.dailyMission.matchesToday += 1;

  checkAchievements(profile);
  saveStoredProfile(profile);

  try {
    const prev = JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) || '[]');
    prev.unshift({
      id: `match-${Date.now()}`,
      map_id: params.mapId,
      difficulty: params.difficulty,
      waves_cleared: params.wavesCleared,
      victory: params.victory ? 1 : 0,
      duration_seconds: params.durationSeconds,
      kills: params.kills,
      score: params.score,
      coins_earned: params.coinsEarned,
      created_at: new Date().toISOString(),
    });
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(prev.slice(0, 20)));
  } catch {}

  return profile;
}

export function spendLocalHealthCoin(cost: number): { success: boolean; newCoinBalance: number } {
  const profile = getStoredProfile();
  if (!profile || profile.coins < cost) {
    return { success: false, newCoinBalance: profile?.coins || 0 };
  }
  profile.coins -= cost;
  saveStoredProfile(profile);
  return { success: true, newCoinBalance: profile.coins };
}

export function handleLocalApiFallback(path: string, options: RequestInit = {}): any {
  const body = (() => {
    try {
      return options.body ? JSON.parse(String(options.body)) : {};
    } catch {
      return {};
    }
  })();

  if (path.startsWith('/api/auth/check-username')) {
    const q = new URL(path, 'http://localhost').searchParams.get('username') || '';
    const trimmed = q.trim();
    const valid = trimmed.length >= 3 && trimmed.length <= 18 && /^[a-zA-Z0-9_-]+$/.test(trimmed);
    return { valid, available: valid };
  }

  if (path === '/api/auth/register') {
    return createLocalProfile(String(body.username || ''));
  }

  const profile = getStoredProfile();
  if (!profile) {
    throw new Error('No saved operative profile found.');
  }

  if (path === '/api/auth/me') {
    return { profile };
  }

  if (path === '/api/shop/weapon/buy') {
    const weaponId = body.weaponId as WeaponId;
    const w = WEAPONS[weaponId];
    if (!w) throw new Error('Weapon not found');
    if (profile.weapons[weaponId]) throw new Error('Weapon already owned');
    if (profile.coins < w.cost) throw new Error('Insufficient coins');
    profile.coins -= w.cost;
    profile.weapons[weaponId] = { upgradeLevel: 1 };
    profile.equippedWeapon = weaponId;
    checkAchievements(profile);
    return { profile: saveStoredProfile(profile) };
  }

  if (path === '/api/shop/weapon/upgrade') {
    const weaponId = body.weaponId as WeaponId;
    const owned = profile.weapons[weaponId];
    if (!owned) throw new Error('Weapon not owned');
    if (owned.upgradeLevel >= 5) throw new Error('Already at max level');
    const cost = getWeaponUpgradeCost(owned.upgradeLevel);
    if (profile.coins < cost) throw new Error('Insufficient coins');
    profile.coins -= cost;
    owned.upgradeLevel += 1;
    return { profile: saveStoredProfile(profile) };
  }

  if (path === '/api/shop/weapon/equip') {
    const weaponId = body.weaponId as WeaponId;
    if (!profile.weapons[weaponId]) throw new Error('Weapon not owned');
    profile.equippedWeapon = weaponId;
    return { profile: saveStoredProfile(profile) };
  }

  if (path === '/api/shop/customization/buy') {
    const itemId = String(body.itemId || '');
    const item = CUSTOMIZATION_ITEMS.find((i) => i.id === itemId);
    if (!item) throw new Error('Item not found');
    if (!profile.customizations.includes(itemId)) {
      if (profile.coins < item.cost) throw new Error('Insufficient coins');
      profile.coins -= item.cost;
      profile.customizations.push(itemId);
    }
    (profile.equippedLoadout as any)[item.category] = item.id;
    return { profile: saveStoredProfile(profile) };
  }

  if (path === '/api/shop/customization/equip') {
    const itemId = String(body.itemId || '');
    const item = CUSTOMIZATION_ITEMS.find((i) => i.id === itemId);
    if (!item) throw new Error('Item not found');
    if (!profile.customizations.includes(itemId) && item.cost > 0) throw new Error('Item not owned');
    (profile.equippedLoadout as any)[item.category] = item.id;
    return { profile: saveStoredProfile(profile) };
  }

  if (path === '/api/rewards/daily') {
    const today = todayKey();
    if (profile.lastDailyClaim === today) throw new Error('Daily reward already claimed today');
    const rewardCoins = 120 + Math.min(6, profile.dailyStreak) * 30;
    profile.coins += rewardCoins;
    profile.stats.totalCoinsEarned += rewardCoins;
    profile.lastDailyClaim = today;
    profile.dailyStreak += 1;
    return { profile: saveStoredProfile(profile), rewardCoins };
  }

  if (path === '/api/rewards/mission') {
    if (body.missionType === 'matches') {
      if (profile.dailyMission.claimedMatches) throw new Error('Already claimed');
      if (profile.dailyMission.matchesToday < 2) throw new Error('Complete 2 matches first');
      profile.dailyMission.claimedMatches = true;
      profile.coins += 180;
      profile.stats.totalCoinsEarned += 180;
      return { profile: saveStoredProfile(profile), rewardCoins: 180 };
    }
    if (profile.dailyMission.claimedKills) throw new Error('Already claimed');
    if (profile.dailyMission.killsToday < 20) throw new Error('Eliminate 20 monsters first');
    profile.dailyMission.claimedKills = true;
    profile.coins += 150;
    profile.stats.totalCoinsEarned += 150;
    return { profile: saveStoredProfile(profile), rewardCoins: 150 };
  }

  if (path === '/api/friends') {
    return { friends: [], incoming: [], outgoing: [] };
  }

  if (path.startsWith('/api/players/search')) {
    return { players: [] };
  }

  if (path.startsWith('/api/leaderboard')) {
    const url = new URL(path, 'http://localhost');
    const scope = url.searchParams.get('scope') === 'friends' ? 'friends' : 'global';
    const sort = url.searchParams.get('sort') || 'kills';

    const selfEntry = {
      id: profile.id,
      username: profile.username,
      player_code: profile.playerCode,
      level: profile.level,
      xp: profile.xp,
      rank: profile.rank,
      coins: profile.coins,
      total_kills: profile.stats.totalKills,
      boss_kills: profile.stats.bossKills,
      matches_played: profile.stats.matchesPlayed,
      highest_wave: profile.stats.highestWave,
      matches_won: profile.stats.matchesWon,
    };

    const entries =
      scope === 'friends'
        ? [selfEntry]
        : [
            selfEntry,
            {
              id: 'bot-reaper-01',
              username: 'Vanguard_Kael',
              player_code: 'NF-409182',
              level: 14,
              xp: 3100,
              rank: 'Stalker',
              coins: 2450,
              total_kills: 412,
              boss_kills: 9,
              matches_played: 18,
              highest_wave: 16,
              matches_won: 11,
            },
            {
              id: 'bot-reaper-02',
              username: 'Sable_09',
              player_code: 'NF-782314',
              level: 10,
              xp: 1850,
              rank: 'Vanguard',
              coins: 1620,
              total_kills: 268,
              boss_kills: 5,
              matches_played: 12,
              highest_wave: 12,
              matches_won: 7,
            },
            {
              id: 'bot-reaper-03',
              username: 'AshWarden',
              player_code: 'NF-551903',
              level: 7,
              xp: 980,
              rank: 'Operative',
              coins: 940,
              total_kills: 154,
              boss_kills: 2,
              matches_played: 8,
              highest_wave: 9,
              matches_won: 4,
            },
          ];

    entries.sort((a, b) => {
      if (sort === 'wave') return b.highest_wave - a.highest_wave || b.total_kills - a.total_kills;
      if (sort === 'wins') return b.matches_won - a.matches_won || b.total_kills - a.total_kills;
      if (sort === 'level') return b.level - a.level || b.xp - a.xp;
      return b.total_kills - a.total_kills || b.xp - a.xp;
    });

    return { entries };
  }

  if (path === '/api/matches/history') {
    try {
      return { matches: JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) || '[]') };
    } catch {
      return { matches: [] };
    }
  }

  return {};
}
