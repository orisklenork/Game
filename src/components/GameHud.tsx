import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  ChevronRight,
  Coins,
  Crosshair,
  Flashlight,
  HeartPulse,
  MessageSquare,
  Pause,
  RotateCw,
  Send,
  Shield,
  Skull,
  Swords,
} from 'lucide-react';
import { GAME_MODES, WEAPON_ORDER, WEAPONS, WeaponId } from '../shared/gameData';
import { HudSnapshot } from '../game/GameEngine';

export interface ChatMessageItem {
  id: string;
  senderId: string;
  username: string;
  text: string;
  ts: number;
}

interface Props {
  hud: HudSnapshot;
  localPlayerId: string;
  localUsername: string;
  ownedWeapons: Record<string, { upgradeLevel: number }>;
  hitMarker: { active: boolean; killed: boolean };
  waveBanner: string | null;
  damageFlash: boolean;
  healPulse: boolean;
  mobileControls: boolean;
  chatMessages: ChatMessageItem[];
  onSendChat: (text: string) => void;
  onChatTypingChange: (typing: boolean) => void;
  onPause: () => void;
  onBuyHealth: () => void;
  onSwitchWeapon: (id: WeaponId) => void;
  onCycleWeapon: () => void;
  onCycleCameraView: () => void;
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
  localPlayerId,
  localUsername,
  ownedWeapons,
  hitMarker,
  waveBanner,
  damageFlash,
  healPulse,
  mobileControls,
  chatMessages,
  onSendChat,
  onChatTypingChange,
  onPause,
  onBuyHealth,
  onSwitchWeapon,
  onCycleWeapon,
  onCycleCameraView,
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
  const chatInputRef = useRef<HTMLInputElement>(null);

  const [joyKnob, setJoyKnob] = useState<{ x: number; y: number; active: boolean; sprinting: boolean }>({
    x: 0,
    y: 0,
    active: false,
    sprinting: false,
  });
  const [mobileAdsOn, setMobileAdsOn] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const openChat = () => {
    setChatOpen(true);
    onChatTypingChange(true);
    window.setTimeout(() => chatInputRef.current?.focus(), 20);
  };

