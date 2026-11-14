import React, { useRef, useState } from 'react';
import {
  Crosshair,
  Flashlight,
  HeartPulse,
  Pause,
  RotateCw,
  Skull,
  Coins,
  Shield,
} from 'lucide-react';
import {
  GAME_MODES,
  HEALTH_PURCHASE_COST,
  MAX_HEALTH_PURCHASES_PER_MATCH,
  WEAPON_ORDER,
  WEAPONS,
  WeaponId,
} from '../shared/gameData';
import { HudSnapshot } from '../game/GameEngine';

interface Props {
  hud: HudSnapshot;
  ownedWeapons: Record<string, { upgradeLevel: number }>;
  hitMarker: { active: boolean; killed: boolean };
  waveBanner: string | null;
  damageFlash: boolean;
  healPulse: boolean;
  mobileControls: boolean;
  onPause: () => void;
  onBuyHealth: () => void;
  onSwitchWeapon: (id: WeaponId) => void;
  onReload: () => void;
  onToggleFlashlight: () => void;
  onLockPointer: () => void;
  onMobileMove: (x: number, y: number) => void;
  onMobileLook: (dx: number, dy: number) => void;
  onMobileShoot: (active: boolean) => void;
  onMobileAim: (active: boolean) => void;
  onMobileJump: () => void;
}

