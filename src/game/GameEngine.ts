import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  DEFAULT_LOADOUT,
  EquippedLoadout,
  GAME_MODES,
  GameModeId,
  getHealthPurchaseCost,
  getWeaponStatsAtLevel,
  MapId,
  MAPS,
  MonsterType,
  resolveCircleObstacles,
  segmentHitsObstacleDist,
  WEAPON_ORDER,
  WeaponClass,
  WeaponId,
} from '../shared/gameData';
import { audioEngine } from './audio';
import { buildHorrorMap, BuiltMapHandle } from './maps';
import {
  buildMedkitModel,
  buildMonsterModel,
  buildPlayerCharacterModel,
  buildProjectileMesh,
  buildWeaponModel,
  MonsterModelHandle,
  PlayerModelHandle,
  WeaponModelHandle,
} from './models';
import { createProceduralTextures, ProceduralTextureSet } from './textures';

export type CameraViewMode = '1st' | '2nd' | '3rd';

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
  weaponClass: WeaponClass;
  isMelee: boolean;
  kills: number;
  score: number;
  coinsEarned: number;
  healthPurchasesUsed: number;
  medkitCost: number;
  wave: number;
  maxWaves: number;
  waveState: 'combat' | 'intermission';
  elapsedSec: number;
  monstersRemaining: number;
  flashlightOn: boolean;
  pointerLocked: boolean;
  cameraView: CameraViewMode;
  gameMode: GameModeId;
  pausedBy: string[];
  boss: { name: string; hp: number; maxHp: number } | null;
  duel?: {
    round: number;
    roundsToWin: number;
    roundState: 'fighting' | 'intermission';
    roundTimeLeftSec: number;
    roundScores: Record<string, number>;
    roundWinnerId: string | null;
  };
  teammate: {
    playerId: string;
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
    opponent: { x: number; z: number; alive: boolean } | null;
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
  pausedBy?: string[];
  gameMode?: GameModeId;
  duel?: {
    round: number;
    roundsToWin: number;
    roundState: 'fighting' | 'intermission';
    roundTimeLeftSec: number;
    roundScores: Record<string, number>;
    roundWinnerId: string | null;
  };
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
  projectiles?: Array<{ id: string; kind: string; x: number; y: number; z: number }>;
  fireZones?: Array<{ id: string; kind: string; x: number; z: number; radius: number; color: string }>;
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
  onThrow: (payload: {
    weaponId: WeaponId;
    ox: number;
    oy: number;
    oz: number;
    dx: number;
    dy: number;
    dz: number;
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
  private localLoadout: EquippedLoadout = DEFAULT_LOADOUT;
  private localPlayerModel: PlayerModelHandle | null = null;
  private localWalkPhase = 0;
  private cameraView: CameraViewMode = '1st';
  private typingChat = false;
  private ownedWeapons: Record<string, { upgradeLevel: number }> = { pistol: { upgradeLevel: 1 } };
  private equippedWeapon: WeaponId = 'pistol';
  private weaponSkinId = 'wskin_factory';
  private ammoMap: Record<string, number> = {};
  private reloading = false;
  private reloadTimer = 0;
  private reloadDuration = 1;
  private fireCooldown = 0;
  private meleeSwingTimer = 0;
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

  // Viewmodel & Flashlight & Medkit
  private viewModelAnchor = new THREE.Group();
  private viewWeapon: WeaponModelHandle | null = null;
  private medkitGroup = buildMedkitModel();
  private medkitAnimTimer = 0;
  private recoilOffset = 0;
  private muzzleFlashTimer = 0;
  private muzzleLight = new THREE.PointLight(0xffb84d, 0, 9);
  private flashlight: THREE.SpotLight;
  private flashlightTarget = new THREE.Object3D();
  private laserLine: THREE.Line;

  // Input state (continuous held vs edge justPressed)
  private heldKeys = new Set<string>();
  private mouseDown = false;
  private mobileMove = { x: 0, y: 0 };
  private mobileShooting = false;

  // Authoritative synced entities
  private gameMode: GameModeId = 'unlimited';
  private duelState: ServerStatePacket['duel'] | undefined = undefined;
  private pausedBy: string[] = [];
  private activeBoss: { name: string; hp: number; maxHp: number } | null = null;
  private wave = 1;
  private maxWaves = 0;
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
  private projectiles = new Map<string, { kind: string; mesh: THREE.Group }>();
  private fireZones = new Map<string, { mesh: THREE.Mesh; radius: number }>();
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
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
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
    const roomEnv = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(roomEnv, 0.04).texture;
    roomEnv.dispose();
    pmrem.dispose();

    this.textures = createProceduralTextures(this.renderer);

    // Camera-attached Viewmodel, Medkit & Flashlight
    this.camera.add(this.viewModelAnchor);
    this.medkitGroup.position.set(-0.2, -0.45, -0.45);
    this.medkitGroup.rotation.set(0.35, 0.2, -0.45);
    this.medkitGroup.visible = false;
    this.camera.add(this.medkitGroup);
    this.camera.add(this.muzzleLight);
    this.muzzleLight.position.set(0.22, -0.15, -0.7);

    this.flashlight = new THREE.SpotLight(0xeef6ff, 16, 42, Math.PI / 5.2, 0.45, 1.3);
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

    // Pre-allocate tracer pool (Zero GC during gun spam)
    for (let i = 0; i < 24; i++) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const mat = new THREE.LineBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.85 });
      const line = new THREE.Line(geo, mat);
      line.visible = false;
      line.frustumCulled = false;
      this.scene.add(line);
      this.tracers.push({ line, life: 0 });
    }

    // Laser sight line for 2nd/3rd person tactical aim
    const laserGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -10)]);
    const laserMat = new THREE.LineBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.55 });
    this.laserLine = new THREE.Line(laserGeo, laserMat);
    this.laserLine.visible = false;
    this.laserLine.frustumCulled = false;
    this.scene.add(this.laserLine);

    this.loadMap('hospital');
    this.bindEvents();

    this.scheduleNextTick();
  }

  public loadMap(mapId: MapId) {
    this.currentMapId = mapId;
    if (this.builtMap) {
      this.scene.remove(this.builtMap.group);
      this.builtMap.dispose();
    }
    const def = MAPS[mapId];
    const modeFogMult = GAME_MODES[this.gameMode]?.fogMult || 1.0;
    this.scene.background = new THREE.Color(def.skyColor);
    this.scene.fog = new THREE.FogExp2(
      def.fogColor,
      (this.quality === 'low' ? def.fogDensity * 0.85 : def.fogDensity) * modeFogMult
    );

    this.builtMap = buildHorrorMap(mapId, this.textures, this.quality, this.isSoftwareGl);
    this.scene.add(this.builtMap.group);
  }

  public setQuality(q: 'low' | 'medium' | 'high') {
    if (this.quality === q) return;
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
    this.typingChat = false;
    this.pausedBy = [];
    this.duelState = undefined;
    this.activeBoss = null;
    this.medkitAnimTimer = 0;
    this.medkitGroup.visible = false;
    this.viewModelAnchor.visible = false;
    this.laserLine.visible = false;
    if (this.localPlayerModel) {
      this.scene.remove(this.localPlayerModel.group);
      this.localPlayerModel = null;
    }
    this.flashlight.intensity = 0;
    this.camera.rotation.set(0, 0, 0, 'XYZ');
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
    gameMode?: GameModeId;
    equippedWeapon: WeaponId;
    ownedWeapons: Record<string, { upgradeLevel: number }>;
    weaponSkinId: string;
    localLoadout?: EquippedLoadout;
    players: RemotePlayerData[];
  }) {
    this.localPlayerId = params.localPlayerId;
    this.gameMode = params.gameMode || 'unlimited';
    this.localLoadout = params.localLoadout || DEFAULT_LOADOUT;
    this.pausedBy = [];
    this.duelState = undefined;
    this.activeBoss = null;
    this.typingChat = false;
    this.ownedWeapons = params.ownedWeapons;
    this.equippedWeapon = params.equippedWeapon;
    this.weaponSkinId = params.weaponSkinId;
    this.clearMatchEntities();

    this.loadMap(params.mapId);

    for (const wid of WEAPON_ORDER) {
      const def = getWeaponStatsAtLevel(wid, this.ownedWeapons[wid]?.upgradeLevel || 1);
      this.ammoMap[wid] = def.magSize;
    }

    const mapDef = MAPS[params.mapId];
    const isDuel = Boolean(GAME_MODES[this.gameMode]?.noMonsters);
    const spawnList = isDuel ? mapDef.duelSpawns : mapDef.playerSpawns;

    params.players.forEach((p, idx) => {
      if (p.playerId === this.localPlayerId) {
        const sp = spawnList[idx % spawnList.length];
        this.playerPos.set(p.x ?? sp[0], 0, p.z ?? sp[1]);
        this.playerVelY = 0;
        this.yaw = p.yaw ?? 0;
        this.pitch = 0;
        this.camera.rotation.set(0, this.yaw, 0, 'YXZ');
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

    if (this.localPlayerModel) {
      this.scene.remove(this.localPlayerModel.group);
    }
    this.localPlayerModel = buildPlayerCharacterModel(
      { ...this.localLoadout, weapon_skin: this.weaponSkinId },
      this.equippedWeapon,
      this.textures.contactShadow
    );
    this.localPlayerModel.group.visible = this.cameraView !== '1st';
    this.scene.add(this.localPlayerModel.group);

    this.mode = 'playing';
    this.paused = false;
    this.reloading = false;
    this.medkitAnimTimer = 0;
    this.medkitGroup.visible = false;
    this.viewModelAnchor.visible = this.cameraView === '1st';
    this.flashlightOn = true;
    this.flashlight.intensity = 16;
    this.rebuildViewWeapon();
  }

  public cycleCameraView(): CameraViewMode {
    const order: CameraViewMode[] = ['1st', '2nd', '3rd'];
    const next = order[(order.indexOf(this.cameraView) + 1) % order.length];
    this.cameraView = next;
    this.viewModelAnchor.visible = next === '1st';
    if (this.localPlayerModel) {
      this.localPlayerModel.group.visible = next !== '1st' && this.localAlive;
    }
    this.laserLine.visible = next === '2nd' && this.localAlive;
    audioEngine.playUiClick();
    return next;
  }

  public setTypingChat(typing: boolean) {
    this.typingChat = typing;
    if (typing) {
      this.heldKeys.clear();
      this.mouseDown = false;
      this.mobileShooting = false;
      this.aiming = false;
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }

  public handleRoundTeleport(x: number, z: number, yaw: number) {
    this.playerPos.set(x, 0, z);
    this.playerVelY = 0;
    this.grounded = true;
    this.yaw = yaw;
    this.pitch = 0;
    this.localHp = 100;
    this.localAlive = true;
  }

  public handleExplosionFx(payload: { kind: string; x: number; y: number; z: number; radius: number; color: string }) {
    if (payload.kind !== 'slam') {
      audioEngine.playExplosion(payload.kind);
    }
    const hex = parseInt(payload.color.replace('#', ''), 16) || 0xf97316;
    this.spawnBurst(payload.x, Math.max(0.4, payload.y), payload.z, hex, 22);
    const dist = Math.hypot(this.playerPos.x - payload.x, this.playerPos.z - payload.z);
    if (dist < payload.radius * 2.5) {
      this.shakeIntensity = Math.max(this.shakeIntensity, Math.min(0.45, 0.45 * (1 - dist / (payload.radius * 2.5))));
    }
  }

  public playMedkitAnimation() {
    this.medkitAnimTimer = 0.85;
    this.medkitGroup.visible = true;
    this.spawnBurst(this.playerPos.x, this.playerPos.y + 1.2, this.playerPos.z, 0x10b981, 14);
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

    if (this.localPlayerModel) {
      this.localPlayerModel.weaponMount.clear();
      const thirdWep = buildWeaponModel(this.equippedWeapon, this.weaponSkinId);
      thirdWep.group.scale.setScalar(0.85);
      this.localPlayerModel.weaponMount.add(thirdWep.group);
    }
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
    if (stats.isMelee) return;
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
    if (this.mode === 'playing' && !this.paused && !this.typingChat && this.renderer.domElement.requestPointerLock) {
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
    this.duelState = state.duel;
    if (state.pausedBy) this.pausedBy = state.pausedBy;
    if (state.gameMode) this.gameMode = state.gameMode;

    const bossMonster = state.monsters.find((m) => m.type === 'boss');
    this.activeBoss = bossMonster
      ? { name: 'Abomination Titan', hp: bossMonster.hp, maxHp: bossMonster.maxHp }
      : null;
    audioEngine.setBossMusic(Boolean(bossMonster));

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

    // Projectiles sync (Grenades, Molotovs, RPGs, Acid bolts)
    const activeProjs = new Set<string>();
    for (const pr of state.projectiles || []) {
      activeProjs.add(pr.id);
      let entry = this.projectiles.get(pr.id);
      if (!entry) {
        const mesh = buildProjectileMesh(pr.kind);
        mesh.position.set(pr.x, pr.y, pr.z);
        this.scene.add(mesh);
        entry = { kind: pr.kind, mesh };
        this.projectiles.set(pr.id, entry);
      } else {
        entry.mesh.position.set(pr.x, pr.y, pr.z);
        entry.mesh.rotation.x += 0.25;
        entry.mesh.rotation.y += 0.2;
      }
    }
    for (const [pid, pr] of this.projectiles.entries()) {
      if (!activeProjs.has(pid)) {
        this.scene.remove(pr.mesh);
        this.projectiles.delete(pid);
      }
    }

    // Fire & Shock Ground Zones sync
    const activeZones = new Set<string>();
    for (const fz of state.fireZones || []) {
      activeZones.add(fz.id);
      if (!this.fireZones.has(fz.id)) {
        const geo = new THREE.CylinderGeometry(fz.radius, fz.radius, 0.08, 24);
        const mat = new THREE.MeshBasicMaterial({
          color: fz.color || '#f97316',
          transparent: true,
          opacity: 0.42,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(fz.x, 0.06, fz.z);
        this.scene.add(mesh);
        this.fireZones.set(fz.id, { mesh, radius: fz.radius });
      }
    }
    for (const [zid, zEntry] of this.fireZones.entries()) {
      if (!activeZones.has(zid)) {
        this.scene.remove(zEntry.mesh);
        zEntry.mesh.geometry.dispose();
        (zEntry.mesh.material as THREE.Material).dispose();
        this.fireZones.delete(zid);
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
    const tr = this.tracers.find((t) => t.life <= 0) || this.tracers[0];
    if (!tr) return;
    const posAttr = tr.line.geometry.getAttribute('position') as THREE.BufferAttribute;
    posAttr.setXYZ(0, ox, oy, oz);
    posAttr.setXYZ(1, ox + dx * 32, oy + dy * 32, oz + dz * 32);
    posAttr.needsUpdate = true;
    (tr.line.material as THREE.LineBasicMaterial).color.setHex(colorHex);
    tr.line.visible = true;
    tr.life = 0.065;
  }

  private tryShoot() {
    if (this.mode !== 'playing' || this.paused || this.pausedBy.length > 0 || !this.localAlive || this.reloading) return;
    if (this.fireCooldown > 0) return;

    const lvl = this.ownedWeapons[this.equippedWeapon]?.upgradeLevel || 1;
    const stats = getWeaponStatsAtLevel(this.equippedWeapon, lvl);

    if (!stats.isMelee) {
      const currentAmmo = this.ammoMap[this.equippedWeapon] ?? stats.magSize;
      if (currentAmmo <= 0) {
        this.triggerReload();
        return;
      }
      this.ammoMap[this.equippedWeapon] = currentAmmo - 1;
    }

    const modeRateMult = GAME_MODES[this.gameMode]?.fireRateMult || 1.0;
    this.fireCooldown = 1 / (stats.fireRate * modeRateMult);
    this.recoilOffset = Math.min(0.16, this.recoilOffset + stats.recoil);
    this.pitch = Math.min(1.35, this.pitch + stats.recoil * 0.25);
    this.shakeIntensity = Math.min(0.22, this.shakeIntensity + stats.recoil * 0.85);

    if (stats.isMelee) {
      this.meleeSwingTimer = 0.24;
    } else if (!stats.isThrowable) {
      this.muzzleFlashTimer = 0.055;
      this.muzzleLight.intensity = 10;
    }
    audioEngine.playGunshot(this.equippedWeapon);

    // Cast from player eye position so 1st, 2nd, and 3rd person aim stays accurate
    _euler.set(this.pitch, this.yaw, 0, 'YXZ');
    const ox = this.playerPos.x;
    const oy = this.playerPos.y + 1.56;
    const oz = this.playerPos.z;

    if (stats.isThrowable || stats.isRocket) {
      _dir.set(0, 0, -1).applyEuler(_euler);
      this.callbacks.onThrow({
        weaponId: this.equippedWeapon,
        ox,
        oy,
        oz,
        dx: _dir.x,
        dy: _dir.y,
        dz: _dir.z,
      });
      if ((this.ammoMap[this.equippedWeapon] ?? 0) <= 0) {
        this.triggerReload();
      }
      return;
    }

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

    if (stats.isFlamethrower) {
      this.spawnBurst(
        ox + rays[0].dx * 2.1,
        oy - 0.1 + rays[0].dy * 2.1,
        oz + rays[0].dz * 2.1,
        0xfb923c,
        8
      );
    } else if (!stats.isMelee) {
      const tracerStart =
        this.cameraView === '1st'
          ? _v1.set(0.22, -0.14, -0.75).applyEuler(_euler).add(this.camera.position)
          : _v1.set(ox + rays[0].dx * 0.65, oy - 0.12, oz + rays[0].dz * 0.65);
      this.spawnTracer(
        tracerStart.x,
        tracerStart.y,
        tracerStart.z,
        rays[0].dx,
        rays[0].dy,
        rays[0].dz,
        this.equippedWeapon === 'plasma' || this.equippedWeapon === 'plasma_cannon'
          ? 0x38bdf8
          : 0xfde047
      );
    }

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

    if (!stats.isMelee && (this.ammoMap[this.equippedWeapon] ?? 0) <= 0) {
      this.triggerReload();
    }
  }

  private resolvePlayerObstacles(x: number, z: number): { x: number; z: number } {
    const pushed = resolveCircleObstacles(x, z, 0.55, MAPS[this.currentMapId]);
    return { x: pushed.x, z: pushed.z };
  }

  private clearMatchEntities() {
    for (const rp of this.remotePlayers.values()) this.scene.remove(rp.model.group);
    this.remotePlayers.clear();
    for (const m of this.monsters.values()) this.scene.remove(m.model.group);
    this.monsters.clear();
    for (const c of this.coins.values()) this.scene.remove(c.mesh);
    this.coins.clear();
    for (const pr of this.projectiles.values()) this.scene.remove(pr.mesh);
    this.projectiles.clear();
    for (const fz of this.fireZones.values()) {
      this.scene.remove(fz.mesh);
      fz.mesh.geometry.dispose();
      (fz.mesh.material as THREE.Material).dispose();
    }
    this.fireZones.clear();
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.typingChat) return;
    this.heldKeys.add(e.code);
    if (this.mode !== 'playing') return;

    if (e.code === 'Escape') {
      this.callbacks.onPauseRequest();
      return;
    }
    if (this.paused) return;

    if (e.code === 'KeyR') this.triggerReload();
    if (e.code === 'KeyF') this.toggleFlashlight();
    if (e.code === 'KeyC') this.cycleCameraView();
    if (e.code === 'KeyQ') this.cycleWeapon(1);
    if (e.code === 'KeyH' || e.code === 'KeyB') this.callbacks.onBuyHealthRequest();
    if (e.code === 'Space') this.triggerJump();

    if (e.code.startsWith('Digit')) {
      const num = parseInt(e.code.replace('Digit', ''), 10);
      const unlocked = WEAPON_ORDER.filter((w) => Boolean(this.ownedWeapons[w]));
      if (num >= 1 && num <= unlocked.length) {
        this.switchWeapon(unlocked[num - 1]);
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
    if (this.mode !== 'playing' || this.paused || this.typingChat) return;
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
    const lvl = this.ownedWeapons[this.equippedWeapon]?.upgradeLevel || 1;
    const wStats = getWeaponStatsAtLevel(this.equippedWeapon, lvl);
    const mapDef = MAPS[this.currentMapId];
    let isMoving = false;

    if (this.localAlive && this.pausedBy.length === 0) {
      const forward = (this.heldKeys.has('KeyW') ? 1 : 0) - (this.heldKeys.has('KeyS') ? 1 : 0) - this.mobileMove.y;
      const strafe = (this.heldKeys.has('KeyD') ? 1 : 0) - (this.heldKeys.has('KeyA') ? 1 : 0) + this.mobileMove.x;
      const sprinting = this.heldKeys.has('ShiftLeft') || this.heldKeys.has('ShiftRight');
      const modeSpeedMult = GAME_MODES[this.gameMode]?.playerSpeedMult || 1.0;

      const speed = 7.6 * wStats.moveSpeedMult * modeSpeedMult * (sprinting && !this.aiming ? 1.32 : this.aiming ? 0.68 : 1.0);
      const len = Math.hypot(forward, strafe);
      if (len > 0.05) {
        isMoving = true;
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

    // 2. Camera FOV, Shake, and 1st / 2nd / 3rd Person Camera Positioning
    const targetFov = this.aiming ? (wStats.weaponClass === 'sniper' ? 38 : 54) : 72;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 14, dt);
      this.camera.updateProjectionMatrix();
    }

    this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 12, dt);
    const sx = (Math.random() - 0.5) * this.shakeIntensity * 0.25;
    const sy = (Math.random() - 0.5) * this.shakeIntensity * 0.25;

    if (this.localPlayerModel) {
      this.localPlayerModel.group.visible = this.cameraView !== '1st' && this.localAlive;
      this.localPlayerModel.group.position.copy(this.playerPos);
      this.localPlayerModel.group.rotation.y = this.yaw + Math.PI;
      if (isMoving) {
        this.localWalkPhase += dt * 11;
        this.localPlayerModel.leftLeg.rotation.x = Math.sin(this.localWalkPhase) * 0.55;
        this.localPlayerModel.rightLeg.rotation.x = -Math.sin(this.localWalkPhase) * 0.55;
      } else {
        this.localPlayerModel.leftLeg.rotation.x = THREE.MathUtils.damp(this.localPlayerModel.leftLeg.rotation.x, 0, 10, dt);
        this.localPlayerModel.rightLeg.rotation.x = THREE.MathUtils.damp(this.localPlayerModel.rightLeg.rotation.x, 0, 10, dt);
      }
    }

    if (this.cameraView === '1st') {
      this.laserLine.visible = false;
      this.camera.position.set(this.playerPos.x + sx, this.playerPos.y + 1.66 + sy, this.playerPos.z);
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    } else {
      _euler.set(this.pitch, this.yaw, 0, 'YXZ');
      const forwardDir = _v1.set(0, 0, -1).applyEuler(_euler).normalize();
      const rightDir = _v2.set(1, 0, 0).applyEuler(_euler).normalize();
      const anchorX = this.playerPos.x;
      const anchorY = this.playerPos.y + 1.56;
      const anchorZ = this.playerPos.z;

      let desiredX: number;
      let desiredY: number;
      let desiredZ: number;
      let lookX: number;
      let lookY: number;
      let lookZ: number;

      if (this.cameraView === '3rd') {
        // Over-the-right-shoulder 3rd person chase camera
        desiredX = anchorX - forwardDir.x * 3.45 + rightDir.x * 0.62;
        desiredY = anchorY - forwardDir.y * 2.2 + 0.55;
        desiredZ = anchorZ - forwardDir.z * 3.45 + rightDir.z * 0.62;
        lookX = anchorX + forwardDir.x * 16;
        lookY = anchorY + forwardDir.y * 16;
        lookZ = anchorZ + forwardDir.z * 16;
      } else {
        // 2nd person: angled front-right cinematic perspective looking across operative & downrange
        desiredX = anchorX + forwardDir.x * 1.95 + rightDir.x * 1.38;
        desiredY = anchorY + 0.52;
        desiredZ = anchorZ + forwardDir.z * 1.95 + rightDir.z * 1.38;
        lookX = anchorX - forwardDir.x * 1.2;
        lookY = anchorY - 0.15;
        lookZ = anchorZ - forwardDir.z * 1.2;
      }

      // Clamp camera against walls/obstacles so walls never obstruct the view
      const camVecX = desiredX - anchorX;
      const camVecY = desiredY - anchorY;
      const camVecZ = desiredZ - anchorZ;
      const camDist = Math.hypot(camVecX, camVecY, camVecZ) || 0.01;
      const hitWall = segmentHitsObstacleDist(
        anchorX,
        anchorY,
        anchorZ,
        camVecX / camDist,
        camVecY / camDist,
        camVecZ / camDist,
        camDist,
        mapDef
      );
      const safeT = hitWall !== null ? Math.max(0.25, (hitWall - 0.35) / camDist) : 1.0;

      this.camera.position.set(
        anchorX + camVecX * safeT + sx,
        Math.max(0.55, anchorY + camVecY * safeT + sy),
        anchorZ + camVecZ * safeT
      );
      this.camera.lookAt(lookX, lookY, lookZ);

      // Update tactical laser sight in 2nd person
      this.laserLine.visible = this.cameraView === '2nd' && this.localAlive;
      if (this.laserLine.visible) {
        const lWall = segmentHitsObstacleDist(anchorX, anchorY, anchorZ, forwardDir.x, forwardDir.y, forwardDir.z, 26, mapDef);
        const lLen = lWall !== null ? lWall : 26;
        const posAttr = this.laserLine.geometry.getAttribute('position') as THREE.BufferAttribute;
        posAttr.setXYZ(0, anchorX, anchorY - 0.15, anchorZ);
        posAttr.setXYZ(1, anchorX + forwardDir.x * lLen, anchorY + forwardDir.y * lLen, anchorZ + forwardDir.z * lLen);
        posAttr.needsUpdate = true;
      }
    }

    // 3. Shooting (hold to spam all guns) & Reloading
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.mouseDown || this.mobileShooting) {
      this.tryShoot();
    }

    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.ammoMap[this.equippedWeapon] = wStats.magSize;
      }
    }

    // Viewmodel recoil, melee slash, reload & medkit syringe animation
    if (this.medkitAnimTimer > 0) {
      this.medkitAnimTimer = Math.max(0, this.medkitAnimTimer - dt);
      const p = 1 - this.medkitAnimTimer / 0.85;
      const arch = Math.sin(p * Math.PI);
      this.medkitGroup.visible = true;
      this.medkitGroup.position.set(-0.18 + arch * 0.14, -0.45 + arch * 0.28, -0.46 + arch * 0.08);
      this.medkitGroup.rotation.set(0.35 - arch * 0.6, 0.2, -0.45 + arch * 0.35);
      if (this.medkitAnimTimer <= 0) this.medkitGroup.visible = false;
    }

    if (this.meleeSwingTimer > 0) {
      this.meleeSwingTimer = Math.max(0, this.meleeSwingTimer - dt);
    }

    this.recoilOffset = THREE.MathUtils.damp(this.recoilOffset, 0, 16, dt);
    if (this.viewWeapon) {
      const dipForMedkit = this.medkitAnimTimer > 0 ? -0.18 : 0;
      const swingP = this.meleeSwingTimer > 0 ? Math.sin((1 - this.meleeSwingTimer / 0.24) * Math.PI) : 0;
      const targetX = (this.aiming ? 0.06 : 0.24) - swingP * 0.34;
      const targetY = (this.reloading ? -0.38 : this.aiming ? -0.17 : -0.22) + dipForMedkit + swingP * 0.06;
      const targetZ = -0.45 + this.recoilOffset - swingP * 0.26;
      this.viewWeapon.group.position.x = THREE.MathUtils.damp(this.viewWeapon.group.position.x, targetX, 18, dt);
      this.viewWeapon.group.position.y = THREE.MathUtils.damp(this.viewWeapon.group.position.y, targetY, 16, dt);
      this.viewWeapon.group.position.z = THREE.MathUtils.damp(this.viewWeapon.group.position.z, targetZ, 24, dt);
      this.viewWeapon.group.rotation.x = this.reloading ? -0.45 : this.recoilOffset * 1.4 - swingP * 0.9;
      this.viewWeapon.group.rotation.z = swingP * 0.75;

      if (this.muzzleFlashTimer > 0) {
        this.muzzleFlashTimer -= dt;
        (this.viewWeapon.flashMesh.material as THREE.MeshBasicMaterial).opacity = 0.92;
        this.viewWeapon.flashMesh.rotation.z = Math.random() * Math.PI;
      } else {
        (this.viewWeapon.flashMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        this.muzzleLight.intensity = 0;
      }
    }

    // 4. Remote Teammates / Opponent Interpolation & Animation
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
      m.model.group.position.x = THREE.MathUtils.damp(m.model.group.position.x, m.targetX, 12, dt);
      m.model.group.position.z = THREE.MathUtils.damp(m.model.group.position.z, m.targetZ, 12, dt);
      m.model.group.rotation.y = m.targetYaw;

      if (this.pausedBy.length === 0) {
        m.walkPhase += dt * (m.type === 'runner' || m.type === 'crawler' || m.type === 'howler' ? 12 : 7);
        m.model.leftLeg.rotation.x = Math.sin(m.walkPhase) * 0.45;
        m.model.rightLeg.rotation.x = -Math.sin(m.walkPhase) * 0.45;

        const armSwing = m.attacking ? -0.9 : Math.sin(m.walkPhase) * 0.25;
        m.model.leftArm.rotation.x = armSwing;
        m.model.rightArm.rotation.x = m.attacking ? -0.9 : -armSwing;
      }

      const flashing = now < m.hitFlashUntil;
      for (const part of m.model.bodyParts) {
        const mat = part.material as THREE.MeshStandardMaterial;
        if (flashing) {
          mat.emissive.setHex(0xffffff);
          mat.emissiveIntensity = 0.8;
        } else if (m.type === 'boss') {
          mat.emissive.setHex(0x450a0a);
          mat.emissiveIntensity = 0.5;
        } else if (m.type === 'phantom') {
          mat.emissive.setHex(0x312e81);
          mat.emissiveIntensity = 0.7;
        } else if (m.type === 'spitter') {
          mat.emissive.setHex(0x14532d);
          mat.emissiveIntensity = 0.35;
        } else if (m.type === 'howler') {
          mat.emissive.setHex(0x581c87);
          mat.emissiveIntensity = 0.35;
        } else if (m.type === 'sentinel') {
          mat.emissive.setHex(0x78350f);
          mat.emissiveIntensity = 0.35;
        } else {
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
        }
      }

      m.model.hpBarGroup.lookAt(this.camera.position);
    }

    // 6. Spin Coins & Pulse Fire Zones
    for (const c of this.coins.values()) {
      c.mesh.rotation.z += dt * 3.2;
      c.mesh.position.y = 0.55 + Math.sin(this.elapsed * 4 + c.x) * 0.1;
    }
    for (const fz of this.fireZones.values()) {
      const s = 0.94 + Math.sin(this.elapsed * 12) * 0.06;
      fz.mesh.scale.set(s, 1, s);
    }

    // 7. Update Pooled Particles & Pooled Tracers
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

    for (const tr of this.tracers) {
      if (tr.life > 0) {
        tr.life -= dt;
        if (tr.life <= 0) tr.line.visible = false;
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
      const isDuel = Boolean(GAME_MODES[this.gameMode]?.noMonsters);
      this.callbacks.onHudUpdate({
        hp: this.localHp,
        maxHp: this.localMaxHp,
        alive: this.localAlive,
        ammo: wStats.isMelee ? 1 : this.ammoMap[this.equippedWeapon] ?? wStats.magSize,
        maxAmmo: wStats.isMelee ? 1 : wStats.magSize,
        reloading: this.reloading,
        reloadProgress: this.reloading ? 1 - Math.max(0, this.reloadTimer / this.reloadDuration) : 1,
        weaponId: this.equippedWeapon,
        weaponName: wStats.name,
        weaponClass: wStats.weaponClass,
        isMelee: Boolean(wStats.isMelee),
        kills: this.localKills,
        score: this.localScore,
        coinsEarned: this.localCoinsEarned,
        healthPurchasesUsed: this.localHealthPurchasesUsed,
        medkitCost: getHealthPurchaseCost(this.localHealthPurchasesUsed),
        wave: this.wave,
        maxWaves: this.maxWaves,
        waveState: this.waveState,
        elapsedSec: this.matchElapsedSec,
        monstersRemaining: this.monstersRemaining,
        flashlightOn: this.flashlightOn,
        pointerLocked: document.pointerLockElement === this.renderer.domElement,
        cameraView: this.cameraView,
        gameMode: this.gameMode,
        pausedBy: this.pausedBy,
        boss: this.activeBoss,
        duel: this.duelState,
        teammate: firstMate
          ? {
              playerId: firstMate.data.playerId,
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
          opponent:
            isDuel && firstMate
              ? {
                  x: firstMate.model.group.position.x,
                  z: firstMate.model.group.position.z,
                  alive: firstMate.data.alive,
                }
              : null,
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
