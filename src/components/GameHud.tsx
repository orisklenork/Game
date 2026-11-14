import React, { useRef } from 'react';
import {
  Crosshair,
  Flashlight,
  HeartPulse,
  Pause,
  RotateCw,
  ShieldAlert,
  Skull,
  Coins,
} from 'lucide-react';
import {
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
  onCycleWeapon: () => void;
}

export function GameHud({
  hud,
  ownedWeapons,
  hitMarker,
  waveBanner,
  damageFlash,
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
  onCycleWeapon,
}: Props) {
  const joyOrigin = useRef<{ x: number; y: number } | null>(null);
  const lookOrigin = useRef<{ x: number; y: number } | null>(null);

  const remainingHealthBuys = MAX_HEALTH_PURCHASES_PER_MATCH - hud.healthPurchasesUsed;
  const mins = Math.floor(hud.elapsedSec / 60);
  const secs = String(hud.elapsedSec % 60).padStart(2, '0');

  // Minimap coordinate converter
  const mapRadius = 56;
  const toMini = (wx: number, wz: number) => {
    const scale = (mapRadius - 6) / Math.max(1, hud.minimap.arenaHalfSize);
    return {
      cx: mapRadius + wx * scale,
      cy: mapRadius + wz * scale,
    };
  };
  const pMini = toMini(hud.minimap.playerX, hud.minimap.playerZ);

  return (
    <div className="fixed inset-0 z-20 pointer-events-none select-none overflow-hidden">
      {/* Red damage edge vignette */}
      {damageFlash && (
        <div
          className="absolute inset-0 transition-opacity duration-150"
          style={{
            boxShadow: 'inset 0 0 110px 40px rgba(220, 38, 38, 0.55)',
          }}
        />
      )}

      {/* TOP LEFT: Player Health, Medkit Purchases, Teammate Health */}
      <div className="absolute top-4 left-4 flex flex-col gap-2.5 max-w-xs">
        <div className="bg-[#0a0e16]/85 border border-slate-700/40 rounded-lg px-4 py-3">
          <div className="flex items-center justify-between gap-4 mb-1.5">
            <span className="text-xs font-medium text-slate-300">Health</span>
            <span className="font-mono-num text-sm font-semibold text-slate-100">
              {Math.ceil(hud.hp)} / {hud.maxHp}
            </span>
          </div>
          <div className="w-48 h-2.5 bg-slate-900 rounded-sm overflow-hidden">
            <div
              className={`h-full transition-all duration-150 ${
                hud.hp > 50 ? 'bg-emerald-500' : hud.hp > 25 ? 'bg-amber-500' : 'bg-red-600'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100))}%` }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2 pointer-events-auto">
            <button
              onClick={onBuyHealth}
              disabled={remainingHealthBuys <= 0 || hud.hp >= hud.maxHp || !hud.alive}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded bg-slate-800 hover:bg-red-700/80 disabled:opacity-45 text-slate-100 transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap shrink-0"
            >
              <HeartPulse className="w-3.5 h-3.5 text-red-400" />
              <span>Medkit ({HEALTH_PURCHASE_COST}c)</span>
            </button>
            <span className="font-mono-num text-xs text-slate-400">
              {remainingHealthBuys}/{MAX_HEALTH_PURCHASES_PER_MATCH} left [H]
            </span>
          </div>
        </div>

        {/* Teammate Status (when in 2-player co-op) */}
        {hud.teammate && (
          <div className="bg-[#0a0e16]/80 border border-slate-700/40 rounded-lg px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="text-xs font-medium text-sky-300 truncate max-w-[130px]">
                {hud.teammate.username}
              </span>
              <span className="font-mono-num text-xs text-slate-300">
                {hud.teammate.alive ? `${Math.ceil(hud.teammate.hp)} HP` : 'DOWN'}
              </span>
            </div>
            <div className="w-44 h-1.5 bg-slate-900 rounded-sm overflow-hidden">
              <div
                className={`h-full ${hud.teammate.alive ? 'bg-sky-500' : 'bg-red-800'}`}
                style={{ width: `${Math.max(0, (hud.teammate.hp / hud.teammate.maxHp) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* TOP CENTER: Wave, Timer, Monsters Remaining */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#0a0e16]/85 border border-slate-700/40 rounded-lg px-5 py-2 flex items-center gap-5">
        <div className="text-center">
          <div className="text-[11px] text-slate-400">Wave</div>
          <div className="font-display font-bold text-lg text-slate-100 font-mono-num leading-tight">
            {hud.wave} / {hud.maxWaves}
          </div>
        </div>
        <div className="w-px h-7 bg-slate-800" />
        <div className="text-center">
          <div className="text-[11px] text-slate-400">Time</div>
          <div className="font-mono-num font-semibold text-base text-slate-100 leading-tight">
            {mins}:{secs}
          </div>
        </div>
        <div className="w-px h-7 bg-slate-800" />
        <div className="text-center">
          <div className="text-[11px] text-slate-400">Hostiles</div>
          <div className="font-mono-num font-semibold text-base text-red-400 leading-tight">
            {hud.monstersRemaining}
          </div>
        </div>
      </div>

      {/* TOP RIGHT: Tactical Minimap, Score, Coins, Pause */}
      <div className="absolute top-4 right-4 flex items-start gap-3">
        <div className="bg-[#0a0e16]/85 border border-slate-700/40 rounded-lg px-3.5 py-2.5 text-right space-y-1">
          <div className="flex items-center justify-end gap-2 text-xs text-slate-300">
            <Skull className="w-3.5 h-3.5 text-red-500" />
            <span className="font-mono-num font-semibold text-slate-100">{hud.kills}</span>
            <span className="text-slate-500">·</span>
            <span className="font-mono-num text-slate-300">{hud.score.toLocaleString()} pts</span>
          </div>
          <div className="flex items-center justify-end gap-1.5 text-xs text-amber-400">
            <Coins className="w-3.5 h-3.5" />
            <span className="font-mono-num font-semibold">+{hud.coinsEarned}</span>
          </div>
        </div>

        {/* Minimap */}
        <div className="hidden sm:block bg-[#0a0e16]/85 border border-slate-700/40 rounded-lg p-1.5">
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
                  r={m.isBoss ? 4.2 : 2.3}
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
          className="pointer-events-auto p-2.5 rounded-lg bg-[#0a0e16]/85 border border-slate-700/40 hover:border-slate-500 text-slate-200 cursor-pointer"
        >
          <Pause className="w-4 h-4" />
        </button>
      </div>

      {/* CENTER: Crosshair, Hit Marker, Reload Indicator, Wave Banner, Click-to-Lock */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-100/90" />
          <div className="absolute w-5 h-px bg-slate-200/50 -left-6" />
          <div className="absolute w-5 h-px bg-slate-200/50 -right-6" />
          <div className="absolute h-5 w-px bg-slate-200/50 -top-6" />
          <div className="absolute h-5 w-px bg-slate-200/50 -bottom-6" />

          {hitMarker.active && (
            <svg
              viewBox="0 0 24 24"
              className={`absolute w-7 h-7 ${hitMarker.killed ? 'text-red-500' : 'text-amber-300'}`}
              stroke="currentColor"
              strokeWidth="2.4"
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
            <span className="text-xs font-medium text-amber-400">Reloading...</span>
            <div className="w-28 h-1.5 bg-slate-900 rounded overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-all duration-75"
                style={{ width: `${Math.round(hud.reloadProgress * 100)}%` }}
              />
            </div>
          </div>
        )}

        {waveBanner && (
          <div className="absolute top-[22%] bg-[#0a0e16]/90 border border-red-700/60 rounded-lg px-6 py-3 text-center">
            <div className="font-display text-2xl font-bold text-red-400 tracking-wide">{waveBanner}</div>
          </div>
        )}

        {!mobileControls && !hud.pointerLocked && hud.alive && (
          <button
            onClick={onLockPointer}
            className="pointer-events-auto absolute top-[63%] bg-[#0a0e16]/90 border border-slate-600/60 hover:border-red-500 rounded-lg px-4 py-2 text-xs text-slate-200 cursor-pointer"
          >
            Click screen to aim and fire · ESC to pause
          </button>
        )}

        {!hud.alive && (
          <div className="absolute top-[34%] bg-red-950/90 border border-red-600/60 rounded-lg px-6 py-4 text-center">
            <div className="font-display text-2xl font-bold text-red-200">YOU HAVE FALLEN</div>
            <div className="text-xs text-red-300 mt-1">
              {hud.teammate?.alive ? 'Spectating teammate until wave ends...' : 'Match ending...'}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM RIGHT: Weapon Name, Ammo, Quick Switch Slots */}
      <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
        <div className="bg-[#0a0e16]/85 border border-slate-700/40 rounded-lg px-4 py-2.5 text-right">
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

        {/* Desktop Weapon Switch Bar */}
        {!mobileControls && (
          <div className="hidden md:flex items-center gap-1 pointer-events-auto">
            {WEAPON_ORDER.map((wid, idx) => {
              const owned = Boolean(ownedWeapons[wid]);
              if (!owned) return null;
              const active = hud.weaponId === wid;
              return (
                <button
                  key={wid}
                  onClick={() => onSwitchWeapon(wid)}
                  className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-red-600 text-white'
                      : 'bg-[#0a0e16]/85 border border-slate-700/40 text-slate-300 hover:text-white'
                  }`}
                >
                  <span className="font-mono-num opacity-70 mr-1">{idx + 1}</span>
                  {WEAPONS[wid].name.split(' ')[0]}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* MOBILE / TOUCH CONTROLS */}
      {mobileControls && (
        <>
          {/* Left Virtual Movement Joystick */}
          <div
            className="pointer-events-auto absolute bottom-6 left-6 w-32 h-32 rounded-full bg-slate-900/60 border border-slate-600/50 flex items-center justify-center touch-none"
            onTouchStart={(e) => {
              const t = e.touches[0];
              const rect = e.currentTarget.getBoundingClientRect();
              joyOrigin.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
              const dx = Math.max(-1, Math.min(1, (t.clientX - joyOrigin.current.x) / 48));
              const dy = Math.max(-1, Math.min(1, (t.clientY - joyOrigin.current.y) / 48));
              onMobileMove(dx, dy);
            }}
            onTouchMove={(e) => {
              if (!joyOrigin.current) return;
              const t = e.touches[0];
              const dx = Math.max(-1, Math.min(1, (t.clientX - joyOrigin.current.x) / 48));
              const dy = Math.max(-1, Math.min(1, (t.clientY - joyOrigin.current.y) / 48));
              onMobileMove(dx, dy);
            }}
            onTouchEnd={() => {
              joyOrigin.current = null;
              onMobileMove(0, 0);
            }}
          >
            <div className="w-12 h-12 rounded-full bg-slate-400/35 border border-slate-300/40" />
          </div>

          {/* Right Look Pad */}
          <div
            className="pointer-events-auto absolute inset-y-16 right-0 w-1/2 touch-none"
            onTouchStart={(e) => {
              const t = e.touches[0];
              lookOrigin.current = { x: t.clientX, y: t.clientY };
            }}
            onTouchMove={(e) => {
              if (!lookOrigin.current) return;
              const t = e.touches[0];
              onMobileLook(t.clientX - lookOrigin.current.x, t.clientY - lookOrigin.current.y);
              lookOrigin.current = { x: t.clientX, y: t.clientY };
            }}
            onTouchEnd={() => {
              lookOrigin.current = null;
            }}
          />

          {/* Action Buttons */}
          <div className="pointer-events-auto absolute bottom-24 right-5 flex flex-col items-end gap-3">
            <div className="flex items-center gap-2.5">
              <button
                onTouchStart={() => onMobileAim(true)}
                onTouchEnd={() => onMobileAim(false)}
                className="w-12 h-12 rounded-full bg-slate-900/80 border border-slate-600/60 text-slate-200 flex items-center justify-center active:bg-slate-700"
                aria-label="Aim"
              >
                <Crosshair className="w-5 h-5" />
              </button>
              <button
                onClick={onReload}
                className="w-12 h-12 rounded-full bg-slate-900/80 border border-slate-600/60 text-slate-200 flex items-center justify-center active:bg-slate-700"
                aria-label="Reload"
              >
                <RotateCw className="w-5 h-5" />
              </button>
              <button
                onClick={onCycleWeapon}
                className="w-12 h-12 rounded-full bg-slate-900/80 border border-slate-600/60 text-slate-200 flex items-center justify-center active:bg-slate-700"
                aria-label="Switch Weapon"
              >
                <ShieldAlert className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onMobileJump}
                className="w-14 h-14 rounded-full bg-slate-900/80 border border-slate-600/60 text-xs font-semibold text-slate-200 active:bg-slate-700"
              >
                JUMP
              </button>
              <button
                onTouchStart={(e) => {
                  e.preventDefault();
                  onMobileShoot(true);
                }}
                onTouchEnd={() => onMobileShoot(false)}
                className="w-16 h-16 rounded-full bg-red-600/90 border-2 border-red-400 text-xs font-bold text-white active:bg-red-500"
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
