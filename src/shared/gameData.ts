export type MapId = 'hospital' | 'forest' | 'mansion' | 'lab' | 'school';
export type DifficultyId = 'normal' | 'nightmare' | 'hell';
export type WeaponId =
  | 'pistol'
  | 'smg'
  | 'shotgun'
  | 'assault_rifle'
  | 'sniper'
  | 'lmg'
  | 'plasma';

export type MonsterType =
  | 'runner'
  | 'zombie'
  | 'crawler'
  | 'brute'
  | 'phantom'
  | 'boss';

export type CustomizationCategory =
  | 'shirt'
  | 'outfit'
  | 'skin'
  | 'mask'
  | 'gloves'
  | 'accessory'
  | 'costume'
  | 'weapon_skin';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  category: string;
  description: string;
  cost: number;
  damage: number;
  fireRate: number; // shots per second
  reloadTime: number; // seconds
  magSize: number;
  pellets: number;
  spread: number; // radians
  range: number;
  automatic: boolean;
  recoil: number;
  moveSpeedMult: number;
  color: string;
  accentColor: string;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    id: 'pistol',
    name: 'M9 Tactical',
    category: 'Sidearm',
    description: 'Standard-issue suppressed sidearm. Fast reload and reliable accuracy.',
    cost: 0,
    damage: 32,
    fireRate: 4.5,
    reloadTime: 1.1,
    magSize: 15,
    pellets: 1,
    spread: 0.012,
    range: 55,
    automatic: false,
    recoil: 0.028,
    moveSpeedMult: 1.0,
    color: '#2b303a',
    accentColor: '#94a3b8',
  },
  smg: {
    id: 'smg',
    name: 'MP5 Spectre',
    category: 'Submachine Gun',
    description: 'High-rate close-quarters SMG built for rapid corridor clearing.',
    cost: 350,
    damage: 21,
    fireRate: 11.0,
    reloadTime: 1.4,
    magSize: 32,
    pellets: 1,
    spread: 0.032,
    range: 45,
    automatic: true,
    recoil: 0.02,
    moveSpeedMult: 0.98,
    color: '#1e242d',
    accentColor: '#64748b',
  },
  shotgun: {
    id: 'shotgun',
    name: 'M870 Breacher',
    category: 'Shotgun',
    description: 'Devastating 12-gauge pump-action that shreds charging horrors up close.',
    cost: 550,
    damage: 20,
    fireRate: 1.35,
    reloadTime: 1.9,
    magSize: 8,
    pellets: 7,
    spread: 0.085,
    range: 28,
    automatic: false,
    recoil: 0.085,
    moveSpeedMult: 0.94,
    color: '#292524',
    accentColor: '#78350f',
  },
  assault_rifle: {
    id: 'assault_rifle',
    name: 'MK18 Carbine',
    category: 'Assault Rifle',
    description: 'Balanced modular rifle with lethal mid-range stopping power.',
    cost: 850,
    damage: 38,
    fireRate: 7.8,
    reloadTime: 1.6,
    magSize: 30,
    pellets: 1,
    spread: 0.02,
    range: 65,
    automatic: true,
    recoil: 0.032,
    moveSpeedMult: 0.93,
    color: '#1f2937',
    accentColor: '#475569',
  },
  sniper: {
    id: 'sniper',
    name: 'M24 Dread',
    category: 'Precision Rifle',
    description: 'High-caliber bolt-action rifle capable of staggering brutes and bosses.',
    cost: 1200,
    damage: 165,
    fireRate: 0.9,
    reloadTime: 2.1,
    magSize: 5,
    pellets: 1,
    spread: 0.002,
    range: 100,
    automatic: false,
    recoil: 0.11,
    moveSpeedMult: 0.88,
    color: '#182026',
    accentColor: '#dc2626',
  },
  lmg: {
    id: 'lmg',
    name: 'M249 Reaper',
    category: 'Heavy Machine Gun',
    description: 'Belt-fed heavy suppression platform with an 80-round box magazine.',
    cost: 1650,
    damage: 31,
    fireRate: 12.5,
    reloadTime: 2.6,
    magSize: 80,
    pellets: 1,
    spread: 0.038,
    range: 60,
    automatic: true,
    recoil: 0.036,
    moveSpeedMult: 0.84,
    color: '#262b33',
    accentColor: '#b45309',
  },
  plasma: {
    id: 'plasma',
    name: 'Arc Railgun',
    category: 'Special Experimental',
    description: 'Prototype electromagnetic rail cannon firing high-energy crimson bolts.',
    cost: 2400,
    damage: 210,
    fireRate: 1.8,
    reloadTime: 1.8,
    magSize: 8,
    pellets: 1,
    spread: 0.004,
    range: 95,
    automatic: false,
    recoil: 0.065,
    moveSpeedMult: 0.92,
    color: '#0f172a',
    accentColor: '#ef4444',
  },
};

