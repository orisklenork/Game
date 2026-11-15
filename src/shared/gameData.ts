export type MapId =
  | 'hospital'
  | 'forest'
  | 'mansion'
  | 'lab'
  | 'school'
  | 'catacombs'
  | 'subway'
  | 'asylum'
  | 'factory'
  | 'graveyard'
  | 'bunker'
  | 'rooftop';

export type DifficultyId = 'normal' | 'nightmare' | 'hell';
export type GameModeId = 'unlimited' | 'boss_rush' | 'blitz' | 'hardcore' | 'duel_1v1';

export type WeaponClass =
  | 'handgun'
  | 'smg'
  | 'shotgun'
  | 'rifle'
  | 'lmg'
  | 'sniper'
  | 'melee'
  | 'throwable'
  | 'special';

export const WEAPON_CLASSES: Array<{ id: WeaponClass; label: string; shortLabel: string }> = [
  { id: 'handgun', label: 'Handguns & Pistols', shortLabel: 'Pistols' },
  { id: 'smg', label: 'Submachine Guns', shortLabel: 'SMGs' },
  { id: 'shotgun', label: 'Shotguns', shortLabel: 'Shotguns' },
  { id: 'rifle', label: 'Assault Rifles', shortLabel: 'Rifles' },
  { id: 'lmg', label: 'Machine Guns (LMG)', shortLabel: 'LMGs' },
  { id: 'sniper', label: 'Snipers & DMRs', shortLabel: 'Snipers' },
  { id: 'melee', label: 'Knives & Melee', shortLabel: 'Melee' },
  { id: 'throwable', label: 'Grenades & Hand Items', shortLabel: 'Throwables' },
  { id: 'special', label: 'Special & Heavy', shortLabel: 'Special' },
];

export type WeaponId =
  // Handguns (7)
  | 'pistol'
  | 'usp45'
  | 'glock18'
  | 'revolver'
  | 'deagle'
  | 'dual_berettas'
  | 'p226'
  // SMGs (6)
  | 'smg'
  | 'ump45'
  | 'vector'
  | 'p90'
  | 'tommy'
  | 'mp7'
  // Shotguns (5)
  | 'sawed_off'
  | 'shotgun'
  | 'spas12'
  | 'aa12'
  | 'ksg12'
  // Assault Rifles (6)
  | 'assault_rifle'
  | 'ak47'
  | 'famas'
  | 'scar'
  | 'm4a1'
  | 'as_val'
  // Machine Guns (5)
  | 'lmg'
  | 'pkm'
  | 'mg42'
  | 'negev'
  | 'minigun'
  // Snipers & DMRs (5)
  | 'mk14'
  | 'vss'
  | 'sniper'
  | 'awp'
  | 'barrett'
  // Knives & Melee (5)
  | 'combat_knife'
  | 'karambit'
  | 'machete'
  | 'tomahawk'
  | 'katana'
  // Hand Items / Throwables (5)
  | 'frag_grenade'
  | 'molotov'
  | 'pipe_bomb'
  | 'thermite'
  | 'shock_grenade'
  // Special & Heavy (4)
  | 'flamethrower'
  | 'plasma'
  | 'rpg'
  | 'plasma_cannon';

