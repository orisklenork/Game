import crypto from 'crypto';
import { Server as HttpServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import {
  DIFFICULTIES,
  DifficultyId,
  EquippedLoadout,
  getWeaponStatsAtLevel,
  HEALTH_PURCHASE_AMOUNT,
  HEALTH_PURCHASE_COST,
  MapId,
  MAPS,
  MAX_HEALTH_PURCHASES_PER_MATCH,
  MONSTERS,
  MonsterType,
  WEAPONS,
  WeaponId,
} from '../src/shared/gameData.ts';
import { db, getFullProfileById, getProfileByToken, recordMatchResult, spendMatchHealthCoin } from './db.ts';

interface ClientConn {
  ws: WebSocket;
  playerId: string;
  username: string;
  playerCode: string;
  roomId: string | null;
}

interface RoomPlayerState {
  playerId: string;
  playerCode: string;
  username: string;
  avatarSeed: string;
  level: number;
  rank: string;
  isReady: boolean;
  weaponId: WeaponId;
  weaponLevels: Record<string, number>;
  loadout: EquippedLoadout;
  // Live match state
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  reloading: boolean;
  kills: number;
  bossKills: number;
  score: number;
  coinsEarned: number;
  xpEarned: number;
  healthPurchasesUsed: number;
  weaponKills: Record<string, number>;
  lastShotAt: number;
}

interface ActiveMonster {
  id: string;
  type: MonsterType;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  attackRange: number;
  attackCooldown: number;
  lastAttackAt: number;
  radius: number;
  coinReward: number;
  scoreReward: number;
  xpReward: number;
  attackAnimUntil: number;
}

interface GroundCoin {
  id: string;
  x: number;
  z: number;
  value: number;
  createdAt: number;
}

interface GameRoom {
  id: string;
  hostId: string;
  mapId: MapId;
  difficulty: DifficultyId;
  isPublicMatchmaking: boolean;
  status: 'waiting' | 'playing' | 'finished';
  players: Map<string, RoomPlayerState>;
  // Match state
  wave: number;
  maxWaves: number;
  waveState: 'combat' | 'intermission';
  intermissionEndsAt: number;
  monstersToSpawn: MonsterType[];
  lastSpawnAt: number;
  monsters: Map<string, ActiveMonster>;
  coins: Map<string, GroundCoin>;
  matchStartedAt: number;
  tickTimer?: NodeJS.Timeout;
}

const clientsByPlayer = new Map<string, ClientConn>();
const rooms = new Map<string, GameRoom>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[crypto.randomInt(0, chars.length)];
  }
  return code;
}

function send(ws: WebSocket, type: string, payload: any = {}) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload }));
  }
}

function broadcastRoom(room: GameRoom, type: string, payload: any, excludePlayerId?: string) {
  for (const p of room.players.values()) {
    if (p.playerId === excludePlayerId) continue;
    const conn = clientsByPlayer.get(p.playerId);
    if (conn) send(conn.ws, type, payload);
  }
}

export function getOnlinePlayerIds(): Set<string> {
  return new Set(clientsByPlayer.keys());
}

function serializeRoom(room: GameRoom) {
  return {
    id: room.id,
    hostId: room.hostId,
    mapId: room.mapId,
    difficulty: room.difficulty,
    isPublicMatchmaking: room.isPublicMatchmaking,
    status: room.status,
    maxPlayers: 2,
    players: Array.from(room.players.values()).map((p) => ({
      playerId: p.playerId,
      playerCode: p.playerCode,
      username: p.username,
      avatarSeed: p.avatarSeed,
      level: p.level,
      rank: p.rank,
      isReady: p.isReady,
      weaponId: p.weaponId,
      loadout: p.loadout,
    })),
  };
}

function buildWaveQueue(wave: number, playerCount: number): MonsterType[] {
  const count = Math.round((5 + wave * 3) * (playerCount === 2 ? 1.35 : 1));
  const queue: MonsterType[] = [];

  for (let i = 0; i < count; i++) {
    const r = Math.random();
    if (wave === 1) {
      queue.push(r < 0.65 ? 'zombie' : 'runner');
    } else if (wave === 2) {
      if (r < 0.4) queue.push('zombie');
      else if (r < 0.75) queue.push('runner');
      else queue.push('crawler');
    } else if (wave <= 4) {
      if (r < 0.25) queue.push('zombie');
      else if (r < 0.5) queue.push('runner');
      else if (r < 0.75) queue.push('crawler');
      else if (r < 0.92) queue.push('brute');
      else queue.push('phantom');
    } else {
      if (r < 0.2) queue.push('runner');
      else if (r < 0.4) queue.push('crawler');
      else if (r < 0.7) queue.push('brute');
      else queue.push('phantom');
    }
  }

  if (wave % 3 === 0) {
    queue.push('boss');
  }
  return queue;
}