export const WEAPON_ORDER: WeaponId[] = [
  'pistol',
  'smg',
  'shotgun',
  'assault_rifle',
  'sniper',
  'lmg',
  'plasma',
];

export function getWeaponUpgradeCost(currentLevel: number): number {
  return currentLevel * 250;
}

export function getWeaponStatsAtLevel(id: WeaponId, level: number) {
  const base = WEAPONS[id];
  const lvl = Math.max(1, Math.min(5, level));
  const dmgMult = 1 + (lvl - 1) * 0.16;
  const rofMult = 1 + (lvl - 1) * 0.06;
  return {
    ...base,
    damage: Math.round(base.damage * dmgMult),
    fireRate: Number((base.fireRate * rofMult).toFixed(2)),
    level: lvl,
  };
}

export interface CustomizationItemDef {
  id: string;
  name: string;
  category: CustomizationCategory;
  cost: number;
  color: string;
  secondaryColor?: string;
  emissive?: string;
  styleTag: string;
  description: string;
}

export const CUSTOMIZATION_ITEMS: CustomizationItemDef[] = [
  // Shirts
  { id: 'shirt_slate', name: 'Operator Tee', category: 'shirt', cost: 0, color: '#334155', styleTag: 'standard', description: 'Standard dark slate tactical undershirt.' },
  { id: 'shirt_crimson', name: 'Bloodline Compression', category: 'shirt', cost: 150, color: '#7f1d1d', styleTag: 'fitted', description: 'Reinforced deep crimson combat shirt.' },
  { id: 'shirt_obsidian', name: 'Nightwatch Thermal', category: 'shirt', cost: 220, color: '#0f172a', styleTag: 'kevlar', description: 'Ballistic-weave midnight thermal layer.' },
  { id: 'shirt_hazard', name: 'Biohazard Lab Tunic', category: 'shirt', cost: 300, color: '#ca8a04', styleTag: 'hazard', description: 'High-visibility quarantine containment top.' },

  // Outfits / Jackets
  { id: 'outfit_vest', name: 'Recon Plate Carrier', category: 'outfit', cost: 0, color: '#1e293b', secondaryColor: '#0f172a', styleTag: 'vest', description: 'Standard tactical vest with utility pouches.' },
  { id: 'outfit_trench', name: 'Hunter Trenchcoat', category: 'outfit', cost: 400, color: '#1c1917', secondaryColor: '#450a0a', styleTag: 'trench', description: 'Weathered dark leather longcoat for night hunts.' },
  { id: 'outfit_riot', name: 'Juggernaut Armor', category: 'outfit', cost: 650, color: '#27272a', secondaryColor: '#52525b', styleTag: 'heavy', description: 'Heavy ceramic-plated assault rig.' },
  { id: 'outfit_lab', name: 'Containment Rig', category: 'outfit', cost: 520, color: '#334155', secondaryColor: '#0284c7', styleTag: 'exo', description: 'Reinforced dark blue hazardous response harness.' },

  // Character Skins (tone/surface)
  { id: 'skin_default', name: 'Survivor Standard', category: 'skin', cost: 0, color: '#d6b39b', styleTag: 'human', description: 'Standard field operative.' },
  { id: 'skin_pale', name: 'Ashen Wraith', category: 'skin', cost: 280, color: '#94a3b8', styleTag: 'pale', description: 'Cold frostbitten complexion.' },
  { id: 'skin_shadow', name: 'Obsidian Operative', category: 'skin', cost: 350, color: '#3b3330', styleTag: 'dark', description: 'Camouflaged night-ops tone.' },
  { id: 'skin_cyber', name: 'Synth Alloy', category: 'skin', cost: 600, color: '#475569', emissive: '#38bdf8', styleTag: 'synth', description: 'Synthetic titanium-plated combat frame.' },

  // Masks
  { id: 'mask_none', name: 'No Mask', category: 'mask', cost: 0, color: '#000000', styleTag: 'none', description: 'Clear line of sight without headgear.' },
  { id: 'mask_gas', name: 'M50 Gas Mask', category: 'mask', cost: 250, color: '#18181b', secondaryColor: '#dc2626', emissive: '#7f1d1d', styleTag: 'gasmask', description: 'Dual-filter respirator with crimson lenses.' },
  { id: 'mask_skull', name: 'Reaper Balaclava', category: 'mask', cost: 420, color: '#09090b', secondaryColor: '#e2e8f0', styleTag: 'skull', description: 'Bone-plated intimidation mask.' },
  { id: 'mask_nvg', name: 'Quad-Optic NVG', category: 'mask', cost: 580, color: '#0f172a', emissive: '#22d3ee', styleTag: 'nvg', description: 'Four-tube tactical night vision visor.' },
  { id: 'mask_oni', name: 'Crimson Oni', category: 'mask', cost: 750, color: '#7f1d1d', secondaryColor: '#f8fafc', emissive: '#ef4444', styleTag: 'oni', description: 'Ceremonial horned horror mask.' },

  // Gloves
  { id: 'gloves_std', name: 'Fingerless Wraps', category: 'gloves', cost: 0, color: '#1e293b', styleTag: 'wraps', description: 'Lightweight combat hand wraps.' },
  { id: 'gloves_red', name: 'Crimson Gauntlets', category: 'gloves', cost: 180, color: '#991b1b', styleTag: 'plated', description: 'Armored knuckle gauntlets.' },
  { id: 'gloves_steel', name: 'Tungsten Grips', category: 'gloves', cost: 260, color: '#475569', styleTag: 'steel', description: 'Reinforced metal-weave shooting gloves.' },

  // Accessories
  { id: 'acc_none', name: 'None', category: 'accessory', cost: 0, color: '#000000', styleTag: 'none', description: 'No back attachment.' },
  { id: 'acc_pack', name: 'Medic Field Pack', category: 'accessory', cost: 240, color: '#334155', secondaryColor: '#dc2626', styleTag: 'backpack', description: 'Tactical trauma backpack.' },
  { id: 'acc_tank', name: 'Cryo Fuel Tank', category: 'accessory', cost: 450, color: '#1e3a8a', emissive: '#38bdf8', styleTag: 'tank', description: 'Pressurized back canister with blue gauge.' },
  { id: 'acc_katana', name: 'Carbon Blade Sheath', category: 'accessory', cost: 550, color: '#09090b', secondaryColor: '#dc2626', styleTag: 'blade', description: 'Diagonal ceremonial survival blade.' },

  // Special Costumes (override aura/accent)
  { id: 'costume_none', name: 'Standard Gear', category: 'costume', cost: 0, color: '#1e293b', styleTag: 'none', description: 'Use individual shirt and outfit pieces.' },
  { id: 'costume_plague', name: 'Plague Doctor', category: 'costume', cost: 900, color: '#09090b', secondaryColor: '#78350f', emissive: '#b91c1c', styleTag: 'plague', description: 'Dark Victorian coat with crimson trim.' },
  { id: 'costume_spectral', name: 'Spectral Warden', category: 'costume', cost: 1350, color: '#0f172a', secondaryColor: '#1d4ed8', emissive: '#60a5fa', styleTag: 'spectral', description: 'Ghostly cold-blue armored shroud.' },

  // Weapon Skins
  { id: 'wskin_factory', name: 'Factory Matte', category: 'weapon_skin', cost: 0, color: '#1f2937', accentColor: '#64748b', styleTag: 'matte', description: 'Standard parkerized steel finish.' } as CustomizationItemDef & { accentColor?: string },
  { id: 'wskin_blood', name: 'Crimson Vein', category: 'weapon_skin', cost: 350, color: '#450a0a', secondaryColor: '#ef4444', emissive: '#7f1d1d', styleTag: 'blood', description: 'Deep blood-anodized finish.' },
  { id: 'wskin_cobalt', name: 'Cobalt Night', category: 'weapon_skin', cost: 450, color: '#0f172a', secondaryColor: '#3b82f6', emissive: '#1d4ed8', styleTag: 'cobalt', description: 'Cold tactical blue steel finish.' },
  { id: 'wskin_gold', name: 'Gilded Mercenary', category: 'weapon_skin', cost: 850, color: '#78350f', secondaryColor: '#f59e0b', emissive: '#b45309', styleTag: 'gold', description: 'Brushed brass & gold alloy plating.' },
];