export type MonsterType =
  | 'runner'
  | 'zombie'
  | 'crawler'
  | 'brute'
  | 'phantom'
  | 'spitter'
  | 'howler'
  | 'sentinel'
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
  weaponClass: WeaponClass;
  category: string;
  description: string;
  cost: number;
  damage: number;
  fireRate: number; // shots/swings/throws per second
  reloadTime: number; // seconds (0 for melee)
  magSize: number;
  pellets: number;
  spread: number; // radians
  range: number;
  automatic: boolean;
  recoil: number;
  moveSpeedMult: number;
  color: string;
  accentColor: string;
  isMelee?: boolean;
  meleeArc?: number; // cosine or radians cleave
  isThrowable?: boolean;
  isRocket?: boolean;
  isFlamethrower?: boolean;
  explosionRadius?: number;
  fuseMs?: number;
  burnDurationMs?: number;
  aoeDotDamage?: number;
  projectileSpeed?: number;
  aoeColor?: string;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  // ==================== HANDGUNS ====================
  pistol: {
    id: 'pistol',
    name: 'M9 Tactical',
    weaponClass: 'handgun',
    category: 'Handgun',
    description: 'Standard-issue sidearm. Crisp recoil control and fast reload.',
    cost: 0,
    damage: 34,
    fireRate: 5.0,
    reloadTime: 1.05,
    magSize: 15,
    pellets: 1,
    spread: 0.011,
    range: 58,
    automatic: false,
    recoil: 0.025,
    moveSpeedMult: 1.02,
    color: '#2b303a',
    accentColor: '#94a3b8',
  },
  usp45: {
    id: 'usp45',
    name: 'USP .45 Suppressed',
    weaponClass: 'handgun',
    category: 'Handgun',
    description: 'Integrally suppressed tactical pistol with surgical pinpoint accuracy.',
    cost: 220,
    damage: 44,
    fireRate: 4.6,
    reloadTime: 1.15,
    magSize: 12,
    pellets: 1,
    spread: 0.006,
    range: 64,
    automatic: false,
    recoil: 0.024,
    moveSpeedMult: 1.03,
    color: '#181c23',
    accentColor: '#475569',
  },
  glock18: {
    id: 'glock18',
    name: 'Glock-18 Auto',
    weaponClass: 'handgun',
    category: 'Machine Pistol',
    description: 'Full-auto pocket shredder with extended 24-round stick magazine.',
    cost: 340,
    damage: 21,
    fireRate: 13.5,
    reloadTime: 1.25,
    magSize: 24,
    pellets: 1,
    spread: 0.036,
    range: 42,
    automatic: true,
    recoil: 0.022,
    moveSpeedMult: 1.02,
    color: '#20242c',
    accentColor: '#64748b',
  },
  p226: {
    id: 'p226',
    name: 'P226 Nightwatch',
    weaponClass: 'handgun',
    category: 'Handgun',
    description: 'Tritium-sighted navy pistol tuned for rapid double-taps.',
    cost: 380,
    damage: 41,
    fireRate: 5.8,
    reloadTime: 1.0,
    magSize: 16,
    pellets: 1,
    spread: 0.009,
    range: 60,
    automatic: false,
    recoil: 0.026,
    moveSpeedMult: 1.02,
    color: '#1c2530',
    accentColor: '#38bdf8',
  },
  dual_berettas: {
    id: 'dual_berettas',
    name: 'Dual 92FS Akimbo',
    weaponClass: 'handgun',
    category: 'Dual Handguns',
    description: 'Twin rapid-fire pistols firing alternating high-velocity 9mm volleys.',
    cost: 520,
    damage: 29,
    fireRate: 9.5,
    reloadTime: 1.75,
    magSize: 30,
    pellets: 1,
    spread: 0.028,
    range: 48,
    automatic: true,
    recoil: 0.024,
    moveSpeedMult: 1.0,
    color: '#27272a',
    accentColor: '#e2e8f0',
  },
  revolver: {
    id: 'revolver',
    name: '.357 Python Magnum',
    weaponClass: 'handgun',
    category: 'Revolver',
    description: 'Heavy six-shooter cylinder packing brutal armor-piercing stopping power.',
    cost: 480,
    damage: 98,
    fireRate: 2.3,
    reloadTime: 1.8,
    magSize: 6,
    pellets: 1,
    spread: 0.007,
    range: 72,
    automatic: false,
    recoil: 0.075,
    moveSpeedMult: 0.99,
    color: '#3f3f46',
    accentColor: '#d4d4d8',
  },
  deagle: {
    id: 'deagle',
    name: 'Desert Eagle .50',
    weaponClass: 'handgun',
    category: 'Hand Cannon',
    description: 'Massive .50 Action Express hand cannon that drops targets in two shots.',
    cost: 760,
    damage: 118,
    fireRate: 2.6,
    reloadTime: 1.55,
    magSize: 7,
    pellets: 1,
    spread: 0.008,
    range: 75,
    automatic: false,
    recoil: 0.088,
    moveSpeedMult: 0.97,
    color: '#71717a',
    accentColor: '#f59e0b',
  },

  // ==================== SUBMACHINE GUNS ====================
  smg: {
    id: 'smg',
    name: 'MP5 Spectre',
    weaponClass: 'smg',
    category: 'Submachine Gun',
    description: 'High-rate close-quarters SMG built for rapid corridor clearing.',
    cost: 350,
    damage: 23,
    fireRate: 11.2,
    reloadTime: 1.4,
    magSize: 32,
    pellets: 1,
    spread: 0.03,
    range: 46,
    automatic: true,
    recoil: 0.019,
    moveSpeedMult: 0.99,
    color: '#1e242d',
    accentColor: '#64748b',
  },
  ump45: {
    id: 'ump45',
    name: 'UMP-45 Enforcer',
    weaponClass: 'smg',
    category: 'Submachine Gun',
    description: 'Hard-hitting .45 ACP SMG with controlled cadence and strong stagger.',
    cost: 490,
    damage: 32,
    fireRate: 8.4,
    reloadTime: 1.45,
    magSize: 28,
    pellets: 1,
    spread: 0.022,
    range: 52,
    automatic: true,
    recoil: 0.024,
    moveSpeedMult: 0.98,
    color: '#18181b',
    accentColor: '#94a3b8',
  },
  mp7: {
    id: 'mp7',
    name: 'MP7 Veil',
    weaponClass: 'smg',
    category: 'PDW / SMG',
    description: 'Armor-piercing PDW spitting a laser-tight 40-round hailstorm.',
    cost: 640,
    damage: 25,
    fireRate: 13.8,
    reloadTime: 1.35,
    magSize: 40,
    pellets: 1,
    spread: 0.024,
    range: 50,
    automatic: true,
    recoil: 0.018,
    moveSpeedMult: 1.0,
    color: '#1f2937',
    accentColor: '#38bdf8',
  },
  vector: {
    id: 'vector',
    name: 'Kriss Vector .45',
    weaponClass: 'smg',
    category: 'Submachine Gun',
    description: 'Blistering 1,100 RPM recoil-mitigated SMG for instant close-range melts.',
    cost: 820,
    damage: 24,
    fireRate: 16.5,
    reloadTime: 1.4,
    magSize: 33,
    pellets: 1,
    spread: 0.028,
    range: 44,
    automatic: true,
    recoil: 0.015,
    moveSpeedMult: 0.99,
    color: '#27272a',
    accentColor: '#ef4444',
  },
  p90: {
    id: 'p90',
    name: 'P90 Abyssal',
    weaponClass: 'smg',
    category: 'Submachine Gun',
    description: 'Bullpup 50-round top-fed magazine built for nonstop crowd suppression.',
    cost: 950,
    damage: 26,
    fireRate: 13.2,
    reloadTime: 1.65,
    magSize: 50,
    pellets: 1,
    spread: 0.026,
    range: 50,
    automatic: true,
    recoil: 0.018,
    moveSpeedMult: 0.98,
    color: '#0f172a',
    accentColor: '#22d3ee',
  },
  tommy: {
    id: 'tommy',
    name: 'Thompson M1928 Drum',
    weaponClass: 'smg',
    category: 'Submachine Gun',
    description: 'Classic drum-fed .45 typewriter with walnut furniture and 50-round drum.',
    cost: 1050,
    damage: 31,
    fireRate: 10.8,
    reloadTime: 1.85,
    magSize: 50,
    pellets: 1,
    spread: 0.033,
    range: 48,
    automatic: true,
    recoil: 0.026,
    moveSpeedMult: 0.95,
    color: '#292524',
    accentColor: '#92400e',
  },

  // ==================== SHOTGUNS ====================
  sawed_off: {
    id: 'sawed_off',
    name: 'Sawed-Off Double',
    weaponClass: 'shotgun',
    category: 'Shotgun',
    description: 'Twin-barrel close-quarters hand cannon with massive point-blank spread.',
    cost: 420,
    damage: 24,
    fireRate: 2.2,
    reloadTime: 1.5,
    magSize: 2,
    pellets: 9,
    spread: 0.115,
    range: 22,
    automatic: false,
    recoil: 0.1,
    moveSpeedMult: 0.98,
    color: '#292524',
    accentColor: '#78350f',
  },
  shotgun: {
    id: 'shotgun',
    name: 'M870 Breacher',
    weaponClass: 'shotgun',
    category: 'Shotgun',
    description: 'Devastating 12-gauge pump-action that shreds charging horrors up close.',
    cost: 550,
    damage: 22,
    fireRate: 1.45,
    reloadTime: 1.8,
    magSize: 8,
    pellets: 7,
    spread: 0.082,
    range: 28,
    automatic: false,
    recoil: 0.08,
    moveSpeedMult: 0.94,
    color: '#292524',
    accentColor: '#78350f',
  },
  spas12: {
    id: 'spas12',
    name: 'SPAS-12 Combat',
    weaponClass: 'shotgun',
    category: 'Semi-Auto Shotgun',
    description: 'Semi-automatic tactical combat shotgun with tight buckshot choke.',
    cost: 920,
    damage: 23,
    fireRate: 2.8,
    reloadTime: 1.9,
    magSize: 8,
    pellets: 8,
    spread: 0.072,
    range: 31,
    automatic: true,
    recoil: 0.072,
    moveSpeedMult: 0.93,
    color: '#18181b',
    accentColor: '#64748b',
  },
  ksg12: {
    id: 'ksg12',
    name: 'KSG-12 Dual-Tube',
    weaponClass: 'shotgun',
    category: 'Bullpup Shotgun',
    description: '14-shell dual-tube tactical shotgun built for prolonged corridor sieges.',
    cost: 1180,
    damage: 25,
    fireRate: 2.1,
    reloadTime: 2.1,
    magSize: 14,
    pellets: 8,
    spread: 0.068,
    range: 32,
    automatic: false,
    recoil: 0.074,
    moveSpeedMult: 0.95,
    color: '#1f2937',
    accentColor: '#f59e0b',
  },
  aa12: {
    id: 'aa12',
    name: 'AA-12 Auto-Shredder',
    weaponClass: 'shotgun',
    category: 'Full-Auto Shotgun',
    description: '20-round drum-fed automatic 12-gauge storm that deletes entire waves.',
    cost: 1680,
    damage: 20,
    fireRate: 4.8,
    reloadTime: 2.25,
    magSize: 20,
    pellets: 7,
    spread: 0.088,
    range: 28,
    automatic: true,
    recoil: 0.048,
    moveSpeedMult: 0.9,
    color: '#1e293b',
    accentColor: '#ef4444',
  },

  // ==================== ASSAULT RIFLES ====================
  assault_rifle: {
    id: 'assault_rifle',
    name: 'MK18 Carbine',
    weaponClass: 'rifle',
    category: 'Assault Rifle',
    description: 'Balanced modular carbine with lethal mid-range stopping power.',
    cost: 850,
    damage: 39,
    fireRate: 8.2,
    reloadTime: 1.55,
    magSize: 30,
    pellets: 1,
    spread: 0.019,
    range: 66,
    automatic: true,
    recoil: 0.03,
    moveSpeedMult: 0.93,
    color: '#1f2937',
    accentColor: '#475569',
  },
  famas: {
    id: 'famas',
    name: 'FAMAS F1 Rapid',
    weaponClass: 'rifle',
    category: 'Assault Rifle',
    description: 'French bullpup rifle firing at a blistering 950 RPM cyclic cadence.',
    cost: 960,
    damage: 34,
    fireRate: 10.6,
    reloadTime: 1.6,
    magSize: 25,
    pellets: 1,
    spread: 0.022,
    range: 62,
    automatic: true,
    recoil: 0.027,
    moveSpeedMult: 0.95,
    color: '#18181b',
    accentColor: '#64748b',
  },
  m4a1: {
    id: 'm4a1',
    name: 'M4A1 Sopmod',
    weaponClass: 'rifle',
    category: 'Assault Rifle',
    description: 'Spec-ops suppressed holographic carbine with ultra-low recoil.',
    cost: 1120,
    damage: 41,
    fireRate: 8.8,
    reloadTime: 1.45,
    magSize: 32,
    pellets: 1,
    spread: 0.014,
    range: 70,
    automatic: true,
    recoil: 0.022,
    moveSpeedMult: 0.94,
    color: '#1e242d',
    accentColor: '#38bdf8',
  },
  ak47: {
    id: 'ak47',
    name: 'AK-47 Ironbark',
    weaponClass: 'rifle',
    category: 'Assault Rifle',
    description: '7.62×39mm powerhouse punching straight through armored Brutes.',
    cost: 1250,
    damage: 52,
    fireRate: 6.8,
    reloadTime: 1.65,
    magSize: 30,
    pellets: 1,
    spread: 0.024,
    range: 68,
    automatic: true,
    recoil: 0.042,
    moveSpeedMult: 0.92,
    color: '#292524',
    accentColor: '#b45309',
  },
  as_val: {
    id: 'as_val',
    name: 'AS-Val Whisper',
    weaponClass: 'rifle',
    category: 'Assault Rifle',
    description: 'Integrally suppressed 9×39mm rifle with razor accuracy and rapid fire.',
    cost: 1380,
    damage: 44,
    fireRate: 9.6,
    reloadTime: 1.5,
    magSize: 28,
    pellets: 1,
    spread: 0.012,
    range: 64,
    automatic: true,
    recoil: 0.022,
    moveSpeedMult: 0.95,
    color: '#0f172a',
    accentColor: '#a855f7',
  },
  scar: {
    id: 'scar',
    name: 'SCAR-H Heavy',
    weaponClass: 'rifle',
    category: 'Battle Rifle',
    description: '7.62 NATO battle rifle hitting like a truck at every engagement distance.',
    cost: 1520,
    damage: 64,
    fireRate: 5.8,
    reloadTime: 1.7,
    magSize: 24,
    pellets: 1,
    spread: 0.014,
    range: 78,
    automatic: true,
    recoil: 0.044,
    moveSpeedMult: 0.91,
    color: '#78716c',
    accentColor: '#d97706',
  },

  // ==================== MACHINE GUNS (LMGs) ====================
  lmg: {
    id: 'lmg',
    name: 'M249 Reaper',
    weaponClass: 'lmg',
    category: 'Light Machine Gun',
    description: 'Belt-fed heavy suppression platform with an 80-round box magazine.',
    cost: 1650,
    damage: 33,
    fireRate: 12.5,
    reloadTime: 2.5,
    magSize: 80,
    pellets: 1,
    spread: 0.036,
    range: 62,
    automatic: true,
    recoil: 0.034,
    moveSpeedMult: 0.85,
    color: '#262b33',
    accentColor: '#b45309',
  },
  negev: {
    id: 'negev',
    name: 'Negev Suppressor',
    weaponClass: 'lmg',
    category: 'Light Machine Gun',
    description: '120-round belt-fed bullet hose built to hold narrow corridors indefinitely.',
    cost: 1900,
    damage: 30,
    fireRate: 14.5,
    reloadTime: 2.7,
    magSize: 120,
    pellets: 1,
    spread: 0.034,
    range: 62,
    automatic: true,
    recoil: 0.028,
    moveSpeedMult: 0.83,
    color: '#1e293b',
    accentColor: '#94a3b8',
  },
  pkm: {
    id: 'pkm',
    name: 'PKM Siege',
    weaponClass: 'lmg',
    category: 'Heavy Machine Gun',
    description: '7.62×54mmR general-purpose machine gun with crushing armor damage.',
    cost: 2150,
    damage: 46,
    fireRate: 9.8,
    reloadTime: 2.8,
    magSize: 100,
    pellets: 1,
    spread: 0.032,
    range: 70,
    automatic: true,
    recoil: 0.038,
    moveSpeedMult: 0.82,
    color: '#27272a',
    accentColor: '#92400e',
  },
  mg42: {
    id: 'mg42',
    name: 'MG42 Buzzsaw',
    weaponClass: 'lmg',
    category: 'Heavy Machine Gun',
    description: 'Infamous high-RPM rotary buzzsaw throwing 18 rounds every second.',
    cost: 2450,
    damage: 29,
    fireRate: 18.0,
    reloadTime: 2.85,
    magSize: 125,
    pellets: 1,
    spread: 0.042,
    range: 64,
    automatic: true,
    recoil: 0.032,
    moveSpeedMult: 0.81,
    color: '#18181b',
    accentColor: '#dc2626',
  },
  minigun: {
    id: 'minigun',
    name: 'M134 Vulcan Minigun',
    weaponClass: 'lmg',
    category: 'Rotary Gatling',
    description: 'Six-barrel rotary Gatling cannon with 200-round electric belt feed.',
    cost: 3400,
    damage: 27,
    fireRate: 24.0,
    reloadTime: 3.1,
    magSize: 200,
    pellets: 1,
    spread: 0.045,
    range: 62,
    automatic: true,
    recoil: 0.025,
    moveSpeedMult: 0.76,
    color: '#0f172a',
    accentColor: '#f59e0b',
  },

  // ==================== SNIPERS & DMRs ====================
  mk14: {
    id: 'mk14',
    name: 'Mk14 EBR',
    weaponClass: 'sniper',
    category: 'Marksman Rifle',
    description: 'Semi-auto precision battle rifle bridging assault cadence & sniper punch.',
    cost: 1080,
    damage: 88,
    fireRate: 4.2,
    reloadTime: 1.75,
    magSize: 14,
    pellets: 1,
    spread: 0.005,
    range: 88,
    automatic: true,
    recoil: 0.056,
    moveSpeedMult: 0.9,
    color: '#1f2937',
    accentColor: '#94a3b8',
  },
  vss: {
    id: 'vss',
    name: 'VSS Vintorez',
    weaponClass: 'sniper',
    category: 'Suppressed DMR',
    description: 'Whisper-quiet full-auto sniper carbine with pinpoint scope optics.',
    cost: 1350,
    damage: 76,
    fireRate: 5.5,
    reloadTime: 1.6,
    magSize: 16,
    pellets: 1,
    spread: 0.004,
    range: 82,
    automatic: true,
    recoil: 0.036,
    moveSpeedMult: 0.92,
    color: '#1c1917',
    accentColor: '#38bdf8',
  },
  sniper: {
    id: 'sniper',
    name: 'M24 Dread',
    weaponClass: 'sniper',
    category: 'Bolt-Action Sniper',
    description: 'High-caliber bolt-action rifle capable of staggering brutes and bosses.',
    cost: 1200,
    damage: 170,
    fireRate: 0.95,
    reloadTime: 2.0,
    magSize: 5,
    pellets: 1,
    spread: 0.002,
    range: 105,
    automatic: false,
    recoil: 0.1,
    moveSpeedMult: 0.89,
    color: '#182026',
    accentColor: '#dc2626',
  },
  awp: {
    id: 'awp',
    name: 'AWP Arctic Magnum',
    weaponClass: 'sniper',
    category: 'Magnum Sniper',
    description: 'Legendary .338 Lapua bolt rifle delivering devastating one-shot lethality.',
    cost: 1850,
    damage: 245,
    fireRate: 0.85,
    reloadTime: 2.15,
    magSize: 6,
    pellets: 1,
    spread: 0.001,
    range: 115,
    automatic: false,
    recoil: 0.12,
    moveSpeedMult: 0.87,
    color: '#14532d',
    accentColor: '#f8fafc',
  },
  barrett: {
    id: 'barrett',
    name: 'Barrett .50 Cal',
    weaponClass: 'sniper',
    category: 'Anti-Materiel Sniper',
    description: 'Semi-auto .50 BMG cannon engineered to punch clean through Titan skulls.',
    cost: 2650,
    damage: 340,
    fireRate: 1.35,
    reloadTime: 2.4,
    magSize: 8,
    pellets: 1,
    spread: 0.001,
    range: 125,
    automatic: false,
    recoil: 0.135,
    moveSpeedMult: 0.81,
    color: '#18181b',
    accentColor: '#f59e0b',
  },

  // ==================== KNIVES & MELEE ====================
  combat_knife: {
    id: 'combat_knife',
    name: 'K-Bar Combat Knife',
    weaponClass: 'melee',
    category: 'Knife · Melee',
    description: 'Razor-sharp tactical blade. Infinite slashes, zero reload, +14% sprint speed.',
    cost: 180,
    damage: 78,
    fireRate: 2.6,
    reloadTime: 0,
    magSize: 1,
    pellets: 1,
    spread: 0,
    range: 3.1,
    automatic: true,
    recoil: 0.015,
    moveSpeedMult: 1.14,
    color: '#1f2937',
    accentColor: '#cbd5e1',
    isMelee: true,
    meleeArc: 0.55,
  },
  karambit: {
    id: 'karambit',
    name: 'Crimson Karambit',
    weaponClass: 'melee',
    category: 'Knife · Melee',
    description: 'Curved claw blade built for ultra-fast relentless close-quarters slicing.',
    cost: 390,
    damage: 72,
    fireRate: 3.4,
    reloadTime: 0,
    magSize: 1,
    pellets: 1,
    spread: 0,
    range: 3.0,
    automatic: true,
    recoil: 0.012,
    moveSpeedMult: 1.18,
    color: '#450a0a',
    accentColor: '#ef4444',
    isMelee: true,
    meleeArc: 0.5,
  },
  machete: {
    id: 'machete',
    name: 'Jungle Cleaver',
    weaponClass: 'melee',
    category: 'Heavy Blade',
    description: 'Broad-bladed survival machete cleaving multiple undead in a wide arc.',
    cost: 520,
    damage: 112,
    fireRate: 2.0,
    reloadTime: 0,
    magSize: 1,
    pellets: 1,
    spread: 0,
    range: 3.5,
    automatic: true,
    recoil: 0.025,
    moveSpeedMult: 1.12,
    color: '#292524',
    accentColor: '#94a3b8',
    isMelee: true,
    meleeArc: 0.35,
  },
  tomahawk: {
    id: 'tomahawk',
    name: 'Tactical Tomahawk',
    weaponClass: 'melee',
    category: 'Combat Axe',
    description: 'Bearded steel breach axe delivering crushing skull-splitting chops.',
    cost: 680,
    damage: 145,
    fireRate: 1.75,
    reloadTime: 0,
    magSize: 1,
    pellets: 1,
    spread: 0,
    range: 3.5,
    automatic: true,
    recoil: 0.032,
    moveSpeedMult: 1.1,
    color: '#1e293b',
    accentColor: '#f59e0b',
    isMelee: true,
    meleeArc: 0.4,
  },
  katana: {
    id: 'katana',
    name: 'Shadow Katana',
    weaponClass: 'melee',
    category: 'Longblade',
    description: 'Long-reach carbon katana with sweeping 120° arc and swift movement.',
    cost: 1100,
    damage: 165,
    fireRate: 2.35,
    reloadTime: 0,
    magSize: 1,
    pellets: 1,
    spread: 0,
    range: 4.2,
    automatic: true,
    recoil: 0.022,
    moveSpeedMult: 1.16,
    color: '#09090b',
    accentColor: '#dc2626',
    isMelee: true,
    meleeArc: 0.25,
  },

  // ==================== HAND ITEMS / THROWABLES ====================
  frag_grenade: {
    id: 'frag_grenade',
    name: 'M67 Frag Grenade',
    weaponClass: 'throwable',
    category: 'Hand Grenade',
    description: 'High-explosive fragmentation grenade detonating after 1.6s in a 6.5m radius.',
    cost: 320,
    damage: 240,
    fireRate: 1.2,
    reloadTime: 2.2,
    magSize: 3,
    pellets: 1,
    spread: 0,
    range: 28,
    automatic: false,
    recoil: 0.02,
    moveSpeedMult: 1.05,
    color: '#14532d',
    accentColor: '#f59e0b',
    isThrowable: true,
    explosionRadius: 6.5,
    fuseMs: 1600,
    projectileSpeed: 21,
    aoeColor: '#f97316',
  },
  molotov: {
    id: 'molotov',
    name: 'Molotov Cocktail',
    weaponClass: 'throwable',
    category: 'Incendiary Hand Item',
    description: 'Shatters on impact, igniting a raging 7-second fire pool that scorches all inside.',
    cost: 440,
    damage: 65,
    fireRate: 1.1,
    reloadTime: 2.3,
    magSize: 3,
    pellets: 1,
    spread: 0,
    range: 26,
    automatic: false,
    recoil: 0.02,
    moveSpeedMult: 1.05,
    color: '#78350f',
    accentColor: '#fb923c',
    isThrowable: true,
    explosionRadius: 5.0,
    fuseMs: 0, // impact detonation!
    burnDurationMs: 7000,
    aoeDotDamage: 38,
    projectileSpeed: 20,
    aoeColor: '#fb923c',
  },
  pipe_bomb: {
    id: 'pipe_bomb',
    name: 'Shrapnel Pipe Bomb',
    weaponClass: 'throwable',
    category: 'Improvised Explosive',
    description: 'Packed iron shrapnel bomb with wider 8m blast radius and brutal damage.',
    cost: 580,
    damage: 310,
    fireRate: 1.0,
    reloadTime: 2.4,
    magSize: 2,
    pellets: 1,
    spread: 0,
    range: 25,
    automatic: false,
    recoil: 0.025,
    moveSpeedMult: 1.03,
    color: '#3f3f46',
    accentColor: '#ef4444',
    isThrowable: true,
    explosionRadius: 8.0,
    fuseMs: 1900,
    projectileSpeed: 19,
    aoeColor: '#ef4444',
  },
  thermite: {
    id: 'thermite',
    name: 'Thermite Charge',
    weaponClass: 'throwable',
    category: 'Incendiary Hand Item',
    description: 'Burns at 2,500°C for 8 seconds—melts bosses and blocks 1v1 lanes.',
    cost: 790,
    damage: 90,
    fireRate: 1.05,
    reloadTime: 2.4,
    magSize: 2,
    pellets: 1,
    spread: 0,
    range: 25,
    automatic: false,
    recoil: 0.02,
    moveSpeedMult: 1.04,
    color: '#1e293b',
    accentColor: '#facc15',
    isThrowable: true,
    explosionRadius: 5.5,
    fuseMs: 700,
    burnDurationMs: 8000,
    aoeDotDamage: 56,
    projectileSpeed: 20,
    aoeColor: '#fde047',
  },
  shock_grenade: {
    id: 'shock_grenade',
    name: 'EMP Shock Grenade',
    weaponClass: 'throwable',
    category: 'Tactical Grenade',
    description: 'Arc blast dealing high shock damage in a huge 7.5m electric field.',
    cost: 660,
    damage: 185,
    fireRate: 1.25,
    reloadTime: 2.1,
    magSize: 3,
    pellets: 1,
    spread: 0,
    range: 28,
    automatic: false,
    recoil: 0.02,
    moveSpeedMult: 1.05,
    color: '#0f172a',
    accentColor: '#38bdf8',
    isThrowable: true,
    explosionRadius: 7.5,
    fuseMs: 1100,
    burnDurationMs: 4000,
    aoeDotDamage: 28,
    projectileSpeed: 22,
    aoeColor: '#38bdf8',
  },

  // ==================== SPECIAL & HEAVY ====================
  flamethrower: {
    id: 'flamethrower',
    name: 'M2 Hellfire',
    weaponClass: 'special',
    category: 'Incendiary Special',
    description: 'Pressurized napalm projector scorching swarms in a wide close-range cone.',
    cost: 1950,
    damage: 24,
    fireRate: 16.0,
    reloadTime: 2.4,
    magSize: 90,
    pellets: 2,
    spread: 0.095,
    range: 18,
    automatic: true,
    recoil: 0.014,
    moveSpeedMult: 0.87,
    color: '#7f1d1d',
    accentColor: '#fb923c',
    isFlamethrower: true,
  },
  plasma: {
    id: 'plasma',
    name: 'Arc Railgun',
    weaponClass: 'special',
    category: 'Experimental Railgun',
    description: 'Prototype electromagnetic rail cannon firing hyper-velocity crimson bolts.',
    cost: 2400,
    damage: 225,
    fireRate: 1.9,
    reloadTime: 1.75,
    magSize: 8,
    pellets: 1,
    spread: 0.003,
    range: 100,
    automatic: false,
    recoil: 0.062,
    moveSpeedMult: 0.92,
    color: '#0f172a',
    accentColor: '#ef4444',
  },
  rpg: {
    id: 'rpg',
    name: 'RPG-7 Launcher',
    weaponClass: 'special',
    category: 'Rocket Launcher',
    description: 'High-explosive warhead launcher detonating on impact with massive splash.',
    cost: 2950,
    damage: 360,
    fireRate: 0.85,
    reloadTime: 2.35,
    magSize: 2,
    pellets: 1,
    spread: 0.005,
    range: 95,
    automatic: false,
    recoil: 0.11,
    moveSpeedMult: 0.82,
    color: '#1e293b',
    accentColor: '#f97316',
    isRocket: true,
    explosionRadius: 7.2,
    projectileSpeed: 38,
    aoeColor: '#f97316',
  },
  plasma_cannon: {
    id: 'plasma_cannon',
    name: 'Helios Plasma Minigun',
    weaponClass: 'special',
    category: 'Experimental Heavy',
    description: 'Apex rapid-fire plasma rotary cannon firing energized bolts non-stop.',
    cost: 3800,
    damage: 54,
    fireRate: 11.5,
    reloadTime: 2.4,
    magSize: 60,
    pellets: 1,
    spread: 0.018,
    range: 85,
    automatic: true,
    recoil: 0.026,
    moveSpeedMult: 0.84,
    color: '#090d16',
    accentColor: '#38bdf8',
  },
};

