import { DifficultyId, EquippedLoadout, MapId, WeaponId } from '../shared/gameData';
import { handleLocalApiFallback } from './localFallback';

let staticFallbackActive = false;

export function isStaticMode(): boolean {
  return staticFallbackActive;
}

export interface PlayerProfile {
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

export interface RoomMemberInfo {
  playerId: string;
  playerCode: string;
  username: string;
  avatarSeed: string;
  level: number;
  rank: string;
  isReady: boolean;
  weaponId: WeaponId;
  loadout: EquippedLoadout;
}

export interface RoomState {
  id: string;
  hostId: string;
  mapId: MapId;
  difficulty: DifficultyId;
  isPublicMatchmaking: boolean;
  status: 'waiting' | 'playing' | 'finished';
  maxPlayers: number;
  players: RoomMemberInfo[];
}

const TOKEN_KEY = 'nightfall_session_token';

export function getSavedToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  if (staticFallbackActive) {
    return handleLocalApiFallback(path, options) as T;
  }
  const token = getSavedToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(path, { ...options, headers });
  if (res.status === 404) {
    staticFallbackActive = true;
    return handleLocalApiFallback(path, options) as T;
  }
  const text = await res.text();
  let data: any = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      throw new Error('Unexpected non-JSON response from server.');
    }
  }
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}
