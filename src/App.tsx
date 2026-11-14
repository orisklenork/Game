import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Award,
  Backpack,
  Coins,
  Crosshair,
  PlusSquare,
  Search,
  Settings,
  ShoppingBag,
  Skull,
  Sparkles,
  Trophy,
  User,
  UserCheck,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AuthOverlay } from './components/AuthOverlay';
import { GameHud } from './components/GameHud';
import { LobbyModal } from './components/LobbyModal';
import { GameSettings, SettingsModal } from './components/SettingsModal';
import { ShopAndCustomize } from './components/ShopAndCustomize';
import { SocialAndProfile } from './components/SocialAndProfile';
import { audioEngine } from './game/audio';
import { HorrorGameEngine, HudSnapshot, ServerStatePacket } from './game/GameEngine';
import { apiFetch, getSavedToken, PlayerProfile, RoomState } from './lib/api';
import { DifficultyId, MapId, MAPS, WeaponId } from './shared/gameData';

type ActiveModal =
  | null
  | 'join_room'
  | 'shop'
  | 'customize'
  | 'inventory'
  | 'friends'
  | 'leaderboard'
  | 'profile'
  | 'settings';

interface MatchResultData {
  victory: boolean;
  wavesCleared: number;
  durationSeconds: number;
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
}

const DEFAULT_HUD: HudSnapshot = {
  hp: 100,
  maxHp: 100,
  alive: true,
  ammo: 15,
  maxAmmo: 15,
  reloading: false,
  reloadProgress: 1,
  weaponId: 'pistol',
  weaponName: 'M9 Tactical',
  kills: 0,
  score: 0,
  coinsEarned: 0,
  healthPurchasesUsed: 0,
  wave: 1,
  maxWaves: 6,
  waveState: 'intermission',
  elapsedSec: 0,
  monstersRemaining: 0,
  flashlightOn: true,
  pointerLocked: false,
  teammate: null,
  minimap: {
    arenaHalfSize: 28,
    playerX: 0,
    playerZ: 0,
    playerYaw: 0,
    monsters: [],
    coins: [],
  },
};

