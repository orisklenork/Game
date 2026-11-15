import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Flame,
  MapPin,
  Play,
  Skull,
  Swords,
  Timer,
  Users,
} from 'lucide-react';
import { GAME_MODES, GameModeId, MapId, MAPS } from '../shared/gameData';

export interface VoteSessionState {
  roomId?: string;
  endsAt: number;
  mapCandidates: MapId[];
  modeCandidates: GameModeId[];
  mapVotes: Record<string, MapId>;
  modeVotes: Record<string, GameModeId>;
  voters: Array<{ playerId: string; username: string }>;
}

interface Props {
  vote: VoteSessionState;
  localPlayerId: string;
  isHost: boolean;
  onVoteMap: (mapId: MapId) => void;
  onVoteMode: (modeId: GameModeId) => void;
  onDeployNow: () => void;
  onCancel?: () => void;
}

function ArenaBlueprintSvg({ mapId }: { mapId: MapId }) {
  const map = MAPS[mapId];
  if (!map) return null;
  const size = 120;
  const pad = 8;
  const half = Math.max(1, map.arenaHalfSize);
  const span = size - pad * 2;
  const toSvg = (v: number) => pad + ((v + half) / (half * 2)) * span;
  const scaleDim = (d: number) => Math.max(2.5, (d / (half * 2)) * span);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-full h-28 rounded-lg bg-[#06090f] border border-slate-800/90"
      aria-label={`${map.name} arena layout`}
    >
      {/* Subtle tactical grid */}
      <line x1={size / 2} y1={pad} x2={size / 2} y2={size - pad} stroke="rgba(148,163,184,0.08)" strokeWidth="1" />
      <line x1={pad} y1={size / 2} x2={size - pad} y2={size / 2} stroke="rgba(148,163,184,0.08)" strokeWidth="1" />
      {/* Perimeter */}
      <rect
        x={pad}
        y={pad}
        width={span}
        height={span}
        fill="none"
        stroke="rgba(248,113,113,0.32)"
        strokeWidth="1.2"
        rx="2"
      />
      {/* Obstacles */}
      {map.obstacles.map((obs, idx) => {
        const w = scaleDim(obs.w);
        const h = scaleDim(obs.d);
        const x = toSvg(obs.x) - w / 2;
        const y = toSvg(obs.z) - h / 2;
        const fill =
          obs.kind === 'wall'
            ? '#334155'
            : obs.kind === 'tree'
            ? '#166534'
            : obs.kind === 'train'
            ? '#7c2d12'
            : obs.kind === 'pillar'
            ? '#475569'
            : '#1e293b';
        return <rect key={idx} x={x} y={y} width={w} height={h} fill={fill} rx="0.8" />;
      })}
      {/* Supply caches */}
      {map.supplyCaches.map(([sx, sz], idx) => (
        <circle key={`sc-${idx}`} cx={toSvg(sx)} cy={toSvg(sz)} r="2" fill="#f59e0b" opacity="0.85" />
      ))}
      {/* Duel / Player Spawns */}
      {map.duelSpawns.map(([dx, dz], idx) => (
        <circle
          key={`ds-${idx}`}
          cx={toSvg(dx)}
          cy={toSvg(dz)}
          r="2.8"
          fill={idx === 0 ? '#22c55e' : '#ef4444'}
          stroke="#06090f"
          strokeWidth="0.8"
        />
      ))}
    </svg>
  );
}

