import React, { useState } from 'react';
import { Check, Copy, Play, Swords, UserPlus, Users, X } from 'lucide-react';
import { DIFFICULTIES, DifficultyId, GAME_MODES, GameModeId, MapId, MAPS, WEAPONS } from '../shared/gameData';
import { PlayerProfile, RoomState } from '../lib/api';

interface FriendEntry {
  id: string;
  username: string;
  level: number;
  rank: string;
  is_online: boolean;
}

interface Props {
  room: RoomState;
  profile: PlayerProfile;
  friends: FriendEntry[];
  onToggleReady: () => void;
  onStartMatch: () => void;
  onChangeConfig: (mapId: MapId, difficulty: DifficultyId, gameMode?: GameModeId) => void;
  onInviteFriend: (friendId: string) => void;
  onLeaveRoom: () => void;
}

export function LobbyModal({
  room,
  profile,
  friends,
  onToggleReady,
  onStartMatch,
  onChangeConfig,
  onInviteFriend,
  onLeaveRoom,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [invitedIds, setInvitedIds] = useState<Record<string, boolean>>({});

  const isHost = room.hostId === profile.id;
  const selfMember = room.players.find((p) => p.playerId === profile.id);
  const partnerMember = room.players.find((p) => p.playerId !== profile.id);
  const mapDef = MAPS[room.mapId];
  const currentMode: GameModeId = room.gameMode || 'unlimited';
  const modeDef = GAME_MODES[currentMode] || GAME_MODES.unlimited;

  const handleCopy = () => {
    navigator.clipboard?.writeText(room.id).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleInvite = (fid: string) => {
    onInviteFriend(fid);
    setInvitedIds((prev) => ({ ...prev, [fid]: true }));
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/75">
      <div className="w-full max-w-5xl bg-[#0d1118] border border-slate-700/40 rounded-xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <div className="text-xs text-slate-400">
              {modeDef.noMonsters ? '1v1 Arena Duel Lobby' : 'Two-Player Co-Op Lobby'}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <h2 className="font-display text-2xl font-bold text-slate-100">Room {room.id}</h2>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#131924] border border-slate-700/50 hover:border-slate-500 text-xs text-slate-200 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>
          </div>

          <button
            onClick={onLeaveRoom}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#131924] border border-slate-700/50 hover:border-red-500/60 text-sm text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Leave Room</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Left: Players & Friends Invite */}
          <div className="lg:col-span-1 space-y-4">
            <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-red-500" />
              <span>Squad ({room.players.length}/2)</span>
            </div>

            {selfMember && (
              <div className="bg-[#131924] border border-slate-700/40 rounded-lg p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-100">{selfMember.username}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Lv.{selfMember.level} · {selfMember.rank} · {room.hostId === selfMember.playerId ? 'Host' : 'Operative'}
                    </div>
                  </div>
                  <span className={`text-xs font-medium ${selfMember.isReady ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {selfMember.isReady ? 'Ready' : 'Waiting'}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-2">
                  Weapon: <span className="text-slate-200">{WEAPONS[selfMember.weaponId]?.name}</span>
                </div>
              </div>
            )}

            {partnerMember ? (
              <div className="bg-[#131924] border border-sky-700/40 rounded-lg p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sky-200">{partnerMember.username}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Lv.{partnerMember.level} · {partnerMember.rank} · {room.hostId === partnerMember.playerId ? 'Host' : 'Partner'}
                    </div>
                  </div>
                  <span className={`text-xs font-medium ${partnerMember.isReady ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {partnerMember.isReady ? 'Ready' : 'Not Ready'}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-2">
                  Weapon: <span className="text-slate-200">{WEAPONS[partnerMember.weaponId]?.name}</span>
                </div>
              </div>
            ) : (
              <div className="bg-[#090d14] border border-dashed border-slate-700/60 rounded-lg p-4 text-center">
                <div className="text-sm text-slate-300 font-medium">Waiting for Second Player</div>
                <div className="text-xs text-slate-500 mt-1">
                  Share Room Code <span className="font-mono-num text-slate-300">{room.id}</span> or start solo anytime.
                </div>
              </div>
            )}

            {/* Quick Friend Invite */}
            <div className="pt-2">
              <div className="text-xs font-medium text-slate-400 mb-2">Invite Online Friends</div>
              {friends.filter((f) => f.is_online).length === 0 ? (
                <div className="text-xs text-slate-500 bg-[#090d14] border border-slate-800 rounded-lg p-3">
                  No friends online right now. Share your Room ID to team up.
                </div>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {friends
                    .filter((f) => f.is_online)
                    .map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between bg-[#131924] border border-slate-700/40 rounded-lg px-3 py-2"
                      >
                        <div className="text-xs">
                          <div className="font-medium text-slate-200">{f.username}</div>
                          <div className="text-slate-400">Lv.{f.level} · {f.rank}</div>
                        </div>
                        <button
                          onClick={() => handleInvite(f.id)}
                          disabled={invitedIds[f.id]}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 disabled:bg-slate-700 text-xs text-white cursor-pointer"
                        >
                          <UserPlus className="w-3 h-3" />
                          <span>{invitedIds[f.id] ? 'Invited' : 'Invite'}</span>
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: 12-Map Selector, Mode Selector & Difficulty */}
          <div className="lg:col-span-2 space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-200">
                  Select Horror Map ({Object.keys(MAPS).length})
                </span>
                {!isHost && <span className="text-xs text-slate-400">Host controls map selection</span>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {(Object.keys(MAPS) as MapId[]).map((mid) => {
                  const m = MAPS[mid];
                  const selected = room.mapId === mid;
                  return (
                    <button
                      key={mid}
                      disabled={!isHost}
                      onClick={() => onChangeConfig(mid, room.difficulty, currentMode)}
                      className={`text-left p-3 rounded-lg border transition-colors ${
                        selected
                          ? 'bg-red-950/35 border-red-600 text-slate-100'
                          : 'bg-[#131924] border-slate-700/40 text-slate-300 hover:border-slate-500'
                      } ${isHost ? 'cursor-pointer' : 'cursor-default opacity-85'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display font-semibold text-sm">{m.name}</span>
                        <span className="font-mono-num text-[11px] text-amber-400 shrink-0">
                          Hazard {m.difficultyRating}/5
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{m.subtitle}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Game Mode Selector */}
            <div>
              <div className="text-sm font-semibold text-slate-200 mb-2">Match Mode</div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {(Object.keys(GAME_MODES) as GameModeId[]).map((moid) => {
                  const gm = GAME_MODES[moid];
                  const selected = currentMode === moid;
                  return (
                    <button
                      key={moid}
                      disabled={!isHost}
                      onClick={() => onChangeConfig(room.mapId, room.difficulty, moid)}
                      className={`text-left p-2.5 rounded-lg border transition-colors ${
                        selected
                          ? gm.noMonsters
                            ? 'bg-sky-950/45 border-sky-500 text-slate-100'
                            : 'bg-amber-950/35 border-amber-500 text-slate-100'
                          : 'bg-[#131924] border-slate-700/40 text-slate-300 hover:border-slate-500'
                      } ${isHost ? 'cursor-pointer' : 'cursor-default opacity-85'}`}
                    >
                      <div className="font-display font-semibold text-xs flex items-center gap-1">
                        {gm.noMonsters && <Swords className="w-3 h-3 text-sky-400 shrink-0" />}
                        <span className="truncate">{gm.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                        {gm.noMonsters ? 'No Zombies · 5 Wins' : `Boss /${gm.bossInterval}w`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-200 mb-2">Difficulty Scaling</div>
              <div className="grid grid-cols-3 gap-2.5">
                {(Object.keys(DIFFICULTIES) as DifficultyId[]).map((did) => {
                  const d = DIFFICULTIES[did];
                  const selected = room.difficulty === did;
                  return (
                    <button
                      key={did}
                      disabled={!isHost}
                      onClick={() => onChangeConfig(room.mapId, did, currentMode)}
                      className={`text-left p-3 rounded-lg border transition-colors ${
                        selected
                          ? 'bg-red-950/35 border-red-600 text-slate-100'
                          : 'bg-[#131924] border-slate-700/40 text-slate-300 hover:border-slate-500'
                      } ${isHost ? 'cursor-pointer' : 'cursor-default opacity-85'}`}
                    >
                      <div className="font-display font-semibold text-sm">{d.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{d.rewardMult}x Rewards</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Map Brief + Action Bar */}
            <div className="bg-[#090d14] border border-slate-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs text-slate-400">Deployment Zone</div>
                <div className="font-display font-semibold text-base text-slate-100">
                  {mapDef.name} · {modeDef.name}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {modeDef.noMonsters
                    ? '1v1 PvP multi-round arena duel · No zombies · First to 5 wins.'
                    : 'Endless waves with Titan Boss every 5 waves · Squad votes map & mode at launch.'}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={onToggleReady}
                  className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-colors cursor-pointer whitespace-nowrap ${
                    selfMember?.isReady
                      ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                      : 'bg-[#131924] border border-slate-600 hover:border-slate-400 text-slate-100'
                  }`}
                >
                  {selfMember?.isReady ? 'Ready ✓' : 'Mark Ready'}
                </button>

                {isHost && (
                  <button
                    onClick={onStartMatch}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-display font-bold text-sm bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>{room.players.length === 2 ? 'Vote & Deploy' : 'Vote & Launch'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