function resolveObstaclePush(mapId: MapId, x: number, z: number, radius: number): { x: number; z: number } {
  const map = MAPS[mapId];
  const limit = map.arenaHalfSize - radius - 0.5;
  let nx = Math.max(-limit, Math.min(limit, x));
  let nz = Math.max(-limit, Math.min(limit, z));

  for (const obs of map.obstacles) {
    const hw = obs.w / 2 + radius;
    const hd = obs.d / 2 + radius;
    const dx = nx - obs.x;
    const dz = nz - obs.z;
    if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
      const penX = hw - Math.abs(dx);
      const penZ = hd - Math.abs(dz);
      if (penX < penZ) {
        nx += dx >= 0 ? penX : -penX;
      } else {
        nz += dz >= 0 ? penZ : -penZ;
      }
    }
  }
  return { x: nx, z: nz };
}

function startMatchLoop(room: GameRoom) {
  const map = MAPS[room.mapId];
  room.status = 'playing';
  room.wave = 1;
  room.maxWaves = 6; // Defeat Wave 6 Boss to win!
  room.waveState = 'intermission';
  room.intermissionEndsAt = Date.now() + 2500;
  room.monsters.clear();
  room.coins.clear();
  room.monstersToSpawn = buildWaveQueue(1, room.players.size);
  room.lastSpawnAt = 0;
  room.matchStartedAt = Date.now();

  let spawnIdx = 0;
  for (const p of room.players.values()) {
    const sp = map.playerSpawns[spawnIdx % map.playerSpawns.length];
    p.x = sp[0];
    p.y = 0;
    p.z = sp[1];
    p.yaw = 0;
    p.pitch = 0;
    p.hp = 100;
    p.maxHp = 100;
    p.alive = true;
    p.reloading = false;
    p.kills = 0;
    p.bossKills = 0;
    p.score = 0;
    p.coinsEarned = 0;
    p.xpEarned = 0;
    p.healthPurchasesUsed = 0;
    p.weaponKills = {};
    p.lastShotAt = 0;
    spawnIdx++;
  }

  db.prepare(`UPDATE rooms SET status = 'playing' WHERE id = ?`).run(room.id);

  broadcastRoom(room, 'match:started', {
    roomId: room.id,
    mapId: room.mapId,
    difficulty: room.difficulty,
    maxWaves: room.maxWaves,
    players: Array.from(room.players.values()),
  });

  if (room.tickTimer) clearInterval(room.tickTimer);
  let lastTick = Date.now();

  room.tickTimer = setInterval(() => {
    if (room.status !== 'playing') {
      if (room.tickTimer) clearInterval(room.tickTimer);
      return;
    }

    const now = Date.now();
    const dt = Math.min((now - lastTick) / 1000, 0.1);
    lastTick = now;

    // 1. Check all players dead
    const alivePlayers = Array.from(room.players.values()).filter((p) => p.alive);
    if (alivePlayers.length === 0) {
      finishMatch(room, false);
      return;
    }

    // 2. Wave progression
    if (room.waveState === 'intermission') {
      if (now >= room.intermissionEndsAt) {
        room.waveState = 'combat';
        broadcastRoom(room, 'match:wave', {
          wave: room.wave,
          isBossWave: room.wave % 3 === 0,
        });
      }
    } else {
      // Spawn monsters gradually
      if (room.monstersToSpawn.length > 0 && now - room.lastSpawnAt >= 750 && room.monsters.size < 22) {
        const mType = room.monstersToSpawn.shift()!;
        const sp = map.monsterSpawns[crypto.randomInt(0, map.monsterSpawns.length)];
        const mDef = MONSTERS[mType];
        const diff = DIFFICULTIES[room.difficulty];
        const waveScale = 1 + (room.wave - 1) * 0.18;
        const coopScale = room.players.size === 2 && mType === 'boss' ? 1.45 : 1.0;

        const maxHp = Math.round(mDef.hp * diff.hpMult * waveScale * coopScale);
        const monster: ActiveMonster = {
          id: crypto.randomUUID(),
          type: mType,
          x: sp[0] + (Math.random() - 0.5) * 2,
          z: sp[1] + (Math.random() - 0.5) * 2,
          yaw: 0,
          hp: maxHp,
          maxHp,
          speed: mDef.speed * diff.speedMult * (1 + Math.min(0.25, (room.wave - 1) * 0.03)),
          damage: Math.round(mDef.damage * diff.dmgMult),
          attackRange: mDef.attackRange,
          attackCooldown: mDef.attackCooldown,
          lastAttackAt: 0,
          radius: mDef.radius,
          coinReward: Math.round(mDef.coinReward * diff.rewardMult),
          scoreReward: Math.round(mDef.scoreReward * diff.rewardMult),
          xpReward: Math.round(mDef.xpReward * diff.rewardMult),
          attackAnimUntil: 0,
        };
        room.monsters.set(monster.id, monster);
        room.lastSpawnAt = now;
      }

      // Check wave clear
      if (room.monstersToSpawn.length === 0 && room.monsters.size === 0) {
        if (room.wave >= room.maxWaves) {
          finishMatch(room, true);
          return;
        }
        room.wave += 1;
        room.waveState = 'intermission';
        room.intermissionEndsAt = now + 4000;
        room.monstersToSpawn = buildWaveQueue(room.wave, room.players.size);

        // Spawn bonus cache coins on wave clear
        for (const sc of map.supplyCaches) {
          const cid = crypto.randomUUID();
          room.coins.set(cid, { id: cid, x: sc[0], z: sc[1], value: 25, createdAt: now });
        }
        // Small wave clear heal for alive players
        for (const p of alivePlayers) {
          p.hp = Math.min(p.maxHp, p.hp + 15);
        }
        broadcastRoom(room, 'match:wave_cleared', { nextWave: room.wave });
      }
    }

    // 3. Update Monsters AI
    for (const m of room.monsters.values()) {
      let nearest: RoomPlayerState | null = null;
      let bestDist = Infinity;
      for (const p of alivePlayers) {
        const d = Math.hypot(p.x - m.x, p.z - m.z);
        if (d < bestDist) {
          bestDist = d;
          nearest = p;
        }
      }
      if (!nearest) continue;

      const dx = nearest.x - m.x;
      const dz = nearest.z - m.z;
      m.yaw = Math.atan2(dx, dz);

      if (bestDist > m.attackRange * 0.85) {
        const vx = (dx / (bestDist || 1)) * m.speed * dt;
        const vz = (dz / (bestDist || 1)) * m.speed * dt;
        const pushed = resolveObstaclePush(room.mapId, m.x + vx, m.z + vz, m.radius);
        m.x = pushed.x;
        m.z = pushed.z;
      }

      // Attack player
      if (bestDist <= m.attackRange && now - m.lastAttackAt >= m.attackCooldown * 1000) {
        m.lastAttackAt = now;
        m.attackAnimUntil = now + 350;
        nearest.hp = Math.max(0, nearest.hp - m.damage);
        if (nearest.hp <= 0) {
          nearest.alive = false;
        }
        broadcastRoom(room, 'match:player_hit', {
          playerId: nearest.playerId,
          damage: m.damage,
          hp: nearest.hp,
          alive: nearest.alive,
          attackerType: m.type,
        });
      }
    }

    // 4. Auto-collect nearby coins
    for (const [cid, coin] of room.coins.entries()) {
      if (now - coin.createdAt > 45000) {
        room.coins.delete(cid);
        continue;
      }
      for (const p of alivePlayers) {
        if (Math.hypot(p.x - coin.x, p.z - coin.z) <= 2.3) {
          room.coins.delete(cid);
          p.coinsEarned += coin.value;
          p.score += coin.value * 5;
          broadcastRoom(room, 'match:coin_collected', {
            coinId: cid,
            playerId: p.playerId,
            value: coin.value,
          });
          break;
        }
      }
    }

    // 5. Broadcast authoritative snapshot
    broadcastRoom(room, 'match:state', {
      t: now,
      elapsedSec: Math.floor((now - room.matchStartedAt) / 1000),
      wave: room.wave,
      maxWaves: room.maxWaves,
      waveState: room.waveState,
      remainingToSpawn: room.monstersToSpawn.length,
      players: Array.from(room.players.values()).map((p) => ({
        playerId: p.playerId,
        x: p.x,
        y: p.y,
        z: p.z,
        yaw: p.yaw,
        pitch: p.pitch,
        hp: p.hp,
        maxHp: p.maxHp,
        alive: p.alive,
        weaponId: p.weaponId,
        reloading: p.reloading,
        kills: p.kills,
        score: p.score,
        coinsEarned: p.coinsEarned,
        healthPurchasesUsed: p.healthPurchasesUsed,
      })),
      monsters: Array.from(room.monsters.values()).map((m) => ({
        id: m.id,
        type: m.type,
        x: m.x,
        z: m.z,
        yaw: m.yaw,
        hp: m.hp,
        maxHp: m.maxHp,
        attacking: now < m.attackAnimUntil,
      })),
      coins: Array.from(room.coins.values()),
    });
  }, 50);
}