const AVATAR_COLORS: Record<string, string> = {
  crimson: '#b91c1c',
  obsidian: '#334155',
  cobalt: '#1d4ed8',
  bone: '#64748b',
  ember: '#c2410c',
  ash: '#475569',
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<HorrorGameEngine | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingWsQueueRef = useRef<Array<{ type: string; payload: any }>>([]);

  const [booting, setBooting] = useState(true);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [token, setToken] = useState<string | null>(getSavedToken());

  const [screen, setScreen] = useState<'menu' | 'playing'>('menu');
  const [paused, setPaused] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [previewMap, setPreviewMap] = useState<MapId>('hospital');

  const [room, setRoom] = useState<RoomState | null>(null);
  const [openRooms, setOpenRooms] = useState<RoomState[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [roomInvite, setRoomInvite] = useState<{
    roomId: string;
    fromUsername: string;
    mapId: MapId;
  } | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(DEFAULT_HUD);
  const [hitMarker, setHitMarker] = useState<{ active: boolean; killed: boolean }>({ active: false, killed: false });
  const [waveBanner, setWaveBanner] = useState<string | null>(null);
  const [damageFlash, setDamageFlash] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResultData | null>(null);

  const [settings, setSettings] = useState<GameSettings>(() => {
    try {
      const saved = localStorage.getItem('nightfall_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      quality: 'medium',
      sensitivity: 0.0022,
      sfxVolume: 0.7,
      musicVolume: 0.32,
      muted: false,
      mobileMode: 'auto',
    };
  });

  const isTouchDevice =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 768);
  const mobileControlsEnabled =
    settings.mobileMode === 'on' || (settings.mobileMode === 'auto' && isTouchDevice);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const sendWs = useCallback((type: string, payload: any = {}) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }));
    } else {
      pendingWsQueueRef.current.push({ type, payload });
    }
  }, []);

  // Initialize isolated 3D Engine once
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new HorrorGameEngine(mount, {
      onHudUpdate: (nextHud) => setHud(nextHud),
      onShoot: (payload) => sendWs('player:shoot', payload),
      onPlayerStateSend: (payload) => sendWs('player:state', payload),
      onPauseRequest: () => {
        setPaused((prev) => {
          const next = !prev;
          engine.setPaused(next);
          return next;
        });
      },
      onBuyHealthRequest: () => sendWs('player:buy_health', {}),
      onHitMarker: (killed) => {
        setHitMarker({ active: true, killed });
        window.setTimeout(() => setHitMarker({ active: false, killed: false }), 130);
      },
    });

    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [sendWs]);

  // Apply settings changes to Engine & Audio
  useEffect(() => {
    localStorage.setItem('nightfall_settings', JSON.stringify(settings));
    engineRef.current?.setQuality(settings.quality);
    engineRef.current?.setSensitivity(settings.sensitivity);
    audioEngine.setMuted(settings.muted);
    audioEngine.setVolumes(settings.sfxVolume, settings.musicVolume);
  }, [settings]);

  // Restore session on mount
  useEffect(() => {
    const saved = getSavedToken();
    if (!saved) {
      setBooting(false);
      return;
    }
    apiFetch<{ profile: PlayerProfile }>('/api/auth/me')
      .then((res) => {
        setProfile(res.profile);
        setToken(saved);
      })
      .catch(() => {
        setProfile(null);
      })
      .finally(() => setBooting(false));
  }, []);

  const refreshFriends = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch('/api/friends');
      setFriendsList(data.friends || []);
    } catch {}
  }, [token]);

  // WebSocket connection lifecycle
  useEffect(() => {
    if (!token || !profile) return;
    let closedByUser = false;
    let reconnectTimer: number | null = null;

    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth', payload: { token } }));
        while (pendingWsQueueRef.current.length > 0) {
          const queued = pendingWsQueueRef.current.shift();
          if (queued) ws.send(JSON.stringify(queued));
        }
        refreshFriends();
      };

      ws.onmessage = (event) => {
        let msg: { type: string; payload: any };
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        const { type, payload } = msg;

        switch (type) {
          case 'room:joined':
          case 'room:updated':
            setRoom(payload);
            setActiveModal(null);
            setPreviewMap(payload.mapId);
            engineRef.current?.loadMap(payload.mapId);
            refreshFriends();
            break;

          case 'room:left':
            setRoom(null);
            break;

          case 'room:open_list':
            setOpenRooms(payload.rooms || []);
            break;

          case 'room:error':
            showToast(payload.message || 'Room error');
            break;

          case 'room:invited':
            setRoomInvite(payload);
            break;

          case 'room:invite_sent':
            showToast(`Invite sent to ${payload.toUsername}`);
            break;

          case 'match:started':
            audioEngine.unlock();
            audioEngine.startAmbientMusic();
            setMatchResult(null);
            setPaused(false);
            setActiveModal(null);
            setScreen('playing');
            setWaveBanner('WAVE 1 STARTING');
            window.setTimeout(() => setWaveBanner(null), 2400);

            setProfile((curr) => {
              if (!curr) return curr;
              const skinId = curr.equippedLoadout.weapon_skin || 'wskin_factory';
              engineRef.current?.startMatch({
                localPlayerId: curr.id,
                mapId: payload.mapId,
                equippedWeapon: curr.equippedWeapon,
                ownedWeapons: curr.weapons,
                weaponSkinId: skinId,
                players: payload.players,
              });
              return curr;
            });
            break;

          case 'match:state':
            engineRef.current?.applyServerState(payload as ServerStatePacket);
            break;

          case 'match:wave':
            setWaveBanner(payload.isBossWave ? `BOSS WAVE ${payload.wave}` : `WAVE ${payload.wave}`);
            window.setTimeout(() => setWaveBanner(null), 2600);
            break;

          case 'match:wave_cleared':
            setWaveBanner(`WAVE CLEARED · NEXT WAVE ${payload.nextWave}`);
            window.setTimeout(() => setWaveBanner(null), 2500);
            break;

          case 'match:hit_confirm':
            engineRef.current?.handleHitConfirm(payload.hits);
            break;

          case 'match:shot_fx':
            engineRef.current?.handleRemoteShotFx(payload);
            break;

          case 'match:player_hit':
            setProfile((curr) => {
              if (curr && payload.playerId === curr.id) {
                engineRef.current?.handlePlayerDamageFx();
                setDamageFlash(true);
                window.setTimeout(() => setDamageFlash(false), 200);
              }
              return curr;
            });
            break;

          case 'match:coin_collected':
            setProfile((curr) => {
              if (curr && payload.playerId === curr.id) {
                audioEngine.playCoinPickup();
              }
              return curr;
            });
            break;

          case 'match:health_purchased':
            audioEngine.playHeal();
            setProfile((curr) => (curr ? { ...curr, coins: payload.newCoinBalance } : curr));
            showToast(`Medkit applied (${payload.remainingPurchases} left)`);
            break;

          case 'match:health_error':
            showToast(payload.message);
            break;

          case 'match:ended':
            audioEngine.setBossMusic(false);
            setScreen('menu');
            setPaused(false);
            engineRef.current?.setDioramaMode();
            if (payload.profile) setProfile(payload.profile);
            setMatchResult({
              victory: payload.victory,
              wavesCleared: payload.wavesCleared,
              durationSeconds: payload.durationSeconds,
              results: payload.results,
            });
            break;
        }
      };

      ws.onclose = () => {
        if (!closedByUser) {
          reconnectTimer = window.setTimeout(connect, 2000);
        }
      };
    };

    connect();
    return () => {
      closedByUser = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [token, profile?.id, refreshFriends, showToast]);

  const handlePlaySoloNow = () => {
    audioEngine.unlock();
    audioEngine.startAmbientMusic();
    audioEngine.playUiClick();
    // Create a room and immediately start match if solo
    sendWs('room:create', { mapId: previewMap, difficulty: 'normal', isPublic: false });
    window.setTimeout(() => {
      sendWs('match:start', {});
    }, 180);
  };

  const handleCreateRoom = () => {
    audioEngine.unlock();
    audioEngine.startAmbientMusic();
    audioEngine.playUiClick();
    sendWs('room:create', { mapId: previewMap, difficulty: 'normal', isPublic: false });
  };

  const handleFindPlayer = () => {
    audioEngine.unlock();
    audioEngine.startAmbientMusic();
    audioEngine.playUiClick();
    sendWs('room:find_player', { mapId: previewMap, difficulty: 'normal' });
  };

  const handleOpenJoinModal = () => {
    audioEngine.unlock();
    audioEngine.playUiClick();
    sendWs('room:list_open', {});
    setActiveModal('join_room');
  };

  const handleJoinByCode = (code: string) => {
    audioEngine.playUiClick();
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    sendWs('room:join', { roomId: clean });
  };

  const handleLeaveMatch = () => {
    audioEngine.playUiClick();
    sendWs('match:abort', {});
    setPaused(false);
    setScreen('menu');
    engineRef.current?.setDioramaMode(previewMap);
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#07090d]">
      {/* Isolated WebGL Viewport Container */}
      <div ref={canvasMountRef} className="fixed inset-0 z-0" />

      {/* Subtle atmospheric scrim on menu screens so text stays razor sharp */}
      {screen === 'menu' && (
        <div
          className="fixed inset-0 z-10 pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, rgba(7,9,13,0.92) 0%, rgba(7,9,13,0.68) 45%, rgba(7,9,13,0.45) 100%)',
          }}
        />
      )}

      {/* Username-Only Registration Overlay */}
      {!booting && !profile && (
        <AuthOverlay
          onAuthenticated={(newProfile, newToken) => {
            setProfile(newProfile);
            setToken(newToken);
            audioEngine.startAmbientMusic();
          }}
        />
      )}

      {/* MAIN MENU OVERLAY */}
      {profile && screen === 'menu' && (
        <div className="fixed inset-0 z-20 flex flex-col justify-between p-5 sm:p-8 overflow-y-auto">
          {/* Top Bar: Profile Summary + Mute/Settings */}
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className="w-11 h-11 rounded-lg flex items-center justify-center font-display font-bold text-lg text-white border border-white/15 shrink-0"
                style={{ backgroundColor: AVATAR_COLORS[profile.avatarSeed] || '#b91c1c' }}
              >
                {profile.username.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-lg text-slate-100">{profile.username}</span>
                  <span className="font-mono-num text-xs text-slate-400">{profile.playerCode}</span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span className="text-red-400 font-medium">
                    Lv.{profile.level} · {profile.rank}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num">{profile.stats.totalKills} Kills</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 font-mono-num font-bold text-base text-amber-400">
                <Coins className="w-4 h-4" />
                <span>{profile.coins.toLocaleString()}</span>
              </div>

              <button
                onClick={() => setSettings((s) => ({ ...s, muted: !s.muted }))}
                className="p-2.5 rounded-lg bg-[#131924] border border-slate-700/50 hover:border-slate-500 text-slate-200 cursor-pointer"
                aria-label="Toggle Mute"
              >
                {settings.muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <button
                onClick={() => {
                  audioEngine.playUiClick();
                  setActiveModal('settings');
                }}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#131924] border border-slate-700/50 hover:border-slate-500 text-xs font-medium text-slate-200 cursor-pointer whitespace-nowrap"
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
            </div>
          </header>

          {/* Center Hero + Main Menu Navigation */}
          <main className="my-auto py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-6xl w-full mx-auto">
            {/* Left Column: Title Lockup & Menu Actions */}
            <div className="lg:col-span-7 space-y-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <svg viewBox="0 0 44 44" className="w-9 h-9 text-red-600 shrink-0" fill="none">
                    <rect x="3" y="3" width="38" height="38" rx="6" stroke="currentColor" strokeWidth="2.2" />
                    <path d="M22 9V35M9 22H35" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="22" cy="22" r="5" fill="#dc2626" />
                  </svg>
                  <h1 className="font-display text-5xl sm:text-6xl font-bold tracking-tight text-slate-100 leading-none">
                    NIGHTFALL
                  </h1>
                </div>
                <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
                  Two-player cooperative survival horror. Enter haunted zones, fight escalating monster waves, earn coins, and outlast the Abomination Titan.
                </p>
              </div>

              {/* Primary Play Actions */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handlePlaySoloNow}
                  className="flex items-center gap-2.5 px-7 py-3.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-display font-bold text-base transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Crosshair className="w-5 h-5" />
                  <span>Play Now</span>
                </button>

                <button
                  onClick={handleCreateRoom}
                  className="flex items-center gap-2 px-5 py-3.5 rounded-lg bg-[#131924] border border-slate-700/60 hover:border-red-500 text-slate-100 font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
                >
                  <PlusSquare className="w-4 h-4 text-red-400" />
                  <span>Create Room</span>
                </button>

                <button
                  onClick={handleOpenJoinModal}
                  className="flex items-center gap-2 px-5 py-3.5 rounded-lg bg-[#131924] border border-slate-700/60 hover:border-slate-400 text-slate-100 font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Users className="w-4 h-4 text-sky-400" />
                  <span>Join Room</span>
                </button>

                <button
                  onClick={handleFindPlayer}
                  className="flex items-center gap-2 px-5 py-3.5 rounded-lg bg-[#131924] border border-slate-700/60 hover:border-amber-500 text-slate-100 font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Search className="w-4 h-4 text-amber-400" />
                  <span>Find Player</span>
                </button>
              </div>

              {/* Secondary Menu Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-w-2xl">
                {(
                  [
                    ['shop', 'Weapon Shop', ShoppingBag],
                    ['customize', 'Customization', Sparkles],
                    ['inventory', 'Inventory', Backpack],
                    ['friends', 'Friends', UserCheck],
                    ['leaderboard', 'Leaderboard', Trophy],
                    ['profile', 'Player Profile', User],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    onClick={() => {
                      audioEngine.playUiClick();
                      setActiveModal(id);
                    }}
                    className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-[#0d1118]/90 border border-slate-800 hover:border-slate-600 text-left text-sm font-medium text-slate-200 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Icon className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Right Column: Live Map Selector Preview */}
            <div className="lg:col-span-5 bg-[#0d1118]/90 border border-slate-700/40 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-display font-semibold text-base text-slate-100">Horror Zones</span>
                <span className="text-xs text-slate-400">Live 3D Preview</span>
              </div>

              <div className="space-y-2">
                {(Object.keys(MAPS) as MapId[]).map((mid) => {
                  const m = MAPS[mid];
                  const active = previewMap === mid;
                  return (
                    <button
                      key={mid}
                      onClick={() => {
                        audioEngine.playUiClick();
                        setPreviewMap(mid);
                        engineRef.current?.loadMap(mid);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 rounded-lg border transition-colors cursor-pointer ${
                        active
                          ? 'bg-red-950/35 border-red-600 text-slate-100'
                          : 'bg-[#131924] border-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display font-semibold text-sm">{m.name}</span>
                        <span className="font-mono-num text-xs text-amber-400">Hazard {m.difficultyRating}/5</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{m.subtitle}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </main>

          {/* Flat Control Hint Footer */}
          <footer className="text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
            <span>WASD Move · Mouse Aim &amp; Shoot · R Reload · 1–7 Weapons · H Medkit · F Flashlight · Esc Pause</span>
            <span>Co-Op Room Limit: 2 Players</span>
          </footer>
        </div>
      )}

      {/* MULTIPLAYER LOBBY MODAL */}
      {profile && room && screen === 'menu' && (
        <LobbyModal
          room={room}
          profile={profile}
          friends={friendsList}
          onToggleReady={() => sendWs('room:ready', { isReady: !room.players.find((p) => p.playerId === profile.id)?.isReady })}
          onStartMatch={() => sendWs('match:start', {})}
          onChangeConfig={(mapId, difficulty) => sendWs('room:config', { mapId, difficulty })}
          onInviteFriend={(friendId) => sendWs('room:invite', { friendId })}
          onLeaveRoom={() => sendWs('room:leave', {})}
        />
      )}

      {/* JOIN ROOM MODAL */}
      {activeModal === 'join_room' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-md bg-[#0d1118] border border-slate-700/40 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-bold text-slate-100">Join Multiplayer Room</h2>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleJoinByCode(joinCode);
              }}
              className="flex gap-2 mb-5"
            >
              <input
                type="text"
                maxLength={8}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter Room ID (e.g. A7K9P2)"
                className="flex-1 px-3.5 py-2.5 rounded-lg bg-[#07090d] border border-slate-700/60 text-sm font-mono-num text-slate-100 uppercase focus:outline-none focus:border-red-500"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-semibold text-white cursor-pointer"
              >
                Join
              </button>
            </form>

            <div className="text-xs font-medium text-slate-400 mb-2">Open Waiting Rooms</div>
            {openRooms.length === 0 ? (
              <div className="text-xs text-slate-500 bg-[#131924] border border-slate-800 rounded-lg p-3">
                No public rooms waiting. Create a room or use Find Player.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {openRooms.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between bg-[#131924] border border-slate-700/40 rounded-lg px-3.5 py-2.5"
                  >
                    <div className="text-xs">
                      <div className="font-semibold text-slate-100">
                        {MAPS[r.mapId]?.name} · <span className="font-mono-num text-amber-400">{r.id}</span>
                      </div>
                      <div className="text-slate-400">
                        Host: {r.players[0]?.username} ({r.players.length}/2)
                      </div>
                    </div>
                    <button
                      onClick={() => handleJoinByCode(r.id)}
                      className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-xs font-semibold text-white cursor-pointer"
                    >
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SHOP / CUSTOMIZATION / INVENTORY */}
      {profile && (activeModal === 'shop' || activeModal === 'customize' || activeModal === 'inventory') && (
        <ShopAndCustomize
          initialTab={activeModal}
          profile={profile}
          onProfileUpdated={setProfile}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* FRIENDS / LEADERBOARD / PROFILE */}
      {profile && (activeModal === 'friends' || activeModal === 'leaderboard' || activeModal === 'profile') && (
        <SocialAndProfile
          initialTab={activeModal}
          profile={profile}
          onProfileUpdated={setProfile}
          inRoom={Boolean(room)}
          onInviteToRoom={(fid) => sendWs('room:invite', { friendId: fid })}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* SETTINGS MODAL */}
      {activeModal === 'settings' && (
        <SettingsModal
          settings={settings}
          onChange={setSettings}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* ACTIVE GAMEPLAY HUD */}
      {profile && screen === 'playing' && (
        <GameHud
          hud={hud}
          ownedWeapons={profile.weapons}
          hitMarker={hitMarker}
          waveBanner={waveBanner}
          damageFlash={damageFlash}
          mobileControls={mobileControlsEnabled}
          onPause={() => {
            setPaused(true);
            engineRef.current?.setPaused(true);
          }}
          onBuyHealth={() => sendWs('player:buy_health', {})}
          onSwitchWeapon={(wid: WeaponId) => engineRef.current?.switchWeapon(wid)}
          onReload={() => engineRef.current?.triggerReload()}
          onToggleFlashlight={() => engineRef.current?.toggleFlashlight()}
          onLockPointer={() => engineRef.current?.requestPointerLock()}
          onMobileMove={(x, y) => engineRef.current?.setMobileMove(x, y)}
          onMobileLook={(dx, dy) => engineRef.current?.applyMobileLook(dx, dy)}
          onMobileShoot={(active) => engineRef.current?.setMobileShooting(active)}
          onMobileAim={(active) => engineRef.current?.setAiming(active)}
          onMobileJump={() => engineRef.current?.triggerJump()}
          onCycleWeapon={() => engineRef.current?.cycleWeapon(1)}
        />
      )}

      {/* PAUSE MODAL */}
      {screen === 'playing' && paused && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/75">
          <div className="w-full max-w-sm bg-[#0d1118] border border-slate-700/40 rounded-xl p-6 text-center space-y-4">
            <h2 className="font-display text-2xl font-bold text-slate-100">Match Paused</h2>
            <div className="space-y-2.5">
              <button
                onClick={() => {
                  setPaused(false);
                  engineRef.current?.setPaused(false);
                  engineRef.current?.requestPointerLock();
                }}
                className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-semibold text-white cursor-pointer"
              >
                Resume Survival
              </button>
              <button
                onClick={() => setActiveModal('settings')}
                className="w-full py-2.5 rounded-lg bg-[#131924] border border-slate-700/50 hover:border-slate-500 text-sm font-semibold text-slate-200 cursor-pointer"
              >
                Settings
              </button>
              <button
                onClick={handleLeaveMatch}
                className="w-full py-2.5 rounded-lg bg-[#131924] border border-red-900/60 hover:bg-red-950/60 text-sm font-semibold text-red-300 cursor-pointer"
              >
                Abandon Match
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MATCH RESULTS MODAL */}
      {matchResult && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/85">
          <div className="w-full max-w-lg bg-[#0d1118] border border-slate-700/40 rounded-xl p-6 shadow-2xl">
            <div className="text-center pb-4 border-b border-slate-800">
              <div className={`font-display text-3xl font-bold ${matchResult.victory ? 'text-emerald-400' : 'text-red-500'}`}>
                {matchResult.victory ? 'DAWN SURVIVED' : 'OVERRUN BY THE HORDE'}
              </div>
              <div className="text-xs text-slate-400 mt-1 font-mono-num">
                Waves Cleared: {matchResult.wavesCleared} · Duration: {Math.floor(matchResult.durationSeconds / 60)}m{' '}
                {matchResult.durationSeconds % 60}s
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {matchResult.results.map((r) => (
                <div
                  key={r.playerId}
                  className="bg-[#131924] border border-slate-700/40 rounded-lg p-3.5 flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-sm text-slate-100">{r.username}</div>
                    <div className="text-xs text-slate-400 font-mono-num mt-0.5">
                      {r.kills} Kills · {r.bossKills} Bosses · {r.score.toLocaleString()} Score
                    </div>
                  </div>
                  <div className="text-right font-mono-num text-xs">
                    <div className="text-amber-400 font-bold">+{r.coinsEarned} Coins</div>
                    <div className="text-sky-400">+{r.xpEarned} XP</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => setMatchResult(null)}
                className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-semibold text-white cursor-pointer"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INCOMING FRIEND ROOM INVITE TOAST */}
      {roomInvite && screen === 'menu' && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#0d1118] border border-red-600/70 rounded-xl p-4 shadow-2xl max-w-xs">
          <div className="text-xs text-red-400 font-semibold">Co-Op Room Invite</div>
          <div className="text-sm text-slate-100 mt-1">
            <span className="font-bold">{roomInvite.fromUsername}</span> invited you to{' '}
            <span className="font-medium">{MAPS[roomInvite.mapId]?.name}</span>.
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => {
                sendWs('room:join', { roomId: roomInvite.roomId });
                setRoomInvite(null);
              }}
              className="flex-1 py-1.5 rounded bg-red-600 hover:bg-red-500 text-xs font-semibold text-white cursor-pointer"
            >
              Join Room
            </button>
            <button
              onClick={() => setRoomInvite(null)}
              className="px-3 py-1.5 rounded bg-slate-800 text-xs text-slate-300 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* TRANSIENT NOTIFICATION TOAST */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#131924] border border-slate-600/60 rounded-lg px-4 py-2 text-xs font-medium text-slate-100 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