export interface EquippedLoadout {
  shirt: string;
  outfit: string;
  skin: string;
  mask: string;
  gloves: string;
  accessory: string;
  costume: string;
  weapon_skin: string;
}

export const DEFAULT_LOADOUT: EquippedLoadout = {
  shirt: 'shirt_slate',
  outfit: 'outfit_vest',
  skin: 'skin_default',
  mask: 'mask_none',
  gloves: 'gloves_std',
  accessory: 'acc_none',
  costume: 'costume_none',
  weapon_skin: 'wskin_factory',
};

export interface ObstacleBox {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  kind: 'wall' | 'pillar' | 'prop' | 'tree' | 'pod' | 'desk' | 'table';
}

export interface MapDef {
  id: MapId;
  name: string;
  subtitle: string;
  difficultyRating: number; // 1-5
  arenaHalfSize: number;
  outdoor: boolean;
  skyColor: string;
  fogColor: string;
  fogDensity: number;
  ambientColor: string;
  lightColor: string;
  floorColor: string;
  wallColor: string;
  accentLightColor: string;
  description: string;
  playerSpawns: [number, number][];
  monsterSpawns: [number, number][];
  supplyCaches: [number, number][];
  obstacles: ObstacleBox[];
}

export const MAPS: Record<MapId, MapDef> = {
  hospital: {
    id: 'hospital',
    name: 'Abandoned Hospital',
    subtitle: 'St. Jude Quarantine Wing',
    difficultyRating: 2,
    arenaHalfSize: 28,
    outdoor: false,
    skyColor: '#05080d',
    fogColor: '#070b12',
    fogDensity: 0.032,
    ambientColor: '#1e293b',
    lightColor: '#93c5fd',
    floorColor: '#1e242b',
    wallColor: '#2d3748',
    accentLightColor: '#dc2626',
    description: 'Flooded surgical corridors with flickering emergency beacons and tight ward bottlenecks.',
    playerSpawns: [
      [-2, 2],
      [2, 2],
    ],
    monsterSpawns: [
      [-22, -22],
      [22, -22],
      [-22, 22],
      [22, 22],
      [0, -24],
      [24, 0],
    ],
    supplyCaches: [
      [-16, 0],
      [16, 0],
      [0, -16],
    ],
    obstacles: [
      { x: -10, z: -10, w: 6, h: 3.6, d: 1.2, kind: 'wall' },
      { x: 10, z: -10, w: 6, h: 3.6, d: 1.2, kind: 'wall' },
      { x: -10, z: 10, w: 6, h: 3.6, d: 1.2, kind: 'wall' },
      { x: 10, z: 10, w: 6, h: 3.6, d: 1.2, kind: 'wall' },
      { x: 0, z: -8, w: 2.2, h: 3.8, d: 2.2, kind: 'pillar' },
      { x: 0, z: 12, w: 2.2, h: 3.8, d: 2.2, kind: 'pillar' },
      { x: -17, z: 0, w: 1.4, h: 3.6, d: 7, kind: 'wall' },
      { x: 17, z: 0, w: 1.4, h: 3.6, d: 7, kind: 'wall' },
      { x: -6, z: 0, w: 2.4, h: 1.0, d: 1.2, kind: 'prop' },
      { x: 6, z: -2, w: 2.4, h: 1.0, d: 1.2, kind: 'prop' },
      { x: -18, z: -16, w: 2.2, h: 1.4, d: 2.2, kind: 'prop' },
      { x: 18, z: 16, w: 2.2, h: 1.4, d: 2.2, kind: 'prop' },
    ],
  },
  forest: {
    id: 'forest',
    name: 'Dark Forest',
    subtitle: 'Blackhollow Pines',
    difficultyRating: 3,
    arenaHalfSize: 34,
    outdoor: true,
    skyColor: '#04070c',
    fogColor: '#060c14',
    fogDensity: 0.036,
    ambientColor: '#1e293b',
    lightColor: '#60a5fa',
    floorColor: '#121814',
    wallColor: '#1f2937',
    accentLightColor: '#f59e0b',
    description: 'Fog-choked midnight woodland where fast creatures stalk between ancient pine trunks and boulders.',
    playerSpawns: [
      [-2.5, 0],
      [2.5, 0],
    ],
    monsterSpawns: [
      [-28, -28],
      [28, -28],
      [-28, 28],
      [28, 28],
      [0, -30],
      [0, 30],
    ],
    supplyCaches: [
      [-18, -12],
      [18, 12],
      [0, 18],
    ],
    obstacles: [
      { x: -8, z: -7, w: 1.5, h: 8, d: 1.5, kind: 'tree' },
      { x: 9, z: -6, w: 1.6, h: 8, d: 1.6, kind: 'tree' },
      { x: -11, z: 9, w: 1.6, h: 8, d: 1.6, kind: 'tree' },
      { x: 10, z: 11, w: 1.5, h: 8, d: 1.5, kind: 'tree' },
      { x: -19, z: -3, w: 1.8, h: 8, d: 1.8, kind: 'tree' },
      { x: 19, z: 3, w: 1.8, h: 8, d: 1.8, kind: 'tree' },
      { x: 0, z: -15, w: 1.7, h: 8, d: 1.7, kind: 'tree' },
      { x: -15, z: -19, w: 3.4, h: 2.1, d: 2.8, kind: 'prop' },
      { x: 16, z: -18, w: 3.2, h: 1.9, d: 3.0, kind: 'prop' },
      { x: -16, z: 18, w: 3.0, h: 2.2, d: 2.8, kind: 'prop' },
      { x: 17, z: 19, w: 3.4, h: 2.0, d: 3.0, kind: 'prop' },
      { x: 0, z: 13, w: 3.6, h: 1.6, d: 2.0, kind: 'prop' },
    ],
  },
  mansion: {
    id: 'mansion',
    name: 'Haunted Mansion',
    subtitle: 'Ravenscroft Estate',
    difficultyRating: 3,
    arenaHalfSize: 28,
    outdoor: false,
    skyColor: '#07050a',
    fogColor: '#0b0810',
    fogDensity: 0.03,
    ambientColor: '#272030',
    lightColor: '#cbd5e1',
    floorColor: '#241a18',
    wallColor: '#2e2226',
    accentLightColor: '#dc2626',
    description: 'Candlelit manor hall with marble pillars, banquet tables, and blood-stained alcoves.',
    playerSpawns: [
      [-2, 4],
      [2, 4],
    ],
    monsterSpawns: [
      [-23, -23],
      [23, -23],
      [-23, 20],
      [23, 20],
      [0, -24],
    ],
    supplyCaches: [
      [-18, -2],
      [18, -2],
      [0, -18],
    ],
    obstacles: [
      { x: -8, z: -8, w: 1.8, h: 4.5, d: 1.8, kind: 'pillar' },
      { x: 8, z: -8, w: 1.8, h: 4.5, d: 1.8, kind: 'pillar' },
      { x: -8, z: 8, w: 1.8, h: 4.5, d: 1.8, kind: 'pillar' },
      { x: 8, z: 8, w: 1.8, h: 4.5, d: 1.8, kind: 'pillar' },
      { x: 0, z: -5, w: 5.5, h: 1.1, d: 2.0, kind: 'table' },
      { x: -16, z: 0, w: 1.4, h: 4.2, d: 8, kind: 'wall' },
      { x: 16, z: 0, w: 1.4, h: 4.2, d: 8, kind: 'wall' },
      { x: -14, z: -16, w: 5, h: 4.2, d: 1.3, kind: 'wall' },
      { x: 14, z: -16, w: 5, h: 4.2, d: 1.3, kind: 'wall' },
      { x: 0, z: 16, w: 6, h: 4.2, d: 1.3, kind: 'wall' },
    ],
  },
  lab: {
    id: 'lab',
    name: 'Underground Laboratory',
    subtitle: 'Sector 09 Bio-Vault',
    difficultyRating: 4,
    arenaHalfSize: 30,
    outdoor: false,
    skyColor: '#030811',
    fogColor: '#050d1a',
    fogDensity: 0.028,
    ambientColor: '#172554',
    lightColor: '#38bdf8',
    floorColor: '#131b26',
    wallColor: '#1e293b',
    accentLightColor: '#ef4444',
    description: 'Cryo-containment chambers and steel catwalk dividers where mutated specimens broke loose.',
    playerSpawns: [
      [-2, 2],
      [2, 2],
    ],
    monsterSpawns: [
      [-25, -25],
      [25, -25],
      [-25, 25],
      [25, 25],
      [0, -26],
      [-26, 0],
      [26, 0],
    ],
    supplyCaches: [
      [-14, -14],
      [14, 14],
      [0, 16],
    ],
    obstacles: [
      { x: -9, z: -9, w: 2.4, h: 3.8, d: 2.4, kind: 'pod' },
      { x: 9, z: -9, w: 2.4, h: 3.8, d: 2.4, kind: 'pod' },
      { x: -9, z: 9, w: 2.4, h: 3.8, d: 2.4, kind: 'pod' },
      { x: 9, z: 9, w: 2.4, h: 3.8, d: 2.4, kind: 'pod' },
      { x: 0, z: -15, w: 7, h: 3.6, d: 1.4, kind: 'wall' },
      { x: 0, z: 15, w: 7, h: 3.6, d: 1.4, kind: 'wall' },
      { x: -18, z: 0, w: 1.5, h: 3.6, d: 8, kind: 'wall' },
      { x: 18, z: 0, w: 1.5, h: 3.6, d: 8, kind: 'wall' },
      { x: -4, z: 0, w: 1.8, h: 1.4, d: 1.8, kind: 'prop' },
      { x: 4, z: 0, w: 1.8, h: 1.4, d: 1.8, kind: 'prop' },
    ],
  },
  school: {
    id: 'school',
    name: 'Abandoned School',
    subtitle: 'Oakridge Academy',
    difficultyRating: 5,
    arenaHalfSize: 30,
    outdoor: false,
    skyColor: '#08090c',
    fogColor: '#0c0e13',
    fogDensity: 0.032,
    ambientColor: '#1f2937',
    lightColor: '#9ca3af',
    floorColor: '#262420',
    wallColor: '#374151',
    accentLightColor: '#dc2626',
    description: 'Overrun locker halls and overturned classroom desks with relentless multi-flank ambushes.',
    playerSpawns: [
      [-2, 0],
      [2, 0],
    ],
    monsterSpawns: [
      [-25, -25],
      [25, -25],
      [-25, 25],
      [25, 25],
      [0, -26],
      [0, 26],
    ],
    supplyCaches: [
      [-18, 0],
      [18, 0],
      [0, -18],
    ],
    obstacles: [
      { x: -11, z: -10, w: 7, h: 3.5, d: 1.2, kind: 'wall' },
      { x: 11, z: -10, w: 7, h: 3.5, d: 1.2, kind: 'wall' },
      { x: -11, z: 10, w: 7, h: 3.5, d: 1.2, kind: 'wall' },
      { x: 11, z: 10, w: 7, h: 3.5, d: 1.2, kind: 'wall' },
      { x: -5, z: -5, w: 2.0, h: 1.0, d: 1.3, kind: 'desk' },
      { x: 5, z: -5, w: 2.0, h: 1.0, d: 1.3, kind: 'desk' },
      { x: -5, z: 5, w: 2.0, h: 1.0, d: 1.3, kind: 'desk' },
      { x: 5, z: 5, w: 2.0, h: 1.0, d: 1.3, kind: 'desk' },
      { x: -19, z: -4, w: 1.6, h: 2.4, d: 6, kind: 'prop' },
      { x: 19, z: 4, w: 1.6, h: 2.4, d: 6, kind: 'prop' },
    ],
  },
};