function finishMatch(room: GameRoom, victory: boolean) {
  if (room.status === 'finished') return;
  room.status = 'finished';
  if (room.tickTimer) {
    clearInterval(room.tickTimer);
    room.tickTimer = undefined;
  }

  const durationSeconds = Math.max(1, Math.floor((Date.now() - room.matchStartedAt) / 1000));
  const wavesCleared = victory ? room.maxWaves : Math.max(0, room.wave - 1);
  const diff = DIFFICULTIES[room.difficulty];

  const playerSummaries = Array.from(room.players.values()).map((p) => {
    const survivalBonusCoins = victory ? Math.round(150 * diff.rewardMult) : Math.round(wavesCleared * 15);
    const survivalBonusXp = victory ? Math.round(160 * diff.rewardMult) : Math.round(wavesCleared * 20);
    const totalCoins = p.coinsEarned + survivalBonusCoins;
    const totalXp = p.xpEarned + survivalBonusXp;

    return {
      playerId: p.playerId,
      username: p.username,
      kills: p.kills,
      bossKills: p.bossKills,
      score: p.score,
      coinsEarned: totalCoins,
      xpEarned: totalXp,
      survived: p.alive,
      weaponKills: p.weaponKills,
    };
  });

  try {
    recordMatchResult({
      roomId: room.id,
      mapId: room.mapId,
      difficulty: room.difficulty,
      wavesCleared,
      victory,
      durationSeconds,
      players: playerSummaries,
    });
  } catch (err) {
    console.error('Failed to record match result:', err);
  }

  db.prepare(`UPDATE rooms SET status = 'waiting' WHERE id = ?`).run(room.id);

  // Send updated profiles + match results
  for (const p of room.players.values()) {
    p.isReady = false;
    const conn = clientsByPlayer.get(p.playerId);
    if (conn) {
      const updatedProfile = getFullProfileById(p.playerId);
      send(conn.ws, 'match:ended', {
        victory,
        wavesCleared,
        durationSeconds,
        results: playerSummaries,
        profile: updatedProfile,
      });
    }
  }

  room.status = 'waiting';
}

