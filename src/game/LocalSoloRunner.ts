import {
  DIFFICULTIES,
  getWeaponStatsAtLevel,
  HEALTH_PURCHASE_AMOUNT,
  HEALTH_PURCHASE_COST,
  MAPS,
  MAX_HEALTH_PURCHASES_PER_MATCH,
  MONSTERS,
  MapId,
  MonsterType,
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
}

interface LocalCoin {
  id: string;
  x: number;
  z: number;
  value: number;
  createdAt: number;
}

export interface LocalMatchCallbacks {
  onStarted: (payload: {
    mapId: MapId;
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
  onHealthPurchased: (payload: { newCoinBalance: number; remainingPurchases: number }) => void;
  onHealthError: (payload: { message: string }) => void;
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

function buildWaveQueue(wave: number): MonsterType[] {
  const queue: MonsterType[] = [];
  const total = 5 + wave * 3;
  for (let i = 0; i < total; i++) {
    const r = Math.random();
    if (wave >= 3 && r < 0.14) queue.push('brute');
    else if (wave >= 4 && r < 0.25) queue.push('phantom');
    else if (r < 0.5) queue.push('runner');
    else if (r < 0.78) queue.push('zombie');
    else queue.push('crawler');
  }
  if (wave === 3 || wave === 6) {
    queue.push('boss');
  }
  return queue;
}

export class LocalSoloRunner {
  private profile: PlayerProfile;
  private mapId: MapId;
  private callbacks: LocalMatchCallbacks;
  private timer: number | null = null;
  private wave = 1;
  private maxWaves = 6;
  private waveState: 'combat' | 'intermission' = 'combat';
  private intermissionEndsAt = 0;
  private monstersToSpawn: MonsterType[] = [];
  private lastSpawnAt = 0;
  private monsters = new Map<string, LocalMonster>();
  private coins = new Map<string, LocalCoin>();
  private matchStartedAt = Date.now();
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

  constructor(profile: PlayerProfile, mapId: MapId, callbacks: LocalMatchCallbacks) {
    this.profile = profile;
    this.mapId = mapId;
    this.callbacks = callbacks;
    this.weaponId = profile.equippedWeapon;
    const spawn = MAPS[mapId].playerSpawns[0] || [0, 2];
    this.px = spawn[0];
    this.pz = spawn[1];
    this.monstersToSpawn = buildWaveQueue(1);
  }

  public start() {
    this.callbacks.onStarted({
      mapId: this.mapId,
      players: [
        {
          playerId: this.profile.id,
          username: this.profile.username,
          loadout: this.profile.equippedLoadout,
          weaponId: this.weaponId,
          x: this.px,
          y: this.py,
          z: this.pz,
          yaw: 0,
          pitch: 0,
          hp: this.hp,
          maxHp: this.maxHp,
          alive: true,
        },
      ],
    });
    this.callbacks.onWave({ wave: 1, isBossWave: false });
    this.timer = window.setInterval(() => this.tick(), 50);
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

  public handleShoot(payload: {
    weaponId: WeaponId;
    ox: number;
    oy: number;
    oz: number;
    rays: Array<{ dx: number; dy: number; dz: number }>;
  }) {
    if (!this.alive || this.ended) return;
    const upg = this.profile.weapons[payload.weaponId]?.upgradeLevel || 1;
    const wStats = getWeaponStatsAtLevel(payload.weaponId, upg);
    const hits: Array<{ monsterId: string; damage: number; killed: boolean; x: number; z: number }> = [];

    for (const ray of payload.rays || []) {
      let best: { m: LocalMonster; dist: number } | null = null;
      for (const m of this.monsters.values()) {
        const mDef = MONSTERS[m.type];
        const cy = mDef.height * 0.52;
        const radius = m.radius * 1.28;
        const ocX = m.x - payload.ox;
        const ocY = cy - payload.oy;
        const ocZ = m.z - payload.oz;
        const proj = ocX * ray.dx + ocY * ray.dy + ocZ * ray.dz;
        if (proj < 0 || proj > wStats.range) continue;
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

        if (killed) {
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
      }
    }

    if (hits.length > 0) {
      this.callbacks.onHitConfirm({ hits });
    }
  }

  public buyHealth() {
    if (!this.alive || this.ended) return;
    if (this.healthPurchasesUsed >= MAX_HEALTH_PURCHASES_PER_MATCH) {
      this.callbacks.onHealthError({ message: 'Medkit limit reached (max 3 per match).' });
      return;
    }
    if (this.hp >= this.maxHp) {
      this.callbacks.onHealthError({ message: 'Health is already full.' });
      return;
    }
    const spent = spendLocalHealthCoin(HEALTH_PURCHASE_COST);
    if (!spent.success) {
      this.callbacks.onHealthError({ message: `Need ${HEALTH_PURCHASE_COST} coins to buy Medkit.` });
      return;
    }
    this.healthPurchasesUsed += 1;
    this.hp = Math.min(this.maxHp, this.hp + HEALTH_PURCHASE_AMOUNT);
    this.callbacks.onHealthPurchased({
      newCoinBalance: spent.newCoinBalance,
      remainingPurchases: MAX_HEALTH_PURCHASES_PER_MATCH - this.healthPurchasesUsed,
    });
  }

  public abort() {
    this.finish(false);
  }

  private tick() {
    if (this.ended) return;
    const now = Date.now();
    const dt = 0.05;
    const mapDef = MAPS[this.mapId];
    const diff = DIFFICULTIES.normal;

    if (this.waveState === 'intermission') {
      if (now >= this.intermissionEndsAt) {
        this.wave += 1;
        this.waveState = 'combat';
        this.monstersToSpawn = buildWaveQueue(this.wave);
        this.callbacks.onWave({ wave: this.wave, isBossWave: this.wave === 3 || this.wave === 6 });
      }
    } else {
      if (this.monstersToSpawn.length > 0 && now - this.lastSpawnAt >= 750 && this.monsters.size < 18) {
        const type = this.monstersToSpawn.shift()!;
        const sp = mapDef.monsterSpawns[Math.floor(Math.random() * mapDef.monsterSpawns.length)] || [0, -20];
        const mDef = MONSTERS[type];
        const waveScale = 1 + (this.wave - 1) * 0.14;
        const id = `m-${this.idSeq++}`;
        this.monsters.set(id, {
          id,
          type,
          x: sp[0] + (Math.random() - 0.5) * 2,
          z: sp[1] + (Math.random() - 0.5) * 2,
          yaw: 0,
          hp: Math.round(mDef.hp * diff.hpMult * waveScale),
          maxHp: Math.round(mDef.hp * diff.hpMult * waveScale),
          speed: mDef.speed * diff.speedMult,
          damage: Math.round(mDef.damage * diff.dmgMult),
          attackRange: mDef.attackRange,
          attackCooldown: mDef.attackCooldown * 1000,
          lastAttackAt: 0,
          radius: mDef.radius,
          coinReward: mDef.coinReward,
          scoreReward: mDef.scoreReward,
          xpReward: mDef.xpReward,
          attackAnimUntil: 0,
        });
        this.lastSpawnAt = now;
      }

      if (this.monstersToSpawn.length === 0 && this.monsters.size === 0) {
        if (this.wave >= this.maxWaves) {
          this.finish(true);
          return;
        }
        this.waveState = 'intermission';
        this.intermissionEndsAt = now + 4500;
        this.callbacks.onWaveCleared({ clearedWave: this.wave, nextWave: this.wave + 1 });
      }
    }

    // Move monsters toward player
    for (const m of this.monsters.values()) {
      const dx = this.px - m.x;
      const dz = this.pz - m.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      m.yaw = Math.atan2(dx, dz);

      if (dist > m.attackRange * 0.85) {
        const step = Math.min(dist, m.speed * dt);
        m.x += (dx / dist) * step;
        m.z += (dz / dist) * step;
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

    // Collect nearby coins
    for (const [cid, c] of this.coins.entries()) {
      if (now - c.createdAt > 25000) {
        this.coins.delete(cid);
        continue;
      }
      if (Math.hypot(this.px - c.x, this.pz - c.z) <= 1.8) {
        this.coins.delete(cid);
        this.coinsEarned += c.value;
        this.score += c.value * 5;
        this.callbacks.onCoinCollected({ playerId: this.profile.id });
      }
    }

    this.callbacks.onState({
      t: now,
      elapsedSec: Math.floor((now - this.matchStartedAt) / 1000),
      wave: this.wave,
      maxWaves: this.maxWaves,
      waveState: this.waveState,
      remainingToSpawn: this.monstersToSpawn.length,
      players: [
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
      ],
      monsters: Array.from(this.monsters.values()).map((m) => ({
        id: m.id,
        type: m.type,
        x: m.x,
        z: m.z,
        yaw: m.yaw,
        hp: m.hp,
        maxHp: m.maxHp,
        attacking: now < m.attackAnimUntil,
      })),
      coins: Array.from(this.coins.values()).map((c) => ({ id: c.id, x: c.x, z: c.z, value: c.value })),
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
    const wavesCleared = victory ? this.maxWaves : Math.max(0, this.wave - 1);
    const totalCoins = this.coinsEarned + (victory ? 150 : 0);
    const totalXp = this.xpEarned + (victory ? 120 : 25);

    const updatedProfile = recordLocalMatchOutcome({
      mapId: this.mapId,
      difficulty: 'normal',
      wavesCleared,
      victory,
      durationSeconds,
      kills: this.kills,
      bossKills: this.bossKills,
      score: this.score,
      coinsEarned: totalCoins,
      xpEarned: totalXp,
    });

    this.callbacks.onEnded({
      victory,
      wavesCleared,
      durationSeconds,
      profile: updatedProfile,
      results: [
        {
          playerId: this.profile.id,
          username: this.profile.username,
          kills: this.kills,
          bossKills: this.bossKills,
          score: this.score,
          coinsEarned: totalCoins,
          xpEarned: totalXp,
          survived: this.alive,
        },
      ],
    });
  }
}