export interface MonsterDef {
  type: MonsterType;
  name: string;
  hp: number;
  speed: number;
  damage: number;
  attackRange: number;
  attackCooldown: number;
  radius: number;
  height: number;
  coinReward: number;
  scoreReward: number;
  xpReward: number;
}

export const MONSTERS: Record<MonsterType, MonsterDef> = {
  runner: {
    type: 'runner',
    name: 'Feral Stalker',
    hp: 65,
    speed: 6.4,
    damage: 12,
    attackRange: 1.8,
    attackCooldown: 0.9,
    radius: 0.6,
    height: 1.85,
    coinReward: 18,
    scoreReward: 120,
    xpReward: 22,
  },
  zombie: {
    type: 'zombie',
    name: 'Risen Shambler',
    hp: 105,
    speed: 3.6,
    damage: 16,
    attackRange: 1.9,
    attackCooldown: 1.2,
    radius: 0.65,
    height: 1.95,
    coinReward: 15,
    scoreReward: 100,
    xpReward: 20,
  },
  crawler: {
    type: 'crawler',
    name: 'Bone Crawler',
    hp: 55,
    speed: 5.5,
    damage: 11,
    attackRange: 1.7,
    attackCooldown: 0.85,
    radius: 0.55,
    height: 0.9,
    coinReward: 20,
    scoreReward: 130,
    xpReward: 25,
  },
  brute: {
    type: 'brute',
    name: 'Ironclad Brute',
    hp: 340,
    speed: 2.7,
    damage: 28,
    attackRange: 2.3,
    attackCooldown: 1.6,
    radius: 1.0,
    height: 2.5,
    coinReward: 48,
    scoreReward: 320,
    xpReward: 60,
  },
  phantom: {
    type: 'phantom',
    name: 'Crimson Wraith',
    hp: 170,
    speed: 5.8,
    damage: 22,
    attackRange: 2.1,
    attackCooldown: 1.05,
    radius: 0.68,
    height: 2.2,
    coinReward: 75,
    scoreReward: 450,
    xpReward: 85,
  },
  boss: {
    type: 'boss',
    name: 'Abomination Titan',
    hp: 1250,
    speed: 3.1,
    damage: 38,
    attackRange: 2.9,
    attackCooldown: 1.5,
    radius: 1.45,
    height: 3.4,
    coinReward: 220,
    scoreReward: 1500,
    xpReward: 260,
  },
};