function handleLeaveRoom(conn: ClientConn) {
  if (!conn.roomId) return;
  const room = rooms.get(conn.roomId);
  conn.roomId = null;
  if (!room) return;

  room.players.delete(conn.playerId);
  db.prepare('DELETE FROM room_members WHERE room_id = ? AND player_id = ?').run(room.id, conn.playerId);

  if (room.players.size === 0) {
    if (room.tickTimer) clearInterval(room.tickTimer);
    rooms.delete(room.id);
    db.prepare('DELETE FROM rooms WHERE id = ?').run(room.id);
  } else {
    if (room.hostId === conn.playerId) {
      const nextHost = room.players.values().next().value;
      if (nextHost) {
        room.hostId = nextHost.playerId;
        db.prepare('UPDATE rooms SET host_id = ? WHERE id = ?').run(room.hostId, room.id);
      }
    }
    broadcastRoom(room, 'room:updated', serializeRoom(room));
  }
}

function rayHitsMonster(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxRange: number,
  m: ActiveMonster
): number | null {
  const mDef = MONSTERS[m.type];
  const cy = mDef.height * 0.52;
  const radius = m.radius * 1.28; // Generous horror shooter hitbox

  const ocX = m.x - ox;
  const ocY = cy - oy;
  const ocZ = m.z - oz;

  const proj = ocX * dx + ocY * dy + ocZ * dz;
  if (proj < 0 || proj > maxRange) return null;

  const closestX = ox + dx * proj;
  const closestY = oy + dy * proj;
  const closestZ = oz + dz * proj;

  const horizDist = Math.hypot(closestX - m.x, closestZ - m.z);
  const vertDist = Math.abs(closestY - cy);

  if (horizDist <= radius && vertDist <= mDef.height * 0.65) {
    return proj;
  }
  return null;
}

