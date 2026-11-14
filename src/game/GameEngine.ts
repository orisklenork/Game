import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  EquippedLoadout,
  getWeaponStatsAtLevel,
  MapId,
  MAPS,
  MonsterType,
  WEAPON_ORDER,
  WeaponId,
} from '../shared/gameData';
import { audioEngine } from './audio';
import { buildHorrorMap, BuiltMapHandle } from './maps';
import {
  buildMonsterModel,
  buildPlayerCharacterModel,
  buildWeaponModel,
  MonsterModelHandle,
  PlayerModelHandle,
  WeaponModelHandle,
} from './models';
import { createProceduralTextures, ProceduralTextureSet } from './textures';

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  alive: boolean;
  ammo: number;
  maxAmmo: number;
  reloading: boolean;
  reloadProgress: number;
  weaponId: WeaponId;
  weaponName: string;
  kills: number;
  score: number;
  coinsEarned: number;
  healthPurchasesUsed: number;
  wave: number;
  maxWaves: number;
  waveState: 'combat' | 'intermission';
  elapsedSec: number;
  monstersRemaining: number;
  flashlightOn: boolean;
  pointerLocked: boolean;
  teammate: {
    username: string;
    hp: number;
    maxHp: number;
    alive: boolean;
    x: number;
    z: number;
  } | null;
  minimap: {
    arenaHalfSize: number;
    playerX: number;
    playerZ: number;
    playerYaw: number;
    monsters: Array<{ x: number; z: number; isBoss: boolean }>;
    coins: Array<{ x: number; z: number }>;
  };
}

export interface RemotePlayerData {
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
}

export interface ServerStatePacket {
  t: number;
  elapsedSec: number;
  wave: number;
  maxWaves: number;
  waveState: 'combat' | 'intermission';
  remainingToSpawn: number;
  players: Array<{
    playerId: string;
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    hp: number;
    maxHp: number;
    alive: boolean;
    weaponId: WeaponId;
    reloading: boolean;
    kills: number;
    score: number;
    coinsEarned: number;
    healthPurchasesUsed: number;
  }>;
  monsters: Array<{
    id: string;
    type: MonsterType;
    x: number;
    z: number;
    yaw: number;
    hp: number;
    maxHp: number;
    attacking: boolean;
  }>;
  coins: Array<{ id: string; x: number; z: number; value: number }>;
}

export interface EngineCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onShoot: (payload: {
    weaponId: WeaponId;
    ox: number;
    oy: number;
    oz: number;
    dx: number;
    dy: number;
    dz: number;
    rays: Array<{ dx: number; dy: number; dz: number }>;
  }) => void;
  onPlayerStateSend: (payload: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    weaponId: WeaponId;
    reloading: boolean;
  }) => void;
  onPauseRequest: () => void;
  onBuyHealthRequest: () => void;
  onHitMarker: (killed: boolean) => void;
}

// Pre-allocated math helpers (Zero GC in render loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

interface PooledParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

interface ActiveTracer {
  line: THREE.Line;
  life: number;
}