export const DIFFICULTIES: Record<
  DifficultyId,
  { name: string; hpMult: number; dmgMult: number; speedMult: number; rewardMult: number; description: string }
> = {
  normal: {
    name: 'Survivor',
    hpMult: 1.0,
    dmgMult: 1.0,
    speedMult: 1.0,
    rewardMult: 1.0,
    description: 'Balanced horror waves for 1–2 players.',
  },
  nightmare: {
    name: 'Nightmare',
    hpMult: 1.35,
    dmgMult: 1.3,
    speedMult: 1.12,
    rewardMult: 1.4,
    description: 'Faster, deadlier monsters with +40% coin & XP rewards.',
  },
  hell: {
    name: 'Bloodmoon',
    hpMult: 1.75,
    dmgMult: 1.6,
    speedMult: 1.22,
    rewardMult: 1.85,
    description: 'Extreme survival gauntlet with +85% coin & XP rewards.',
  },
};

export const HEALTH_PURCHASE_COST = 90;
export const HEALTH_PURCHASE_AMOUNT = 55;
export const MAX_HEALTH_PURCHASES_PER_MATCH = 3;

export function getLevelFromXp(xp: number): { level: number; currentXp: number; nextLevelXp: number; rank: string } {
  let level = 1;
  let remaining = Math.max(0, xp);
  let req = 150;
  while (remaining >= req && level < 100) {
    remaining -= req;
    level++;
    req = Math.round(150 * Math.pow(1.18, level - 1));
  }
  const ranks = [
    'Recruit',
    'Scout',
    'Operative',
    'Vanguard',
    'Stalker',
    'Exorcist',
    'Warden',
    'Reaper',
    'Nightlord',
    'Apex Legend',
  ];
  const rank = ranks[Math.min(ranks.length - 1, Math.floor((level - 1) / 3))];
  return { level, currentXp: remaining, nextLevelXp: req, rank };
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  rewardCoins: number;
  target: number;
  statKey: 'total_kills' | 'boss_kills' | 'matches_won' | 'matches_played' | 'weapons_unlocked';
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_blood', name: 'First Blood', description: 'Eliminate your first 10 monsters.', rewardCoins: 100, target: 10, statKey: 'total_kills' },
  { id: 'slayer_100', name: 'Night Slayer', description: 'Eliminate 100 monsters across matches.', rewardCoins: 350, target: 100, statKey: 'total_kills' },
  { id: 'slayer_500', name: 'Apex Exterminator', description: 'Eliminate 500 monsters across matches.', rewardCoins: 900, target: 500, statKey: 'total_kills' },
  { id: 'titan_fall', name: 'Titan Slayer', description: 'Defeat 3 Abomination Bosses.', rewardCoins: 450, target: 3, statKey: 'boss_kills' },
  { id: 'survivor_win', name: 'Dawn Survivor', description: 'Complete and win 3 survival matches.', rewardCoins: 400, target: 3, statKey: 'matches_won' },
  { id: 'arsenal_collector', name: 'Arms Dealer', description: 'Unlock 4 different weapons in the shop.', rewardCoins: 500, target: 4, statKey: 'weapons_unlocked' },
];