export function GameHud({
  hud,
  ownedWeapons,
  hitMarker,
  waveBanner,
  damageFlash,
  healPulse,
  mobileControls,
  onPause,
  onBuyHealth,
  onSwitchWeapon,
  onReload,
  onToggleFlashlight,
  onLockPointer,
  onMobileMove,
  onMobileLook,
  onMobileShoot,
  onMobileAim,
  onMobileJump,
}: Props) {
  const joyTouchId = useRef<number | null>(null);
  const joyOrigin = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lookTouchId = useRef<number | null>(null);
  const lookPrev = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const fireTouchId = useRef<number | null>(null);
  const firePrev = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const [joyKnob, setJoyKnob] = useState<{ x: number; y: number; active: boolean; sprinting: boolean }>({
    x: 0,
    y: 0,
    active: false,
    sprinting: false,
  });
  const [mobileAdsOn, setMobileAdsOn] = useState(false);

  const remainingHealthBuys = MAX_HEALTH_PURCHASES_PER_MATCH - hud.healthPurchasesUsed;
  const mins = Math.floor(hud.elapsedSec / 60);
  const secs = String(hud.elapsedSec % 60).padStart(2, '0');
  const modeDef = GAME_MODES[hud.gameMode] || GAME_MODES.unlimited;
  const bossInterval = modeDef.bossInterval || 5;
  const isBossWave = hud.wave % bossInterval === 0;
  const wavesToBoss = bossInterval - (hud.wave % bossInterval || bossInterval);

  const mapRadius = 56;
  const toMini = (wx: number, wz: number) => {
    const scale = (mapRadius - 6) / Math.max(1, hud.minimap.arenaHalfSize);
    return {
      cx: mapRadius + wx * scale,
      cy: mapRadius + wz * scale,
    };
  };
  const pMini = toMini(hud.minimap.playerX, hud.minimap.playerZ);

  const findTouchById = (touches: React.TouchList, id: number | null) => {
    if (id === null) return null;
    for (let i = 0; i < touches.length; i++) {
      if (touches[i].identifier === id) return touches[i];
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-20 pointer-events-none select-none overflow-hidden">
      {/* Red damage edge vignette */}
      {damageFlash && (
        <div
          className="absolute inset-0 transition-opacity duration-150"
          style={{
            boxShadow: 'inset 0 0 110px 40px rgba(220, 38, 38, 0.58)',
          }}
        />
      )}

      {/* Emerald Medkit Heal Pulse */}
      {healPulse && (
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{
            boxShadow: 'inset 0 0 110px 36px rgba(16, 185, 129, 0.52)',
          }}
        >
          <div className="absolute top-[28%] left-1/2 -translate-x-1/2 bg-emerald-950/90 border border-emerald-400/70 rounded-full px-5 py-1.5 flex items-center gap-2 shadow-lg animate-bounce">
            <HeartPulse className="w-4 h-4 text-emerald-400" />
            <span className="font-display font-bold text-sm text-emerald-200">+55 HP MEDKIT APPLIED</span>
          </div>
        </div>
      )}

      {/* TOP LEFT: Player Health, Medkit Purchases, Teammate Health */}
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex flex-col gap-2 max-w-[230px] sm:max-w-xs">
        <div className="bg-[#0a0e16]/88 backdrop-blur-md border border-slate-700/45 rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-lg">
          <div className="flex items-center justify-between gap-4 mb-1.5">
            <span className="text-xs font-medium text-slate-300">Health</span>
            <span className="font-mono-num text-sm font-bold text-slate-100">
              {Math.ceil(hud.hp)} / {hud.maxHp}
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-900 rounded-sm overflow-hidden">
            <div
              className={`h-full transition-all duration-150 ${
                hud.hp > 50 ? 'bg-emerald-500' : hud.hp > 25 ? 'bg-amber-500' : 'bg-red-600'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100))}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 pointer-events-auto">
            <button
              onClick={onBuyHealth}
              disabled={remainingHealthBuys <= 0 || hud.hp >= hud.maxHp || !hud.alive}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-emerald-700/80 disabled:opacity-45 text-slate-100 transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap shrink-0"
            >
              <HeartPulse className="w-3.5 h-3.5 text-emerald-400" />
              <span>Medkit ({HEALTH_PURCHASE_COST}c)</span>
            </button>
            <span className="font-mono-num text-[11px] text-slate-400">
              {remainingHealthBuys}/{MAX_HEALTH_PURCHASES_PER_MATCH} [H]
            </span>
          </div>
        </div>

        {/* Teammate Status (2-player co-op) */}
        {hud.teammate && (
          <div className="bg-[#0a0e16]/85 backdrop-blur-md border border-sky-700/40 rounded-xl px-3.5 py-2">
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="text-xs font-medium text-sky-300 truncate max-w-[130px]">
                {hud.teammate.username}
              </span>
              <span className="font-mono-num text-xs text-slate-300">
                {hud.teammate.alive ? `${Math.ceil(hud.teammate.hp)} HP` : 'DOWN'}
              </span>
            </div>
            <div className="w-40 h-1.5 bg-slate-900 rounded-sm overflow-hidden">
              <div
                className={`h-full ${hud.teammate.alive ? 'bg-sky-500' : 'bg-red-800'}`}
                style={{ width: `${Math.max(0, (hud.teammate.hp / hud.teammate.maxHp) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* TOP CENTER: Unlimited Wave, Mode, Timer, Hostiles + Boss Bar */}
      <div className="absolute top-3 sm:top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        <div className="bg-[#0a0e16]/88 backdrop-blur-md border border-slate-700/45 rounded-xl px-3.5 sm:px-5 py-2 flex items-center gap-3.5 sm:gap-5 shadow-lg">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">{modeDef.name}</div>
            <div className="font-display font-bold text-base sm:text-lg text-slate-100 font-mono-num leading-tight">
              WAVE {hud.wave}{' '}
              <span className="text-xs font-semibold text-amber-400">
                {isBossWave ? '· BOSS' : `· BOSS -${wavesToBoss}`}
              </span>
            </div>
          </div>
          <div className="w-px h-7 bg-slate-800" />
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Time</div>
            <div className="font-mono-num font-semibold text-sm sm:text-base text-slate-100 leading-tight">
              {mins}:{secs}
            </div>
          </div>
          <div className="w-px h-7 bg-slate-800" />
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Hostiles</div>
            <div className="font-mono-num font-semibold text-sm sm:text-base text-red-400 leading-tight">
              {hud.monstersRemaining}
            </div>
          </div>
        </div>

        {/* Boss HP Bar */}
        {hud.boss && (
          <div className="w-64 sm:w-80 bg-[#0d080c]/92 border border-red-600/60 rounded-xl px-4 py-2 shadow-xl">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-display font-bold text-red-300 tracking-wide uppercase">
                {hud.boss.name}
              </span>
              <span className="font-mono-num text-red-200 font-semibold">
                {Math.ceil(hud.boss.hp)} / {hud.boss.maxHp}
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-700 via-red-500 to-amber-500 transition-all duration-100"
                style={{ width: `${Math.max(0, Math.min(100, (hud.boss.hp / hud.boss.maxHp) * 100))}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* TOP RIGHT: Score, Coins, Tactical Minimap, Pause */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-start gap-2.5">
        <div className="bg-[#0a0e16]/88 backdrop-blur-md border border-slate-700/45 rounded-xl px-3 py-2 text-right space-y-0.5 shadow-lg">
          <div className="flex items-center justify-end gap-1.5 text-xs text-slate-300">
            <Skull className="w-3.5 h-3.5 text-red-500" />
            <span className="font-mono-num font-semibold text-slate-100">{hud.kills}</span>
            <span className="text-slate-500">·</span>
            <span className="font-mono-num text-slate-300">{hud.score.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-end gap-1 text-xs text-amber-400">
            <Coins className="w-3.5 h-3.5" />
            <span className="font-mono-num font-semibold">+{hud.coinsEarned}</span>
          </div>
        </div>

        {/* Minimap */}
        <div className="hidden sm:block bg-[#0a0e16]/88 backdrop-blur-md border border-slate-700/45 rounded-xl p-1.5 shadow-lg">
          <svg width={mapRadius * 2} height={mapRadius * 2} className="block">
            <rect
              x={2}
              y={2}
              width={mapRadius * 2 - 4}
              height={mapRadius * 2 - 4}
              fill="#070a10"
              stroke="rgba(148,163,184,0.22)"
              strokeWidth="1"
            />
            {hud.minimap.coins.map((c, idx) => {
              const p = toMini(c.x, c.z);
              return <circle key={`c-${idx}`} cx={p.cx} cy={p.cy} r={2} fill="#f59e0b" />;
            })}
            {hud.minimap.monsters.map((m, idx) => {
              const p = toMini(m.x, m.z);
              return (
                <circle
                  key={`m-${idx}`}
                  cx={p.cx}
                  cy={p.cy}
                  r={m.isBoss ? 4.4 : 2.4}
                  fill={m.isBoss ? '#f97316' : '#ef4444'}
                />
              );
            })}
            {hud.teammate && hud.teammate.alive && (
              <circle
                cx={toMini(hud.teammate.x, hud.teammate.z).cx}
                cy={toMini(hud.teammate.x, hud.teammate.z).cy}
                r={3.5}
                fill="#38bdf8"
              />
            )}
            <circle cx={pMini.cx} cy={pMini.cy} r={3.8} fill="#22c55e" />
          </svg>
        </div>

        <button
          onClick={onPause}
          aria-label="Pause Game"
          className="pointer-events-auto p-2.5 rounded-xl bg-[#0a0e16]/88 backdrop-blur-md border border-slate-700/50 hover:border-slate-500 text-slate-200 cursor-pointer shadow-lg"
        >
          <Pause className="w-4 h-4" />
        </button>
      </div>

      {/* CENTER: Crosshair, Hit Marker, Reload Indicator, Wave Banner, Paused-By Banner */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-100/95 shadow" />
          <div className="absolute w-4 h-px bg-slate-200/60 -left-5" />
          <div className="absolute w-4 h-px bg-slate-200/60 -right-5" />
          <div className="absolute h-4 w-px bg-slate-200/60 -top-5" />
          <div className="absolute h-4 w-px bg-slate-200/60 -bottom-5" />

          {hitMarker.active && (
            <svg
              viewBox="0 0 24 24"
              className={`absolute w-7 h-7 ${hitMarker.killed ? 'text-red-500' : 'text-amber-300'}`}
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="4" y1="4" x2="9" y2="9" />
              <line x1="20" y1="4" x2="15" y2="9" />
              <line x1="4" y1="20" x2="9" y2="15" />
              <line x1="20" y1="20" x2="15" y2="15" />
            </svg>
          )}
        </div>

        {hud.reloading && (
          <div className="absolute top-[56%] flex flex-col items-center gap-1">
            <span className="text-xs font-semibold text-amber-400">Reloading...</span>
            <div className="w-28 h-1.5 bg-slate-900 rounded overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-all duration-75"
                style={{ width: `${Math.round(hud.reloadProgress * 100)}%` }}
              />
            </div>
          </div>
        )}

        {waveBanner && (
          <div className="absolute top-[22%] bg-[#0a0e16]/92 border border-red-600/70 rounded-xl px-6 py-3 text-center shadow-2xl">
            <div className="font-display text-2xl font-bold text-red-400 tracking-wide">{waveBanner}</div>
          </div>
        )}

        {/* Multiplayer Pause Overlay (teammate sees this while NPCs are frozen) */}
        {hud.pausedBy.length > 0 && (
          <div className="absolute top-[34%] bg-[#0b101b]/95 border border-amber-500/70 rounded-2xl px-6 py-4 text-center shadow-2xl max-w-sm">
            <div className="flex items-center justify-center gap-2 text-amber-400 font-display font-bold text-lg">
              <Shield className="w-5 h-5" />
              <span>PAUSED BY {hud.pausedBy.join(', ').toUpperCase()}</span>
            </div>
            <div className="text-xs text-slate-300 mt-1">
              All monsters are frozen and cannot attack until resumed.
            </div>
          </div>
        )}

        {!mobileControls && !hud.pointerLocked && hud.alive && hud.pausedBy.length === 0 && (
          <button
            onClick={onLockPointer}
            className="pointer-events-auto absolute top-[63%] bg-[#0a0e16]/90 border border-slate-600/60 hover:border-red-500 rounded-xl px-4 py-2 text-xs text-slate-200 cursor-pointer shadow-lg"
          >
            Click screen to aim &amp; hold Fire to spray · ESC to pause
          </button>
        )}

        {!hud.alive && (
          <div className="absolute top-[34%] bg-red-950/92 border border-red-600/70 rounded-xl px-6 py-4 text-center shadow-2xl">
            <div className="font-display text-2xl font-bold text-red-200">YOU HAVE FALLEN</div>
            <div className="text-xs text-red-300 mt-1">
              {hud.teammate?.alive ? 'Spectating teammate until wave ends...' : 'Match ending...'}
            </div>
          </div>
        )}
      </div>

      {/* DESKTOP BOTTOM RIGHT: Weapon Info + Quick Switch Bar */}
      {!mobileControls && (
        <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
          <div className="bg-[#0a0e16]/88 backdrop-blur-md border border-slate-700/45 rounded-xl px-4 py-2.5 text-right shadow-lg">
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={onToggleFlashlight}
                className="pointer-events-auto text-xs text-slate-400 hover:text-amber-300 cursor-pointer"
                title="Toggle Flashlight [F]"
              >
                <Flashlight className={`w-4 h-4 ${hud.flashlightOn ? 'text-amber-300' : 'text-slate-600'}`} />
              </button>
              <span className="font-display font-semibold text-base text-slate-100">{hud.weaponName}</span>
            </div>
            <div className="font-mono-num text-2xl font-bold text-slate-100 mt-0.5">
              {hud.ammo} <span className="text-sm font-normal text-slate-400">/ ∞</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1 pointer-events-auto">
            {WEAPON_ORDER.map((wid, idx) => {
              const owned = Boolean(ownedWeapons[wid]);
              if (!owned) return null;
              const active = hud.weaponId === wid;
              return (
                <button
                  key={wid}
                  onClick={() => onSwitchWeapon(wid)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-red-600 text-white shadow'
                      : 'bg-[#0a0e16]/88 border border-slate-700/45 text-slate-300 hover:text-white'
                  }`}
                >
                  <span className="font-mono-num opacity-70 mr-1">{idx + 1}</span>
                  {WEAPONS[wid].name.split(' ')[0]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* PRO MOBILE / TOUCH CONTROLS */}
      {mobileControls && (
        <>
          {/* Compact Weapon + Ammo Strip at Bottom Center */}
          <div className="pointer-events-auto absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 max-w-[54vw]">
            <div className="bg-[#0a0e16]/88 backdrop-blur-md border border-slate-700/50 rounded-full px-3.5 py-1 flex items-center gap-2.5 text-xs">
              <span className="font-display font-semibold text-slate-100 truncate">{hud.weaponName}</span>
              <span className="font-mono-num font-bold text-amber-300">{hud.ammo}/∞</span>
              <button
                onClick={onToggleFlashlight}
                className="p-0.5 text-slate-300"
                aria-label="Flashlight"
              >
                <Flashlight className={`w-3.5 h-3.5 ${hud.flashlightOn ? 'text-amber-300' : 'text-slate-600'}`} />
              </button>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto max-w-full px-1">
              {WEAPON_ORDER.map((wid) => {
                if (!ownedWeapons[wid]) return null;
                const active = hud.weaponId === wid;
                return (
                  <button
                    key={wid}
                    onClick={() => onSwitchWeapon(wid)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                      active
                        ? 'bg-red-600 text-white'
                        : 'bg-[#0a0e16]/85 border border-slate-700/50 text-slate-300'
                    }`}
                  >
                    {WEAPONS[wid].name.split(' ')[0]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Left Virtual Movement Joystick (Multi-touch tracked) */}
          <div
            className="pointer-events-auto absolute bottom-6 left-5 w-36 h-36 rounded-full bg-slate-950/55 border-2 border-slate-600/45 flex items-center justify-center touch-none"
            onTouchStart={(e) => {
              e.preventDefault();
              if (joyTouchId.current !== null) return;
              const t = e.changedTouches[0];
              joyTouchId.current = t.identifier;
              const rect = e.currentTarget.getBoundingClientRect();
              joyOrigin.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
              const rawX = t.clientX - joyOrigin.current.x;
              const rawY = t.clientY - joyOrigin.current.y;
              const maxR = 52;
              const mag = Math.hypot(rawX, rawY);
              const clamped = mag > maxR ? maxR / mag : 1;
              const kx = rawX * clamped;
              const ky = rawY * clamped;
              const nx = kx / maxR;
              const ny = ky / maxR;
              setJoyKnob({ x: kx, y: ky, active: true, sprinting: Math.hypot(nx, ny) > 0.78 });
              onMobileMove(nx, ny);
            }}
            onTouchMove={(e) => {
              const t = findTouchById(e.touches, joyTouchId.current);
              if (!t) return;
              const rawX = t.clientX - joyOrigin.current.x;
              const rawY = t.clientY - joyOrigin.current.y;
              const maxR = 52;
              const mag = Math.hypot(rawX, rawY);
              const clamped = mag > maxR ? maxR / mag : 1;
              const kx = rawX * clamped;
              const ky = rawY * clamped;
              const nx = kx / maxR;
              const ny = ky / maxR;
              setJoyKnob({ x: kx, y: ky, active: true, sprinting: Math.hypot(nx, ny) > 0.78 });
              onMobileMove(nx, ny);
            }}
            onTouchEnd={(e) => {
              if (!findTouchById(e.touches, joyTouchId.current)) {
                joyTouchId.current = null;
                setJoyKnob({ x: 0, y: 0, active: false, sprinting: false });
                onMobileMove(0, 0);
              }
            }}
            onTouchCancel={() => {
              joyTouchId.current = null;
              setJoyKnob({ x: 0, y: 0, active: false, sprinting: false });
              onMobileMove(0, 0);
            }}
          >
            {/* Sprint outer indicator */}
            <span className="absolute -top-5 text-[10px] font-semibold tracking-wider text-slate-400">
              {joyKnob.sprinting ? 'SPRINTING' : 'MOVE'}
            </span>
            <div
              className={`w-14 h-14 rounded-full border-2 transition-colors ${
                joyKnob.sprinting
                  ? 'bg-red-500/45 border-red-300'
                  : joyKnob.active
                  ? 'bg-slate-300/40 border-slate-200'
                  : 'bg-slate-400/25 border-slate-400/45'
              }`}
              style={{
                transform: `translate(${joyKnob.x}px, ${joyKnob.y}px)`,
              }}
            />
          </div>

          {/* Right Look Surface (Multi-touch tracked) */}
          <div
            className="pointer-events-auto absolute inset-y-16 right-0 w-[55%] touch-none"
            onTouchStart={(e) => {
              if (lookTouchId.current !== null) return;
              const t = e.changedTouches[0];
              lookTouchId.current = t.identifier;
              lookPrev.current = { x: t.clientX, y: t.clientY };
            }}
            onTouchMove={(e) => {
              const t = findTouchById(e.touches, lookTouchId.current);
              if (!t) return;
              onMobileLook((t.clientX - lookPrev.current.x) * 1.35, (t.clientY - lookPrev.current.y) * 1.35);
              lookPrev.current = { x: t.clientX, y: t.clientY };
            }}
            onTouchEnd={(e) => {
              if (!findTouchById(e.touches, lookTouchId.current)) {
                lookTouchId.current = null;
              }
            }}
            onTouchCancel={() => {
              lookTouchId.current = null;
            }}
          />

          {/* Ergonomic Mobile Action Cluster */}
          <div className="pointer-events-auto absolute bottom-6 right-5 flex flex-col items-end gap-3 touch-none">
            {/* Top Utility Row: Medkit, ADS Toggle, Reload */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={onBuyHealth}
                disabled={remainingHealthBuys <= 0 || hud.hp >= hud.maxHp || !hud.alive}
                className="w-12 h-12 rounded-full bg-emerald-950/85 border border-emerald-500/60 disabled:opacity-40 text-emerald-300 flex flex-col items-center justify-center active:scale-95"
                aria-label="Medkit"
              >
                <HeartPulse className="w-4 h-4" />
                <span className="text-[9px] font-mono-num">{remainingHealthBuys}</span>
              </button>
              <button
                onClick={() => {
                  const next = !mobileAdsOn;
                  setMobileAdsOn(next);
                  onMobileAim(next);
                }}
                className={`w-12 h-12 rounded-full border flex items-center justify-center active:scale-95 ${
                  mobileAdsOn
                    ? 'bg-red-600/85 border-red-300 text-white'
                    : 'bg-slate-900/85 border-slate-600/60 text-slate-200'
                }`}
                aria-label="Toggle Aim"
              >
                <Crosshair className="w-5 h-5" />
              </button>
              <button
                onClick={onReload}
                className="w-12 h-12 rounded-full bg-slate-900/85 border border-slate-600/60 text-slate-200 flex items-center justify-center active:bg-slate-700"
                aria-label="Reload"
              >
                <RotateCw className="w-5 h-5" />
              </button>
            </div>

            {/* Bottom Combat Row: Jump + Drag-to-Aim Hold-to-Spam Fire */}
            <div className="flex items-center gap-3">
              <button
                onTouchStart={(e) => {
                  e.preventDefault();
                  onMobileJump();
                }}
                onClick={onMobileJump}
                className="w-14 h-14 rounded-full bg-slate-900/85 border border-slate-600/60 text-xs font-semibold text-slate-200 active:bg-slate-700"
              >
                JUMP
              </button>
              <button
                onTouchStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const t = e.changedTouches[0];
                  fireTouchId.current = t.identifier;
                  firePrev.current = { x: t.clientX, y: t.clientY };
                  onMobileShoot(true);
                }}
                onTouchMove={(e) => {
                  const t = findTouchById(e.touches, fireTouchId.current);
                  if (!t) return;
                  // Allow aiming while holding FIRE!
                  onMobileLook((t.clientX - firePrev.current.x) * 1.25, (t.clientY - firePrev.current.y) * 1.25);
                  firePrev.current = { x: t.clientX, y: t.clientY };
                }}
                onTouchEnd={(e) => {
                  if (!findTouchById(e.touches, fireTouchId.current)) {
                    fireTouchId.current = null;
                    onMobileShoot(false);
                  }
                }}
                onTouchCancel={() => {
                  fireTouchId.current = null;
                  onMobileShoot(false);
                }}
                className="w-20 h-20 rounded-full bg-red-600/92 border-2 border-red-300 text-sm font-display font-bold text-white shadow-[0_0_24px_rgba(220,38,38,0.45)] active:scale-95"
              >
                FIRE
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
