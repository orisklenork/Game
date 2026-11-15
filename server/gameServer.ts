import crypto from 'crypto';
import type { Server as HttpServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import {
  DIFFICULTIES,
  GAME_MODES,
  getHealthPurchaseCost,
  getWeaponStatsAtLevel,
  HEALTH_PURCHASE_AMOUNT,
  MAPS,
  MONSTERS,
  resolveCircleObstacles,
  segmentHitsObstacleDist,
  WEAPONS,
} from '../src/shared/gameData.ts';
import type {
  DifficultyId,
  EquippedLoadout,
  GameModeId,
  MapId,
  MonsterType,
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
  strafeSign: number;
  spitCooldownUntil: number;
  slamCooldownUntil: number;
}

interface ActiveProjectile {
  id: string;
  ownerId: string;
  isEnemyProjectile: boolean;
  kind: string;
  weaponId?: WeaponId;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
  damage: number;
  radius: number;
  aoeColor: string;
  burnDurationMs: number;
  aoeDotDamage: number;
  detonateAt: number | null;
  createdAt: number;
}

interface ActiveFireZone {
  id: string;
  ownerId: string;
  kind: string;
  x: number;
  z: number;
  radius: number;
  damagePerSec: number;
  color: string;
  expiresAt: number;
  lastTickAt: number;
}

interface GroundCoin {
  id: string;
  x: number;
  z: number;
  value: number;
  createdAt: number;
}

interface RoomVoteState {
  endsAt: number;
  mapCandidates: MapId[];
  modeCandidates: GameModeId[];
  mapVotes: Map<string, MapId>;
  modeVotes: Map<string, GameModeId>;
  timer?: NodeJS.Timeout;
}

interface GameRoom {
  id: string;
  hostId: string;
  mapId: MapId;
  difficulty: DifficultyId;
  gameMode: GameModeId;
  isPublicMatchmaking: boolean;
  status: 'waiting' | 'voting' | 'playing' | 'finished';
  players: Map<string, RoomPlayerState>;
  // Pause state
  pausedPlayers: Map<string, string>;
  pausedSince: number | null;
  // Vote state
  voteState: RoomVoteState | null;
  // Match state
  wave: number;
  maxWaves: number; // 0 = unlimited
  waveState: 'combat' | 'intermission';
  intermissionEndsAt: number;
  monstersToSpawn: MonsterType[];
  lastSpawnAt: number;
  monsters: Map<string, ActiveMonster>;
  coins: Map<string, GroundCoin>;
  projectiles: Map<string, ActiveProjectile>;
  fireZones: Map<string, ActiveFireZone>;
  // 1v1 Duel state
  round: number;
  roundScores: Record<string, number>;
  roundEndsAt: number;
  roundIntermissionEndsAt: number;
  roundState: 'fighting' | 'intermission';
  roundWinnerId: string | null;
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
    gameMode: room.gameMode,
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

function serializeVoteState(room: GameRoom) {
  if (!room.voteState) return null;
  const mapVotes: Record<string, MapId> = {};
  for (const [pid, mid] of room.voteState.mapVotes.entries()) mapVotes[pid] = mid;
  const modeVotes: Record<string, GameModeId> = {};
  for (const [pid, moid] of room.voteState.modeVotes.entries()) modeVotes[pid] = moid;

  return {
    roomId: room.id,
    endsAt: room.voteState.endsAt,
    mapCandidates: room.voteState.mapCandidates,
    modeCandidates: room.voteState.modeCandidates,
    mapVotes,
    modeVotes,
    voters: Array.from(room.players.values()).map((p) => ({
      playerId: p.playerId,
      username: p.username,
    })),
  };
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickVoteCandidates(currentMap: MapId): {
  mapCandidates: MapId[];
  modeCandidates: GameModeId[];
} {
  const allMaps = Object.keys(MAPS) as MapId[];
  const otherMaps = shuffleArray(allMaps.filter((m) => m !== currentMap));
  const mapCandidates = shuffleArray([currentMap, ...otherMaps.slice(0, 3)]);

  const allModes = Object.keys(GAME_MODES) as GameModeId[];
  const modeCandidates = shuffleArray(allModes).slice(0, 4);
  if (!modeCandidates.includes('unlimited')) modeCandidates[0] = 'unlimited';
  if (!modeCandidates.includes('duel_1v1')) modeCandidates[modeCandidates.length - 1] = 'duel_1v1';
  return { mapCandidates, modeCandidates };
}

function tallyWinner<T extends string>(candidates: T[], votes: Map<string, T>, fallback: T): T {
  if (votes.size === 0) return candidates[0] || fallback;
  const counts = new Map<T, number>();
  for (const c of candidates) counts.set(c, 0);
  for (const v of votes.values()) {
    if (counts.has(v)) counts.set(v, (counts.get(v) || 0) + 1);
  }
  let bestCount = -1;
  let tied: T[] = [];
  for (const c of candidates) {
    const cnt = counts.get(c) || 0;
    if (cnt > bestCount) {
      bestCount = cnt;
      tied = [c];
    } else if (cnt === bestCount) {
      tied.push(c);
    }
  }
  return tied[crypto.randomInt(0, tied.length)] || fallback;
}

function beginRoomVote(room: GameRoom) {
  if (room.voteState?.timer) {
    clearTimeout(room.voteState.timer);
  }
  const { mapCandidates, modeCandidates } = pickVoteCandidates(room.mapId);
  room.status = 'voting';
  room.voteState = {
    endsAt: Date.now() + 14000,
    mapCandidates,
    modeCandidates,
    mapVotes: new Map(),
    modeVotes: new Map(),
  };

  room.voteState.timer = setTimeout(() => {
    finalizeRoomVote(room);
  }, 14000);

  broadcastRoom(room, 'room:vote_started', serializeVoteState(room));
}

function finalizeRoomVote(room: GameRoom) {
  if (!room.voteState || room.status !== 'voting') return;
  if (room.voteState.timer) {
    clearTimeout(room.voteState.timer);
    room.voteState.timer = undefined;
  }
  const chosenMap = tallyWinner(room.voteState.mapCandidates, room.voteState.mapVotes, room.mapId);
  const chosenMode = tallyWinner(room.voteState.modeCandidates, room.voteState.modeVotes, room.gameMode);
  room.mapId = chosenMap;
  room.gameMode = chosenMode;
  room.voteState = null;

  db.prepare('UPDATE rooms SET map_id = ? WHERE id = ?').run(room.mapId, room.id);
  broadcastRoom(room, 'room:updated', serializeRoom(room));

  // Refresh loadouts & start
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
}

function buildWaveQueue(wave: number, playerCount: number, gameMode: GameModeId): MonsterType[] {
  const modeCountMult = gameMode === 'blitz' ? 1.32 : gameMode === 'boss_rush' ? 0.92 : 1.0;
  const count = Math.round((6 + wave * 3.2) * (playerCount === 2 ? 1.35 : 1) * modeCountMult);
  const queue: MonsterType[] = [];

  for (let i = 0; i < count; i++) {
    const r = Math.random();
    if (gameMode === 'boss_rush') {
      if (r < 0.25) queue.push('brute');
      else if (r < 0.48) queue.push('sentinel');
      else if (r < 0.68) queue.push('howler');
      else if (r < 0.85) queue.push('spitter');
      else queue.push('phantom');
      continue;
    }

    if (wave === 1) {
      if (r < 0.55) queue.push('zombie');
      else if (r < 0.85) queue.push('runner');
      else queue.push('crawler');
    } else if (wave === 2) {
      if (r < 0.3) queue.push('zombie');
      else if (r < 0.6) queue.push('runner');
      else if (r < 0.85) queue.push('crawler');
      else queue.push('spitter');
    } else if (wave <= 4) {
      if (r < 0.18) queue.push('zombie');
      else if (r < 0.36) queue.push('runner');
      else if (r < 0.52) queue.push('crawler');
      else if (r < 0.68) queue.push('spitter');
      else if (r < 0.82) queue.push('howler');
      else if (r < 0.93) queue.push('brute');
      else queue.push('phantom');
    } else {
      if (r < 0.16) queue.push('runner');
      else if (r < 0.3) queue.push('crawler');
      else if (r < 0.45) queue.push('spitter');
      else if (r < 0.6) queue.push('howler');
      else if (r < 0.75) queue.push('brute');
      else if (r < 0.88) queue.push('sentinel');
      else queue.push('phantom');
    }
  }

  // Boss Fight every 5 waves!
  const bossInterval = GAME_MODES[gameMode]?.bossInterval || 5;
  if (wave % bossInterval === 0) {
    queue.push('boss');
    if (gameMode === 'boss_rush' && wave >= 10) {
      queue.push('boss');
    }
  }
  return queue;
}

function moveMonsterWithObstacles(
  m: ActiveMonster,
  targetX: number,
  targetZ: number,
  stepDist: number,
  mapId: MapId
) {
  const map = MAPS[mapId];
  const start = resolveCircleObstacles(m.x, m.z, m.radius, map);
  m.x = start.x;
  m.z = start.z;

  const dx = targetX - m.x;
  const dz = targetZ - m.z;
  const dist = Math.hypot(dx, dz) || 0.001;
  const ux = dx / dist;
  const uz = dz / dist;

  // Direct attempt
  const direct = resolveCircleObstacles(m.x + ux * stepDist, m.z + uz * stepDist, m.radius, map);
  const directProgress = (direct.x - m.x) * ux + (direct.z - m.z) * uz;

  if (!direct.collided || directProgress >= stepDist * 0.45) {
    m.x = direct.x;
    m.z = direct.z;
    return;
  }

  // Blocked by wall/pillar: probe tangential angles around obstacle smoothly
  const s = m.strafeSign || 1;
  const probeAngles = [
    s * 0.75,
    -s * 0.75,
    s * 1.35,
    -s * 1.35,
    s * 1.85,
    -s * 1.85,
  ];

  let bestX = direct.x;
  let bestZ = direct.z;
  let bestScore = -Infinity;
  let chosenSign = s;

  for (const ang of probeAngles) {
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const rx = ux * cos - uz * sin;
    const rz = ux * sin + uz * cos;
    const cand = resolveCircleObstacles(m.x + rx * stepDist, m.z + rz * stepDist, m.radius, map);
    const movedDist = Math.hypot(cand.x - m.x, cand.z - m.z);
    if (movedDist < stepDist * 0.25) continue;

    // Score prefers reducing distance to player while actually moving cleanly
    const newDist = Math.hypot(targetX - cand.x, targetZ - cand.z);
    const distGain = dist - newDist;
    const score = distGain + movedDist * 0.65 - (cand.collided ? 0.15 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestX = cand.x;
      bestZ = cand.z;
      chosenSign = ang >= 0 ? 1 : -1;
    }
  }

  m.strafeSign = chosenSign;
  m.x = bestX;
  m.z = bestZ;
}

function applyMonsterSeparation(monsters: Map<string, ActiveMonster>, mapId: MapId) {
  const map = MAPS[mapId];
  const arr = Array.from(monsters.values());
  for (let i = 0; i < arr.length; i++) {
    const a = arr[i];
    for (let j = i + 1; j < arr.length; j++) {
      const b = arr[j];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      const minSep = (a.radius + b.radius) * 0.85;
      if (d > 0.0001 && d < minSep) {
        const push = (minSep - d) * 0.35;
        const nx = dx / d;
        const nz = dz / d;
        const pa = resolveCircleObstacles(a.x - nx * push, a.z - nz * push, a.radius, map);
        const pb = resolveCircleObstacles(b.x + nx * push, b.z + nz * push, b.radius, map);
        a.x = pa.x;
        a.z = pa.z;
        b.x = pb.x;
        b.z = pb.z;
      }
    }
  }
}

function detonateProjectile(room: GameRoom, proj: ActiveProjectile, now: number) {
  const map = MAPS[room.mapId];
  const modeDef = GAME_MODES[room.gameMode] || GAME_MODES.unlimited;

  broadcastRoom(room, 'match:explosion', {
    kind: proj.kind,
    x: proj.x,
    y: Math.max(0.25, proj.y),
    z: proj.z,
    radius: proj.radius,
    color: proj.aoeColor,
  });

  if (proj.burnDurationMs > 0) {
    const fzId = crypto.randomUUID();
    room.fireZones.set(fzId, {
      id: fzId,
      ownerId: proj.ownerId,
      kind: proj.kind,
      x: proj.x,
      z: proj.z,
      radius: proj.radius,
      damagePerSec: proj.aoeDotDamage || 32,
      color: proj.aoeColor,
      expiresAt: now + proj.burnDurationMs,
      lastTickAt: now,
    });
  }

  const owner = room.players.get(proj.ownerId);
  const hitResults: Array<{ monsterId: string; damage: number; killed: boolean; x: number; z: number }> = [];

  if (!modeDef.noMonsters && !proj.isEnemyProjectile) {
    for (const m of Array.from(room.monsters.values())) {
      const dist = Math.hypot(m.x - proj.x, m.z - proj.z);
      if (dist <= proj.radius + m.radius) {
        const len = Math.max(0.01, Math.hypot(m.x - proj.x, 0.4, m.z - proj.z));
        const blocked = segmentHitsObstacleDist(
          proj.x,
          Math.max(0.5, proj.y),
          proj.z,
          (m.x - proj.x) / len,
          0,
          (m.z - proj.z) / len,
          dist,
          map
        );
        const falloff = 1 - 0.6 * Math.min(1, dist / proj.radius);
        const dmg = Math.round(proj.damage * falloff * (blocked !== null ? 0.35 : 1));
        m.hp = Math.max(0, m.hp - dmg);
        const killed = m.hp <= 0;
        hitResults.push({ monsterId: m.id, damage: dmg, killed, x: m.x, z: m.z });

        if (killed) {
          room.monsters.delete(m.id);
          if (owner) {
            owner.kills += 1;
            if (m.type === 'boss') owner.bossKills += 1;
            owner.score += m.scoreReward;
            owner.xpEarned += m.xpReward;
            if (proj.weaponId) {
              owner.weaponKills[proj.weaponId] = (owner.weaponKills[proj.weaponId] || 0) + 1;
            }
          }
          const coinId = crypto.randomUUID();
          room.coins.set(coinId, {
            id: coinId,
            x: m.x,
            z: m.z,
            value: m.coinReward,
            createdAt: now,
          });
          broadcastRoom(room, 'match:monster_killed', {
            monsterId: m.id,
            type: m.type,
            killerId: proj.ownerId,
            x: m.x,
            z: m.z,
            coinDrop: { id: coinId, x: m.x, z: m.z, value: m.coinReward },
          });
        }
      }
    }
  } else if (modeDef.noMonsters) {
    // PvP blast damage in 1v1
    for (const target of room.players.values()) {
      if (!target.alive) continue;
      if (target.playerId === proj.ownerId && proj.kind !== 'frag_grenade' && proj.kind !== 'pipe_bomb' && proj.kind !== 'rpg') {
        continue;
      }
      const dist = Math.hypot(target.x - proj.x, target.z - proj.z);
      if (dist <= proj.radius + 0.5) {
        const selfMult = target.playerId === proj.ownerId ? 0.4 : 1.0;
        const falloff = 1 - 0.65 * Math.min(1, dist / proj.radius);
        const dmg = Math.max(8, Math.round(proj.damage * 0.42 * falloff * selfMult));
        target.hp = Math.max(0, target.hp - dmg);
        if (target.hp <= 0) target.alive = false;
        broadcastRoom(room, 'match:player_hit', {
          playerId: target.playerId,
          attackerId: proj.ownerId,
          damage: dmg,
          hp: target.hp,
          alive: target.alive,
          attackerType: proj.kind,
        });
        if (target.playerId !== proj.ownerId) {
          hitResults.push({ monsterId: target.playerId, damage: dmg, killed: !target.alive, x: target.x, z: target.z });
        }
      }
    }
  }

  if (hitResults.length > 0 && owner) {
    const conn = clientsByPlayer.get(owner.playerId);
    if (conn) send(conn.ws, 'match:hit_confirm', { hits: hitResults });
  }
}

function handleDuelRoundEnd(room: GameRoom, winner: RoomPlayerState | null, now: number) {
  const modeDef = GAME_MODES[room.gameMode] || GAME_MODES.duel_1v1;
  const targetWins = modeDef.roundsToWin || 5;

  if (winner) {
    room.roundScores[winner.playerId] = (room.roundScores[winner.playerId] || 0) + 1;
    winner.kills += 1;
    winner.score += 250;
    winner.coinsEarned += 45;
    winner.xpEarned += 55;
  }

  room.roundWinnerId = winner?.playerId || null;
  const winnerScore = winner ? room.roundScores[winner.playerId] || 0 : 0;
  const matchOver = winnerScore >= targetWins;

  broadcastRoom(room, 'match:round_ended', {
    round: room.round,
    winnerId: winner?.playerId || null,
    winnerName: winner?.username || 'Draw',
    roundScores: room.roundScores,
    matchOver,
  });

  if (matchOver) {
    finishMatch(room, true);
    return;
  }

  room.roundState = 'intermission';
  room.roundIntermissionEndsAt = now + 3000;
}

function startMatchLoop(room: GameRoom) {
  const map = MAPS[room.mapId];
  const modeDef = GAME_MODES[room.gameMode] || GAME_MODES.unlimited;

  room.status = 'playing';
  room.wave = 1;
  room.maxWaves = 0; // Unlimited waves!
  room.waveState = modeDef.noMonsters ? 'combat' : 'intermission';
  room.intermissionEndsAt = Date.now() + 2500;
  room.monsters.clear();
  room.coins.clear();
  room.projectiles.clear();
  room.fireZones.clear();
  room.pausedPlayers.clear();
  room.pausedSince = null;
  room.monstersToSpawn = modeDef.noMonsters ? [] : buildWaveQueue(1, room.players.size, room.gameMode);
  room.lastSpawnAt = 0;
  room.matchStartedAt = Date.now();

  // 1v1 Duel setup
  room.round = 1;
  room.roundState = 'fighting';
  room.roundEndsAt = Date.now() + (modeDef.roundSeconds || 90) * 1000;
  room.roundIntermissionEndsAt = 0;
  room.roundWinnerId = null;
  room.roundScores = {};

  const playerList = Array.from(room.players.values());
  const spawns = modeDef.noMonsters ? map.duelSpawns : map.playerSpawns;

  playerList.forEach((p, spawnIdx) => {
    const sp = spawns[spawnIdx % spawns.length];
    const oppSp = spawns[(spawnIdx + 1) % spawns.length];
    p.x = sp[0];
    p.y = 0;
    p.z = sp[1];
    p.yaw = modeDef.noMonsters ? Math.atan2(-(oppSp[0] - sp[0]), -(oppSp[1] - sp[1])) : 0;
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
    room.roundScores[p.playerId] = 0;
  });

  db.prepare(`UPDATE rooms SET status = 'playing' WHERE id = ?`).run(room.id);

  broadcastRoom(room, 'match:started', {
    roomId: room.id,
    mapId: room.mapId,
    difficulty: room.difficulty,
    gameMode: room.gameMode,
    maxWaves: room.maxWaves,
    players: playerList,
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

    const pausedBy = Array.from(room.pausedPlayers.values());
    const isPaused = pausedBy.length > 0;
    const alivePlayers = Array.from(room.players.values()).filter((p) => p.alive);

    if (!modeDef.noMonsters) {
      // Co-op defeat check
      if (alivePlayers.length === 0) {
        finishMatch(room, false);
        return;
      }
    }

    if (!isPaused) {
      // A. Mode-specific loop: 1v1 Multi-Round Duel vs Co-op Survival Waves
      if (modeDef.noMonsters) {
        if (room.roundState === 'fighting') {
          if (room.players.size >= 2 && alivePlayers.length <= 1) {
            handleDuelRoundEnd(room, alivePlayers[0] || null, now);
          } else if (alivePlayers.length === 0) {
            handleDuelRoundEnd(room, null, now);
          } else if (now >= room.roundEndsAt) {
            // Time expired: highest HP wins round
            const sorted = [...alivePlayers].sort((a, b) => b.hp - a.hp);
            const winner = sorted.length >= 2 && sorted[0].hp === sorted[1].hp ? null : sorted[0] || null;
            handleDuelRoundEnd(room, winner, now);
          }
        } else if (room.roundState === 'intermission' && now >= room.roundIntermissionEndsAt) {
          room.round += 1;
          room.roundState = 'fighting';
          room.roundEndsAt = now + (modeDef.roundSeconds || 90) * 1000;
          room.roundWinnerId = null;
          room.projectiles.clear();
          room.fireZones.clear();
          const pArr = Array.from(room.players.values());
          const spawnPayload: Array<{ playerId: string; x: number; z: number; yaw: number }> = [];
          pArr.forEach((p, idx) => {
            const sp = map.duelSpawns[idx % map.duelSpawns.length];
            const oppSp = map.duelSpawns[(idx + 1) % map.duelSpawns.length];
            p.x = sp[0];
            p.y = 0;
            p.z = sp[1];
            p.yaw = Math.atan2(-(oppSp[0] - sp[0]), -(oppSp[1] - sp[1]));
            p.pitch = 0;
            p.hp = 100;
            p.alive = true;
            spawnPayload.push({ playerId: p.playerId, x: p.x, z: p.z, yaw: p.yaw });
          });
          broadcastRoom(room, 'match:round_started', {
            round: room.round,
            roundScores: room.roundScores,
            spawns: spawnPayload,
          });
        }
      } else {
        // Co-op Survival Wave progression
        if (room.waveState === 'intermission') {
          if (now >= room.intermissionEndsAt) {
            room.waveState = 'combat';
            broadcastRoom(room, 'match:wave', {
              wave: room.wave,
              isBossWave: room.wave % (modeDef.bossInterval || 5) === 0,
            });
          }
        } else {
          if (
            room.monstersToSpawn.length > 0 &&
            now - room.lastSpawnAt >= modeDef.spawnIntervalMs &&
            room.monsters.size < 26
          ) {
            const mType = room.monstersToSpawn.shift()!;
            const sp = map.monsterSpawns[crypto.randomInt(0, map.monsterSpawns.length)];
            const mDef = MONSTERS[mType];
            const diff = DIFFICULTIES[room.difficulty];
            const waveScale = 1 + (room.wave - 1) * 0.16;
            const coopScale = room.players.size === 2 && mType === 'boss' ? 1.45 : 1.0;

            const spawnResolved = resolveCircleObstacles(
              sp[0] + (Math.random() - 0.5) * 1.5,
              sp[1] + (Math.random() - 0.5) * 1.5,
              mDef.radius,
              map
            );

            const maxHp = Math.round(mDef.hp * diff.hpMult * modeDef.hpMult * waveScale * coopScale);
            const monster: ActiveMonster = {
              id: crypto.randomUUID(),
              type: mType,
              x: spawnResolved.x,
              z: spawnResolved.z,
              yaw: 0,
              hp: maxHp,
              maxHp,
              speed:
                mDef.speed *
                diff.speedMult *
                modeDef.speedMult *
                (1 + Math.min(0.32, (room.wave - 1) * 0.025)),
              damage: Math.round(mDef.damage * diff.dmgMult),
              attackRange: mDef.attackRange,
              attackCooldown: mDef.attackCooldown,
              lastAttackAt: 0,
              radius: mDef.radius,
              coinReward: Math.round(mDef.coinReward * diff.rewardMult * modeDef.rewardMult),
              scoreReward: Math.round(mDef.scoreReward * diff.rewardMult * modeDef.rewardMult),
              xpReward: Math.round(mDef.xpReward * diff.rewardMult * modeDef.rewardMult),
              attackAnimUntil: 0,
              strafeSign: Math.random() < 0.5 ? 1 : -1,
              spitCooldownUntil: now + 2200,
              slamCooldownUntil: now + 4500,
            };
            room.monsters.set(monster.id, monster);
            room.lastSpawnAt = now;
          }

          if (room.monstersToSpawn.length === 0 && room.monsters.size === 0) {
            room.wave += 1;
            room.waveState = 'intermission';
            room.intermissionEndsAt = now + 4000;
            room.monstersToSpawn = buildWaveQueue(room.wave, room.players.size, room.gameMode);

            for (const sc of map.supplyCaches) {
              const cid = crypto.randomUUID();
              room.coins.set(cid, { id: cid, x: sc[0], z: sc[1], value: 25, createdAt: now });
            }
            for (const p of alivePlayers) {
              p.hp = Math.min(p.maxHp, p.hp + 18);
            }
            broadcastRoom(room, 'match:wave_cleared', { nextWave: room.wave });
          }
        }

        // B. Update Monsters AI (Howler aura, Spitter ranged acid, Brute/Boss shockwave slam, smart steering)
        const howlers = Array.from(room.monsters.values()).filter((hm) => hm.type === 'howler');

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

          let auraMult = 1.0;
          if (m.type !== 'howler') {
            for (const h of howlers) {
              if (Math.hypot(h.x - m.x, h.z - m.z) <= 6.5) {
                auraMult = 1.28;
                break;
              }
            }
          }

          // Spitter fires acid bolts when in range with clear line of sight
          if (m.type === 'spitter' && bestDist <= 12.5 && bestDist > 2.6 && now >= m.spitCooldownUntil) {
            const len = Math.max(0.01, bestDist);
            const ux = dx / len;
            const uz = dz / len;
            const blocked = segmentHitsObstacleDist(m.x, 1.35, m.z, ux, 0, uz, bestDist, map);
            if (blocked === null) {
              m.spitCooldownUntil = now + 2600;
              m.attackAnimUntil = now + 350;
              const pid = crypto.randomUUID();
              room.projectiles.set(pid, {
                id: pid,
                ownerId: m.id,
                isEnemyProjectile: true,
                kind: 'acid',
                x: m.x + ux * 0.6,
                y: 1.35,
                z: m.z + uz * 0.6,
                vx: ux * 16.5,
                vy: 0.4,
                vz: uz * 16.5,
                gravity: 2.2,
                damage: m.damage,
                radius: 1.6,
                aoeColor: '#4ade80',
                burnDurationMs: 0,
                aoeDotDamage: 0,
                detonateAt: now + 2200,
                createdAt: now,
              });
            }
          }

          if (bestDist > m.attackRange * 0.85) {
            const step = Math.min(bestDist, m.speed * auraMult * dt);
            moveMonsterWithObstacles(m, nearest.x, nearest.z, step, room.mapId);
          }

          // Brute & Boss ground shockwave slam
          if ((m.type === 'boss' || m.type === 'brute') && bestDist <= 4.2 && now >= m.slamCooldownUntil) {
            m.slamCooldownUntil = now + (m.type === 'boss' ? 5500 : 7500);
            m.attackAnimUntil = now + 450;
            const slamRadius = m.type === 'boss' ? 4.8 : 3.4;
            broadcastRoom(room, 'match:explosion', {
              kind: 'slam',
              x: m.x,
              y: 0.35,
              z: m.z,
              radius: slamRadius,
              color: m.type === 'boss' ? '#ef4444' : '#f59e0b',
            });
            for (const target of alivePlayers) {
              if (Math.hypot(target.x - m.x, target.z - m.z) <= slamRadius) {
                const slamDmg = Math.round(m.damage * 0.85);
                target.hp = Math.max(0, target.hp - slamDmg);
                if (target.hp <= 0) target.alive = false;
                broadcastRoom(room, 'match:player_hit', {
                  playerId: target.playerId,
                  damage: slamDmg,
                  hp: target.hp,
                  alive: target.alive,
                  attackerType: m.type,
                });
              }
            }
          } else if (bestDist <= m.attackRange && now - m.lastAttackAt >= m.attackCooldown * 1000) {
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

        applyMonsterSeparation(room.monsters, room.mapId);
      }

      // C. Update Active Projectiles (Grenades, Molotovs, RPGs, Spitter Acid)
      for (const [pid, proj] of Array.from(room.projectiles.entries())) {
        const speed = Math.hypot(proj.vx, proj.vy, proj.vz);
        if (speed > 0.01) {
          const stepLen = speed * dt;
          const hitWallDist = segmentHitsObstacleDist(
            proj.x,
            proj.y,
            proj.z,
            proj.vx / speed,
            proj.vy / speed,
            proj.vz / speed,
            stepLen,
            map
          );

          if (hitWallDist !== null) {
            if (proj.isEnemyProjectile) {
              room.projectiles.delete(pid);
              continue;
            }
            if (proj.kind === 'rpg' || proj.detonateAt === null) {
              proj.x += (proj.vx / speed) * Math.max(0, hitWallDist - 0.15);
              proj.y += (proj.vy / speed) * Math.max(0, hitWallDist - 0.15);
              proj.z += (proj.vz / speed) * Math.max(0, hitWallDist - 0.15);
              room.projectiles.delete(pid);
              detonateProjectile(room, proj, now);
              continue;
            } else {
              // Timed grenade bounce off obstacle/floor
              proj.vx *= -0.42;
              proj.vz *= -0.42;
              proj.vy = Math.abs(proj.vy) * 0.35;
            }
          }
        }

        proj.vy -= proj.gravity * dt;
        proj.x += proj.vx * dt;
        proj.y += proj.vy * dt;
        proj.z += proj.vz * dt;

        if (proj.y <= 0.12) {
          proj.y = 0.12;
          if (proj.isEnemyProjectile) {
            room.projectiles.delete(pid);
            continue;
          }
          if (proj.kind === 'rpg' || proj.detonateAt === null) {
            room.projectiles.delete(pid);
            detonateProjectile(room, proj, now);
            continue;
          }
          proj.vy = Math.abs(proj.vy) * 0.38;
          proj.vx *= 0.68;
          proj.vz *= 0.68;
        }

        // Direct entity hit check for RPG & enemy acid bolts
        let directDetonated = false;
        if (proj.isEnemyProjectile) {
          for (const target of alivePlayers) {
            if (Math.hypot(target.x - proj.x, target.z - proj.z) <= 0.72 && Math.abs(target.y + 1.0 - proj.y) <= 1.1) {
              target.hp = Math.max(0, target.hp - proj.damage);
              if (target.hp <= 0) target.alive = false;
              broadcastRoom(room, 'match:player_hit', {
                playerId: target.playerId,
                damage: proj.damage,
                hp: target.hp,
                alive: target.alive,
                attackerType: 'spitter',
              });
              room.projectiles.delete(pid);
              directDetonated = true;
              break;
            }
          }
        } else if (proj.kind === 'rpg') {
          for (const m of room.monsters.values()) {
            if (Math.hypot(m.x - proj.x, m.z - proj.z) <= m.radius + 0.55) {
              room.projectiles.delete(pid);
              detonateProjectile(room, proj, now);
              directDetonated = true;
              break;
            }
          }
          if (!directDetonated && modeDef.noMonsters) {
            for (const target of alivePlayers) {
              if (target.playerId === proj.ownerId) continue;
              if (Math.hypot(target.x - proj.x, target.z - proj.z) <= 0.85) {
                room.projectiles.delete(pid);
                detonateProjectile(room, proj, now);
                directDetonated = true;
                break;
              }
            }
          }
        }
        if (directDetonated) continue;

        if (proj.detonateAt !== null && now >= proj.detonateAt) {
          room.projectiles.delete(pid);
          if (!proj.isEnemyProjectile) {
            detonateProjectile(room, proj, now);
          }
        }
      }

      // D. Update Fire / Shock Ground Zones (Molotov, Thermite, Shock Grenade)
      for (const [fzId, fz] of Array.from(room.fireZones.entries())) {
        if (now >= fz.expiresAt) {
          room.fireZones.delete(fzId);
          continue;
        }
        if (now - fz.lastTickAt >= 450) {
          fz.lastTickAt = now;
          const owner = room.players.get(fz.ownerId);
          const tickDmg = Math.round(fz.damagePerSec * 0.45);
          const dotHits: Array<{ monsterId: string; damage: number; killed: boolean; x: number; z: number }> = [];

          if (!modeDef.noMonsters) {
            for (const m of Array.from(room.monsters.values())) {
              if (Math.hypot(m.x - fz.x, m.z - fz.z) <= fz.radius + m.radius) {
                m.hp = Math.max(0, m.hp - tickDmg);
                const killed = m.hp <= 0;
                dotHits.push({ monsterId: m.id, damage: tickDmg, killed, x: m.x, z: m.z });
                if (killed) {
                  room.monsters.delete(m.id);
                  if (owner) {
                    owner.kills += 1;
                    if (m.type === 'boss') owner.bossKills += 1;
                    owner.score += m.scoreReward;
                    owner.xpEarned += m.xpReward;
                  }
                  const cid = crypto.randomUUID();
                  room.coins.set(cid, { id: cid, x: m.x, z: m.z, value: m.coinReward, createdAt: now });
                  broadcastRoom(room, 'match:monster_killed', {
                    monsterId: m.id,
                    type: m.type,
                    killerId: fz.ownerId,
                    x: m.x,
                    z: m.z,
                    coinDrop: { id: cid, x: m.x, z: m.z, value: m.coinReward },
                  });
                }
              }
            }
          } else {
            for (const target of alivePlayers) {
              if (target.playerId === fz.ownerId) continue;
              if (Math.hypot(target.x - fz.x, target.z - fz.z) <= fz.radius) {
                const pvpTick = Math.max(4, Math.round(tickDmg * 0.45));
                target.hp = Math.max(0, target.hp - pvpTick);
                if (target.hp <= 0) target.alive = false;
                broadcastRoom(room, 'match:player_hit', {
                  playerId: target.playerId,
                  attackerId: fz.ownerId,
                  damage: pvpTick,
                  hp: target.hp,
                  alive: target.alive,
                  attackerType: fz.kind,
                });
              }
            }
          }

          if (dotHits.length > 0 && owner) {
            const conn = clientsByPlayer.get(owner.playerId);
            if (conn) send(conn.ws, 'match:hit_confirm', { hits: dotHits });
          }
        }
      }

      // E. Auto-collect nearby coins
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
    }

    // F. Broadcast authoritative snapshot
    broadcastRoom(room, 'match:state', {
      t: now,
      elapsedSec: Math.floor(((room.pausedSince ?? now) - room.matchStartedAt) / 1000),
      wave: modeDef.noMonsters ? room.round : room.wave,
      maxWaves: room.maxWaves,
      waveState: room.waveState,
      remainingToSpawn: room.monstersToSpawn.length,
      pausedBy,
      gameMode: room.gameMode,
      duel: modeDef.noMonsters
        ? {
            round: room.round,
            roundsToWin: modeDef.roundsToWin || 5,
            roundState: room.roundState,
            roundTimeLeftSec: Math.max(0, Math.ceil((room.roundEndsAt - now) / 1000)),
            roundScores: room.roundScores,
            roundWinnerId: room.roundWinnerId,
          }
        : undefined,
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
        attacking: !isPaused && now < m.attackAnimUntil,
      })),
      coins: Array.from(room.coins.values()),
      projectiles: Array.from(room.projectiles.values()).map((pr) => ({
        id: pr.id,
        kind: pr.kind,
        x: pr.x,
        y: pr.y,
        z: pr.z,
      })),
      fireZones: Array.from(room.fireZones.values()).map((fz) => ({
        id: fz.id,
        kind: fz.kind,
        x: fz.x,
        z: fz.z,
        radius: fz.radius,
        color: fz.color,
      })),
    });
  }, 50);
}

function finishMatch(room: GameRoom, victory: boolean) {
  if (room.status === 'finished') return;
  room.status = 'finished';
  room.pausedPlayers.clear();
  room.pausedSince = null;
  if (room.tickTimer) {
    clearInterval(room.tickTimer);
    room.tickTimer = undefined;
  }

  const durationSeconds = Math.max(1, Math.floor((Date.now() - room.matchStartedAt) / 1000));
  const modeDef = GAME_MODES[room.gameMode] || GAME_MODES.unlimited;
  const wavesCleared = modeDef.noMonsters ? room.round : Math.max(0, room.wave - 1);
  const diff = DIFFICULTIES[room.difficulty];

  const playerSummaries = Array.from(room.players.values()).map((p) => {
    const survivalBonusCoins = Math.round(wavesCleared * 25 * diff.rewardMult * modeDef.rewardMult);
    const survivalBonusXp = Math.round(wavesCleared * 30 * diff.rewardMult * modeDef.rewardMult);
    const totalCoins = p.coinsEarned + survivalBonusCoins;
    const totalXp = p.xpEarned + survivalBonusXp;

    const didWin = modeDef.noMonsters
      ? (room.roundScores[p.playerId] || 0) >= (modeDef.roundsToWin || 5)
      : victory || wavesCleared >= 5;

    return {
      playerId: p.playerId,
      username: p.username,
      kills: p.kills,
      bossKills: p.bossKills,
      score: p.score,
      coinsEarned: totalCoins,
      xpEarned: totalXp,
      survived: didWin || p.alive,
      weaponKills: p.weaponKills,
    };
  });

  try {
    recordMatchResult({
      roomId: room.id,
      mapId: room.mapId,
      difficulty: room.difficulty,
      wavesCleared,
      victory: victory || wavesCleared >= 5,
      durationSeconds,
      players: playerSummaries,
    });
  } catch (err) {
    console.error('Failed to record match result:', err);
  }

  db.prepare(`UPDATE rooms SET status = 'waiting' WHERE id = ?`).run(room.id);

  for (const p of room.players.values()) {
    p.isReady = false;
    const conn = clientsByPlayer.get(p.playerId);
    if (conn) {
      const updatedProfile = getFullProfileById(p.playerId);
      const didWin = modeDef.noMonsters
        ? (room.roundScores[p.playerId] || 0) >= (modeDef.roundsToWin || 5)
        : victory || wavesCleared >= 5;
      send(conn.ws, 'match:ended', {
        victory: didWin,
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
  if (room.pausedPlayers.has(conn.playerId)) {
    room.pausedPlayers.delete(conn.playerId);
    if (room.pausedPlayers.size === 0 && room.pausedSince) {
      const pausedDelta = Date.now() - room.pausedSince;
      room.intermissionEndsAt += pausedDelta;
      room.matchStartedAt += pausedDelta;
      room.lastSpawnAt += pausedDelta;
      for (const c of room.coins.values()) c.createdAt += pausedDelta;
      room.pausedSince = null;
    }
  }

  db.prepare('DELETE FROM room_members WHERE room_id = ? AND player_id = ?').run(room.id, conn.playerId);

  if (room.players.size === 0) {
    if (room.tickTimer) clearInterval(room.tickTimer);
    if (room.voteState?.timer) clearTimeout(room.voteState.timer);
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

function rayHitsPlayer(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxRange: number,
  target: RoomPlayerState
): number | null {
  const cy = target.y + 0.98;
  const ocX = target.x - ox;
  const ocY = cy - oy;
  const ocZ = target.z - oz;
  const proj = ocX * dx + ocY * dy + ocZ * dz;
  if (proj < 0 || proj > maxRange) return null;
  const closestX = ox + dx * proj;
  const closestY = oy + dy * proj;
  const closestZ = oz + dz * proj;
  if (Math.hypot(closestX - target.x, closestZ - target.z) <= 0.56 && Math.abs(closestY - cy) <= 1.05) {
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
          const difficulty: DifficultyId = DIFFICULTIES[payload.difficulty as DifficultyId]
            ? payload.difficulty
            : 'normal';
          const gameMode: GameModeId = GAME_MODES[payload.gameMode as GameModeId]
            ? payload.gameMode
            : 'unlimited';

          const room: GameRoom = {
            id: code,
            hostId: conn.playerId,
            mapId,
            difficulty,
            gameMode,
            isPublicMatchmaking: Boolean(payload.isPublic),
            status: 'waiting',
            players: new Map([[conn.playerId, buildRoomMember()]]),
            pausedPlayers: new Map(),
            pausedSince: null,
            voteState: null,
            wave: 1,
            maxWaves: 0,
            waveState: 'intermission',
            intermissionEndsAt: 0,
            monstersToSpawn: [],
            lastSpawnAt: 0,
            monsters: new Map(),
            coins: new Map(),
            projectiles: new Map(),
            fireZones: new Map(),
            round: 1,
            roundScores: {},
            roundEndsAt: 0,
            roundIntermissionEndsAt: 0,
            roundState: 'fighting',
            roundWinnerId: null,
            matchStartedAt: 0,
          };
          rooms.set(code, room);
          conn.roomId = code;

          db.prepare(
            'INSERT OR REPLACE INTO rooms (id, host_id, map_id, difficulty, status, max_players) VALUES (?, ?, ?, ?, ?, 2)'
          ).run(code, conn.playerId, mapId, difficulty, 'waiting');
          db.prepare('INSERT OR REPLACE INTO room_members (room_id, player_id, is_ready) VALUES (?, ?, 0)').run(
            code,
            conn.playerId
          );

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
          db.prepare('INSERT OR REPLACE INTO room_members (room_id, player_id, is_ready) VALUES (?, ?, 0)').run(
            room.id,
            conn.playerId
          );

          send(ws, 'room:joined', serializeRoom(room));
          broadcastRoom(room, 'room:updated', serializeRoom(room), conn.playerId);
          break;
        }

        case 'room:find_player': {
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
            db.prepare('INSERT OR REPLACE INTO room_members (room_id, player_id, is_ready) VALUES (?, ?, 0)').run(
              openRoom.id,
              conn.playerId
            );
            send(ws, 'room:joined', serializeRoom(openRoom));
            broadcastRoom(openRoom, 'room:updated', serializeRoom(openRoom), conn.playerId);
          } else {
            handleLeaveRoom(conn);
            let code = generateRoomCode();
            while (rooms.has(code)) code = generateRoomCode();
            const mapId: MapId = MAPS[payload.mapId as MapId] ? payload.mapId : 'hospital';
            const difficulty: DifficultyId = DIFFICULTIES[payload.difficulty as DifficultyId]
              ? payload.difficulty
              : 'normal';
            const room: GameRoom = {
              id: code,
              hostId: conn.playerId,
              mapId,
              difficulty,
              gameMode: 'unlimited',
              isPublicMatchmaking: true,
              status: 'waiting',
              players: new Map([[conn.playerId, buildRoomMember()]]),
              pausedPlayers: new Map(),
              pausedSince: null,
              voteState: null,
              wave: 1,
              maxWaves: 0,
              waveState: 'intermission',
              intermissionEndsAt: 0,
              monstersToSpawn: [],
              lastSpawnAt: 0,
              monsters: new Map(),
              coins: new Map(),
              projectiles: new Map(),
              fireZones: new Map(),
              round: 1,
              roundScores: {},
              roundEndsAt: 0,
              roundIntermissionEndsAt: 0,
              roundState: 'fighting',
              roundWinnerId: null,
              matchStartedAt: 0,
            };
            rooms.set(code, room);
            conn.roomId = code;
            db.prepare(
              'INSERT OR REPLACE INTO rooms (id, host_id, map_id, difficulty, status, max_players) VALUES (?, ?, ?, ?, ?, 2)'
            ).run(code, conn.playerId, mapId, difficulty, 'waiting');
            db.prepare('INSERT OR REPLACE INTO room_members (room_id, player_id, is_ready) VALUES (?, ?, 0)').run(
              code,
              conn.playerId
            );
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
          p.weaponId = profile.equippedWeapon;
          p.loadout = profile.equippedLoadout;
          const wLevels: Record<string, number> = {};
          for (const [wid, info] of Object.entries(profile.weapons)) wLevels[wid] = info.upgradeLevel;
          p.weaponLevels = wLevels;
          db.prepare('UPDATE room_members SET is_ready = ? WHERE room_id = ? AND player_id = ?').run(
            p.isReady ? 1 : 0,
            room.id,
            conn.playerId
          );
          broadcastRoom(room, 'room:updated', serializeRoom(room));
          break;
        }

        case 'room:config': {
          if (!conn.roomId) return;
          const room = rooms.get(conn.roomId);
          if (!room || room.hostId !== conn.playerId || room.status !== 'waiting') return;
          if (payload.mapId && MAPS[payload.mapId as MapId]) room.mapId = payload.mapId;
          if (payload.difficulty && DIFFICULTIES[payload.difficulty as DifficultyId]) {
            room.difficulty = payload.difficulty;
          }
          if (payload.gameMode && GAME_MODES[payload.gameMode as GameModeId]) {
            room.gameMode = payload.gameMode;
          }
          db.prepare('UPDATE rooms SET map_id = ?, difficulty = ? WHERE id = ?').run(
            room.mapId,
            room.difficulty,
            room.id
          );
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

        case 'room:begin_vote': {
          if (!conn.roomId) return;
          const room = rooms.get(conn.roomId);
          if (!room || room.hostId !== conn.playerId || room.status !== 'waiting') return;
          beginRoomVote(room);
          break;
        }

        case 'room:vote': {
          if (!conn.roomId) return;
          const room = rooms.get(conn.roomId);
          if (!room || room.status !== 'voting' || !room.voteState) return;
          if (payload.mapId && room.voteState.mapCandidates.includes(payload.mapId)) {
            room.voteState.mapVotes.set(conn.playerId, payload.mapId);
          }
          if (payload.gameMode && room.voteState.modeCandidates.includes(payload.gameMode)) {
            room.voteState.modeVotes.set(conn.playerId, payload.gameMode);
          }
          broadcastRoom(room, 'room:vote_updated', serializeVoteState(room));

          // Auto-deploy once all squad members voted for both map & mode
          let allVoted = true;
          for (const pid of room.players.keys()) {
            if (!room.voteState.mapVotes.has(pid) || !room.voteState.modeVotes.has(pid)) {
              allVoted = false;
              break;
            }
          }
          if (allVoted || (payload.forceStart && room.hostId === conn.playerId)) {
            finalizeRoomVote(room);
          }
          break;
        }

        case 'match:start': {
          if (!conn.roomId) return;
          const room = rooms.get(conn.roomId);
          if (!room || room.hostId !== conn.playerId || (room.status !== 'waiting' && room.status !== 'voting')) {
            return;
          }
          if (payload.mapId && MAPS[payload.mapId as MapId]) room.mapId = payload.mapId;
          if (payload.gameMode && GAME_MODES[payload.gameMode as GameModeId]) room.gameMode = payload.gameMode;
          if (room.voteState?.timer) clearTimeout(room.voteState.timer);
          room.voteState = null;

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

        case 'player:pause': {
          if (!conn.roomId) return;
          const room = rooms.get(conn.roomId);
          if (!room || room.status !== 'playing') return;
          const p = room.players.get(conn.playerId);
          if (!p) return;

          const wantPause = Boolean(payload.paused);
          const wasPaused = room.pausedPlayers.size > 0;
          if (wantPause) {
            room.pausedPlayers.set(p.playerId, p.username);
          } else {
            room.pausedPlayers.delete(p.playerId);
          }
          const isNowPaused = room.pausedPlayers.size > 0;

          if (!wasPaused && isNowPaused) {
            room.pausedSince = Date.now();
          } else if (wasPaused && !isNowPaused && room.pausedSince) {
            const delta = Date.now() - room.pausedSince;
            room.intermissionEndsAt += delta;
            room.matchStartedAt += delta;
            room.lastSpawnAt += delta;
            room.roundEndsAt += delta;
            room.roundIntermissionEndsAt += delta;
            for (const c of room.coins.values()) c.createdAt += delta;
            for (const pr of room.projectiles.values()) {
              if (pr.detonateAt !== null) pr.detonateAt += delta;
            }
            for (const fz of room.fireZones.values()) fz.expiresAt += delta;
            room.pausedSince = null;
          }

          broadcastRoom(room, 'match:pause_state', {
            pausedBy: Array.from(room.pausedPlayers.values()),
          });
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
          if (room.pausedPlayers.size > 0) return;
          const p = room.players.get(conn.playerId);
          if (!p || !p.alive) return;

          const weaponId = (
            payload.weaponId && p.weaponLevels[payload.weaponId] ? payload.weaponId : p.weaponId
          ) as WeaponId;
          const lvl = p.weaponLevels[weaponId] || 1;
          const wStats = getWeaponStatsAtLevel(weaponId, lvl);
          const modeDef = GAME_MODES[room.gameMode] || GAME_MODES.unlimited;

          if (modeDef.noMonsters && room.roundState !== 'fighting') return;

          const now = Date.now();
          const minIntervalMs = (1000 / (wStats.fireRate * modeDef.fireRateMult)) * 0.68;
          if (now - p.lastShotAt < minIntervalMs) return;
          p.lastShotAt = now;

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

          const rays: Array<{ dx: number; dy: number; dz: number }> = Array.isArray(payload.rays)
            ? payload.rays.slice(0, wStats.pellets)
            : [{ dx: Number(payload.dx) || 0, dy: Number(payload.dy) || 0, dz: Number(payload.dz) || -1 }];

          const ox = Number(payload.ox) || p.x;
          const oy = Number(payload.oy) || p.y + 1.6;
          const oz = Number(payload.oz) || p.z;
          const map = MAPS[room.mapId];

          const hitResults: Array<{ monsterId: string; damage: number; killed: boolean; x: number; z: number }> = [];

          if (modeDef.noMonsters) {
            // 1v1 PvP hitscan with strict wall occlusion
            for (const ray of rays) {
              const wallDist = segmentHitsObstacleDist(ox, oy, oz, ray.dx, ray.dy, ray.dz, wStats.range, map);
              const maxD = wallDist !== null ? wallDist : wStats.range;
              let bestTarget: RoomPlayerState | null = null;
              let bestDist = Infinity;

              for (const other of room.players.values()) {
                if (other.playerId === p.playerId || !other.alive) continue;
                const dist = rayHitsPlayer(ox, oy, oz, ray.dx, ray.dy, ray.dz, maxD, other);
                if (dist !== null && dist < bestDist) {
                  bestDist = dist;
                  bestTarget = other;
                }
              }

              if (bestTarget) {
                // Scale extreme boss-level weapon damage cleanly into 100 HP PvP balance
                const pvpDmg = Math.max(8, Math.round(wStats.damage * (wStats.isMelee ? 0.85 : 0.45)));
                bestTarget.hp = Math.max(0, bestTarget.hp - pvpDmg);
                const killed = bestTarget.hp <= 0;
                if (killed) bestTarget.alive = false;
                hitResults.push({
                  monsterId: bestTarget.playerId,
                  damage: pvpDmg,
                  killed,
                  x: bestTarget.x,
                  z: bestTarget.z,
                });
                broadcastRoom(room, 'match:player_hit', {
                  playerId: bestTarget.playerId,
                  attackerId: p.playerId,
                  damage: pvpDmg,
                  hp: bestTarget.hp,
                  alive: bestTarget.alive,
                  attackerType: weaponId,
                });
              }
            }
          } else if (wStats.isMelee) {
            // Melee cleave arc with wall occlusion
            const fdx = rays[0]?.dx || 0;
            const fdz = rays[0]?.dz || -1;
            const fLen = Math.hypot(fdx, fdz) || 1;
            const nfx = fdx / fLen;
            const nfz = fdz / fLen;

            for (const m of Array.from(room.monsters.values())) {
              const mdx = m.x - ox;
              const mdz = m.z - oz;
              const dist = Math.hypot(mdx, mdz);
              if (dist > wStats.range + m.radius) continue;
              const dot = (mdx / Math.max(0.01, dist)) * nfx + (mdz / Math.max(0.01, dist)) * nfz;
              if (dot < (wStats.meleeArc ?? 0.4)) continue;
              const blocked = segmentHitsObstacleDist(ox, oy, oz, mdx / Math.max(0.01, dist), 0, mdz / Math.max(0.01, dist), dist, map);
              if (blocked !== null) continue;

              m.hp = Math.max(0, m.hp - wStats.damage);
              const killed = m.hp <= 0;
              hitResults.push({ monsterId: m.id, damage: wStats.damage, killed, x: m.x, z: m.z });
              if (killed) {
                room.monsters.delete(m.id);
                p.kills += 1;
                if (m.type === 'boss') p.bossKills += 1;
                p.score += m.scoreReward;
                p.xpEarned += m.xpReward;
                p.weaponKills[weaponId] = (p.weaponKills[weaponId] || 0) + 1;
                const coinId = crypto.randomUUID();
                room.coins.set(coinId, { id: coinId, x: m.x, z: m.z, value: m.coinReward, createdAt: now });
                broadcastRoom(room, 'match:monster_killed', {
                  monsterId: m.id,
                  type: m.type,
                  killerId: p.playerId,
                  x: m.x,
                  z: m.z,
                  coinDrop: { id: coinId, x: m.x, z: m.z, value: m.coinReward },
                });
              }
            }
          } else {
            for (const ray of rays) {
              const wallDist = segmentHitsObstacleDist(ox, oy, oz, ray.dx, ray.dy, ray.dz, wStats.range, map);
              const maxD = wallDist !== null ? wallDist : wStats.range;
              let bestMonster: ActiveMonster | null = null;
              let bestDist = Infinity;

              for (const m of room.monsters.values()) {
                const dist = rayHitsMonster(ox, oy, oz, ray.dx, ray.dy, ray.dz, maxD, m);
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
          }

          if (hitResults.length > 0) {
            send(ws, 'match:hit_confirm', { hits: hitResults });
          }
          break;
        }

        case 'player:throw': {
          if (!conn.roomId) return;
          const room = rooms.get(conn.roomId);
          if (!room || room.status !== 'playing' || room.pausedPlayers.size > 0) return;
          const p = room.players.get(conn.playerId);
          if (!p || !p.alive) return;

          const weaponId = (payload.weaponId && p.weaponLevels[payload.weaponId] ? payload.weaponId : p.weaponId) as WeaponId;
          const wStats = getWeaponStatsAtLevel(weaponId, p.weaponLevels[weaponId] || 1);
          if (!wStats.isThrowable && !wStats.isRocket) return;

          const now = Date.now();
          const modeDef = GAME_MODES[room.gameMode] || GAME_MODES.unlimited;
          if (modeDef.noMonsters && room.roundState !== 'fighting') return;

          const minIntervalMs = (1000 / (wStats.fireRate * modeDef.fireRateMult)) * 0.65;
          if (now - p.lastShotAt < minIntervalMs) return;
          p.lastShotAt = now;

          const ox = Number(payload.ox) || p.x;
          const oy = Number(payload.oy) || p.y + 1.5;
          const oz = Number(payload.oz) || p.z;
          const dx = Number(payload.dx) || 0;
          const dy = Number(payload.dy) || 0;
          const dz = Number(payload.dz) || -1;
          const len = Math.hypot(dx, dy, dz) || 1;
          const spd = wStats.projectileSpeed || 20;

          const pid = crypto.randomUUID();
          room.projectiles.set(pid, {
            id: pid,
            ownerId: p.playerId,
            isEnemyProjectile: false,
            kind: weaponId,
            weaponId,
            x: ox + (dx / len) * 0.5,
            y: oy,
            z: oz + (dz / len) * 0.5,
            vx: (dx / len) * spd,
            vy: (dy / len) * spd + (wStats.isRocket ? 0 : 4.2),
            vz: (dz / len) * spd,
            gravity: wStats.isRocket ? 0 : 18,
            damage: wStats.damage,
            radius: wStats.explosionRadius || 6,
            aoeColor: wStats.aoeColor || '#f97316',
            burnDurationMs: wStats.burnDurationMs || 0,
            aoeDotDamage: wStats.aoeDotDamage || 0,
            detonateAt: wStats.fuseMs ? now + wStats.fuseMs : null,
            createdAt: now,
          });
          break;
        }

        case 'match:chat': {
          if (!conn.roomId) return;
          const room = rooms.get(conn.roomId);
          if (!room) return;
          const p = room.players.get(conn.playerId);
          if (!p) return;
          const text = String(payload.text || '').trim().slice(0, 160);
          if (!text) return;
          broadcastRoom(room, 'match:chat', {
            id: crypto.randomUUID(),
            senderId: p.playerId,
            username: p.username,
            text,
            ts: Date.now(),
          });
          break;
        }

        case 'player:buy_health': {
          if (!conn.roomId) return;
          const room = rooms.get(conn.roomId);
          if (!room || room.status !== 'playing') return;
          const p = room.players.get(conn.playerId);
          if (!p || !p.alive) return;

          if (p.hp >= p.maxHp) {
            send(ws, 'match:health_error', { message: 'Health is already full.' });
            return;
          }

          const cost = getHealthPurchaseCost(p.healthPurchasesUsed);
          try {
            const newBalance = spendMatchHealthCoin(p.playerId, cost);
            p.healthPurchasesUsed += 1;
            p.hp = Math.min(p.maxHp, p.hp + HEALTH_PURCHASE_AMOUNT);
            send(ws, 'match:health_purchased', {
              hp: p.hp,
              healthPurchasesUsed: p.healthPurchasesUsed,
              costPaid: cost,
              nextCost: getHealthPurchaseCost(p.healthPurchasesUsed),
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
