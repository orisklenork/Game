import {
  DIFFICULTIES,
  EquippedLoadout,
  GAME_MODES,
  GameModeId,
  getHealthPurchaseCost,
  getWeaponStatsAtLevel,
  HEALTH_PURCHASE_AMOUNT,
  MAPS,
  MONSTERS,
  MapId,
  MonsterType,
  resolveCircleObstacles,
  segmentHitsObstacleDist,
  WeaponId,
} from '../shared/gameData';
import type { PlayerProfile } from '../lib/api';
import { recordLocalMatchOutcome, spendLocalHealthCoin } from '../lib/localFallback';
import type { ServerStatePacket } from './GameEngine';

interface LocalMonster {
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

interface LocalProjectile {
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
}

interface LocalFireZone {
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

interface LocalCoin {
  id: string;
  x: number;
  z: number;
  value: number;
  createdAt: number;
}

interface DuelBotState {
  playerId: string;
  username: string;
  loadout: EquippedLoadout;
  weaponId: WeaponId;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  kills: number;
  score: number;
  strafeSign: number;
  strafeSwitchAt: number;
  lastShotAt: number;
  lastThrowAt: number;
}

export interface LocalMatchCallbacks {
  onStarted: (payload: {
    mapId: MapId;
    gameMode: GameModeId;
    players: Array<{
      playerId: string;
      username: string;
      loadout: PlayerProfile['equippedLoadout'];
      weaponId: WeaponId;
      x: number;
      y: number;
      z: number;
      yaw: number;
      pitch: number;
      hp: number;
      maxHp: number;
      alive: boolean;
    }>;
  }) => void;
  onState: (packet: ServerStatePacket) => void;
  onWave: (payload: { wave: number; isBossWave: boolean }) => void;
  onWaveCleared: (payload: { clearedWave: number; nextWave: number }) => void;
  onHitConfirm: (payload: { hits: Array<{ monsterId: string; damage: number; killed: boolean; x: number; z: number }> }) => void;
  onPlayerHit: (payload: { playerId: string }) => void;
  onCoinCollected: (payload: { playerId: string }) => void;
  onHealthPurchased: (payload: {
    newCoinBalance: number;
    healthPurchasesUsed: number;
    costPaid: number;
    nextCost: number;
  }) => void;
  onHealthError: (payload: { message: string }) => void;
  onExplosion: (payload: { kind: string; x: number; y: number; z: number; radius: number; color: string }) => void;
  onRemoteShotFx: (payload: {
    playerId: string;
    weaponId: WeaponId;
    ox: number;
    oy: number;
    oz: number;
    dx: number;
    dy: number;
    dz: number;
  }) => void;
  onRoundEnded: (payload: {
    round: number;
    winnerId: string | null;
    winnerName: string;
    roundScores: Record<string, number>;
    matchOver: boolean;
  }) => void;
  onRoundStarted: (payload: {
    round: number;
    roundScores: Record<string, number>;
    spawns: Array<{ playerId: string; x: number; z: number; yaw: number }>;
  }) => void;
  onChat: (payload: { id: string; senderId: string; username: string; text: string; ts: number }) => void;
  onEnded: (payload: {
    victory: boolean;
    wavesCleared: number;
    durationSeconds: number;
    profile: PlayerProfile | null;
    results: Array<{
      playerId: string;
      username: string;
      kills: number;
      bossKills: number;
      score: number;
      coinsEarned: number;
      xpEarned: number;
      survived: boolean;
    }>;
  }) => void;
}

function buildWaveQueue(wave: number, gameMode: GameModeId): MonsterType[] {
  const queue: MonsterType[] = [];
  const countMult = gameMode === 'blitz' ? 1.3 : gameMode === 'boss_rush' ? 0.92 : 1.0;
  const total = Math.round((6 + wave * 3) * countMult);
  for (let i = 0; i < total; i++) {
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
  const bossInterval = GAME_MODES[gameMode]?.bossInterval || 5;
  if (wave % bossInterval === 0) {
    queue.push('boss');
    if (gameMode === 'boss_rush' && wave >= 10) queue.push('boss');
  }
  return queue;
}

function moveCircleWithObstacles(
  entity: { x: number; z: number; strafeSign: number },
  radius: number,
  targetX: number,
  targetZ: number,
  stepDist: number,
  mapId: MapId
) {
  const map = MAPS[mapId];
  const start = resolveCircleObstacles(entity.x, entity.z, radius, map);
  entity.x = start.x;
  entity.z = start.z;

  const dx = targetX - entity.x;
  const dz = targetZ - entity.z;
  const dist = Math.hypot(dx, dz) || 0.001;
  const ux = dx / dist;
  const uz = dz / dist;

  const direct = resolveCircleObstacles(entity.x + ux * stepDist, entity.z + uz * stepDist, radius, map);
  const directProgress = (direct.x - entity.x) * ux + (direct.z - entity.z) * uz;

  if (!direct.collided || directProgress >= stepDist * 0.45) {
    entity.x = direct.x;
    entity.z = direct.z;
    return;
  }

  const s = entity.strafeSign || 1;
  const probeAngles = [s * 0.75, -s * 0.75, s * 1.35, -s * 1.35, s * 1.85, -s * 1.85];
  let bestX = direct.x;
  let bestZ = direct.z;
  let bestScore = -Infinity;
  let chosenSign = s;

  for (const ang of probeAngles) {
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const rx = ux * cos - uz * sin;
    const rz = ux * sin + uz * cos;
    const cand = resolveCircleObstacles(entity.x + rx * stepDist, entity.z + rz * stepDist, radius, map);
    const movedDist = Math.hypot(cand.x - entity.x, cand.z - entity.z);
    if (movedDist < stepDist * 0.25) continue;

    const newDist = Math.hypot(targetX - cand.x, targetZ - cand.z);
    const score = dist - newDist + movedDist * 0.65 - (cand.collided ? 0.15 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestX = cand.x;
      bestZ = cand.z;
      chosenSign = ang >= 0 ? 1 : -1;
    }
  }

  entity.strafeSign = chosenSign;
  entity.x = bestX;
  entity.z = bestZ;
}

export class LocalSoloRunner {
  private profile: PlayerProfile;
  private mapId: MapId;
  private gameMode: GameModeId;
  private callbacks: LocalMatchCallbacks;
  private timer: number | null = null;
  private wave = 1;
  private maxWaves = 0;
  private waveState: 'combat' | 'intermission' = 'combat';
  private intermissionEndsAt = 0;
  private monstersToSpawn: MonsterType[] = [];
  private lastSpawnAt = 0;
  private monsters = new Map<string, LocalMonster>();
  private projectiles = new Map<string, LocalProjectile>();
  private fireZones = new Map<string, LocalFireZone>();
  private coins = new Map<string, LocalCoin>();
  private matchStartedAt = Date.now();
  private paused = false;
  private pausedSince: number | null = null;
  private px = 0;
  private py = 0;
  private pz = 2;
  private yaw = 0;
  private pitch = 0;
  private hp = 100;
  private maxHp = 100;
  private alive = true;
  private weaponId: WeaponId;
  private reloading = false;
  private kills = 0;
  private bossKills = 0;
  private score = 0;
  private coinsEarned = 0;
  private xpEarned = 0;
  private healthPurchasesUsed = 0;
  private ended = false;
  private idSeq = 1;

  // 1v1 Duel & Arena Bot state
  private round = 1;
  private roundState: 'fighting' | 'intermission' = 'fighting';
  private roundEndsAt = 0;
  private roundIntermissionEndsAt = 0;
  private roundWinnerId: string | null = null;
  private roundScores: Record<string, number> = {};
  private bot: DuelBotState | null = null;

  constructor(
    profile: PlayerProfile,
    mapId: MapId,
    callbacks: LocalMatchCallbacks,
    gameMode: GameModeId = 'unlimited'
  ) {
    this.profile = profile;
    this.mapId = mapId;
    this.gameMode = gameMode;
    this.callbacks = callbacks;
    this.weaponId = profile.equippedWeapon;

    const mapDef = MAPS[mapId];
    const modeDef = GAME_MODES[gameMode] || GAME_MODES.unlimited;

    if (modeDef.noMonsters) {
      const sp0 = mapDef.duelSpawns[0] || [-14, -14];
      const sp1 = mapDef.duelSpawns[1] || [14, 14];
      this.px = sp0[0];
      this.pz = sp0[1];
      this.yaw = Math.atan2(-(sp1[0] - sp0[0]), -(sp1[1] - sp0[1]));
      this.round = 1;
      this.roundState = 'fighting';
      this.roundEndsAt = Date.now() + (modeDef.roundSeconds || 90) * 1000;
      this.roundScores = { [profile.id]: 0, 'bot-duelist': 0 };
      this.bot = {
        playerId: 'bot-duelist',
        username: 'Spectre-AI',
        loadout: {
          shirt: 'shirt_crimson',
          outfit: 'outfit_trench',
          skin: 'skin_cyber',
          mask: 'mask_nvg',
          gloves: 'gloves_red',
          accessory: 'acc_katana',
          costume: 'costume_none',
          weapon_skin: 'wskin_blood',
        },
        weaponId: 'ak47',
        x: sp1[0],
        y: 0,
        z: sp1[1],
        yaw: Math.atan2(-(sp0[0] - sp1[0]), -(sp0[1] - sp1[1])),
        pitch: 0,
        hp: 100,
        maxHp: 100,
        alive: true,
        kills: 0,
        score: 0,
        strafeSign: 1,
        strafeSwitchAt: Date.now() + 1800,
        lastShotAt: Date.now() + 900,
        lastThrowAt: Date.now() + 6500,
      };
    } else {
      const spawn = mapDef.playerSpawns[0] || [0, 2];
      this.px = spawn[0];
      this.pz = spawn[1];
      this.monstersToSpawn = buildWaveQueue(1, this.gameMode);
    }
  }

  public start() {
    const players: Parameters<LocalMatchCallbacks['onStarted']>[0]['players'] = [
      {
        playerId: this.profile.id,
        username: this.profile.username,
        loadout: this.profile.equippedLoadout,
        weaponId: this.weaponId,
        x: this.px,
        y: this.py,
        z: this.pz,
        yaw: this.yaw,
        pitch: 0,
        hp: this.hp,
        maxHp: this.maxHp,
        alive: true,
      },
    ];
    if (this.bot) {
      players.push({
        playerId: this.bot.playerId,
        username: this.bot.username,
        loadout: this.bot.loadout,
        weaponId: this.bot.weaponId,
        x: this.bot.x,
        y: this.bot.y,
        z: this.bot.z,
        yaw: this.bot.yaw,
        pitch: 0,
        hp: this.bot.hp,
        maxHp: this.bot.maxHp,
        alive: true,
      });
    }

    this.callbacks.onStarted({
      mapId: this.mapId,
      gameMode: this.gameMode,
      players,
    });
    if (!this.bot) {
      this.callbacks.onWave({ wave: 1, isBossWave: false });
    } else {
      this.callbacks.onChat({
        id: `sys-${Date.now()}`,
        senderId: 'bot-duelist',
        username: 'Spectre-AI',
        text: '1v1 Arena engaged. First to 5 round wins. Good luck.',
        ts: Date.now(),
      });
    }
    this.timer = window.setInterval(() => this.tick(), 50);
  }

  public setPaused(nextPaused: boolean) {
    if (this.paused === nextPaused) return;
    this.paused = nextPaused;
    if (nextPaused) {
      this.pausedSince = Date.now();
    } else if (this.pausedSince) {
      const delta = Date.now() - this.pausedSince;
      this.intermissionEndsAt += delta;
      this.matchStartedAt += delta;
      this.lastSpawnAt += delta;
      this.roundEndsAt += delta;
      this.roundIntermissionEndsAt += delta;
      for (const c of this.coins.values()) c.createdAt += delta;
      for (const pr of this.projectiles.values()) {
        if (pr.detonateAt !== null) pr.detonateAt += delta;
      }
      for (const fz of this.fireZones.values()) fz.expiresAt += delta;
      this.pausedSince = null;
    }
    this.emitState(Date.now());
  }

  public updatePlayerState(payload: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    weaponId: WeaponId;
    reloading: boolean;
  }) {
    const limit = MAPS[this.mapId].arenaHalfSize - 1.2;
    this.px = Math.max(-limit, Math.min(limit, payload.x));
    this.py = payload.y;
    this.pz = Math.max(-limit, Math.min(limit, payload.z));
    this.yaw = payload.yaw;
    this.pitch = payload.pitch;
    this.weaponId = payload.weaponId;
    this.reloading = payload.reloading;
  }

  public sendChat(rawText: string) {
    const text = rawText.trim().slice(0, 160);
    if (!text || this.ended) return;
    this.callbacks.onChat({
      id: `chat-${this.idSeq++}`,
      senderId: this.profile.id,
      username: this.profile.username,
      text,
      ts: Date.now(),
    });
    if (this.bot) {
      const botReplies = [
        'Scanning cover angles—watch your flank.',
        'Solid duel so far. First to 5 takes it.',
        'Reloading behind barrier, push if you dare!',
        'Nice peek! Keep your guard up.',
      ];
      const reply = botReplies[Math.floor(Math.random() * botReplies.length)];
      window.setTimeout(() => {
        if (!this.ended) {
          this.callbacks.onChat({
            id: `chat-${this.idSeq++}`,
            senderId: this.bot!.playerId,
            username: this.bot!.username,
            text: reply,
            ts: Date.now(),
          });
        }
      }, 650);
    }
  }

  public handleShoot(payload: {
    weaponId: WeaponId;
    ox: number;
    oy: number;
    oz: number;
    rays: Array<{ dx: number; dy: number; dz: number }>;
  }) {
    if (!this.alive || this.ended || this.paused) return;
    if (this.bot && this.roundState !== 'fighting') return;

    const map = MAPS[this.mapId];
    const upg = this.profile.weapons[payload.weaponId]?.upgradeLevel || 1;
    const wStats = getWeaponStatsAtLevel(payload.weaponId, upg);
    const hits: Array<{ monsterId: string; damage: number; killed: boolean; x: number; z: number }> = [];

    if (this.bot) {
      // 1v1 PvP hitscan against Spectre-AI (wall-occluded)
      if (!this.bot.alive) return;
      for (const ray of payload.rays || []) {
        const wallDist = segmentHitsObstacleDist(payload.ox, payload.oy, payload.oz, ray.dx, ray.dy, ray.dz, wStats.range, map);
        const maxD = wallDist !== null ? wallDist : wStats.range;
        const cy = this.bot.y + 0.98;
        const ocX = this.bot.x - payload.ox;
        const ocY = cy - payload.oy;
        const ocZ = this.bot.z - payload.oz;
        const proj = ocX * ray.dx + ocY * ray.dy + ocZ * ray.dz;
        if (proj < 0 || proj > maxD) continue;
        const cx = payload.ox + ray.dx * proj;
        const cya = payload.oy + ray.dy * proj;
        const cz = payload.oz + ray.dz * proj;
        if (Math.hypot(cx - this.bot.x, cz - this.bot.z) <= 0.6 && Math.abs(cya - cy) <= 1.05) {
          const pvpDmg = Math.max(8, Math.round(wStats.damage * (wStats.isMelee ? 0.85 : 0.48)));
          this.bot.hp = Math.max(0, this.bot.hp - pvpDmg);
          const killed = this.bot.hp <= 0;
          if (killed) this.bot.alive = false;
          hits.push({ monsterId: this.bot.playerId, damage: pvpDmg, killed, x: this.bot.x, z: this.bot.z });
        }
      }
      if (hits.length > 0) this.callbacks.onHitConfirm({ hits });
      return;
    }

    if (wStats.isMelee) {
      const fdx = payload.rays[0]?.dx || 0;
      const fdz = payload.rays[0]?.dz || -1;
      const flen = Math.hypot(fdx, fdz) || 1;
      const nfx = fdx / flen;
      const nfz = fdz / flen;

      for (const m of Array.from(this.monsters.values())) {
        const mdx = m.x - payload.ox;
        const mdz = m.z - payload.oz;
        const dist = Math.hypot(mdx, mdz);
        if (dist > wStats.range + m.radius) continue;
        const dot = (mdx / Math.max(0.01, dist)) * nfx + (mdz / Math.max(0.01, dist)) * nfz;
        if (dot < (wStats.meleeArc ?? 0.4)) continue;
        const blocked = segmentHitsObstacleDist(
          payload.ox,
          payload.oy,
          payload.oz,
          mdx / Math.max(0.01, dist),
          0,
          mdz / Math.max(0.01, dist),
          dist,
          map
        );
        if (blocked !== null) continue;

        m.hp -= wStats.damage;
        const killed = m.hp <= 0;
        hits.push({ monsterId: m.id, damage: wStats.damage, killed, x: m.x, z: m.z });
        if (killed) this.killLocalMonster(m);
      }
    } else {
      for (const ray of payload.rays || []) {
        const wallDist = segmentHitsObstacleDist(payload.ox, payload.oy, payload.oz, ray.dx, ray.dy, ray.dz, wStats.range, map);
        const maxD = wallDist !== null ? wallDist : wStats.range;
        let best: { m: LocalMonster; dist: number } | null = null;
        for (const m of this.monsters.values()) {
          const mDef = MONSTERS[m.type];
          const cy = mDef.height * 0.52;
          const radius = m.radius * 1.28;
          const ocX = m.x - payload.ox;
          const ocY = cy - payload.oy;
          const ocZ = m.z - payload.oz;
          const proj = ocX * ray.dx + ocY * ray.dy + ocZ * ray.dz;
          if (proj < 0 || proj > maxD) continue;
          const cx = payload.ox + ray.dx * proj;
          const cya = payload.oy + ray.dy * proj;
          const cz = payload.oz + ray.dz * proj;
          if (Math.hypot(cx - m.x, cz - m.z) <= radius && Math.abs(cya - cy) <= mDef.height * 0.65) {
            if (!best || proj < best.dist) best = { m, dist: proj };
          }
        }

        if (best) {
          const { m, dist } = best;
          m.hp -= wStats.damage;
          const hx = payload.ox + ray.dx * dist;
          const hz = payload.oz + ray.dz * dist;
          const killed = m.hp <= 0;
          hits.push({ monsterId: m.id, damage: wStats.damage, killed, x: hx, z: hz });
          if (killed) this.killLocalMonster(m);
        }
      }
    }

    if (hits.length > 0) {
      this.callbacks.onHitConfirm({ hits });
    }
  }

  public handleThrow(payload: { weaponId: WeaponId; ox: number; oy: number; oz: number; dx: number; dy: number; dz: number }) {
    if (!this.alive || this.ended || this.paused) return;
    if (this.bot && this.roundState !== 'fighting') return;

    const upg = this.profile.weapons[payload.weaponId]?.upgradeLevel || 1;
    const wStats = getWeaponStatsAtLevel(payload.weaponId, upg);
    if (!wStats.isThrowable && !wStats.isRocket) return;

    const len = Math.hypot(payload.dx, payload.dy, payload.dz) || 1;
    const spd = wStats.projectileSpeed || 20;
    const pid = `pr-${this.idSeq++}`;
    this.projectiles.set(pid, {
      id: pid,
      ownerId: this.profile.id,
      isEnemyProjectile: false,
      kind: payload.weaponId,
      weaponId: payload.weaponId,
      x: payload.ox + (payload.dx / len) * 0.5,
      y: payload.oy,
      z: payload.oz + (payload.dz / len) * 0.5,
      vx: (payload.dx / len) * spd,
      vy: (payload.dy / len) * spd + (wStats.isRocket ? 0 : 4.2),
      vz: (payload.dz / len) * spd,
      gravity: wStats.isRocket ? 0 : 18,
      damage: wStats.damage,
      radius: wStats.explosionRadius || 6,
      aoeColor: wStats.aoeColor || '#f97316',
      burnDurationMs: wStats.burnDurationMs || 0,
      aoeDotDamage: wStats.aoeDotDamage || 0,
      detonateAt: wStats.fuseMs ? Date.now() + wStats.fuseMs : null,
    });
  }

  private killLocalMonster(m: LocalMonster) {
    this.monsters.delete(m.id);
    this.kills += 1;
    if (m.type === 'boss') this.bossKills += 1;
    this.score += m.scoreReward;
    this.xpEarned += m.xpReward;
    const coinId = `c-${this.idSeq++}`;
    this.coins.set(coinId, {
      id: coinId,
      x: m.x,
      z: m.z,
      value: m.coinReward,
      createdAt: Date.now(),
    });
  }

  private detonateLocalProjectile(proj: LocalProjectile, now: number) {
    const map = MAPS[this.mapId];
    this.callbacks.onExplosion({
      kind: proj.kind,
      x: proj.x,
      y: Math.max(0.25, proj.y),
      z: proj.z,
      radius: proj.radius,
      color: proj.aoeColor,
    });

    if (proj.burnDurationMs > 0) {
      const fzId = `fz-${this.idSeq++}`;
      this.fireZones.set(fzId, {
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

    const hits: Array<{ monsterId: string; damage: number; killed: boolean; x: number; z: number }> = [];

    if (this.bot) {
      if (this.bot.alive && proj.ownerId !== this.bot.playerId) {
        const dist = Math.hypot(this.bot.x - proj.x, this.bot.z - proj.z);
        if (dist <= proj.radius + 0.55) {
          const falloff = 1 - 0.65 * Math.min(1, dist / proj.radius);
          const dmg = Math.max(8, Math.round(proj.damage * 0.42 * falloff));
          this.bot.hp = Math.max(0, this.bot.hp - dmg);
          const killed = this.bot.hp <= 0;
          if (killed) this.bot.alive = false;
          hits.push({ monsterId: this.bot.playerId, damage: dmg, killed, x: this.bot.x, z: this.bot.z });
        }
      }
      if (this.alive && proj.ownerId === this.bot.playerId) {
        const dist = Math.hypot(this.px - proj.x, this.pz - proj.z);
        if (dist <= proj.radius + 0.5) {
          const falloff = 1 - 0.65 * Math.min(1, dist / proj.radius);
          const dmg = Math.max(8, Math.round(proj.damage * 0.32 * falloff));
          this.hp = Math.max(0, this.hp - dmg);
          this.callbacks.onPlayerHit({ playerId: this.profile.id });
          if (this.hp <= 0) this.alive = false;
        }
      }
    } else if (!proj.isEnemyProjectile) {
      for (const m of Array.from(this.monsters.values())) {
        const dist = Math.hypot(m.x - proj.x, m.z - proj.z);
        if (dist <= proj.radius + m.radius) {
          const len = Math.max(0.01, Math.hypot(m.x - proj.x, m.z - proj.z));
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
          m.hp -= dmg;
          const killed = m.hp <= 0;
          hits.push({ monsterId: m.id, damage: dmg, killed, x: m.x, z: m.z });
          if (killed) this.killLocalMonster(m);
        }
      }
    }

    if (hits.length > 0) this.callbacks.onHitConfirm({ hits });
  }

  public buyHealth() {
    if (!this.alive || this.ended) return;
    if (this.hp >= this.maxHp) {
      this.callbacks.onHealthError({ message: 'Health is already full.' });
      return;
    }
    const cost = getHealthPurchaseCost(this.healthPurchasesUsed);
    const spent = spendLocalHealthCoin(cost);
    if (!spent.success) {
      this.callbacks.onHealthError({ message: `Need ${cost} coins to buy Medkit.` });
      return;
    }
    this.healthPurchasesUsed += 1;
    this.hp = Math.min(this.maxHp, this.hp + HEALTH_PURCHASE_AMOUNT);
    this.callbacks.onHealthPurchased({
      newCoinBalance: spent.newCoinBalance,
      healthPurchasesUsed: this.healthPurchasesUsed,
      costPaid: cost,
      nextCost: getHealthPurchaseCost(this.healthPurchasesUsed),
    });
  }

  public abort() {
    this.finish(false);
  }

  private endDuelRound(winnerId: string | null, winnerName: string, now: number) {
    const targetWins = GAME_MODES.duel_1v1.roundsToWin || 5;
    if (winnerId) {
      this.roundScores[winnerId] = (this.roundScores[winnerId] || 0) + 1;
      if (winnerId === this.profile.id) {
        this.kills += 1;
        this.score += 250;
        this.coinsEarned += 45;
        this.xpEarned += 55;
      } else if (this.bot) {
        this.bot.kills += 1;
        this.bot.score += 250;
      }
    }
    this.roundWinnerId = winnerId;
    const matchOver = winnerId ? (this.roundScores[winnerId] || 0) >= targetWins : false;

    this.callbacks.onRoundEnded({
      round: this.round,
      winnerId,
      winnerName,
      roundScores: { ...this.roundScores },
      matchOver,
    });

    if (matchOver) {
      this.finish(winnerId === this.profile.id);
      return;
    }

    this.roundState = 'intermission';
    this.roundIntermissionEndsAt = now + 3000;
  }

  private tick() {
    if (this.ended) return;
    const now = Date.now();
    if (this.paused) {
      this.emitState(now);
      return;
    }

    const dt = 0.05;
    const mapDef = MAPS[this.mapId];
    const diff = DIFFICULTIES.normal;
    const modeDef = GAME_MODES[this.gameMode] || GAME_MODES.unlimited;

    if (this.bot) {
      // ==================== 1v1 ARENA DUEL LOOP ====================
      if (this.roundState === 'fighting') {
        if (!this.alive || !this.bot.alive) {
          const winnerId = this.alive ? this.profile.id : this.bot.alive ? this.bot.playerId : null;
          const winnerName = winnerId === this.profile.id ? this.profile.username : winnerId ? this.bot.username : 'Draw';
          this.endDuelRound(winnerId, winnerName, now);
        } else if (now >= this.roundEndsAt) {
          const winnerId =
            this.hp > this.bot.hp ? this.profile.id : this.bot.hp > this.hp ? this.bot.playerId : null;
          const winnerName = winnerId === this.profile.id ? this.profile.username : winnerId ? this.bot.username : 'Draw';
          this.endDuelRound(winnerId, winnerName, now);
        } else if (this.bot.alive && this.alive) {
          // Bot movement, obstacle steering, LOS peeking, and tactical shooting
          const dx = this.px - this.bot.x;
          const dz = this.pz - this.bot.z;
          const dist = Math.hypot(dx, dz) || 0.001;
          this.bot.yaw = Math.atan2(-dx, -dz);

          if (now >= this.bot.strafeSwitchAt) {
            this.bot.strafeSign = Math.random() < 0.5 ? 1 : -1;
            this.bot.strafeSwitchAt = now + 1300 + Math.random() * 1400;
          }

          // Ideal combat range ~9-13m with lateral strafing
          const desiredDist = 10.5;
          const perpX = (-dz / dist) * this.bot.strafeSign;
          const perpZ = (dx / dist) * this.bot.strafeSign;
          const radialPush = dist > desiredDist + 2 ? 0.75 : dist < desiredDist - 2 ? -0.65 : 0.15;
          const moveTargetX = this.bot.x + ((dx / dist) * radialPush + perpX * 0.85) * 4;
          const moveTargetZ = this.bot.z + ((dz / dist) * radialPush + perpZ * 0.85) * 4;
          moveCircleWithObstacles(this.bot, 0.58, moveTargetX, moveTargetZ, 5.4 * dt, this.mapId);

          const ux = dx / dist;
          const uz = dz / dist;
          const losBlocked = segmentHitsObstacleDist(this.bot.x, 1.5, this.bot.z, ux, 0, uz, dist, mapDef);

          if (losBlocked === null && dist < 44 && now - this.bot.lastShotAt >= 360) {
            this.bot.lastShotAt = now + (Math.random() < 0.25 ? 240 : 0);
            const spread = 0.085;
            const sdx = ux + (Math.random() - 0.5) * spread;
            const sdy = (this.py + 1.15 - 1.5) / dist + (Math.random() - 0.5) * 0.04;
            const sdz = uz + (Math.random() - 0.5) * spread;
            const slen = Math.hypot(sdx, sdy, sdz) || 1;
            this.callbacks.onRemoteShotFx({
              playerId: this.bot.playerId,
              weaponId: this.bot.weaponId,
              ox: this.bot.x,
              oy: 1.48,
              oz: this.bot.z,
              dx: sdx / slen,
              dy: sdy / slen,
              dz: sdz / slen,
            });
            // ~34% hit chance scaled by distance
            if (Math.random() < Math.max(0.18, 0.46 - dist * 0.008)) {
              const dmg = 11;
              this.hp = Math.max(0, this.hp - dmg);
              this.callbacks.onPlayerHit({ playerId: this.profile.id });
              if (this.hp <= 0) this.alive = false;
            }
          } else if (dist < 22 && dist > 6 && now - this.bot.lastThrowAt >= 9500) {
            this.bot.lastThrowAt = now;
            const pid = `pr-${this.idSeq++}`;
            this.projectiles.set(pid, {
              id: pid,
              ownerId: this.bot.playerId,
              isEnemyProjectile: false,
              kind: 'frag_grenade',
              x: this.bot.x + ux * 0.6,
              y: 1.5,
              z: this.bot.z + uz * 0.6,
              vx: ux * 17,
              vy: 4.5,
              vz: uz * 17,
              gravity: 18,
              damage: 145,
              radius: 5.5,
              aoeColor: '#f97316',
              burnDurationMs: 0,
              aoeDotDamage: 0,
              detonateAt: now + 1600,
            });
          }
        }
      } else if (this.roundState === 'intermission' && now >= this.roundIntermissionEndsAt) {
        this.round += 1;
        this.roundState = 'fighting';
        this.roundEndsAt = now + (modeDef.roundSeconds || 90) * 1000;
        this.roundWinnerId = null;
        this.projectiles.clear();
        this.fireZones.clear();

        const sp0 = mapDef.duelSpawns[0] || [-14, -14];
        const sp1 = mapDef.duelSpawns[1] || [14, 14];
        this.px = sp0[0];
        this.py = 0;
        this.pz = sp0[1];
        this.yaw = Math.atan2(-(sp1[0] - sp0[0]), -(sp1[1] - sp0[1]));
        this.hp = 100;
        this.alive = true;

        this.bot.x = sp1[0];
        this.bot.y = 0;
        this.bot.z = sp1[1];
        this.bot.yaw = Math.atan2(-(sp0[0] - sp1[0]), -(sp0[1] - sp1[1]));
        this.bot.hp = 100;
        this.bot.alive = true;
        this.bot.lastShotAt = now + 700;

        this.callbacks.onRoundStarted({
          round: this.round,
          roundScores: { ...this.roundScores },
          spawns: [
            { playerId: this.profile.id, x: this.px, z: this.pz, yaw: this.yaw },
            { playerId: this.bot.playerId, x: this.bot.x, z: this.bot.z, yaw: this.bot.yaw },
          ],
        });
      }
    } else {
      // ==================== CO-OP / SOLO HORROR WAVES ====================
      if (this.waveState === 'intermission') {
        if (now >= this.intermissionEndsAt) {
          this.wave += 1;
          this.waveState = 'combat';
          this.monstersToSpawn = buildWaveQueue(this.wave, this.gameMode);
          this.callbacks.onWave({
            wave: this.wave,
            isBossWave: this.wave % (modeDef.bossInterval || 5) === 0,
          });
        }
      } else {
        if (
          this.monstersToSpawn.length > 0 &&
          now - this.lastSpawnAt >= modeDef.spawnIntervalMs &&
          this.monsters.size < 22
        ) {
          const type = this.monstersToSpawn.shift()!;
          const sp = mapDef.monsterSpawns[Math.floor(Math.random() * mapDef.monsterSpawns.length)] || [0, -20];
          const mDef = MONSTERS[type];
          const waveScale = 1 + (this.wave - 1) * 0.14;
          const resolved = resolveCircleObstacles(
            sp[0] + (Math.random() - 0.5) * 1.5,
            sp[1] + (Math.random() - 0.5) * 1.5,
            mDef.radius,
            mapDef
          );
          const id = `m-${this.idSeq++}`;
          this.monsters.set(id, {
            id,
            type,
            x: resolved.x,
            z: resolved.z,
            yaw: 0,
            hp: Math.round(mDef.hp * diff.hpMult * modeDef.hpMult * waveScale),
            maxHp: Math.round(mDef.hp * diff.hpMult * modeDef.hpMult * waveScale),
            speed: mDef.speed * diff.speedMult * modeDef.speedMult * (1 + Math.min(0.28, (this.wave - 1) * 0.02)),
            damage: Math.round(mDef.damage * diff.dmgMult),
            attackRange: mDef.attackRange,
            attackCooldown: mDef.attackCooldown * 1000,
            lastAttackAt: 0,
            radius: mDef.radius,
            coinReward: Math.round(mDef.coinReward * modeDef.rewardMult),
            scoreReward: Math.round(mDef.scoreReward * modeDef.rewardMult),
            xpReward: Math.round(mDef.xpReward * modeDef.rewardMult),
            attackAnimUntil: 0,
            strafeSign: Math.random() < 0.5 ? 1 : -1,
            spitCooldownUntil: now + 2200,
            slamCooldownUntil: now + 4500,
          });
          this.lastSpawnAt = now;
        }

        if (this.monstersToSpawn.length === 0 && this.monsters.size === 0) {
          this.hp = Math.min(this.maxHp, this.hp + 18);
          this.waveState = 'intermission';
          this.intermissionEndsAt = now + 4000;
          this.callbacks.onWaveCleared({ clearedWave: this.wave, nextWave: this.wave + 1 });
        }
      }

      const howlers = Array.from(this.monsters.values()).filter((hm) => hm.type === 'howler');
      for (const m of this.monsters.values()) {
        const dx = this.px - m.x;
        const dz = this.pz - m.z;
        const dist = Math.hypot(dx, dz) || 0.001;
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

        if (m.type === 'spitter' && dist <= 12.5 && dist > 2.6 && now >= m.spitCooldownUntil) {
          const ux = dx / dist;
          const uz = dz / dist;
          if (segmentHitsObstacleDist(m.x, 1.35, m.z, ux, 0, uz, dist, mapDef) === null) {
            m.spitCooldownUntil = now + 2600;
            m.attackAnimUntil = now + 350;
            const pid = `pr-${this.idSeq++}`;
            this.projectiles.set(pid, {
              id: pid,
              ownerId: m.id,
              isEnemyProjectile: true,
              kind: 'acid',
              x: m.x + ux * 0.6,
              y: 1.35,
              z: m.z + uz * 0.6,
              vx: ux * 16,
              vy: 0.4,
              vz: uz * 16,
              gravity: 2.2,
              damage: m.damage,
              radius: 1.5,
              aoeColor: '#4ade80',
              burnDurationMs: 0,
              aoeDotDamage: 0,
              detonateAt: now + 2200,
            });
          }
        }

        if (dist > m.attackRange * 0.85) {
          const step = Math.min(dist, m.speed * auraMult * dt);
          moveCircleWithObstacles(m, m.radius, this.px, this.pz, step, this.mapId);
        } else if ((m.type === 'boss' || m.type === 'brute') && dist <= 4.0 && now >= m.slamCooldownUntil && this.alive) {
          m.slamCooldownUntil = now + (m.type === 'boss' ? 5500 : 7500);
          m.attackAnimUntil = now + 450;
          const slamRadius = m.type === 'boss' ? 4.8 : 3.4;
          this.callbacks.onExplosion({
            kind: 'slam',
            x: m.x,
            y: 0.35,
            z: m.z,
            radius: slamRadius,
            color: m.type === 'boss' ? '#ef4444' : '#f59e0b',
          });
          if (dist <= slamRadius) {
            this.hp = Math.max(0, this.hp - Math.round(m.damage * 0.85));
            this.callbacks.onPlayerHit({ playerId: this.profile.id });
            if (this.hp <= 0) {
              this.alive = false;
              this.finish(false);
              return;
            }
          }
        } else if (now - m.lastAttackAt >= m.attackCooldown && this.alive) {
          m.lastAttackAt = now;
          m.attackAnimUntil = now + 260;
          this.hp = Math.max(0, this.hp - m.damage);
          this.callbacks.onPlayerHit({ playerId: this.profile.id });
          if (this.hp <= 0) {
            this.alive = false;
            this.finish(false);
            return;
          }
        }
      }

      const arr = Array.from(this.monsters.values());
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const a = arr[i];
          const b = arr[j];
          const sdx = b.x - a.x;
          const sdz = b.z - a.z;
          const sd = Math.hypot(sdx, sdz);
          const minSep = (a.radius + b.radius) * 0.85;
          if (sd > 0.0001 && sd < minSep) {
            const push = (minSep - sd) * 0.35;
            const nx = sdx / sd;
            const nz = sdz / sd;
            const pa = resolveCircleObstacles(a.x - nx * push, a.z - nz * push, a.radius, mapDef);
            const pb = resolveCircleObstacles(b.x + nx * push, b.z + nz * push, b.radius, mapDef);
            a.x = pa.x;
            a.z = pa.z;
            b.x = pb.x;
            b.z = pb.z;
          }
        }
      }
    }

    // ==================== PROJECTILES & FIRE ZONES ====================
    for (const [pid, proj] of Array.from(this.projectiles.entries())) {
      const spd = Math.hypot(proj.vx, proj.vy, proj.vz);
      if (spd > 0.01) {
        const hitWall = segmentHitsObstacleDist(
          proj.x,
          proj.y,
          proj.z,
          proj.vx / spd,
          proj.vy / spd,
          proj.vz / spd,
          spd * dt,
          mapDef
        );
        if (hitWall !== null) {
          if (proj.isEnemyProjectile) {
            this.projectiles.delete(pid);
            continue;
          }
          if (proj.kind === 'rpg' || proj.detonateAt === null) {
            proj.x += (proj.vx / spd) * Math.max(0, hitWall - 0.15);
            proj.y += (proj.vy / spd) * Math.max(0, hitWall - 0.15);
            proj.z += (proj.vz / spd) * Math.max(0, hitWall - 0.15);
            this.projectiles.delete(pid);
            this.detonateLocalProjectile(proj, now);
            continue;
          } else {
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
          this.projectiles.delete(pid);
          continue;
        }
        if (proj.kind === 'rpg' || proj.detonateAt === null) {
          this.projectiles.delete(pid);
          this.detonateLocalProjectile(proj, now);
          continue;
        }
        proj.vy = Math.abs(proj.vy) * 0.38;
        proj.vx *= 0.68;
        proj.vz *= 0.68;
      }

      if (proj.isEnemyProjectile && this.alive) {
        if (Math.hypot(this.px - proj.x, this.pz - proj.z) <= 0.72 && Math.abs(this.py + 1.0 - proj.y) <= 1.1) {
          this.hp = Math.max(0, this.hp - proj.damage);
          this.callbacks.onPlayerHit({ playerId: this.profile.id });
          this.projectiles.delete(pid);
          if (this.hp <= 0) {
            this.alive = false;
            if (!this.bot) {
              this.finish(false);
              return;
            }
          }
          continue;
        }
      } else if (proj.kind === 'rpg') {
        let hit = false;
        for (const m of this.monsters.values()) {
          if (Math.hypot(m.x - proj.x, m.z - proj.z) <= m.radius + 0.55) {
            hit = true;
            break;
          }
        }
        if (!hit && this.bot && this.bot.alive && Math.hypot(this.bot.x - proj.x, this.bot.z - proj.z) <= 0.85) {
          hit = true;
        }
        if (hit) {
          this.projectiles.delete(pid);
          this.detonateLocalProjectile(proj, now);
          continue;
        }
      }

      if (proj.detonateAt !== null && now >= proj.detonateAt) {
        this.projectiles.delete(pid);
        if (!proj.isEnemyProjectile) this.detonateLocalProjectile(proj, now);
      }
    }

    for (const [fzId, fz] of Array.from(this.fireZones.entries())) {
      if (now >= fz.expiresAt) {
        this.fireZones.delete(fzId);
        continue;
      }
      if (now - fz.lastTickAt >= 450) {
        fz.lastTickAt = now;
        const tickDmg = Math.round(fz.damagePerSec * 0.45);
        const hits: Array<{ monsterId: string; damage: number; killed: boolean; x: number; z: number }> = [];
        if (this.bot && this.bot.alive && fz.ownerId !== this.bot.playerId) {
          if (Math.hypot(this.bot.x - fz.x, this.bot.z - fz.z) <= fz.radius) {
            const pvpTick = Math.max(4, Math.round(tickDmg * 0.45));
            this.bot.hp = Math.max(0, this.bot.hp - pvpTick);
            const killed = this.bot.hp <= 0;
            if (killed) this.bot.alive = false;
            hits.push({ monsterId: this.bot.playerId, damage: pvpTick, killed, x: this.bot.x, z: this.bot.z });
          }
        } else if (!this.bot) {
          for (const m of Array.from(this.monsters.values())) {
            if (Math.hypot(m.x - fz.x, m.z - fz.z) <= fz.radius + m.radius) {
              m.hp -= tickDmg;
              const killed = m.hp <= 0;
              hits.push({ monsterId: m.id, damage: tickDmg, killed, x: m.x, z: m.z });
              if (killed) this.killLocalMonster(m);
            }
          }
        }
        if (hits.length > 0) this.callbacks.onHitConfirm({ hits });
      }
    }

    // Collect nearby coins
    for (const [cid, c] of this.coins.entries()) {
      if (now - c.createdAt > 35000) {
        this.coins.delete(cid);
        continue;
      }
      if (Math.hypot(this.px - c.x, this.pz - c.z) <= 2.2) {
        this.coins.delete(cid);
        this.coinsEarned += c.value;
        this.score += c.value * 5;
        this.callbacks.onCoinCollected({ playerId: this.profile.id });
      }
    }

    this.emitState(now);
  }

  private emitState(now: number) {
    const players: ServerStatePacket['players'] = [
      {
        playerId: this.profile.id,
        x: this.px,
        y: this.py,
        z: this.pz,
        yaw: this.yaw,
        pitch: this.pitch,
        hp: this.hp,
        maxHp: this.maxHp,
        alive: this.alive,
        weaponId: this.weaponId,
        reloading: this.reloading,
        kills: this.kills,
        score: this.score,
        coinsEarned: this.coinsEarned,
        healthPurchasesUsed: this.healthPurchasesUsed,
      },
    ];
    if (this.bot) {
      players.push({
        playerId: this.bot.playerId,
        x: this.bot.x,
        y: this.bot.y,
        z: this.bot.z,
        yaw: this.bot.yaw,
        pitch: this.bot.pitch,
        hp: this.bot.hp,
        maxHp: this.bot.maxHp,
        alive: this.bot.alive,
        weaponId: this.bot.weaponId,
        reloading: false,
        kills: this.bot.kills,
        score: this.bot.score,
        coinsEarned: 0,
        healthPurchasesUsed: 0,
      });
    }

    this.callbacks.onState({
      t: now,
      elapsedSec: Math.floor(((this.pausedSince ?? now) - this.matchStartedAt) / 1000),
      wave: this.bot ? this.round : this.wave,
      maxWaves: this.maxWaves,
      waveState: this.waveState,
      remainingToSpawn: this.monstersToSpawn.length,
      pausedBy: this.paused ? [this.profile.username] : [],
      gameMode: this.gameMode,
      duel: this.bot
        ? {
            round: this.round,
            roundsToWin: GAME_MODES.duel_1v1.roundsToWin || 5,
            roundState: this.roundState,
            roundTimeLeftSec: Math.max(0, Math.ceil((this.roundEndsAt - now) / 1000)),
            roundScores: { ...this.roundScores },
            roundWinnerId: this.roundWinnerId,
          }
        : undefined,
      players,
      monsters: Array.from(this.monsters.values()).map((m) => ({
        id: m.id,
        type: m.type,
        x: m.x,
        z: m.z,
        yaw: m.yaw,
        hp: m.hp,
        maxHp: m.maxHp,
        attacking: !this.paused && now < m.attackAnimUntil,
      })),
      coins: Array.from(this.coins.values()).map((c) => ({ id: c.id, x: c.x, z: c.z, value: c.value })),
      projectiles: Array.from(this.projectiles.values()).map((pr) => ({
        id: pr.id,
        kind: pr.kind,
        x: pr.x,
        y: pr.y,
        z: pr.z,
      })),
      fireZones: Array.from(this.fireZones.values()).map((fz) => ({
        id: fz.id,
        kind: fz.kind,
        x: fz.x,
        z: fz.z,
        radius: fz.radius,
        color: fz.color,
      })),
    });
  }

  private finish(victory: boolean) {
    if (this.ended) return;
    this.ended = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const durationSeconds = Math.max(1, Math.floor((Date.now() - this.matchStartedAt) / 1000));
    const wavesCleared = this.bot ? this.round : Math.max(0, this.wave - 1);
    const modeDef = GAME_MODES[this.gameMode] || GAME_MODES.unlimited;
    const totalCoins = this.coinsEarned + Math.round(wavesCleared * 25 * modeDef.rewardMult);
    const totalXp = this.xpEarned + Math.round(wavesCleared * 30 * modeDef.rewardMult);
    const didWin = this.bot
      ? (this.roundScores[this.profile.id] || 0) >= (modeDef.roundsToWin || 5)
      : victory || wavesCleared >= 5;

    const updatedProfile = recordLocalMatchOutcome({
      mapId: this.mapId,
      difficulty: 'normal',
      wavesCleared,
      victory: didWin,
      durationSeconds,
      kills: this.kills,
      bossKills: this.bossKills,
      score: this.score,
      coinsEarned: totalCoins,
      xpEarned: totalXp,
    });

    const results = [
      {
        playerId: this.profile.id,
        username: this.profile.username,
        kills: this.kills,
        bossKills: this.bossKills,
        score: this.score,
        coinsEarned: totalCoins,
        xpEarned: totalXp,
        survived: didWin || this.alive,
      },
    ];
    if (this.bot) {
      results.push({
        playerId: this.bot.playerId,
        username: this.bot.username,
        kills: this.bot.kills,
        bossKills: 0,
        score: this.bot.score,
        coinsEarned: 0,
        xpEarned: 0,
        survived: !didWin,
      });
    }

    this.callbacks.onEnded({
      victory: didWin,
      wavesCleared,
      durationSeconds,
      profile: updatedProfile,
      results,
    });
  }
}