export const WEAPON_ORDER: WeaponId[] = [
  'pistol',
  'usp45',
  'glock18',
  'p226',
  'dual_berettas',
  'revolver',
  'deagle',
  'smg',
  'ump45',
  'mp7',
  'vector',
  'p90',
  'tommy',
  'sawed_off',
  'shotgun',
  'spas12',
  'ksg12',
  'aa12',
  'assault_rifle',
  'famas',
  'm4a1',
  'ak47',
  'as_val',
  'scar',
  'lmg',
  'negev',
  'pkm',
  'mg42',
  'minigun',
  'mk14',
  'vss',
  'sniper',
  'awp',
  'barrett',
  'combat_knife',
  'karambit',
  'machete',
  'tomahawk',
  'katana',
  'frag_grenade',
  'molotov',
  'pipe_bomb',
  'thermite',
  'shock_grenade',
  'flamethrower',
  'plasma',
  'rpg',
  'plasma_cannon',
];

export function getWeaponUpgradeCost(currentLevel: number): number {
  return currentLevel * 250;
}

export function getWeaponStatsAtLevel(id: WeaponId, level: number) {
  const base = WEAPONS[id] || WEAPONS.pistol;
  const lvl = Math.max(1, Math.min(5, level));
  const dmgMult = 1 + (lvl - 1) * 0.16;
  const rofMult = 1 + (lvl - 1) * 0.06;
  return {
    ...base,
    damage: Math.round(base.damage * dmgMult),
    aoeDotDamage: base.aoeDotDamage ? Math.round(base.aoeDotDamage * dmgMult) : undefined,
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
  { id: 'shirt_cobalt', name: 'Cobalt Recon Base', category: 'shirt', cost: 260, color: '#1e3a8a', styleTag: 'fitted', description: 'Moisture-wicking deep navy strike shirt.' },
  { id: 'shirt_emerald', name: 'Viper Camo Top', category: 'shirt', cost: 340, color: '#14532d', styleTag: 'kevlar', description: 'Dark forest guerrilla combat shirt.' },
  { id: 'shirt_arctic', name: 'Whiteout Fleece', category: 'shirt', cost: 380, color: '#cbd5e1', styleTag: 'fitted', description: 'Winter ops urban infiltration layer.' },

  // Outfits / Jackets
  { id: 'outfit_vest', name: 'Recon Plate Carrier', category: 'outfit', cost: 0, color: '#1e293b', secondaryColor: '#0f172a', styleTag: 'vest', description: 'Standard tactical vest with utility pouches.' },
  { id: 'outfit_trench', name: 'Hunter Trenchcoat', category: 'outfit', cost: 400, color: '#1c1917', secondaryColor: '#450a0a', styleTag: 'trench', description: 'Weathered dark leather longcoat for night hunts.' },
  { id: 'outfit_riot', name: 'Juggernaut Armor', category: 'outfit', cost: 650, color: '#27272a', secondaryColor: '#52525b', styleTag: 'heavy', description: 'Heavy ceramic-plated assault rig.' },
  { id: 'outfit_lab', name: 'Containment Rig', category: 'outfit', cost: 520, color: '#334155', secondaryColor: '#0284c7', styleTag: 'exo', description: 'Reinforced dark blue hazardous response harness.' },
  { id: 'outfit_samurai', name: 'Ronin Lamellar', category: 'outfit', cost: 780, color: '#450a0a', secondaryColor: '#f59e0b', styleTag: 'heavy', description: 'Crimson-lacquered ballistic shoulder armor.' },
  { id: 'outfit_ghillie', name: 'Shadow Duster', category: 'outfit', cost: 590, color: '#14261c', secondaryColor: '#0f172a', styleTag: 'trench', description: 'Moss-darkened sniper cloak.' },

  // Character Skins (tone/surface)
  { id: 'skin_default', name: 'Survivor Standard', category: 'skin', cost: 0, color: '#d6b39b', styleTag: 'human', description: 'Standard field operative.' },
  { id: 'skin_pale', name: 'Ashen Wraith', category: 'skin', cost: 280, color: '#94a3b8', styleTag: 'pale', description: 'Cold frostbitten complexion.' },
  { id: 'skin_shadow', name: 'Obsidian Operative', category: 'skin', cost: 350, color: '#3b3330', styleTag: 'dark', description: 'Camouflaged night-ops tone.' },
  { id: 'skin_cyber', name: 'Synth Alloy', category: 'skin', cost: 600, color: '#475569', emissive: '#38bdf8', styleTag: 'synth', description: 'Synthetic titanium-plated combat frame.' },
  { id: 'skin_hellfire', name: 'Ember Scarred', category: 'skin', cost: 720, color: '#292524', emissive: '#ef4444', styleTag: 'synth', description: 'Charred obsidian frame glowing with crimson veins.' },
  { id: 'skin_gold', name: 'Gilded Automaton', category: 'skin', cost: 950, color: '#d97706', emissive: '#f59e0b', styleTag: 'synth', description: 'Polished brass & gold synthetic armor.' },

  // Masks
  { id: 'mask_none', name: 'No Mask', category: 'mask', cost: 0, color: '#000000', styleTag: 'none', description: 'Clear line of sight without headgear.' },
  { id: 'mask_gas', name: 'M50 Gas Mask', category: 'mask', cost: 250, color: '#18181b', secondaryColor: '#dc2626', emissive: '#7f1d1d', styleTag: 'gasmask', description: 'Dual-filter respirator with crimson lenses.' },
  { id: 'mask_skull', name: 'Reaper Balaclava', category: 'mask', cost: 420, color: '#09090b', secondaryColor: '#e2e8f0', styleTag: 'skull', description: 'Bone-plated intimidation mask.' },
  { id: 'mask_nvg', name: 'Quad-Optic NVG', category: 'mask', cost: 580, color: '#0f172a', emissive: '#22d3ee', styleTag: 'nvg', description: 'Four-tube tactical night vision visor.' },
  { id: 'mask_oni', name: 'Crimson Oni', category: 'mask', cost: 750, color: '#7f1d1d', secondaryColor: '#f8fafc', emissive: '#ef4444', styleTag: 'oni', description: 'Ceremonial horned horror mask.' },
  { id: 'mask_cyber_visor', name: 'Apex Holo-Visor', category: 'mask', cost: 820, color: '#090d16', secondaryColor: '#38bdf8', emissive: '#0ea5e9', styleTag: 'nvg', description: 'Sleek wrap-around blue targeting visor.' },
  { id: 'mask_gold_oni', name: 'Gilded Demon', category: 'mask', cost: 1100, color: '#92400e', secondaryColor: '#fde047', emissive: '#f59e0b', styleTag: 'oni', description: 'Gold-horned warlord mask.' },

  // Gloves
  { id: 'gloves_std', name: 'Fingerless Wraps', category: 'gloves', cost: 0, color: '#1e293b', styleTag: 'wraps', description: 'Lightweight combat hand wraps.' },
  { id: 'gloves_red', name: 'Crimson Gauntlets', category: 'gloves', cost: 180, color: '#991b1b', styleTag: 'plated', description: 'Armored knuckle gauntlets.' },
  { id: 'gloves_steel', name: 'Tungsten Grips', category: 'gloves', cost: 260, color: '#475569', styleTag: 'steel', description: 'Reinforced metal-weave shooting gloves.' },
  { id: 'gloves_gold', name: 'Brass Knuckles', category: 'gloves', cost: 420, color: '#b45309', styleTag: 'steel', description: 'Gilded alloy assault gauntlets.' },
  { id: 'gloves_void', name: 'Obsidian Claws', category: 'gloves', cost: 480, color: '#09090b', styleTag: 'plated', description: 'Pitch-black carbon-fiber gauntlets.' },

  // Accessories
  { id: 'acc_none', name: 'None', category: 'accessory', cost: 0, color: '#000000', styleTag: 'none', description: 'No back attachment.' },
  { id: 'acc_pack', name: 'Medic Field Pack', category: 'accessory', cost: 240, color: '#334155', secondaryColor: '#dc2626', styleTag: 'backpack', description: 'Tactical trauma backpack.' },
  { id: 'acc_tank', name: 'Cryo Fuel Tank', category: 'accessory', cost: 450, color: '#1e3a8a', emissive: '#38bdf8', styleTag: 'tank', description: 'Pressurized back canister with blue gauge.' },
  { id: 'acc_katana', name: 'Carbon Blade Sheath', category: 'accessory', cost: 550, color: '#09090b', secondaryColor: '#dc2626', styleTag: 'blade', description: 'Diagonal ceremonial survival blade.' },
  { id: 'acc_napalm', name: 'Hellfire Fuel Rig', category: 'accessory', cost: 680, color: '#7f1d1d', emissive: '#f97316', styleTag: 'tank', description: 'Twin-pressurized incendiary canister.' },

  // Special Costumes
  { id: 'costume_none', name: 'Standard Gear', category: 'costume', cost: 0, color: '#1e293b', styleTag: 'none', description: 'Use individual shirt and outfit pieces.' },
  { id: 'costume_plague', name: 'Plague Doctor', category: 'costume', cost: 900, color: '#09090b', secondaryColor: '#78350f', emissive: '#b91c1c', styleTag: 'plague', description: 'Dark Victorian coat with crimson trim.' },
  { id: 'costume_spectral', name: 'Spectral Warden', category: 'costume', cost: 1350, color: '#0f172a', secondaryColor: '#1d4ed8', emissive: '#60a5fa', styleTag: 'spectral', description: 'Ghostly cold-blue armored shroud.' },
  { id: 'costume_hellhound', name: 'Infernal Executioner', category: 'costume', cost: 1650, color: '#1c0a0a', secondaryColor: '#dc2626', emissive: '#f97316', styleTag: 'plague', description: 'Molten crimson armor forged for bloodmoon survival.' },
  { id: 'costume_gold', name: 'Sovereign Sentinel', category: 'costume', cost: 2100, color: '#18181b', secondaryColor: '#d97706', emissive: '#fbbf24', styleTag: 'spectral', description: 'Black-and-gold ceremonial elite exosuit.' },

  // Weapon Skins (12 finishes!)
  { id: 'wskin_factory', name: 'Factory Matte', category: 'weapon_skin', cost: 0, color: '#1f2937', secondaryColor: '#64748b', styleTag: 'matte', description: 'Standard parkerized steel finish.' },
  { id: 'wskin_blood', name: 'Crimson Vein', category: 'weapon_skin', cost: 350, color: '#450a0a', secondaryColor: '#ef4444', emissive: '#7f1d1d', styleTag: 'blood', description: 'Deep blood-anodized finish.' },
  { id: 'wskin_cobalt', name: 'Cobalt Night', category: 'weapon_skin', cost: 450, color: '#0f172a', secondaryColor: '#3b82f6', emissive: '#1d4ed8', styleTag: 'cobalt', description: 'Cold tactical blue steel finish.' },
  { id: 'wskin_arctic', name: 'Arctic Ghost', category: 'weapon_skin', cost: 520, color: '#e2e8f0', secondaryColor: '#38bdf8', emissive: '#0ea5e9', styleTag: 'arctic', description: 'Winter-white ceramic chassis with frost accents.' },
  { id: 'wskin_toxic', name: 'Biohazard Venom', category: 'weapon_skin', cost: 580, color: '#14261c', secondaryColor: '#4ade80', emissive: '#16a34a', styleTag: 'toxic', description: 'Quarantine green plating with glowing hazard rails.' },
  { id: 'wskin_inferno', name: 'Hellfire Ember', category: 'weapon_skin', cost: 680, color: '#27120c', secondaryColor: '#fb923c', emissive: '#ea580c', styleTag: 'inferno', description: 'Volcanic molten trim burning along receiver seams.' },
  { id: 'wskin_gold', name: 'Gilded Mercenary', category: 'weapon_skin', cost: 850, color: '#78350f', secondaryColor: '#f59e0b', emissive: '#b45309', styleTag: 'gold', description: 'Brushed brass & gold alloy plating.' },
  { id: 'wskin_obsidian', name: 'Carbon Stealth', category: 'weapon_skin', cost: 620, color: '#09090b', secondaryColor: '#3f3f46', styleTag: 'carbon', description: 'Matte black carbon-weave spec-ops coat.' },
  { id: 'wskin_synth', name: 'Neon Synthwave', category: 'weapon_skin', cost: 920, color: '#1e1b4b', secondaryColor: '#e879f9', emissive: '#c026d3', styleTag: 'synth', description: 'Ultraviolet cybernetic trim with glowing magenta rails.' },
  { id: 'wskin_bloodmoon', name: 'Bloodmoon Ruby', category: 'weapon_skin', cost: 1150, color: '#7f1d1d', secondaryColor: '#fca5a5', emissive: '#dc2626', styleTag: 'ruby', description: 'Crystalline crimson sheen forged under the bloodmoon.' },
  { id: 'wskin_chrome', name: 'Mirror Chrome', category: 'weapon_skin', cost: 980, color: '#cbd5e1', secondaryColor: '#f8fafc', styleTag: 'chrome', description: 'High-polish mirror-finished titanium alloy.' },
  { id: 'wskin_damascus', name: 'Damascus Forge', category: 'weapon_skin', cost: 1280, color: '#334155', secondaryColor: '#fbbf24', emissive: '#78350f', styleTag: 'damascus', description: 'Folded dark steel with golden ceremonial inlays.' },
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
  kind: 'wall' | 'pillar' | 'prop' | 'tree' | 'pod' | 'desk' | 'table' | 'crate' | 'grave' | 'train';
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
  duelSpawns: [number, number][];
  monsterSpawns: [number, number][];
  supplyCaches: [number, number][];
  obstacles: ObstacleBox[];
}

export const MAPS: Record<MapId, MapDef> = {
  // 1. Hospital: Asymmetric L-Wing Triage Wards & Central Reception Hub
  hospital: {
    id: 'hospital',
    name: 'St. Jude Triage Wing',
    subtitle: 'Quarantine Hospital Ward',
    difficultyRating: 2,
    arenaHalfSize: 28,
    outdoor: false,
    skyColor: '#05080d',
    fogColor: '#070b12',
    fogDensity: 0.03,
    ambientColor: '#1e293b',
    lightColor: '#93c5fd',
    floorColor: '#1e242b',
    wallColor: '#2d3748',
    accentLightColor: '#dc2626',
    description: 'Enclosed surgical triage rooms, central nursing counter, and flanking blood-stained corridors.',
    playerSpawns: [
      [-2, 3],
      [2, 3],
    ],
    duelSpawns: [
      [-21, -18],
      [21, 18],
    ],
    monsterSpawns: [
      [-23, -23],
      [23, -22],
      [-23, 22],
      [23, 22],
      [0, -24],
      [24, 0],
    ],
    supplyCaches: [
      [-17, -14],
      [17, 14],
      [0, -16],
    ],
    obstacles: [
      // Central Nurses Station (openings N/S)
      { x: -3.5, z: 0, w: 1.2, h: 1.25, d: 6.5, kind: 'desk' },
      { x: 3.5, z: 0, w: 1.2, h: 1.25, d: 6.5, kind: 'desk' },
      // NW Enclosed Surgical Ward with East & South Doorways
      { x: -16, z: -8, w: 10, h: 3.8, d: 1.1, kind: 'wall' },
      { x: -10.5, z: -15, w: 1.1, h: 3.8, d: 7, kind: 'wall' },
      { x: -17, z: -16, w: 3.0, h: 1.05, d: 1.4, kind: 'table' },
      // SE Quarantine ICU Ward
      { x: 16, z: 8, w: 10, h: 3.8, d: 1.1, kind: 'wall' },
      { x: 10.5, z: 15, w: 1.1, h: 3.8, d: 7, kind: 'wall' },
      { x: 17, z: 16, w: 3.0, h: 1.05, d: 1.4, kind: 'table' },
      // NE Corridor Divider & Cryo Morgue Locker
      { x: 14, z: -14, w: 1.3, h: 3.8, d: 10, kind: 'wall' },
      { x: 20, z: -12, w: 2.6, h: 2.4, d: 1.6, kind: 'crate' },
      // SW Ambulance Bay Divider & Gurney Cover
      { x: -14, z: 14, w: 1.3, h: 3.8, d: 10, kind: 'wall' },
      { x: -19, z: 11, w: 3.0, h: 1.0, d: 1.3, kind: 'prop' },
      { x: 0, z: -15, w: 2.2, h: 4.0, d: 2.2, kind: 'pillar' },
      { x: 0, z: 15, w: 2.2, h: 4.0, d: 2.2, kind: 'pillar' },
    ],
  },

  // 2. Forest: Winding Ravine, Hunter Cabin & Pine Clearing
  forest: {
    id: 'forest',
    name: 'Blackhollow Pines',
    subtitle: 'Midnight Logging Camp',
    difficultyRating: 3,
    arenaHalfSize: 34,
    outdoor: true,
    skyColor: '#04070c',
    fogColor: '#060c14',
    fogDensity: 0.032,
    ambientColor: '#1e293b',
    lightColor: '#60a5fa',
    floorColor: '#121814',
    wallColor: '#1f2937',
    accentLightColor: '#f59e0b',
    description: 'Ruined timber cabin in the woods surrounded by granite boulders, dense pine groves, and log stacks.',
    playerSpawns: [
      [-2, 1],
      [2, 1],
    ],
    duelSpawns: [
      [-26, 20],
      [26, -20],
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
      [-18, -14],
      [18, 14],
      [0, 0],
    ],
    obstacles: [
      // Ruined Hunter Cabin Walls (West-Central)
      { x: -13, z: -4, w: 7, h: 3.4, d: 1.0, kind: 'wall' },
      { x: -16, z: 2, w: 1.0, h: 3.4, d: 8, kind: 'wall' },
      { x: -11, z: 6, w: 5, h: 3.4, d: 1.0, kind: 'wall' },
      // East Timber Stack Ridge
      { x: 14, z: -10, w: 4.5, h: 1.8, d: 2.0, kind: 'crate' },
      { x: 16, z: 6, w: 2.2, h: 1.8, d: 5.5, kind: 'crate' },
      // Winding Boulder Clusters
      { x: -2, z: -14, w: 4.0, h: 2.3, d: 3.2, kind: 'prop' },
      { x: 8, z: 16, w: 3.8, h: 2.2, d: 3.0, kind: 'prop' },
      { x: -21, z: 18, w: 3.6, h: 2.4, d: 3.4, kind: 'prop' },
      { x: 22, z: -21, w: 3.5, h: 2.1, d: 3.2, kind: 'prop' },
      // Scattered Tall Pines
      { x: -5, z: 12, w: 1.6, h: 8, d: 1.6, kind: 'tree' },
      { x: 7, z: -4, w: 1.5, h: 8, d: 1.5, kind: 'tree' },
      { x: -23, z: -17, w: 1.9, h: 8, d: 1.9, kind: 'tree' },
      { x: 24, z: 14, w: 1.8, h: 8, d: 1.8, kind: 'tree' },
      { x: 2, z: 24, w: 1.7, h: 8, d: 1.7, kind: 'tree' },
      { x: -18, z: -25, w: 1.7, h: 8, d: 1.7, kind: 'tree' },
    ],
  },

  // 3. Mansion: Grand Foyer, Banquet Hall & Library Mezzanine
  mansion: {
    id: 'mansion',
    name: 'Ravenscroft Manor',
    subtitle: 'Grand Foyer & Library',
    difficultyRating: 3,
    arenaHalfSize: 28,
    outdoor: false,
    skyColor: '#07050a',
    fogColor: '#0b0810',
    fogDensity: 0.028,
    ambientColor: '#272030',
    lightColor: '#cbd5e1',
    floorColor: '#241a18',
    wallColor: '#2e2226',
    accentLightColor: '#dc2626',
    description: 'Two-wing Victorian estate featuring a central banquet hall, book-lined study alcoves, and marble colonnade.',
    playerSpawns: [
      [-3, 14],
      [3, 14],
    ],
    duelSpawns: [
      [-21, -20],
      [21, 20],
    ],
    monsterSpawns: [
      [-23, -23],
      [23, -23],
      [-23, 20],
      [23, 20],
      [0, -24],
    ],
    supplyCaches: [
      [-18, 0],
      [18, 0],
      [0, -18],
    ],
    obstacles: [
      // Long Central Banquet Table
      { x: 0, z: -2, w: 3.2, h: 1.15, d: 10.5, kind: 'table' },
      // East Wing Library Alcoves
      { x: 11, z: -11, w: 1.3, h: 4.4, d: 10, kind: 'wall' },
      { x: 18, z: -4, w: 7, h: 4.4, d: 1.3, kind: 'wall' },
      { x: 19, z: -16, w: 2.2, h: 3.0, d: 5, kind: 'crate' },
      // West Wing Parlor & Fireplace Divider
      { x: -11, z: 9, w: 1.3, h: 4.4, d: 10, kind: 'wall' },
      { x: -18, z: 2, w: 7, h: 4.4, d: 1.3, kind: 'wall' },
      { x: -19, z: 15, w: 3.4, h: 1.15, d: 1.8, kind: 'table' },
      // Grand Foyer Marble Pillars
      { x: -6, z: -14, w: 1.9, h: 4.6, d: 1.9, kind: 'pillar' },
      { x: 6, z: -14, w: 1.9, h: 4.6, d: 1.9, kind: 'pillar' },
      { x: -6, z: 16, w: 1.9, h: 4.6, d: 1.9, kind: 'pillar' },
      { x: 6, z: 16, w: 1.9, h: 4.6, d: 1.9, kind: 'pillar' },
    ],
  },

  // 4. Lab: Hex-Ring Bio-Reactor & Cryo-Containment Corridors
  lab: {
    id: 'lab',
    name: 'Bio-Vault Sector 09',
    subtitle: 'Subterranean Cryo-Lab',
    difficultyRating: 4,
    arenaHalfSize: 30,
    outdoor: false,
    skyColor: '#030811',
    fogColor: '#050d1a',
    fogDensity: 0.026,
    ambientColor: '#172554',
    lightColor: '#38bdf8',
    floorColor: '#131b26',
    wallColor: '#1e293b',
    accentLightColor: '#ef4444',
    description: 'Central containment reactor ring ringed by glowing cryo-specimen vats and armored blast bulkheads.',
    playerSpawns: [
      [-2, 11],
      [2, 11],
    ],
    duelSpawns: [
      [-23, 0],
      [23, 0],
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
      [0, 0],
      [-17, -17],
      [17, 17],
    ],
    obstacles: [
      // Central Reactor Containment Ring (4 curved-feel quadrants with narrow gaps)
      { x: -6, z: -6, w: 5.5, h: 3.8, d: 1.3, kind: 'wall' },
      { x: 6, z: -6, w: 5.5, h: 3.8, d: 1.3, kind: 'wall' },
      { x: -6, z: 6, w: 5.5, h: 3.8, d: 1.3, kind: 'wall' },
      { x: 6, z: 6, w: 5.5, h: 3.8, d: 1.3, kind: 'wall' },
      // Ring of Cryo Specimen Pods
      { x: -13, z: 0, w: 2.5, h: 4.0, d: 2.5, kind: 'pod' },
      { x: 13, z: 0, w: 2.5, h: 4.0, d: 2.5, kind: 'pod' },
      { x: 0, z: -13, w: 2.5, h: 4.0, d: 2.5, kind: 'pod' },
      { x: 0, z: 13, w: 2.5, h: 4.0, d: 2.5, kind: 'pod' },
      // Corner Lab Airlock Walls
      { x: -19, z: -15, w: 1.5, h: 3.8, d: 9, kind: 'wall' },
      { x: 19, z: 15, w: 1.5, h: 3.8, d: 9, kind: 'wall' },
      { x: -16, z: 19, w: 8, h: 3.8, d: 1.5, kind: 'wall' },
      { x: 16, z: -19, w: 8, h: 3.8, d: 1.5, kind: 'wall' },
    ],
  },

  // 5. School: Classroom Wing vs Open Gymnasium Court
  school: {
    id: 'school',
    name: 'Oakridge Academy',
    subtitle: 'Classrooms & Gymnasium',
    difficultyRating: 4,
    arenaHalfSize: 30,
    outdoor: false,
    skyColor: '#08090c',
    fogColor: '#0c0e13',
    fogDensity: 0.03,
    ambientColor: '#1f2937',
    lightColor: '#9ca3af',
    floorColor: '#262420',
    wallColor: '#374151',
    accentLightColor: '#dc2626',
    description: 'West locker hallway dividing three desk-filled classrooms from an open bleacher gymnasium on the east.',
    playerSpawns: [
      [-2, 0],
      [2, 0],
    ],
    duelSpawns: [
      [-23, -18],
      [23, 18],
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
      [-19, 0],
      [18, 0],
      [0, -20],
    ],
    obstacles: [
      // Main North-South Hallway Spine separating Classrooms (West) & Gym (East)
      { x: -3, z: -16, w: 1.3, h: 3.6, d: 12, kind: 'wall' },
      { x: -3, z: 16, w: 1.3, h: 3.6, d: 12, kind: 'wall' },
      // West Classrooms (North, Middle, South dividers)
      { x: -16, z: -8, w: 14, h: 3.6, d: 1.2, kind: 'wall' },
      { x: -16, z: 8, w: 14, h: 3.6, d: 1.2, kind: 'wall' },
      { x: -18, z: -17, w: 2.2, h: 1.0, d: 1.4, kind: 'desk' },
      { x: -12, z: -17, w: 2.2, h: 1.0, d: 1.4, kind: 'desk' },
      { x: -16, z: 0, w: 2.4, h: 1.0, d: 1.4, kind: 'desk' },
      { x: -18, z: 17, w: 2.2, h: 1.0, d: 1.4, kind: 'desk' },
      { x: -12, z: 17, w: 2.2, h: 1.0, d: 1.4, kind: 'desk' },
      // East Gymnasium Bleachers & Vault Cover
      { x: 21, z: -11, w: 3.0, h: 2.0, d: 10, kind: 'crate' },
      { x: 21, z: 11, w: 3.0, h: 2.0, d: 10, kind: 'crate' },
      { x: 10, z: -6, w: 2.0, h: 1.3, d: 2.0, kind: 'prop' },
      { x: 10, z: 6, w: 2.0, h: 1.3, d: 2.0, kind: 'prop' },
    ],
  },

  // 6. Catacombs: Spiral Ossuary Maze & Central Ritual Altar
  catacombs: {
    id: 'catacombs',
    name: 'Sunken Catacombs',
    subtitle: 'Spiral Bone Crypts',
    difficultyRating: 4,
    arenaHalfSize: 29,
    outdoor: false,
    skyColor: '#050406',
    fogColor: '#0d0910',
    fogDensity: 0.033,
    ambientColor: '#291c2e',
    lightColor: '#c084fc',
    floorColor: '#1e1b22',
    wallColor: '#362f3d',
    accentLightColor: '#a855f7',
    description: 'Asymmetric winding ossuary corridors spiraling around a central sacrificial stone altar.',
    playerSpawns: [
      [-2.5, 4],
      [2.5, 4],
    ],
    duelSpawns: [
      [-23, -22],
      [23, 22],
    ],
    monsterSpawns: [
      [-24, -24],
      [24, -24],
      [-24, 24],
      [24, 24],
      [0, -25],
    ],
    supplyCaches: [
      [0, 0],
      [-19, 10],
      [19, -10],
    ],
    obstacles: [
      // Central Sacrificial Altar
      { x: 0, z: 0, w: 3.2, h: 1.3, d: 2.2, kind: 'table' },
      // Inner Spiral Arms
      { x: -8, z: -6, w: 1.5, h: 4.0, d: 10, kind: 'wall' },
      { x: 8, z: 6, w: 1.5, h: 4.0, d: 10, kind: 'wall' },
      { x: 5, z: -9, w: 10, h: 4.0, d: 1.5, kind: 'wall' },
      { x: -5, z: 9, w: 10, h: 4.0, d: 1.5, kind: 'wall' },
      // Outer Crypt Alcoves & Pillars
      { x: -17, z: 4, w: 1.6, h: 3.8, d: 12, kind: 'wall' },
      { x: 17, z: -4, w: 1.6, h: 3.8, d: 12, kind: 'wall' },
      { x: -17, z: -17, w: 2.8, h: 4.6, d: 2.8, kind: 'pillar' },
      { x: 17, z: 17, w: 2.8, h: 4.6, d: 2.8, kind: 'pillar' },
      { x: 15, z: -18, w: 2.8, h: 4.6, d: 2.8, kind: 'pillar' },
      { x: -15, z: 18, w: 2.8, h: 4.6, d: 2.8, kind: 'pillar' },
    ],
  },

  // 7. Subway: Twin Parallel Tracks & Staggered Wrecked Train Cars
  subway: {
    id: 'subway',
    name: 'Derelict Metro',
    subtitle: 'Sector 9 Underground Line',
    difficultyRating: 5,
    arenaHalfSize: 31,
    outdoor: false,
    skyColor: '#040608',
    fogColor: '#090e14',
    fogDensity: 0.029,
    ambientColor: '#1e293b',
    lightColor: '#38bdf8',
    floorColor: '#1b1f24',
    wallColor: '#2d3748',
    accentLightColor: '#f59e0b',
    description: 'Staggered wrecked metro train cars along twin dark rail tunnels with central ticket turnstiles.',
    playerSpawns: [
      [0, -2.5],
      [0, 2.5],
    ],
    duelSpawns: [
      [-24, -18],
      [24, 18],
    ],
    monsterSpawns: [
      [-26, -24],
      [26, -24],
      [-26, 24],
      [26, 24],
      [-27, 0],
      [27, 0],
    ],
    supplyCaches: [
      [0, 0],
      [-18, -14],
      [18, 14],
    ],
    obstacles: [
      // North Track Wrecked Train Cars (two cars with gap between)
      { x: -14, z: -12, w: 14, h: 3.3, d: 3.1, kind: 'train' },
      { x: 12, z: -12, w: 14, h: 3.3, d: 3.1, kind: 'train' },
      // South Track Staggered Train Cars
      { x: -12, z: 12, w: 14, h: 3.3, d: 3.1, kind: 'train' },
      { x: 14, z: 12, w: 14, h: 3.3, d: 3.1, kind: 'train' },
      // Central Platform Concrete Pillars & Ticket Booths
      { x: -16, z: 0, w: 2.2, h: 4.6, d: 2.2, kind: 'pillar' },
      { x: 16, z: 0, w: 2.2, h: 4.6, d: 2.2, kind: 'pillar' },
      { x: -5, z: -3, w: 2.8, h: 1.5, d: 1.6, kind: 'desk' },
      { x: 5, z: 3, w: 2.8, h: 1.5, d: 1.6, kind: 'desk' },
      { x: 0, z: -22, w: 6, h: 3.4, d: 1.4, kind: 'wall' },
      { x: 0, z: 22, w: 6, h: 3.4, d: 1.4, kind: 'wall' },
    ],
  },

  // 8. NEW: Blackwood Asylum (Central Rotunda Watchtower & Radial Cellblocks)
  asylum: {
    id: 'asylum',
    name: 'Blackwood Asylum',
    subtitle: 'Cellblock Rotunda',
    difficultyRating: 4,
    arenaHalfSize: 30,
    outdoor: false,
    skyColor: '#050708',
    fogColor: '#090d0f',
    fogDensity: 0.031,
    ambientColor: '#1f2937',
    lightColor: '#86efac',
    floorColor: '#1a201e',
    wallColor: '#2c3531',
    accentLightColor: '#ef4444',
    description: 'Central panopticon guard hub radiating padded cellblock corridors with flickering fluorescent tubes.',
    playerSpawns: [
      [0, -4],
      [0, 4],
    ],
    duelSpawns: [
      [-23, 0],
      [23, 0],
    ],
    monsterSpawns: [
      [-24, -24],
      [24, -24],
      [-24, 24],
      [24, 24],
      [-25, 0],
      [25, 0],
    ],
    supplyCaches: [
      [0, 0],
      [-16, -16],
      [16, 16],
    ],
    obstacles: [
      // Central Panopticon Watchtower Pillars
      { x: -4.2, z: -4.2, w: 1.8, h: 4.6, d: 1.8, kind: 'pillar' },
      { x: 4.2, z: -4.2, w: 1.8, h: 4.6, d: 1.8, kind: 'pillar' },
      { x: -4.2, z: 4.2, w: 1.8, h: 4.6, d: 1.8, kind: 'pillar' },
      { x: 4.2, z: 4.2, w: 1.8, h: 4.6, d: 1.8, kind: 'pillar' },
      // Radial Cellblock Corridor Partitions (5 spokes)
      { x: 0, z: -16, w: 1.4, h: 4.0, d: 10, kind: 'wall' },
      { x: -16, z: -10, w: 10, h: 4.0, d: 1.4, kind: 'wall' },
      { x: 16, z: -10, w: 10, h: 4.0, d: 1.4, kind: 'wall' },
      { x: -14, z: 14, w: 1.4, h: 4.0, d: 11, kind: 'wall' },
      { x: 14, z: 14, w: 1.4, h: 4.0, d: 11, kind: 'wall' },
      { x: -20, z: 2, w: 2.6, h: 1.2, d: 2.6, kind: 'crate' },
      { x: 20, z: 2, w: 2.6, h: 1.2, d: 2.6, kind: 'crate' },
    ],
  },

  // 9. NEW: Rustworks Foundry (Industrial Smelter & Shipping Container Maze)
  factory: {
    id: 'factory',
    name: 'Rustworks Foundry',
    subtitle: 'Smelter & Cargo Dock',
    difficultyRating: 4,
    arenaHalfSize: 32,
    outdoor: false,
    skyColor: '#0b0604',
    fogColor: '#120a07',
    fogDensity: 0.027,
    ambientColor: '#2d1c14',
    lightColor: '#fb923c',
    floorColor: '#1c1917',
    wallColor: '#292524',
    accentLightColor: '#f97316',
    description: 'Molten steel foundry with towering industrial cargo containers, assembly lanes, and smelter vats.',
    playerSpawns: [
      [-3, 0],
      [3, 0],
    ],
    duelSpawns: [
      [-25, -22],
      [25, 22],
    ],
    monsterSpawns: [
      [-26, -26],
      [26, -26],
      [-26, 26],
      [26, 26],
      [0, -27],
      [0, 27],
    ],
    supplyCaches: [
      [-15, 0],
      [15, 0],
      [0, -18],
    ],
    obstacles: [
      // Towering Cargo Containers (arranged as asymmetric lane maze)
      { x: -14, z: -14, w: 9.5, h: 3.4, d: 3.4, kind: 'crate' },
      { x: 14, z: 14, w: 9.5, h: 3.4, d: 3.4, kind: 'crate' },
      { x: 16, z: -12, w: 3.4, h: 3.4, d: 9.5, kind: 'crate' },
      { x: -16, z: 12, w: 3.4, h: 3.4, d: 9.5, kind: 'crate' },
      // Central Dual Blast Smelter Furnaces
      { x: -5, z: 0, w: 3.0, h: 4.5, d: 3.0, kind: 'pod' },
      { x: 5, z: 0, w: 3.0, h: 4.5, d: 3.0, kind: 'pod' },
      // Conveyor Assembly Walls
      { x: 0, z: -13, w: 8.5, h: 1.5, d: 2.0, kind: 'prop' },
      { x: 0, z: 13, w: 8.5, h: 1.5, d: 2.0, kind: 'prop' },
      { x: -23, z: -2, w: 3.2, h: 2.6, d: 3.2, kind: 'crate' },
      { x: 23, z: 2, w: 3.2, h: 2.6, d: 3.2, kind: 'crate' },
    ],
  },

  // 10. NEW: Ravenwood Cemetery (Outdoor Foggy Necropolis & Mausoleum)
  graveyard: {
    id: 'graveyard',
    name: 'Ravenwood Necropolis',
    subtitle: 'Foggy Moonlit Cemetery',
    difficultyRating: 3,
    arenaHalfSize: 33,
    outdoor: true,
    skyColor: '#05070e',
    fogColor: '#0a0e1a',
    fogDensity: 0.034,
    ambientColor: '#1e2436',
    lightColor: '#a5b4fc',
    floorColor: '#141915',
    wallColor: '#27272a',
    accentLightColor: '#a855f7',
    description: 'Moonlit outdoor graveyard anchored by a stone mausoleum, winding crypt walls, and headstone rows.',
    playerSpawns: [
      [-2, 8],
      [2, 8],
    ],
    duelSpawns: [
      [-24, -22],
      [24, 22],
    ],
    monsterSpawns: [
      [-27, -27],
      [27, -27],
      [-27, 27],
      [27, 27],
      [0, -28],
    ],
    supplyCaches: [
      [0, -14],
      [-18, 4],
      [18, 4],
    ],
    obstacles: [
      // Central Stone Mausoleum Walls (Open West & East)
      { x: 0, z: -5.5, w: 8, h: 4.0, d: 1.3, kind: 'wall' },
      { x: 0, z: 5.5, w: 8, h: 4.0, d: 1.3, kind: 'wall' },
      // Wrought-Iron Cemetery Divider Walls
      { x: -15, z: -8, w: 1.2, h: 2.4, d: 11, kind: 'wall' },
      { x: 15, z: 8, w: 1.2, h: 2.4, d: 11, kind: 'wall' },
      // Headstone Clusters
      { x: -10, z: -18, w: 1.4, h: 1.9, d: 0.8, kind: 'grave' },
      { x: -5, z: -18, w: 1.4, h: 1.9, d: 0.8, kind: 'grave' },
      { x: 6, z: -18, w: 1.4, h: 1.9, d: 0.8, kind: 'grave' },
      { x: 11, z: -18, w: 1.4, h: 1.9, d: 0.8, kind: 'grave' },
      { x: -10, z: 18, w: 1.4, h: 1.9, d: 0.8, kind: 'grave' },
      { x: 10, z: 18, w: 1.4, h: 1.9, d: 0.8, kind: 'grave' },
      // Dead Pine Trees
      { x: -22, z: 12, w: 1.8, h: 8, d: 1.8, kind: 'tree' },
      { x: 22, z: -12, w: 1.8, h: 8, d: 1.8, kind: 'tree' },
      { x: -21, z: -20, w: 1.7, h: 8, d: 1.7, kind: 'tree' },
      { x: 21, z: 20, w: 1.7, h: 8, d: 1.7, kind: 'tree' },
    ],
  },

  // 11. NEW: Doomsday Bunker 42 (Tight Tactical CQB Zig-Zag)
  bunker: {
    id: 'bunker',
    name: 'Doomsday Bunker 42',
    subtitle: 'Reinforced Blast Vault',
    difficultyRating: 5,
    arenaHalfSize: 25,
    outdoor: false,
    skyColor: '#050608',
    fogColor: '#090b0f',
    fogDensity: 0.026,
    ambientColor: '#262626',
    lightColor: '#fcd34d',
    floorColor: '#1f2023',
    wallColor: '#3f3f46',
    accentLightColor: '#dc2626',
    description: 'Compact concrete nuclear shelter with zig-zagging blast walls and armory cover—built for intense CQB & 1v1s.',
    playerSpawns: [
      [-2, 0],
      [2, 0],
    ],
    duelSpawns: [
      [-19, -18],
      [19, 18],
    ],
    monsterSpawns: [
      [-21, -21],
      [21, -21],
      [-21, 21],
      [21, 21],
      [0, -21],
      [0, 21],
    ],
    supplyCaches: [
      [-12, 0],
      [12, 0],
      [0, 0],
    ],
    obstacles: [
      // Zig-Zag Concrete Blast Barriers
      { x: -9, z: -9, w: 8, h: 3.6, d: 1.4, kind: 'wall' },
      { x: 9, z: 9, w: 8, h: 3.6, d: 1.4, kind: 'wall' },
      { x: -9, z: 9, w: 1.4, h: 3.6, d: 8, kind: 'wall' },
      { x: 9, z: -9, w: 1.4, h: 3.6, d: 8, kind: 'wall' },
      // Central Generator Block
      { x: 0, z: 0, w: 3.2, h: 2.2, d: 3.2, kind: 'crate' },
      // Flanking Ammunition Crates
      { x: -16, z: 0, w: 2.4, h: 1.5, d: 3.4, kind: 'crate' },
      { x: 16, z: 0, w: 2.4, h: 1.5, d: 3.4, kind: 'crate' },
      { x: 0, z: -16, w: 3.4, h: 1.5, d: 2.4, kind: 'crate' },
      { x: 0, z: 16, w: 3.4, h: 1.5, d: 2.4, kind: 'crate' },
    ],
  },

  // 12. NEW: Crimson Helipad (Open Skyscraper Rooftop with HVAC & Skylights)
  rooftop: {
    id: 'rooftop',
    name: 'Crimson Helipad',
    subtitle: 'Stormy Skyscraper Roof',
    difficultyRating: 3,
    arenaHalfSize: 29,
    outdoor: true,
    skyColor: '#09050d',
    fogColor: '#110a18',
    fogDensity: 0.022,
    ambientColor: '#272038',
    lightColor: '#f87171',
    floorColor: '#1b1d24',
    wallColor: '#334155',
    accentLightColor: '#ef4444',
    description: 'High-altitude storm-swept helipad ringed by HVAC chiller units, rooftop skylights, and radio towers.',
    playerSpawns: [
      [-3, 0],
      [3, 0],
    ],
    duelSpawns: [
      [-23, -20],
      [23, 20],
    ],
    monsterSpawns: [
      [-24, -24],
      [24, -24],
      [-24, 24],
      [24, 24],
      [0, -25],
      [0, 25],
    ],
    supplyCaches: [
      [0, 0],
      [-18, 0],
      [18, 0],
    ],
    obstacles: [
      // Helicopter Landing Pad Corner Beacons / HVAC Units
      { x: -13, z: -13, w: 4.5, h: 2.4, d: 3.2, kind: 'crate' },
      { x: 13, z: -13, w: 4.5, h: 2.4, d: 3.2, kind: 'crate' },
      { x: -13, z: 13, w: 4.5, h: 2.4, d: 3.2, kind: 'crate' },
      { x: 13, z: 13, w: 4.5, h: 2.4, d: 3.2, kind: 'crate' },
      // Rooftop Stairwell Penthouse (North) & Elevator Shaft (South)
      { x: 0, z: -20, w: 8, h: 3.8, d: 4.2, kind: 'wall' },
      { x: 0, z: 20, w: 8, h: 3.8, d: 4.2, kind: 'wall' },
      // Long Low Parapet Skylights (vault/peek cover)
      { x: -18, z: 0, w: 2.4, h: 1.25, d: 9, kind: 'prop' },
      { x: 18, z: 0, w: 2.4, h: 1.25, d: 9, kind: 'prop' },
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
  spitter: {
    type: 'spitter',
    name: 'Acid Bile-Spitter',
    hp: 95,
    speed: 4.2,
    damage: 18,
    attackRange: 8.5,
    attackCooldown: 1.85,
    radius: 0.62,
    height: 1.9,
    coinReward: 34,
    scoreReward: 210,
    xpReward: 40,
  },
  howler: {
    type: 'howler',
    name: 'Banshee Howler',
    hp: 120,
    speed: 6.7,
    damage: 17,
    attackRange: 2.0,
    attackCooldown: 0.95,
    radius: 0.58,
    height: 2.15,
    coinReward: 42,
    scoreReward: 260,
    xpReward: 48,
  },
  sentinel: {
    type: 'sentinel',
    name: 'Obsidian Stalker',
    hp: 255,
    speed: 4.9,
    damage: 26,
    attackRange: 2.35,
    attackCooldown: 1.15,
    radius: 0.82,
    height: 2.45,
    coinReward: 65,
    scoreReward: 390,
    xpReward: 72,
  },
  boss: {
    type: 'boss',
    name: 'Abomination Titan',
    hp: 1350,
    speed: 3.3,
    damage: 38,
    attackRange: 3.0,
    attackCooldown: 1.45,
    radius: 1.45,
    height: 3.4,
    coinReward: 250,
    scoreReward: 1600,
    xpReward: 280,
  },
};

export interface GameModeDef {
  id: GameModeId;
  name: string;
  tagline: string;
  description: string;
  hpMult: number;
  speedMult: number;
  rewardMult: number;
  playerSpeedMult: number;
  fireRateMult: number;
  spawnIntervalMs: number;
  fogMult: number;
  bossInterval: number;
  noMonsters?: boolean;
  roundsToWin?: number;
  roundSeconds?: number;
}

export const GAME_MODES: Record<GameModeId, GameModeDef> = {
  unlimited: {
    id: 'unlimited',
    name: 'Endless Nightfall',
    tagline: 'Unlimited Waves · Boss Every 5 Waves',
    description: 'Survive infinite escalating horror waves. An Abomination Titan descends every 5th wave.',
    hpMult: 1.0,
    speedMult: 1.0,
    rewardMult: 1.0,
    playerSpeedMult: 1.0,
    fireRateMult: 1.0,
    spawnIntervalMs: 700,
    fogMult: 1.0,
    bossInterval: 5,
  },
  boss_rush: {
    id: 'boss_rush',
    name: 'Titan Hunt',
    tagline: 'Heavy Elites · +50% Coins & Boss Every 5 Waves',
    description: 'Packed with Sentinels, Brutes, and Titans every 5 waves with +50% coin & XP payouts.',
    hpMult: 1.15,
    speedMult: 1.05,
    rewardMult: 1.5,
    playerSpeedMult: 1.05,
    fireRateMult: 1.05,
    spawnIntervalMs: 650,
    fogMult: 1.0,
    bossInterval: 5,
  },
  blitz: {
    id: 'blitz',
    name: 'Blood Blitz',
    tagline: '+30% Fire Rate & Speed · Fast Swarm Waves',
    description: 'High-adrenaline endless arcade chaos: faster movement, faster guns, relentless swarms, boss every 5 waves.',
    hpMult: 0.9,
    speedMult: 1.18,
    rewardMult: 1.25,
    playerSpeedMult: 1.22,
    fireRateMult: 1.28,
    spawnIntervalMs: 460,
    fogMult: 0.85,
    bossInterval: 5,
  },
  hardcore: {
    id: 'hardcore',
    name: 'Blackout Nightmare',
    tagline: 'Dense Fog · +75% Rewards · Boss Every 5 Waves',
    description: 'Thick oppressive darkness and lethal monsters for elite operatives seeking maximum coins & XP.',
    hpMult: 1.35,
    speedMult: 1.14,
    rewardMult: 1.75,
    playerSpeedMult: 1.0,
    fireRateMult: 1.0,
    spawnIntervalMs: 620,
    fogMult: 1.38,
    bossInterval: 5,
  },
  duel_1v1: {
    id: 'duel_1v1',
    name: '1v1 Arena Duel',
    tagline: 'Zero Zombies · First to 5 Round Wins',
    description: 'Pure 1v1 PvP combat (or vs Adaptive Arena Bot). No monsters, wall-blocked sightlines, full multi-round duel.',
    hpMult: 1.0,
    speedMult: 1.0,
    rewardMult: 1.5,
    playerSpeedMult: 1.1,
    fireRateMult: 1.0,
    spawnIntervalMs: 999999,
    fogMult: 0.72,
    bossInterval: 0,
    noMonsters: true,
    roundsToWin: 5,
    roundSeconds: 90,
  },
};

export function resolveCircleObstacles(
  x: number,
  z: number,
  radius: number,
  map: MapDef
): { x: number; z: number; collided: boolean } {
  const limit = map.arenaHalfSize - radius - 0.5;
  let nx = Math.max(-limit, Math.min(limit, x));
  let nz = Math.max(-limit, Math.min(limit, z));
  let collided = nx !== x || nz !== z;

  for (const obs of map.obstacles) {
    const hw = obs.w / 2 + radius;
    const hd = obs.d / 2 + radius;
    const dx = nx - obs.x;
    const dz = nz - obs.z;
    if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
      collided = true;
      const penX = hw - Math.abs(dx);
      const penZ = hd - Math.abs(dz);
      if (penX < penZ) nx += dx >= 0 ? penX : -penX;
      else nz += dz >= 0 ? penZ : -penZ;
    }
  }
  return { x: nx, z: nz, collided };
}

/**
 * 3D slab ray-AABB intersection test against map perimeter walls and obstacles.
 * Returns closest positive hit distance along (dx, dy, dz) within maxDist, or null if clear.
 */
export function segmentHitsObstacleDist(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
  map: MapDef
): number | null {
  let closest: number | null = null;

  const checkBox = (minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number) => {
    let tMin = 0;
    let tMax = maxDist;

    const axes: Array<[number, number, number, number]> = [
      [ox, dx, minX, maxX],
      [oy, dy, minY, maxY],
      [oz, dz, minZ, maxZ],
    ];
    for (const [o, d, bMin, bMax] of axes) {
      if (Math.abs(d) < 1e-8) {
        if (o < bMin || o > bMax) return;
      } else {
        let t1 = (bMin - o) / d;
        let t2 = (bMax - o) / d;
        if (t1 > t2) {
          const tmp = t1;
          t1 = t2;
          t2 = tmp;
        }
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) return;
      }
    }
    if (tMin > 0 && tMin <= maxDist && (closest === null || tMin < closest)) {
      closest = tMin;
    }
  };

  for (const obs of map.obstacles) {
    checkBox(
      obs.x - obs.w / 2,
      obs.x + obs.w / 2,
      0,
      obs.h,
      obs.z - obs.d / 2,
      obs.z + obs.d / 2
    );
  }

  // Ground plane
  if (dy < -1e-6 && oy > 0) {
    const tFloor = -oy / dy;
    if (tFloor > 0 && tFloor <= maxDist && (closest === null || tFloor < closest)) {
      closest = tFloor;
    }
  }

  return closest;
}

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

export const HEALTH_PURCHASE_COST = 80;
export const HEALTH_PURCHASE_AMOUNT = 55;
export const MAX_HEALTH_PURCHASES_PER_MATCH = 999;

export function getHealthPurchaseCost(purchasesUsed: number): number {
  return 80 + Math.max(0, purchasesUsed) * 45;
}

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
  { id: 'first_blood', name: 'First Blood', description: 'Eliminate your first 10 enemies.', rewardCoins: 100, target: 10, statKey: 'total_kills' },
  { id: 'slayer_100', name: 'Night Slayer', description: 'Eliminate 100 enemies across matches.', rewardCoins: 350, target: 100, statKey: 'total_kills' },
  { id: 'slayer_500', name: 'Apex Exterminator', description: 'Eliminate 500 enemies across matches.', rewardCoins: 900, target: 500, statKey: 'total_kills' },
  { id: 'titan_fall', name: 'Titan Slayer', description: 'Defeat 3 Abomination Bosses.', rewardCoins: 450, target: 3, statKey: 'boss_kills' },
  { id: 'survivor_win', name: 'Dawn Survivor', description: 'Complete and win 3 matches.', rewardCoins: 400, target: 3, statKey: 'matches_won' },
  { id: 'arsenal_collector', name: 'Arms Dealer', description: 'Unlock 8 different weapons in the shop.', rewardCoins: 600, target: 8, statKey: 'weapons_unlocked' },
];