export function setupGameWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    if (req.url?.startsWith('/ws')) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    let conn: ClientConn | null = null;

    ws.on('message', (raw) => {
      let msg: { type: string; payload?: any };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      const { type, payload = {} } = msg;

      if (type === 'auth') {
        const profile = getProfileByToken(payload.token);
        if (!profile) {
          send(ws, 'auth:error', { message: 'Invalid session token' });
          return;
        }
        const prev = clientsByPlayer.get(profile.id);
        if (prev && prev.ws !== ws) {
          handleLeaveRoom(prev);
          prev.ws.close();
        }
        conn = {
          ws,
          playerId: profile.id,
          username: profile.username,
          playerCode: profile.playerCode,
          roomId: null,
        };
        clientsByPlayer.set(profile.id, conn);
        send(ws, 'auth:ok', { playerId: profile.id });
        return;
      }

      if (!conn) {
        send(ws, 'error', { message: 'Authenticate first' });
        return;
      }

      const profile = getFullProfileById(conn.playerId);
      if (!profile) return;

      const buildRoomMember = (): RoomPlayerState => {
        const weaponLevels: Record<string, number> = {};
        for (const [wid, info] of Object.entries(profile.weapons)) {
          weaponLevels[wid] = info.upgradeLevel;
        }
        return {
          playerId: profile.id,
          playerCode: profile.playerCode,
          username: profile.username,
          avatarSeed: profile.avatarSeed,
          level: profile.level,
          rank: profile.rank,
          isReady: false,
          weaponId: profile.equippedWeapon,
          weaponLevels,
          loadout: profile.equippedLoadout,
          x: 0,
          y: 0,
          z: 0,
          yaw: 0,
          pitch: 0,
          hp: 100,
          maxHp: 100,
          alive: true,
          reloading: false,
          kills: 0,
          bossKills: 0,
          score: 0,
          coinsEarned: 0,
          xpEarned: 0,
          healthPurchasesUsed: 0,
          weaponKills: {},
          lastShotAt: 0,
        };
      };

      switch (type) {
        case 'room:create': {
          handleLeaveRoom(conn);
          let code = generateRoomCode();
          while (rooms.has(code)) code = generateRoomCode();

          const mapId: MapId = MAPS[payload.mapId as MapId] ? payload.mapId : 'hospital';
          const difficulty: DifficultyId = DIFFICULTIES[payload.difficulty as DifficultyId] ? payload.difficulty : 'normal';

          const room: GameRoom = {
            id: code,
            hostId: conn.playerId,
            mapId,
            difficulty,
            isPublicMatchmaking: Boolean(payload.isPublic),
            status: 'waiting',
            players: new Map([[conn.playerId, buildRoomMember()]]),
            wave: 1,
            maxWaves: 6,
            waveState: 'intermission',
            intermissionEndsAt: 0,
            monstersToSpawn: [],
            lastSpawnAt: 0,
            monsters: new Map(),
            coins: new Map(),
            matchStartedAt: 0,
          };
          rooms.set(code, room);
          conn.roomId = code;

          db.prepare('INSERT OR REPLACE INTO rooms (id, host_id, map_id, difficulty, status, max_players) VALUES (?, ?, ?, ?, ?, 2)').run(
            code,
            conn.playerId,
            mapId,
            difficulty,
            'waiting'
          );
          db.prepare('INSERT OR REPLACE INTO room_members (room_id, player_id, is_ready) VALUES (?, ?, 0)').run(code, conn.playerId);

          send(ws, 'room:joined', serializeRoom(room));
          break;
        }

        case 'room:join': {
          const targetId = String(payload.roomId || '').trim().toUpperCase();
          const room = rooms.get(targetId);
          if (!room) {
            send(ws, 'room:error', { message: `Room ${targetId} not found.` });
            return;
          }
          if (room.status !== 'waiting') {
            send(ws, 'room:error', { message: 'Match already in progress in this room.' });
            return;
          }
          if (room.players.size >= 2 && !room.players.has(conn.playerId)) {
            send(ws, 'room:error', { message: 'Room is full (maximum 2 players).' });
            return;
          }

          handleLeaveRoom(conn);
          room.players.set(conn.playerId, buildRoomMember());
          conn.roomId = room.id;
          db.prepare('INSERT OR REPLACE INTO room_members (room_id, player_id, is_ready) VALUES (?, ?, 0)').run(room.id, conn.playerId);

          send(ws, 'room:joined', serializeRoom(room));
          broadcastRoom(room, 'room:updated', serializeRoom(room), conn.playerId);
          break;
        }

        case 'room:find_player': {
          // Find an existing waiting room with 1 player
          let openRoom: GameRoom | undefined;
          for (const r of rooms.values()) {
            if (r.status === 'waiting' && r.players.size === 1 && !r.players.has(conn.playerId)) {
              openRoom = r;
              break;
            }
          }

          if (openRoom) {
            handleLeaveRoom(conn);
            openRoom.players.set(conn.playerId, buildRoomMember());
            conn.roomId = openRoom.id;
            db.prepare('INSERT OR REPLACE INTO room_members (room_id, player_id, is_ready) VALUES (?, ?, 0)').run(openRoom.id, conn.playerId);
            send(ws, 'room:joined', serializeRoom(openRoom));
            broadcastRoom(openRoom, 'room:updated', serializeRoom(openRoom), conn.playerId);
          } else {
            // Create a public room and wait for another player
            handleLeaveRoom(conn);
            let code = generateRoomCode();
            while (rooms.has(code)) code = generateRoomCode();
            const mapId: MapId = MAPS[payload.mapId as MapId] ? payload.mapId : 'hospital';
            const difficulty: DifficultyId = DIFFICULTIES[payload.difficulty as DifficultyId] ? payload.difficulty : 'normal';
            const room: GameRoom = {
              id: code,
              hostId: conn.playerId,
              mapId,
              difficulty,
              isPublicMatchmaking: true,
              status: 'waiting',
              players: new Map([[conn.playerId, buildRoomMember()]]),
              wave: 1,
              maxWaves: 6,
              waveState: 'intermission',
              intermissionEndsAt: 0,
              monstersToSpawn: [],
              lastSpawnAt: 0,
              monsters: new Map(),
              coins: new Map(),
              matchStartedAt: 0,
            };
            rooms.set(code, room);
            conn.roomId = code;
            db.prepare('INSERT OR REPLACE INTO rooms (id, host_id, map_id, difficulty, status, max_players) VALUES (?, ?, ?, ?, ?, 2)').run(
              code,
              conn.playerId,
              mapId,
              difficulty,
              'waiting'
            );
            db.prepare('INSERT OR REPLACE INTO room_members (room_id, player_id, is_ready) VALUES (?, ?, 0)').run(code, conn.playerId);
            send(ws, 'room:joined', serializeRoom(room));
          }
          break;
        }

        case 'room:list_open': {
          const openRooms = Array.from(rooms.values())
            .filter((r) => r.status === 'waiting' && r.players.size < 2)
            .map(serializeRoom);
          send(ws, 'room:open_list', { rooms: openRooms });
          break;
        }

        case 'room:leave': {
          handleLeaveRoom(conn);
          send(ws, 'room:left', {});
          break;
        }

        case 'room:ready': {
          if (!conn.roomId) return;
          const room = rooms.get(conn.roomId);
          if (!room) return;
          const p = room.players.get(conn.playerId);
          if (!p) return;
          p.isReady = Boolean(payload.isReady);
          // Refresh weapon/loadout when readying
          p.weaponId = profile.equippedWeapon;
          p.loadout = profile.equippedLoadout;
          const wLevels: Record<string, number> = {};
          for (const [wid, info] of Object.entries(profile.weapons)) wLevels[wid] = info.upgradeLevel;
          p.weaponLevels = wLevels;
          db.prepare('UPDATE room_members SET is_ready = ? WHERE room_id = ? AND player_id = ?').run(p.isReady ? 1 : 0, room.id, conn.playerId);
          broadcastRoom(room, 'room:updated', serializeRoom(room));
          break;
        }

        case 'room:config': {
          if (!conn.roomId) return;
          const room = rooms.get(conn.roomId);
          if (!room || room.hostId !== conn.playerId || room.status !== 'waiting') return;
          if (payload.mapId && MAPS[payload.mapId as MapId]) room.mapId = payload.mapId;
          if (payload.difficulty && DIFFICULTIES[payload.difficulty as DifficultyId]) room.difficulty = payload.difficulty;
          db.prepare('UPDATE rooms SET map_id = ?, difficulty = ? WHERE id = ?').run(room.mapId, room.difficulty, room.id);
          broadcastRoom(room, 'room:updated', serializeRoom(room));
          break;
        }

        case 'room:invite': {
          if (!conn.roomId) return;
          const room = rooms.get(conn.roomId);
          if (!room) return;
          const targetConn = clientsByPlayer.get(payload.friendId);
          if (!targetConn) {
            send(ws, 'room:error', { message: 'Friend is currently offline.' });
            return;
          }
          send(targetConn.ws, 'room:invited', {
            roomId: room.id,
            fromUsername: conn.username,
            mapId: room.mapId,
            difficulty: room.difficulty,
          });
          send(ws, 'room:invite_sent', { toUsername: targetConn.username });
          break;
        }

        case 'match:start': {
          if (!conn.roomId) return;
          const room = rooms.get(conn.roomId);
          if (!room || room.hostId !== conn.playerId || room.status !== 'waiting') return;
          // Refresh all players' loadouts & weapon levels
          for (const rp of room.players.values()) {
            const fp = getFullProfileById(rp.playerId);
            if (fp) {
              rp.weaponId = fp.equippedWeapon;
              rp.loadout = fp.equippedLoadout;
              const wl: Record<string, number> = {};
              for (const [wid, info] of Object.entries(fp.weapons)) wl[wid] = info.upgradeLevel;
              rp.weaponLevels = wl;
            }
          }
          startMatchLoop(room);
          break;
        }

        case 'player:state': {
          if (!conn.roomId) return;
          const room = rooms.get(conn.roomId);
          if (!room || room.status !== 'playing') return;
          const p = room.players.get(conn.playerId);
          if (!p || !p.alive) return;

          const limit = MAPS[room.mapId].arenaHalfSize - 0.8;
          p.x = Math.max(-limit, Math.min(limit, Number(payload.x) || 0));
          p.y = Math.max(0, Math.min(6, Number(payload.y) || 0));
          p.z = Math.max(-limit, Math.min(limit, Number(payload.z) || 0));
          p.yaw = Number(payload.yaw) || 0;
          p.pitch = Number(payload.pitch) || 0;
          if (payload.weaponId && p.weaponLevels[payload.weaponId]) {
            p.weaponId = payload.weaponId;
          }
          p.reloading = Boolean(payload.reloading);
          break;
        }

        case 'player:shoot': {
          if (!conn.roomId) return;
          const room = rooms.get(conn.roomId);
          if (!room || room.status !== 'playing') return;
          const p = room.players.get(conn.playerId);
          if (!p || !p.alive) return;

          const weaponId = (payload.weaponId && p.weaponLevels[payload.weaponId] ? payload.weaponId : p.weaponId) as WeaponId;
          const lvl = p.weaponLevels[weaponId] || 1;
          const wStats = getWeaponStatsAtLevel(weaponId, lvl);

          const now = Date.now();
          const minIntervalMs = (1000 / wStats.fireRate) * 0.72; // slight network jitter tolerance
          if (now - p.lastShotAt < minIntervalMs) return;
          p.lastShotAt = now;

          // Broadcast shot FX to teammate
          broadcastRoom(
            room,
            'match:shot_fx',
            {
              playerId: p.playerId,
              weaponId,
              ox: payload.ox,
              oy: payload.oy,
              oz: payload.oz,
              dx: payload.dx,
              dy: payload.dy,
              dz: payload.dz,
            },
            p.playerId
          );

          // Server-side ray hit check against active monsters
          const rays: Array<{ dx: number; dy: number; dz: number }> = Array.isArray(payload.rays)
            ? payload.rays.slice(0, wStats.pellets)
            : [{ dx: Number(payload.dx) || 0, dy: Number(payload.dy) || 0, dz: Number(payload.dz) || -1 }];

          const ox = Number(payload.ox) || p.x;
          const oy = Number(payload.oy) || p.y + 1.6;
          const oz = Number(payload.oz) || p.z;

          const hitResults: Array<{ monsterId: string; damage: number; killed: boolean; x: number; z: number }> = [];

          for (const ray of rays) {
            let bestMonster: ActiveMonster | null = null;
            let bestDist = Infinity;

            for (const m of room.monsters.values()) {
              const dist = rayHitsMonster(ox, oy, oz, ray.dx, ray.dy, ray.dz, wStats.range, m);
              if (dist !== null && dist < bestDist) {
                bestDist = dist;
                bestMonster = m;
              }
            }

            if (bestMonster) {
              bestMonster.hp = Math.max(0, bestMonster.hp - wStats.damage);
              const killed = bestMonster.hp <= 0;
              hitResults.push({
                monsterId: bestMonster.id,
                damage: wStats.damage,
                killed,
                x: bestMonster.x,
                z: bestMonster.z,
              });

              if (killed) {
                room.monsters.delete(bestMonster.id);
                p.kills += 1;
                if (bestMonster.type === 'boss') p.bossKills += 1;
                p.score += bestMonster.scoreReward;
                p.xpEarned += bestMonster.xpReward;
                p.weaponKills[weaponId] = (p.weaponKills[weaponId] || 0) + 1;

                // Drop coin pickup in 3D world
                const coinId = crypto.randomUUID();
                room.coins.set(coinId, {
                  id: coinId,
                  x: bestMonster.x,
                  z: bestMonster.z,
                  value: bestMonster.coinReward,
                  createdAt: now,
                });

                broadcastRoom(room, 'match:monster_killed', {
                  monsterId: bestMonster.id,
                  type: bestMonster.type,
                  killerId: p.playerId,
                  x: bestMonster.x,
                  z: bestMonster.z,
                  coinDrop: { id: coinId, x: bestMonster.x, z: bestMonster.z, value: bestMonster.coinReward },
                });
              }
            }
          }

          if (hitResults.length > 0) {
            send(ws, 'match:hit_confirm', { hits: hitResults });
          }
          break;
        }

        case 'player:buy_health': {
          if (!conn.roomId) return;
          const room = rooms.get(conn.roomId);
          if (!room || room.status !== 'playing') return;
          const p = room.players.get(conn.playerId);
          if (!p || !p.alive) return;

          if (p.healthPurchasesUsed >= MAX_HEALTH_PURCHASES_PER_MATCH) {
            send(ws, 'match:health_error', { message: 'Maximum 3 health purchases reached for this match.' });
            return;
          }
          if (p.hp >= p.maxHp) {
            send(ws, 'match:health_error', { message: 'Health is already full.' });
            return;
          }

          try {
            const newBalance = spendMatchHealthCoin(p.playerId, HEALTH_PURCHASE_COST);
            p.healthPurchasesUsed += 1;
            p.hp = Math.min(p.maxHp, p.hp + HEALTH_PURCHASE_AMOUNT);
            send(ws, 'match:health_purchased', {
              hp: p.hp,
              healthPurchasesUsed: p.healthPurchasesUsed,
              remainingPurchases: MAX_HEALTH_PURCHASES_PER_MATCH - p.healthPurchasesUsed,
              newCoinBalance: newBalance,
            });
          } catch (err: any) {
            send(ws, 'match:health_error', { message: err.message || 'Cannot purchase health' });
          }
          break;
        }

        case 'match:abort': {
          if (!conn.roomId) return;
          const room = rooms.get(conn.roomId);
          if (!room) return;
          if (room.status === 'playing') {
            finishMatch(room, false);
          }
          break;
        }
      }
    });

    ws.on('close', () => {
      if (conn) {
        handleLeaveRoom(conn);
        const current = clientsByPlayer.get(conn.playerId);
        if (current?.ws === ws) {
          clientsByPlayer.delete(conn.playerId);
          db.prepare(`UPDATE profiles SET is_online = 0, last_seen = datetime('now') WHERE id = ?`).run(conn.playerId);
        }
      }
    });
  });
}