export class HorrorGameEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private textures: ProceduralTextureSet;
  private isSoftwareGl: boolean;
  private quality: 'low' | 'medium' | 'high' = 'medium';

  private currentMapId: MapId = 'hospital';
  private builtMap: BuiltMapHandle | null = null;

  private mode: 'diorama' | 'playing' = 'diorama';
  private paused = false;
  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private elapsed = 0;
  private hitstopTimer = 0;
  private shakeIntensity = 0;

  // Local player state
  private localPlayerId = '';
  private ownedWeapons: Record<string, { upgradeLevel: number }> = { pistol: { upgradeLevel: 1 } };
  private equippedWeapon: WeaponId = 'pistol';
  private weaponSkinId = 'wskin_factory';
  private ammoMap: Record<string, number> = {};
  private reloading = false;
  private reloadTimer = 0;
  private reloadDuration = 1;
  private fireCooldown = 0;
  private aiming = false;
  private flashlightOn = true;
  private sensitivity = 0.0022;

  private playerPos = new THREE.Vector3(0, 0, 2);
  private playerVelY = 0;
  private grounded = true;
  private yaw = 0;
  private pitch = 0;
  private stepTimer = 0;
  private localHp = 100;
  private localMaxHp = 100;
  private localAlive = true;
  private localKills = 0;
  private localScore = 0;
  private localCoinsEarned = 0;
  private localHealthPurchasesUsed = 0;

  // Viewmodel & Flashlight
  private viewModelAnchor = new THREE.Group();
  private viewWeapon: WeaponModelHandle | null = null;
  private recoilOffset = 0;
  private muzzleFlashTimer = 0;
  private muzzleLight = new THREE.PointLight(0xffb84d, 0, 9);
  private flashlight: THREE.SpotLight;
  private flashlightTarget = new THREE.Object3D();

  // Input state (continuous held vs edge justPressed)
  private heldKeys = new Set<string>();
  private mouseDown = false;
  private mobileMove = { x: 0, y: 0 };
  private mobileShooting = false;

  // Authoritative synced entities
  private wave = 1;
  private maxWaves = 6;
  private waveState: 'combat' | 'intermission' = 'intermission';
  private matchElapsedSec = 0;
  private monstersRemaining = 0;

  private remotePlayers = new Map<
    string,
    {
      data: RemotePlayerData;
      model: PlayerModelHandle;
      targetPos: THREE.Vector3;
      targetYaw: number;
      walkPhase: number;
    }
  >();

  private monsters = new Map<
    string,
    {
      type: MonsterType;
      model: MonsterModelHandle;
      targetX: number;
      targetZ: number;
      targetYaw: number;
      hp: number;
      maxHp: number;
      attacking: boolean;
      walkPhase: number;
      hitFlashUntil: number;
    }
  >();

  private coins = new Map<string, { mesh: THREE.Mesh; x: number; z: number }>();
  private coinGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.07, 14);
  private coinMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xb45309,
    emissiveIntensity: 0.6,
    metalness: 0.85,
    roughness: 0.2,
  });

  // Pooled particles & tracers
  private particlePool: PooledParticle[] = [];
  private tracers: ActiveTracer[] = [];
  private lastNetworkSync = 0;
  private lastHudEmit = 0;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    // Software WebGL probe (never via user agent)
    this.isSoftwareGl = (() => {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      72,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.1,
      140
    );

    // Studio procedural environment map for metallic PBR weapons & armor
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.textures = createProceduralTextures(this.renderer);

    // Camera-attached Viewmodel & Flashlight
    this.camera.add(this.viewModelAnchor);
    this.camera.add(this.muzzleLight);
    this.muzzleLight.position.set(0.22, -0.15, -0.7);

    this.flashlight = new THREE.SpotLight(0xeef6ff, 14, 38, Math.PI / 5.5, 0.45, 1.4);
    this.flashlight.position.set(0.18, -0.1, -0.2);
    this.flashlightTarget.position.set(0, 0, -10);
    this.camera.add(this.flashlight);
    this.camera.add(this.flashlightTarget);
    this.flashlight.target = this.flashlightTarget;
    this.scene.add(this.camera);

    // Pre-allocate blood/spark particle pool (Zero GC)
    const pGeo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
    for (let i = 0; i < 64; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xdc2626 });
      const mesh = new THREE.Mesh(pGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.particlePool.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0.4 });
    }

    this.loadMap('hospital');
    this.bindEvents();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.scheduleNextTick();
  }

  public loadMap(mapId: MapId) {
    this.currentMapId = mapId;
    if (this.builtMap) {
      this.scene.remove(this.builtMap.group);
      this.builtMap.dispose();
    }
    const def = MAPS[mapId];
    this.scene.background = new THREE.Color(def.skyColor);
    this.scene.fog = new THREE.FogExp2(def.fogColor, this.quality === 'low' ? def.fogDensity * 0.85 : def.fogDensity);

    this.builtMap = buildHorrorMap(mapId, this.textures, this.quality, this.isSoftwareGl);
    this.scene.add(this.builtMap.group);
  }

  public setQuality(q: 'low' | 'medium' | 'high') {
    this.quality = q;
    if (!this.isSoftwareGl) {
      this.renderer.shadowMap.enabled = q !== 'low';
      const maxDpr = q === 'high' ? 2 : q === 'medium' ? 1.5 : 1;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxDpr));
    }
    this.loadMap(this.currentMapId);
  }

  public setSensitivity(sens: number) {
    this.sensitivity = sens;
  }

  public setDioramaMode(mapId?: MapId) {
    this.mode = 'diorama';
    this.paused = false;
    this.viewModelAnchor.visible = false;
    this.flashlight.intensity = 0;
    this.clearMatchEntities();
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    if (mapId && mapId !== this.currentMapId) {
      this.loadMap(mapId);
    }
  }

  public startMatch(params: {
    localPlayerId: string;
    mapId: MapId;
    equippedWeapon: WeaponId;
    ownedWeapons: Record<string, { upgradeLevel: number }>;
    weaponSkinId: string;
    players: RemotePlayerData[];
  }) {
    this.localPlayerId = params.localPlayerId;
    this.ownedWeapons = params.ownedWeapons;
    this.equippedWeapon = params.equippedWeapon;
    this.weaponSkinId = params.weaponSkinId;
    this.clearMatchEntities();

    if (params.mapId !== this.currentMapId) {
      this.loadMap(params.mapId);
    }

    // Initialize magazines
    for (const wid of WEAPON_ORDER) {
      const def = getWeaponStatsAtLevel(wid, this.ownedWeapons[wid]?.upgradeLevel || 1);
      this.ammoMap[wid] = def.magSize;
    }

    // Place local player & build remote teammates
    const mapDef = MAPS[params.mapId];
    params.players.forEach((p, idx) => {
      if (p.playerId === this.localPlayerId) {
        const sp = mapDef.playerSpawns[idx % mapDef.playerSpawns.length];
        this.playerPos.set(sp[0], 0, sp[1]);
        this.playerVelY = 0;
        this.yaw = 0;
        this.pitch = 0;
        this.localHp = 100;
        this.localMaxHp = 100;
        this.localAlive = true;
        this.localKills = 0;
        this.localScore = 0;
        this.localCoinsEarned = 0;
        this.localHealthPurchasesUsed = 0;
      } else {
        this.spawnOrUpdateRemotePlayer(p);
      }
    });

    this.mode = 'playing';
    this.paused = false;
    this.reloading = false;
    this.viewModelAnchor.visible = true;
    this.flashlightOn = true;
    this.flashlight.intensity = 14;
    this.rebuildViewWeapon();
  }

  private spawnOrUpdateRemotePlayer(p: RemotePlayerData) {
    if (this.remotePlayers.has(p.playerId)) return;
    const model = buildPlayerCharacterModel(p.loadout, p.weaponId, this.textures.contactShadow);
    model.group.position.set(p.x, p.y, p.z);
    this.scene.add(model.group);
    this.remotePlayers.set(p.playerId, {
      data: { ...p },
      model,
      targetPos: new THREE.Vector3(p.x, p.y, p.z),
      targetYaw: p.yaw,
      walkPhase: 0,
    });
  }

  private rebuildViewWeapon() {
    if (this.viewWeapon) {
      this.viewModelAnchor.remove(this.viewWeapon.group);
    }
    this.viewWeapon = buildWeaponModel(this.equippedWeapon, this.weaponSkinId, this.textures.muzzleFlash);
    this.viewWeapon.group.position.set(0.24, -0.22, -0.45);
    this.viewModelAnchor.add(this.viewWeapon.group);
  }

  public switchWeapon(weaponId: WeaponId) {
    if (!this.ownedWeapons[weaponId] || this.equippedWeapon === weaponId) return;
    this.equippedWeapon = weaponId;
    this.reloading = false;
    this.reloadTimer = 0;
    this.rebuildViewWeapon();
    audioEngine.playUiClick();
  }

  public cycleWeapon(dir = 1) {
    const unlocked = WEAPON_ORDER.filter((w) => Boolean(this.ownedWeapons[w]));
    if (unlocked.length <= 1) return;
    const idx = unlocked.indexOf(this.equippedWeapon);
    const next = unlocked[(idx + dir + unlocked.length) % unlocked.length];
    this.switchWeapon(next);
  }

  public triggerReload() {
    if (this.reloading || !this.localAlive) return;
    const lvl = this.ownedWeapons[this.equippedWeapon]?.upgradeLevel || 1;
    const stats = getWeaponStatsAtLevel(this.equippedWeapon, lvl);
    if ((this.ammoMap[this.equippedWeapon] ?? stats.magSize) >= stats.magSize) return;
    this.reloading = true;
    this.reloadDuration = stats.reloadTime;
    this.reloadTimer = stats.reloadTime;
    audioEngine.playReload();
  }

  public toggleFlashlight() {
    this.flashlightOn = !this.flashlightOn;
    this.flashlight.intensity = this.flashlightOn ? 14 : 0;
    audioEngine.playUiClick();
  }

  public setPaused(paused: boolean) {
    this.paused = paused;
    if (paused) {
      this.heldKeys.clear();
      this.mouseDown = false;
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }

  public requestPointerLock() {
    if (this.mode === 'playing' && !this.paused && this.renderer.domElement.requestPointerLock) {
      this.renderer.domElement.requestPointerLock();
    }
  }

  // Mobile Controls API
  public setMobileMove(x: number, y: number) {
    this.mobileMove.x = x;
    this.mobileMove.y = y;
  }

  public applyMobileLook(dx: number, dy: number) {
    if (this.mode !== 'playing' || this.paused) return;
    this.yaw -= dx * this.sensitivity * 1.4;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * this.sensitivity * 1.4, -1.35, 1.35);
  }

  public setMobileShooting(active: boolean) {
    this.mobileShooting = active;
    if (active) this.tryShoot();
  }

  public setAiming(active: boolean) {
    this.aiming = active;
  }

  public triggerJump() {
    if (this.grounded && this.localAlive) {
      this.playerVelY = 6.8;
      this.grounded = false;
    }
  }

  public applyServerState(state: ServerStatePacket) {
    if (this.mode !== 'playing') return;
    this.wave = state.wave;
    this.maxWaves = state.maxWaves;
    this.waveState = state.waveState;
    this.matchElapsedSec = state.elapsedSec;
    this.monstersRemaining = state.monsters.length + state.remainingToSpawn;

    const hasBoss = state.monsters.some((m) => m.type === 'boss');
    audioEngine.setBossMusic(hasBoss);

    // Players
    for (const sp of state.players) {
      if (sp.playerId === this.localPlayerId) {
        this.localHp = sp.hp;
        this.localMaxHp = sp.maxHp;
        this.localAlive = sp.alive;
        this.localKills = sp.kills;
        this.localScore = sp.score;
        this.localCoinsEarned = sp.coinsEarned;
        this.localHealthPurchasesUsed = sp.healthPurchasesUsed;
      } else {
        const rp = this.remotePlayers.get(sp.playerId);
        if (rp) {
          rp.targetPos.set(sp.x, sp.y, sp.z);
          rp.targetYaw = sp.yaw;
          rp.data.hp = sp.hp;
          rp.data.maxHp = sp.maxHp;
          rp.data.alive = sp.alive;
          if (rp.data.weaponId !== sp.weaponId) {
            rp.data.weaponId = sp.weaponId;
            rp.model.weaponMount.clear();
            const newWep = buildWeaponModel(sp.weaponId, rp.data.loadout.weapon_skin);
            newWep.group.scale.setScalar(0.85);
            rp.model.weaponMount.add(newWep.group);
          }
        }
      }
    }

    // Monsters sync
    const activeIds = new Set<string>();
    for (const sm of state.monsters) {
      activeIds.add(sm.id);
      let entry = this.monsters.get(sm.id);
      if (!entry) {
        const model = buildMonsterModel(sm.type, this.textures.contactShadow);
        model.group.position.set(sm.x, 0, sm.z);
        model.group.rotation.y = sm.yaw;
        this.scene.add(model.group);
        entry = {
          type: sm.type,
          model,
          targetX: sm.x,
          targetZ: sm.z,
          targetYaw: sm.yaw,
          hp: sm.hp,
          maxHp: sm.maxHp,
          attacking: sm.attacking,
          walkPhase: Math.random() * Math.PI * 2,
          hitFlashUntil: 0,
        };
        this.monsters.set(sm.id, entry);
        if (Math.random() < 0.35 || sm.type === 'boss') {
          audioEngine.playMonsterGrowl(sm.type === 'boss');
        }
      } else {
        if (sm.hp < entry.hp) {
          entry.hitFlashUntil = performance.now() + 90;
        }
        entry.targetX = sm.x;
        entry.targetZ = sm.z;
        entry.targetYaw = sm.yaw;
        entry.hp = sm.hp;
        entry.maxHp = sm.maxHp;
        entry.attacking = sm.attacking;
      }
      const ratio = Math.max(0.01, sm.hp / Math.max(1, sm.maxHp));
      entry.model.hpBarFill.scale.x = ratio;
    }

    for (const [mid, entry] of this.monsters.entries()) {
      if (!activeIds.has(mid)) {
        this.scene.remove(entry.model.group);
        this.monsters.delete(mid);
      }
    }

    // Coins sync
    const activeCoins = new Set<string>();
    for (const sc of state.coins) {
      activeCoins.add(sc.id);
      if (!this.coins.has(sc.id)) {
        const mesh = new THREE.Mesh(this.coinGeo, this.coinMat);
        mesh.position.set(sc.x, 0.55, sc.z);
        mesh.rotation.x = Math.PI / 2;
        this.scene.add(mesh);
        this.coins.set(sc.id, { mesh, x: sc.x, z: sc.z });
      }
    }
    for (const [cid, c] of this.coins.entries()) {
      if (!activeCoins.has(cid)) {
        this.scene.remove(c.mesh);
        this.coins.delete(cid);
      }
    }
  }

  public handleHitConfirm(hits: Array<{ monsterId: string; damage: number; killed: boolean; x: number; z: number }>) {
    let anyKilled = false;
    for (const h of hits) {
      this.spawnBurst(h.x, 1.1, h.z, 0xdc2626, h.killed ? 14 : 6);
      if (h.killed) {
        anyKilled = true;
      }
    }
    if (anyKilled) {
      this.hitstopTimer = 0.035;
      audioEngine.playMonsterDeath();
    }
    audioEngine.playHitMarker(anyKilled);
    this.callbacks.onHitMarker(anyKilled);
  }

  public handleRemoteShotFx(fx: {
    weaponId: WeaponId;
    ox: number;
    oy: number;
    oz: number;
    dx: number;
    dy: number;
    dz: number;
  }) {
    audioEngine.playGunshot(fx.weaponId, 0.5);
    this.spawnTracer(fx.ox, fx.oy - 0.1, fx.oz, fx.dx, fx.dy, fx.dz, fx.weaponId === 'plasma' ? 0xef4444 : 0xfbbf24);
  }

  public handlePlayerDamageFx() {
    this.shakeIntensity = Math.max(this.shakeIntensity, 0.25);
    audioEngine.playPlayerHurt();
  }

  private spawnBurst(x: number, y: number, z: number, colorHex: number, count: number) {
    let spawned = 0;
    for (const p of this.particlePool) {
      if (p.life <= 0) {
        p.life = 0.35 + Math.random() * 0.25;
        p.maxLife = p.life;
        p.mesh.position.set(x, y, z);
        (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
        p.mesh.visible = true;
        p.vx = (Math.random() - 0.5) * 6;
        p.vy = 1.5 + Math.random() * 4.5;
        p.vz = (Math.random() - 0.5) * 6;
        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  private spawnTracer(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, colorHex: number) {
    const start = new THREE.Vector3(ox, oy, oz);
    const end = new THREE.Vector3(ox + dx * 32, oy + dy * 32, oz + dz * 32);
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.85 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.08 });
  }

  private tryShoot() {
    if (this.mode !== 'playing' || this.paused || !this.localAlive || this.reloading) return;
    if (this.fireCooldown > 0) return;

    const lvl = this.ownedWeapons[this.equippedWeapon]?.upgradeLevel || 1;
    const stats = getWeaponStatsAtLevel(this.equippedWeapon, lvl);
    const currentAmmo = this.ammoMap[this.equippedWeapon] ?? stats.magSize;
    if (currentAmmo <= 0) {
      this.triggerReload();
      return;
    }

    this.ammoMap[this.equippedWeapon] = currentAmmo - 1;
    this.fireCooldown = 1 / stats.fireRate;
    this.recoilOffset = Math.min(0.16, this.recoilOffset + stats.recoil);
    this.pitch = Math.min(1.35, this.pitch + stats.recoil * 0.28);
    this.shakeIntensity = Math.min(0.22, this.shakeIntensity + stats.recoil * 0.9);
    this.muzzleFlashTimer = 0.055;
    this.muzzleLight.intensity = 10;
    audioEngine.playGunshot(this.equippedWeapon);

    // Compute camera ray + pellet spread rays
    _euler.set(this.pitch, this.yaw, 0, 'YXZ');
    const ox = this.camera.position.x;
    const oy = this.camera.position.y;
    const oz = this.camera.position.z;

    const rays: Array<{ dx: number; dy: number; dz: number }> = [];
    for (let i = 0; i < stats.pellets; i++) {
      _dir.set(0, 0, -1).applyEuler(_euler);
      if (stats.spread > 0) {
        _dir.x += (Math.random() - 0.5) * stats.spread * (this.aiming ? 0.5 : 1);
        _dir.y += (Math.random() - 0.5) * stats.spread * (this.aiming ? 0.5 : 1);
        _dir.z += (Math.random() - 0.5) * stats.spread * (this.aiming ? 0.5 : 1);
        _dir.normalize();
      }
      rays.push({ dx: _dir.x, dy: _dir.y, dz: _dir.z });
    }

    const tracerStart = _v1.set(0.22, -0.14, -0.75).applyEuler(_euler).add(this.camera.position);
    this.spawnTracer(
      tracerStart.x,
      tracerStart.y,
      tracerStart.z,
      rays[0].dx,
      rays[0].dy,
      rays[0].dz,
      this.equippedWeapon === 'plasma' ? 0xef4444 : 0xfde047
    );

    this.callbacks.onShoot({
      weaponId: this.equippedWeapon,
      ox,
      oy,
      oz,
      dx: rays[0].dx,
      dy: rays[0].dy,
      dz: rays[0].dz,
      rays,
    });

    if (this.ammoMap[this.equippedWeapon] <= 0) {
      this.triggerReload();
    }
  }

  private resolvePlayerObstacles(x: number, z: number): { x: number; z: number } {
    const map = MAPS[this.currentMapId];
    const r = 0.55;
    const limit = map.arenaHalfSize - r - 0.5;
    let nx = Math.max(-limit, Math.min(limit, x));
    let nz = Math.max(-limit, Math.min(limit, z));

    for (const obs of map.obstacles) {
      const hw = obs.w / 2 + r;
      const hd = obs.d / 2 + r;
      const dx = nx - obs.x;
      const dz = nz - obs.z;
      if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
        const penX = hw - Math.abs(dx);
        const penZ = hd - Math.abs(dz);
        if (penX < penZ) nx += dx >= 0 ? penX : -penX;
        else nz += dz >= 0 ? penZ : -penZ;
      }
    }
    return { x: nx, z: nz };
  }

  private clearMatchEntities() {
    for (const rp of this.remotePlayers.values()) this.scene.remove(rp.model.group);
    this.remotePlayers.clear();
    for (const m of this.monsters.values()) this.scene.remove(m.model.group);
    this.monsters.clear();
    for (const c of this.coins.values()) this.scene.remove(c.mesh);
    this.coins.clear();
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.heldKeys.add(e.code);
    if (this.mode !== 'playing') return;

    if (e.code === 'Escape') {
      this.callbacks.onPauseRequest();
      return;
    }
    if (this.paused) return;

    if (e.code === 'KeyR') this.triggerReload();
    if (e.code === 'KeyF') this.toggleFlashlight();
    if (e.code === 'KeyH' || e.code === 'KeyB') this.callbacks.onBuyHealthRequest();
    if (e.code === 'Space') this.triggerJump();

    if (e.code.startsWith('Digit')) {
      const num = parseInt(e.code.replace('Digit', ''), 10);
      if (num >= 1 && num <= WEAPON_ORDER.length) {
        this.switchWeapon(WEAPON_ORDER[num - 1]);
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code);
  };

  private onMouseMove = (e: MouseEvent) => {
    if (this.mode !== 'playing' || this.paused) return;
    if (document.pointerLockElement !== this.renderer.domElement) return;
    this.yaw -= e.movementX * this.sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * this.sensitivity, -1.35, 1.35);
  };

  private onMouseDown = (e: MouseEvent) => {
    if (this.mode !== 'playing' || this.paused) return;
    audioEngine.unlock();
    if (e.button === 0) {
      if (document.pointerLockElement !== this.renderer.domElement) {
        this.requestPointerLock();
      }
      this.mouseDown = true;
      this.tryShoot();
    } else if (e.button === 2) {
      this.aiming = true;
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouseDown = false;
    else if (e.button === 2) this.aiming = false;
  };

  private onWheel = (e: WheelEvent) => {
    if (this.mode !== 'playing' || this.paused) return;
    this.cycleWeapon(e.deltaY > 0 ? 1 : -1);
  };

  private onContextMenu = (e: MouseEvent) => {
    if (this.mode === 'playing') e.preventDefault();
  };

  private onBlur = () => {
    this.heldKeys.clear();
    this.mouseDown = false;
    this.aiming = false;
  };

  private onResize = () => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private onContextLost = (e: Event) => {
    e.preventDefault();
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
  };

  private onContextRestored = () => {
    this.scheduleNextTick();
  };

  private bindEvents() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('resize', this.onResize);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  private scheduleNextTick() {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(this.tick, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private tick = () => {
    if (this.disposed) return;
    const now = performance.now();
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.05);
    this.elapsed += dt;

    // Flickering horror lights
    if (this.builtMap) {
      for (const fl of this.builtMap.flickerLights) {
        const flicker = Math.sin(this.elapsed * 9 + fl.phase) * Math.sin(this.elapsed * 23 + fl.phase);
        fl.light.intensity = flicker > 0.68 ? fl.baseIntensity * 0.25 : fl.baseIntensity;
      }
    }

    if (this.mode === 'diorama') {
      // Smooth cinematic horror camera orbit on Title / Menus
      const angle = this.elapsed * 0.12;
      const radius = 15;
      this.camera.position.set(Math.cos(angle) * radius, 4.2 + Math.sin(this.elapsed * 0.4) * 0.4, Math.sin(angle) * radius);
      this.camera.lookAt(0, 1.4, 0);
      this.renderer.render(this.scene, this.camera);
      this.scheduleNextTick();
      return;
    }

    // Hitstop micro-freeze on heavy kills
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
    } else if (!this.paused) {
      this.updateGameplay(dt, now);
    }

    this.renderer.render(this.scene, this.camera);
    this.scheduleNextTick();
  };

  private updateGameplay(dt: number, now: number) {
    // 1. Movement
    const lvl = this.ownedWeapons[this.equippedWeapon]?.upgradeLevel || 1;
    const wStats = getWeaponStatsAtLevel(this.equippedWeapon, lvl);

    if (this.localAlive) {
      const forward = (this.heldKeys.has('KeyW') ? 1 : 0) - (this.heldKeys.has('KeyS') ? 1 : 0) - this.mobileMove.y;
      const strafe = (this.heldKeys.has('KeyD') ? 1 : 0) - (this.heldKeys.has('KeyA') ? 1 : 0) + this.mobileMove.x;
      const sprinting = this.heldKeys.has('ShiftLeft') || this.heldKeys.has('ShiftRight');

      const speed = 7.4 * wStats.moveSpeedMult * (sprinting && !this.aiming ? 1.32 : this.aiming ? 0.68 : 1.0);
      const len = Math.hypot(forward, strafe);
      if (len > 0.05) {
        const nf = forward / Math.max(1, len);
        const ns = strafe / Math.max(1, len);
        const sinY = Math.sin(this.yaw);
        const cosY = Math.cos(this.yaw);
        const moveX = (-sinY * nf + cosY * ns) * speed * dt;
        const moveZ = (-cosY * nf - sinY * ns) * speed * dt;
        const pushed = this.resolvePlayerObstacles(this.playerPos.x + moveX, this.playerPos.z + moveZ);
        this.playerPos.x = pushed.x;
        this.playerPos.z = pushed.z;

        if (this.grounded) {
          this.stepTimer -= dt * (sprinting ? 1.4 : 1.0);
          if (this.stepTimer <= 0) {
            this.stepTimer = 0.42;
            audioEngine.playFootstep();
          }
        }
      }

      // Gravity & Jump
      if (!this.grounded || this.playerPos.y > 0) {
        this.playerVelY -= 19.5 * dt;
        this.playerPos.y += this.playerVelY * dt;
        if (this.playerPos.y <= 0) {
          this.playerPos.y = 0;
          this.playerVelY = 0;
          this.grounded = true;
        }
      }
    }

    // 2. Camera FOV (ADS zoom) & Shake
    const targetFov = this.aiming ? (this.equippedWeapon === 'sniper' ? 38 : 54) : 72;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 14, dt);
      this.camera.updateProjectionMatrix();
    }

    this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 12, dt);
    const sx = (Math.random() - 0.5) * this.shakeIntensity * 0.25;
    const sy = (Math.random() - 0.5) * this.shakeIntensity * 0.25;

    this.camera.position.set(this.playerPos.x + sx, this.playerPos.y + 1.66 + sy, this.playerPos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    // 3. Shooting & Reloading
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if ((this.mouseDown || this.mobileShooting) && wStats.automatic) {
      this.tryShoot();
    }

    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.ammoMap[this.equippedWeapon] = wStats.magSize;
      }
    }

    // Viewmodel recoil & reload animation
    this.recoilOffset = THREE.MathUtils.damp(this.recoilOffset, 0, 16, dt);
    if (this.viewWeapon) {
      const targetX = this.aiming ? 0.06 : 0.24;
      const targetY = this.reloading ? -0.38 : this.aiming ? -0.17 : -0.22;
      const targetZ = -0.45 + this.recoilOffset;
      this.viewWeapon.group.position.x = THREE.MathUtils.damp(this.viewWeapon.group.position.x, targetX, 16, dt);
      this.viewWeapon.group.position.y = THREE.MathUtils.damp(this.viewWeapon.group.position.y, targetY, 14, dt);
      this.viewWeapon.group.position.z = THREE.MathUtils.damp(this.viewWeapon.group.position.z, targetZ, 22, dt);
      this.viewWeapon.group.rotation.x = this.reloading ? -0.45 : this.recoilOffset * 1.4;

      if (this.muzzleFlashTimer > 0) {
        this.muzzleFlashTimer -= dt;
        (this.viewWeapon.flashMesh.material as THREE.MeshBasicMaterial).opacity = 0.92;
        this.viewWeapon.flashMesh.rotation.z = Math.random() * Math.PI;
      } else {
        (this.viewWeapon.flashMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        this.muzzleLight.intensity = 0;
      }
    }

    // 4. Remote Teammates Interpolation & Animation
    for (const rp of this.remotePlayers.values()) {
      rp.model.group.visible = rp.data.alive;
      if (!rp.data.alive) continue;
      const moveDist = _v1.subVectors(rp.targetPos, rp.model.group.position).length();
      rp.model.group.position.x = THREE.MathUtils.damp(rp.model.group.position.x, rp.targetPos.x, 12, dt);
      rp.model.group.position.y = THREE.MathUtils.damp(rp.model.group.position.y, rp.targetPos.y, 12, dt);
      rp.model.group.position.z = THREE.MathUtils.damp(rp.model.group.position.z, rp.targetPos.z, 12, dt);
      rp.model.group.rotation.y = rp.targetYaw + Math.PI;
      if (moveDist > 0.03) {
        rp.walkPhase += dt * 10;
        rp.model.leftLeg.rotation.x = Math.sin(rp.walkPhase) * 0.55;
        rp.model.rightLeg.rotation.x = -Math.sin(rp.walkPhase) * 0.55;
      } else {
        rp.model.leftLeg.rotation.x = THREE.MathUtils.damp(rp.model.leftLeg.rotation.x, 0, 10, dt);
        rp.model.rightLeg.rotation.x = THREE.MathUtils.damp(rp.model.rightLeg.rotation.x, 0, 10, dt);
      }
    }

    // 5. Monsters Interpolation, Limb Gait, Hit Flash & Billboard HP Bar
    for (const m of this.monsters.values()) {
      m.model.group.position.x = THREE.MathUtils.damp(m.model.group.position.x, m.targetX, 10, dt);
      m.model.group.position.z = THREE.MathUtils.damp(m.model.group.position.z, m.targetZ, 10, dt);
      m.model.group.rotation.y = m.targetYaw;

      m.walkPhase += dt * (m.type === 'runner' || m.type === 'crawler' ? 12 : 7);
      m.model.leftLeg.rotation.x = Math.sin(m.walkPhase) * 0.45;
      m.model.rightLeg.rotation.x = -Math.sin(m.walkPhase) * 0.45;

      const armSwing = m.attacking ? -0.9 : Math.sin(m.walkPhase) * 0.25;
      m.model.leftArm.rotation.x = armSwing;
      m.model.rightArm.rotation.x = m.attacking ? -0.9 : -armSwing;

      // Hit flash feedback
      const flashing = now < m.hitFlashUntil;
      for (const part of m.model.bodyParts) {
        const mat = part.material as THREE.MeshStandardMaterial;
        if (flashing) {
          mat.emissive.setHex(0xffffff);
          mat.emissiveIntensity = 0.8;
        } else if (m.type === 'boss') {
          mat.emissive.setHex(0x450a0a);
          mat.emissiveIntensity = 0.45;
        } else if (m.type === 'phantom') {
          mat.emissive.setHex(0x312e81);
          mat.emissiveIntensity = 0.7;
        } else {
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
        }
      }

      // Billboard HP bar to camera
      m.model.hpBarGroup.lookAt(this.camera.position);
    }

    // 6. Spin Coins
    for (const c of this.coins.values()) {
      c.mesh.rotation.z += dt * 3.2;
      c.mesh.position.y = 0.55 + Math.sin(this.elapsed * 4 + c.x) * 0.1;
    }

    // 7. Update Pooled Particles & Tracers
    for (const p of this.particlePool) {
      if (p.life > 0) {
        p.life -= dt;
        p.vy -= 14 * dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y = Math.max(0.05, p.mesh.position.y + p.vy * dt);
        p.mesh.position.z += p.vz * dt;
        p.mesh.scale.setScalar(Math.max(0.1, p.life / p.maxLife));
        if (p.life <= 0) p.mesh.visible = false;
      }
    }

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.life -= dt;
      if (tr.life <= 0) {
        this.scene.remove(tr.line);
        tr.line.geometry.dispose();
        (tr.line.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }

    // 8. Send player state at 20Hz
    if (now - this.lastNetworkSync >= 50) {
      this.lastNetworkSync = now;
      this.callbacks.onPlayerStateSend({
        x: this.playerPos.x,
        y: this.playerPos.y,
        z: this.playerPos.z,
        yaw: this.yaw,
        pitch: this.pitch,
        weaponId: this.equippedWeapon,
        reloading: this.reloading,
      });
    }

    // 9. Emit HUD snapshot at ~15Hz
    if (now - this.lastHudEmit >= 65) {
      this.lastHudEmit = now;
      const firstMate = this.remotePlayers.values().next().value;
      const mapDef = MAPS[this.currentMapId];
      this.callbacks.onHudUpdate({
        hp: this.localHp,
        maxHp: this.localMaxHp,
        alive: this.localAlive,
        ammo: this.ammoMap[this.equippedWeapon] ?? wStats.magSize,
        maxAmmo: wStats.magSize,
        reloading: this.reloading,
        reloadProgress: this.reloading ? 1 - Math.max(0, this.reloadTimer / this.reloadDuration) : 1,
        weaponId: this.equippedWeapon,
        weaponName: wStats.name,
        kills: this.localKills,
        score: this.localScore,
        coinsEarned: this.localCoinsEarned,
        healthPurchasesUsed: this.localHealthPurchasesUsed,
        wave: this.wave,
        maxWaves: this.maxWaves,
        waveState: this.waveState,
        elapsedSec: this.matchElapsedSec,
        monstersRemaining: this.monstersRemaining,
        flashlightOn: this.flashlightOn,
        pointerLocked: document.pointerLockElement === this.renderer.domElement,
        teammate: firstMate
          ? {
              username: firstMate.data.username,
              hp: firstMate.data.hp,
              maxHp: firstMate.data.maxHp,
              alive: firstMate.data.alive,
              x: firstMate.model.group.position.x,
              z: firstMate.model.group.position.z,
            }
          : null,
        minimap: {
          arenaHalfSize: mapDef.arenaHalfSize,
          playerX: this.playerPos.x,
          playerZ: this.playerPos.z,
          playerYaw: this.yaw,
          monsters: Array.from(this.monsters.values()).map((m) => ({
            x: m.model.group.position.x,
            z: m.model.group.position.z,
            isBoss: m.type === 'boss',
          })),
          coins: Array.from(this.coins.values()).map((c) => ({ x: c.x, z: c.z })),
        },
      });
    }
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    this.renderer.domElement.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('wheel', this.onWheel);
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('resize', this.onResize);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);

    if (this.builtMap) this.builtMap.dispose();
    this.textures.dispose();
    this.coinGeo.dispose();
    this.coinMat.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