  const closeChat = () => {
    setChatOpen(false);
    setChatDraft('');
    onChatTypingChange(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      if (!isInput && (e.code === 'KeyT' || e.code === 'Enter')) {
        e.preventDefault();
        openChat();
      } else if (chatOpen && e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeChat();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatDraft.trim();
    if (trimmed) {
      onSendChat(trimmed);
    }
    closeChat();
  };

  const mins = Math.floor(hud.elapsedSec / 60);
  const secs = String(hud.elapsedSec % 60).padStart(2, '0');
  const modeDef = GAME_MODES[hud.gameMode] || GAME_MODES.unlimited;
  const isDuel = hud.gameMode === 'duel_1v1' || Boolean(modeDef.noMonsters);
  const bossInterval = modeDef.bossInterval || 5;
  const isBossWave = !isDuel && bossInterval > 0 && hud.wave % bossInterval === 0;
  const wavesToBoss = bossInterval > 0 ? bossInterval - (hud.wave % bossInterval || bossInterval) : 0;

  const oppId = hud.teammate?.playerId || '';
  const myDuelScore = hud.duel?.roundScores[localPlayerId] ?? 0;
  const oppDuelScore = oppId ? hud.duel?.roundScores[oppId] ?? 0 : 0;

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

  const visibleChat = chatOpen
    ? chatMessages.slice(-6)
    : chatMessages.filter((m) => nowTick - m.ts < 10000).slice(-5);

  const viewLabel = hud.cameraView === '1st' ? '1ST PERSON' : hud.cameraView === '2nd' ? '2ND PERSON' : '3RD PERSON';

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

      {/* TOP LEFT: Player Health, Infinite Escalating Medkit, Teammate or Opponent HP */}
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex flex-col gap-2 max-w-[250px] sm:max-w-xs">
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
              disabled={hud.hp >= hud.maxHp || !hud.alive}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-emerald-700/80 disabled:opacity-45 text-slate-100 transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap shrink-0"
            >
              <HeartPulse className="w-3.5 h-3.5 text-emerald-400" />
              <span>Medkit ({hud.medkitCost}c)</span>
            </button>
            <span className="font-mono-num text-[11px] text-slate-400">
              Used {hud.healthPurchasesUsed} [H]
            </span>
          </div>
        </div>

        {/* Teammate (Co-op) or Duel Opponent HP */}
        {hud.teammate && (
          <div
            className={`bg-[#0a0e16]/85 backdrop-blur-md border rounded-xl px-3.5 py-2 ${
              isDuel ? 'border-red-700/50' : 'border-sky-700/40'
            }`}
          >
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className={`text-xs font-medium truncate max-w-[130px] ${isDuel ? 'text-red-300' : 'text-sky-300'}`}>
                {isDuel ? `VS ${hud.teammate.username}` : hud.teammate.username}
              </span>
              <span className="font-mono-num text-xs text-slate-300">
                {hud.teammate.alive ? `${Math.ceil(hud.teammate.hp)} HP` : 'DOWN'}
              </span>
            </div>
            <div className="w-40 h-1.5 bg-slate-900 rounded-sm overflow-hidden">
              <div
                className={`h-full ${
                  !hud.teammate.alive ? 'bg-red-900' : isDuel ? 'bg-red-500' : 'bg-sky-500'
                }`}
                style={{ width: `${Math.max(0, (hud.teammate.hp / hud.teammate.maxHp) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* TOP CENTER: 1v1 Round Scoreboard OR Zombie Wave HUD */}
      <div className="absolute top-3 sm:top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        {isDuel && hud.duel ? (
          <div className="bg-[#0a0e16]/92 backdrop-blur-md border border-sky-600/45 rounded-xl px-4 sm:px-6 py-2 flex items-center gap-4 sm:gap-6 shadow-xl">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-emerald-400 truncate max-w-[90px]">
                {localUsername}
              </div>
              <div className="font-mono-num text-xl font-bold text-emerald-300 leading-tight">{myDuelScore}</div>
            </div>

            <div className="text-center px-2 border-x border-slate-800">
              <div className="text-[10px] uppercase tracking-wider text-sky-300 flex items-center justify-center gap-1">
                <Swords className="w-3 h-3" />
                <span>ROUND {hud.duel.round} · FT{hud.duel.roundsToWin}</span>
              </div>
              <div className="font-mono-num font-bold text-base text-slate-100 leading-tight">
                {hud.duel.roundState === 'intermission' ? 'NEXT RD' : `${hud.duel.roundTimeLeftSec}s`}
              </div>
            </div>

            <div className="text-left">
              <div className="text-[10px] uppercase tracking-wider text-red-400 truncate max-w-[90px]">
                {hud.teammate?.username || 'Opponent'}
              </div>
              <div className="font-mono-num text-xl font-bold text-red-300 leading-tight">{oppDuelScore}</div>
            </div>
          </div>
        ) : (
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
        )}

        {/* Boss HP Bar */}
        {!isDuel && hud.boss && (
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

      {/* TOP RIGHT: Camera View Switch, Score, Coins, Minimap, Pause */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-start gap-2">
        <div className="flex flex-col items-end gap-1.5">
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

          <button
            onClick={onCycleCameraView}
            className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0a0e16]/88 border border-slate-700/50 hover:border-sky-400 text-[11px] font-mono-num font-semibold text-sky-300 cursor-pointer shadow"
            title="Cycle Camera View [C]"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>[C] {viewLabel}</span>
          </button>
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
            {!isDuel && hud.teammate && hud.teammate.alive && (
              <circle
                cx={toMini(hud.teammate.x, hud.teammate.z).cx}
                cy={toMini(hud.teammate.x, hud.teammate.z).cy}
                r={3.5}
                fill="#38bdf8"
              />
            )}
            {hud.minimap.opponent && hud.minimap.opponent.alive && (
              <circle
                cx={toMini(hud.minimap.opponent.x, hud.minimap.opponent.z).cx}
                cy={toMini(hud.minimap.opponent.x, hud.minimap.opponent.z).cy}
                r={3.8}
                fill="#ef4444"
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

      {/* CENTER: Crosshair, Hit Marker, Reload, Wave/Round Banner, Pause Banner */}
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

        {hud.pausedBy.length > 0 && (
          <div className="absolute top-[34%] bg-[#0b101b]/95 border border-amber-500/70 rounded-2xl px-6 py-4 text-center shadow-2xl max-w-sm">
            <div className="flex items-center justify-center gap-2 text-amber-400 font-display font-bold text-lg">
              <Shield className="w-5 h-5" />
              <span>PAUSED BY {hud.pausedBy.join(', ').toUpperCase()}</span>
            </div>
            <div className="text-xs text-slate-300 mt-1">
              Combat &amp; NPCs are frozen until resumed.
            </div>
          </div>
        )}

        {!mobileControls && !hud.pointerLocked && hud.alive && hud.pausedBy.length === 0 && !chatOpen && (
          <button
            onClick={onLockPointer}
            className="pointer-events-auto absolute top-[63%] bg-[#0a0e16]/90 border border-slate-600/60 hover:border-red-500 rounded-xl px-4 py-2 text-xs text-slate-200 cursor-pointer shadow-lg"
          >
            Click to aim · Hold Fire · [C] View · [Q] Next Gun · [T] Chat · [H] Medkit
          </button>
        )}

        {!hud.alive && (
          <div className="absolute top-[34%] bg-red-950/92 border border-red-600/70 rounded-xl px-6 py-4 text-center shadow-2xl">
            <div className="font-display text-2xl font-bold text-red-200">
              {isDuel ? 'ROUND ELIMINATED' : 'YOU HAVE FALLEN'}
            </div>
            <div className="text-xs text-red-300 mt-1">
              {isDuel
                ? 'Next round starting shortly...'
                : hud.teammate?.alive
                ? 'Spectating teammate until wave ends...'
                : 'Match ending...'}
            </div>
          </div>
        )}
      </div>

      {/* IN-GAME CHAT OVERLAY (Bottom-Left on Desktop, Top-Left lower on Mobile) */}
      <div
        className={`absolute ${
          mobileControls ? 'top-36 left-3 max-w-[230px]' : 'bottom-4 left-4 w-80'
        } flex flex-col gap-1.5`}
      >
        {visibleChat.length > 0 && (
          <div className="bg-[#080c13]/82 backdrop-blur-sm border border-slate-700/45 rounded-xl px-3 py-2 space-y-1 max-h-40 overflow-y-auto">
            {visibleChat.map((m) => (
              <div key={m.id} className="text-xs leading-snug break-words">
                <span
                  className={`font-semibold mr-1.5 ${
                    m.senderId === localPlayerId ? 'text-emerald-400' : 'text-sky-300'
                  }`}
                >
                  {m.username}:
                </span>
                <span className="text-slate-100">{m.text}</span>
              </div>
            ))}
          </div>
        )}

        {chatOpen ? (
          <form
            onSubmit={handleChatSubmit}
            className="pointer-events-auto flex items-center gap-1.5 bg-[#0a0e16]/95 border border-red-500/70 rounded-xl p-1.5 shadow-xl"
          >
            <input
              ref={chatInputRef}
              type="text"
              maxLength={160}
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              onBlur={() => {
                if (!chatDraft.trim()) closeChat();
              }}
              placeholder="Message squad / opponent..."
              className="flex-1 bg-transparent px-2 py-1 text-xs text-slate-100 focus:outline-none"
            />
            <button
              type="submit"
              className="p-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white cursor-pointer"
              aria-label="Send Message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : (
          <div className="pointer-events-auto flex items-center gap-1.5">
            <button
              onClick={openChat}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0a0e16]/82 border border-slate-700/50 hover:border-slate-500 text-[11px] text-slate-300 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
              <span>{mobileControls ? 'Chat' : 'Chat [T]'}</span>
            </button>
          </div>
        )}
      </div>

      {/* DESKTOP BOTTOM RIGHT: Weapon Info + Quick Switch Bar */}
      {!mobileControls && (
        <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2 max-w-[56vw]">
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
              {hud.isMelee ? (
                <span>∞</span>
              ) : (
                <>
                  {hud.ammo} <span className="text-sm font-normal text-slate-400">/ ∞</span>
                </>
              )}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1 pointer-events-auto max-w-full">
            <button
              onClick={onCycleWeapon}
              className="px-2.5 py-1.5 rounded-lg bg-[#0a0e16]/90 border border-slate-700/60 hover:border-amber-400 text-xs font-semibold text-amber-300 cursor-pointer shrink-0 flex items-center gap-1"
              title="Next Unlocked Weapon [Q]"
            >
              <span>[Q]</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center gap-1 overflow-x-auto max-w-md py-0.5">
              {WEAPON_ORDER.map((wid, idx) => {
                if (!ownedWeapons[wid]) return null;
                const active = hud.weaponId === wid;
                return (
                  <button
                    key={wid}
                    onClick={() => onSwitchWeapon(wid)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-red-600 text-white shadow'
                        : 'bg-[#0a0e16]/88 border border-slate-700/45 text-slate-300 hover:text-white'
                    }`}
                  >
                    {idx < 9 && <span className="font-mono-num opacity-70 mr-1">{idx + 1}</span>}
                    {WEAPONS[wid].name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* PRO MOBILE / TOUCH CONTROLS */}
      {mobileControls && (
        <>
          {/* Compact Weapon + Ammo Strip at Bottom Center */}
          <div className="pointer-events-auto absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 max-w-[52vw]">
            <div className="bg-[#0a0e16]/88 backdrop-blur-md border border-slate-700/50 rounded-full px-3.5 py-1 flex items-center gap-2.5 text-xs">
              <span className="font-display font-semibold text-slate-100 truncate">{hud.weaponName}</span>
              <span className="font-mono-num font-bold text-amber-300">
                {hud.isMelee ? '∞' : `${hud.ammo}/∞`}
              </span>
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
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0 ${
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

          {/* Left Virtual Movement Joystick */}
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

          {/* Right Look Surface */}
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
            <div className="flex items-center gap-2">
              <button
                onClick={onCycleCameraView}
                className="w-11 h-11 rounded-full bg-slate-900/85 border border-sky-500/60 text-sky-300 flex flex-col items-center justify-center active:scale-95"
                aria-label="Camera View"
              >
                <Camera className="w-3.5 h-3.5" />
                <span className="text-[9px] font-mono-num">{hud.cameraView}</span>
              </button>
              <button
                onClick={onBuyHealth}
                disabled={hud.hp >= hud.maxHp || !hud.alive}
                className="w-12 h-12 rounded-full bg-emerald-950/85 border border-emerald-500/60 disabled:opacity-40 text-emerald-300 flex flex-col items-center justify-center active:scale-95"
                aria-label="Medkit"
              >
                <HeartPulse className="w-4 h-4" />
                <span className="text-[9px] font-mono-num">{hud.medkitCost}c</span>
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
