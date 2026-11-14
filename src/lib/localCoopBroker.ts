import { DifficultyId, GAME_MODES, GameModeId, MapId, MAPS } from '../shared/gameData';
import type { PlayerProfile, RoomState } from './api';

const LOCAL_ROOMS_KEY = 'nightfall_local_rooms_v1';
const CHANNEL_NAME = 'nightfall_coop_v1';

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

function readRooms(): Record<string, RoomState & { updatedAt: number }> {
  try {
    const raw = localStorage.getItem(LOCAL_ROOMS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, RoomState & { updatedAt: number }>;
    const now = Date.now();
    // Prune stale local rooms older than 30 minutes
    const cleaned: Record<string, RoomState & { updatedAt: number }> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (now - (v.updatedAt || now) < 30 * 60 * 1000) {
        cleaned[k] = v;
      }
    }
    return cleaned;
  } catch {
    return {};
  }
}

function writeRooms(rooms: Record<string, RoomState & { updatedAt: number }>) {
  try {
    localStorage.setItem(LOCAL_ROOMS_KEY, JSON.stringify(rooms));
  } catch {}
}

function makeRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function createLocalRoom(
  profile: PlayerProfile,
  mapId: MapId,
  difficulty: DifficultyId,
  isPublic = false
): RoomState {
  const rooms = readRooms();
  let id = makeRoomCode();
  while (rooms[id]) id = makeRoomCode();

  const room: RoomState & { updatedAt: number } = {
    id,
    hostId: profile.id,
    mapId: MAPS[mapId] ? mapId : 'hospital',
    difficulty: difficulty || 'normal',
    gameMode: 'unlimited',
    isPublicMatchmaking: isPublic,
    status: 'waiting',
    maxPlayers: 2,
    players: [
      {
        playerId: profile.id,
        playerCode: profile.playerCode,
        username: profile.username,
        avatarSeed: profile.avatarSeed,
        level: profile.level,
        rank: profile.rank,
        isReady: false,
        weaponId: profile.equippedWeapon,
        loadout: profile.equippedLoadout,
      },
    ],
    updatedAt: Date.now(),
  };

  rooms[id] = room;
  writeRooms(rooms);
  getChannel()?.postMessage({ type: 'room:updated', room });
  return room;
}

export function listLocalOpenRooms(): RoomState[] {
  const rooms = readRooms();
  return Object.values(rooms).filter((r) => r.status === 'waiting' && r.players.length < 2);
}

export function joinLocalRoom(profile: PlayerProfile, roomId: string): RoomState {
  const clean = roomId.trim().toUpperCase();
  const rooms = readRooms();
  const room = rooms[clean];
  if (!room) {
    throw new Error(`Room ${clean} not found.`);
  }
  if (room.players.length >= 2 && !room.players.some((p) => p.playerId === profile.id)) {
    throw new Error('Room is full (maximum 2 players).');
  }

  if (!room.players.some((p) => p.playerId === profile.id)) {
    room.players.push({
      playerId: profile.id,
      playerCode: profile.playerCode,
      username: profile.username,
      avatarSeed: profile.avatarSeed,
      level: profile.level,
      rank: profile.rank,
      isReady: false,
      weaponId: profile.equippedWeapon,
      loadout: profile.equippedLoadout,
    });
  }
  room.updatedAt = Date.now();
  rooms[clean] = room;
  writeRooms(rooms);
  getChannel()?.postMessage({ type: 'room:updated', room });
  return room;
}

export function findOrCreateLocalPublicRoom(
  profile: PlayerProfile,
  mapId: MapId,
  difficulty: DifficultyId
): RoomState {
  const open = listLocalOpenRooms().find((r) => !r.players.some((p) => p.playerId === profile.id));
  if (open) {
    return joinLocalRoom(profile, open.id);
  }
  return createLocalRoom(profile, mapId, difficulty, true);
}

export function toggleLocalReady(roomId: string, playerId: string, isReady: boolean): RoomState | null {
  const rooms = readRooms();
  const room = rooms[roomId];
  if (!room) return null;
  const member = room.players.find((p) => p.playerId === playerId);
  if (member) member.isReady = isReady;
  room.updatedAt = Date.now();
  writeRooms(rooms);
  getChannel()?.postMessage({ type: 'room:updated', room });
  return room;
}

export function updateLocalRoomConfig(
  roomId: string,
  mapId: MapId,
  difficulty: DifficultyId,
  gameMode?: GameModeId
): RoomState | null {
  const rooms = readRooms();
  const room = rooms[roomId];
  if (!room) return null;
  if (MAPS[mapId]) room.mapId = mapId;
  room.difficulty = difficulty;
  if (gameMode && GAME_MODES[gameMode]) room.gameMode = gameMode;
  room.updatedAt = Date.now();
  writeRooms(rooms);
  getChannel()?.postMessage({ type: 'room:updated', room });
  return room;
}

export function leaveLocalRoom(roomId: string, playerId: string) {
  const rooms = readRooms();
  const room = rooms[roomId];
  if (!room) return;
  room.players = room.players.filter((p) => p.playerId !== playerId);
  if (room.players.length === 0) {
    delete rooms[roomId];
  } else {
    if (room.hostId === playerId) {
      room.hostId = room.players[0].playerId;
    }
    room.updatedAt = Date.now();
  }
  writeRooms(rooms);
  getChannel()?.postMessage({ type: 'room:updated', room });
}

export function subscribeLocalCoop(onRoomUpdate: (room: RoomState) => void): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  const handler = (ev: MessageEvent) => {
    if (ev.data?.type === 'room:updated' && ev.data.room) {
      onRoomUpdate(ev.data.room);
    }
  };
  ch.addEventListener('message', handler);
  return () => ch.removeEventListener('message', handler);
}