export function VoteModal({
  vote,
  localPlayerId,
  isHost,
  onVoteMap,
  onVoteMode,
  onDeployNow,
  onCancel,
}: Props) {
  const [step, setStep] = useState<'map' | 'mode'>('map');
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.ceil((vote.endsAt - Date.now()) / 1000))
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setSecondsLeft(Math.max(0, Math.ceil((vote.endsAt - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(id);
  }, [vote.endsAt]);

  const myMapVote = vote.mapVotes[localPlayerId] || vote.mapCandidates[0];
  const myModeVote = vote.modeVotes[localPlayerId] || vote.modeCandidates[0];

  const countMapVotes = (mid: MapId) =>
    Object.values(vote.mapVotes).filter((v) => v === mid).length;
  const countModeVotes = (moid: GameModeId) =>
    Object.values(vote.modeVotes).filter((v) => v === moid).length;

  const votersForMap = (mid: MapId) =>
    vote.voters.filter((u) => vote.mapVotes[u.playerId] === mid).map((u) => u.username);
  const votersForMode = (moid: GameModeId) =>
    vote.voters.filter((u) => vote.modeVotes[u.playerId] === moid).map((u) => u.username);

  const selectedMapObj = MAPS[myMapVote];
  const selectedModeObj = GAME_MODES[myModeVote];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-5xl bg-[#0a0e16] border border-slate-700/60 rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/90">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-red-400">
              {step === 'map' ? 'Step 1 of 2 · Arena Selection' : 'Step 2 of 2 · Combat Mode'}
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-100 mt-0.5">
              {step === 'map' ? 'Vote Deployment Arena' : 'Vote Combat Ruleset'}
            </h2>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Stage Indicator Tabs */}
            <div className="flex items-center bg-[#121822] border border-slate-800 rounded-lg p-1 text-xs">
              <button
                onClick={() => setStep('map')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                  step === 'map' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                1. Map ({selectedMapObj?.name.split(' ')[0]})
              </button>
              <button
                onClick={() => setStep('mode')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                  step === 'mode' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                2. Mode ({selectedModeObj?.name.split(' ')[0]})
              </button>
            </div>

            {vote.voters.length > 1 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#131924] border border-slate-700/60 text-xs text-sky-300">
                <Users className="w-3.5 h-3.5" />
                <span>{vote.voters.length} Operatives</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/50 border border-red-700/50 text-xs font-mono-num font-bold text-red-300">
              <Timer className="w-3.5 h-3.5" />
              <span>{secondsLeft}s</span>
            </div>
          </div>
        </div>

        {/* STAGE 1: MAP VOTE WITH TACTICAL SCHEMATICS */}
        {step === 'map' && (
          <div className="mt-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <MapPin className="w-4 h-4 text-red-500" />
                <span>Choose 1 of {vote.mapCandidates.length} Unique Blueprints</span>
              </div>
              <span className="text-xs text-slate-400">
                Selected: <span className="text-red-300 font-semibold">{selectedMapObj?.name}</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {vote.mapCandidates.map((mid) => {
                const m = MAPS[mid];
                if (!m) return null;
                const selected = myMapVote === mid;
                const votes = countMapVotes(mid);
                const voters = votersForMap(mid);
                return (
                  <button
                    key={mid}
                    onClick={() => onVoteMap(mid)}
                    className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      selected
                        ? 'bg-red-950/45 border-red-500 shadow-[0_0_24px_rgba(220,38,38,0.22)]'
                        : 'bg-[#121822] border-slate-700/50 hover:border-slate-500'
                    }`}
                  >
                    <div>
                      <ArenaBlueprintSvg mapId={mid} />
                      <div className="flex items-start justify-between gap-2 mt-3">
                        <div>
                          <div className="font-display font-bold text-sm text-slate-100 leading-tight">{m.name}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{m.subtitle}</div>
                        </div>
                        <span className="font-mono-num text-[11px] font-bold px-2 py-0.5 rounded bg-slate-900/90 text-amber-400 shrink-0">
                          {votes} {votes === 1 ? 'vote' : 'votes'}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-300/85 mt-2 line-clamp-2 leading-relaxed">
                        {m.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-amber-400 font-mono-num">
                          Hazard {m.difficultyRating}/5 · {m.arenaHalfSize * 2}m
                        </span>
                        {selected ? (
                          <span className="flex items-center gap-1 text-red-300 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Picked
                          </span>
                        ) : (
                          <span className="text-slate-500">Vote</span>
                        )}
                      </div>
                      {voters.length > 0 && (
                        <div className="mt-1 text-[10px] text-sky-300 truncate">{voters.join(', ')}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STAGE 2: MODE VOTE (ENDLESS HORROR MODES + 1V1 ARENA DUEL) */}
        {step === 'mode' && (
          <div className="mt-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>Arena Locked: {selectedMapObj?.name} — Choose Gameplay Mode</span>
              </div>
              <span className="text-xs text-slate-400">
                Mode: <span className="text-amber-300 font-semibold">{selectedModeObj?.name}</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {vote.modeCandidates.map((moid) => {
                const mode = GAME_MODES[moid];
                if (!mode) return null;
                const selected = myModeVote === moid;
                const votes = countModeVotes(moid);
                const voters = votersForMode(moid);
                const isDuel = Boolean(mode.noMonsters);

                return (
                  <button
                    key={moid}
                    onClick={() => onVoteMode(moid)}
                    className={`text-left p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      selected
                        ? isDuel
                          ? 'bg-sky-950/45 border-sky-400 shadow-[0_0_24px_rgba(56,189,248,0.2)]'
                          : 'bg-amber-950/40 border-amber-500 shadow-[0_0_24px_rgba(245,158,11,0.18)]'
                        : 'bg-[#121822] border-slate-700/50 hover:border-slate-500'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-display font-bold text-base text-slate-100">{mode.name}</div>
                        <span className="font-mono-num text-[11px] font-bold px-2 py-0.5 rounded bg-slate-900/90 text-amber-400 shrink-0">
                          {votes} {votes === 1 ? 'vote' : 'votes'}
                        </span>
                      </div>
                      <div className={`text-xs font-medium mt-1 ${isDuel ? 'text-sky-300' : 'text-amber-300'}`}>
                        {mode.tagline}
                      </div>
                      <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">{mode.description}</p>
                    </div>

                    <div className="mt-4 pt-2.5 border-t border-slate-800/80">
                      <div className="flex items-center justify-between text-[11px]">
                        {isDuel ? (
                          <span className="flex items-center gap-1 text-sky-300 font-medium">
                            <Swords className="w-3.5 h-3.5" />
                            No Zombies · First to {mode.roundsToWin || 5} Rounds
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-slate-300">
                            <Skull className="w-3.5 h-3.5 text-red-400" />
                            Boss every {mode.bossInterval} waves
                          </span>
                        )}
                        {selected && (
                          <span className="flex items-center gap-1 text-amber-300 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                      {voters.length > 0 && (
                        <div className="mt-1 text-[10px] text-sky-300 truncate">{voters.join(', ')}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="mt-6 pt-4 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            Infinite escalating medkits [H] · Switch 1st/2nd/3rd person [C] · Squad Chat [T]
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-4 py-2.5 rounded-lg bg-[#131924] border border-slate-700/60 hover:border-slate-500 text-sm text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
            )}

            {step === 'map' ? (
              <button
                onClick={() => setStep('mode')}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-display font-bold text-white transition-colors cursor-pointer"
              >
                <span>Confirm Map &amp; Choose Mode</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => setStep('map')}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#131924] border border-slate-700/60 hover:border-slate-500 text-sm text-slate-200 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Map</span>
                </button>
                <button
                  onClick={onDeployNow}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-display font-bold text-white transition-colors cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{isHost ? 'Deploy Into Match' : 'Lock Vote'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
