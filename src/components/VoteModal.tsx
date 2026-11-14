import React, { useEffect, useState } from 'react';
import { CheckCircle2, Flame, MapPin, Play, Skull, Timer, Users } from 'lucide-react';
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

export function VoteModal({
  vote,
  localPlayerId,
  isHost,
  onVoteMap,
  onVoteMode,
  onDeployNow,
  onCancel,
}: Props) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.ceil((vote.endsAt - Date.now()) / 1000))
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setSecondsLeft(Math.max(0, Math.ceil((vote.endsAt - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(id);
  }, [vote.endsAt]);

  const myMapVote = vote.mapVotes[localPlayerId];
  const myModeVote = vote.modeVotes[localPlayerId];

  const countMapVotes = (mid: MapId) =>
    Object.values(vote.mapVotes).filter((v) => v === mid).length;
  const countModeVotes = (moid: GameModeId) =>
    Object.values(vote.modeVotes).filter((v) => v === moid).length;

  const votersForMap = (mid: MapId) =>
    vote.voters.filter((u) => vote.mapVotes[u.playerId] === mid).map((u) => u.username);
  const votersForMode = (moid: GameModeId) =>
    vote.voters.filter((u) => vote.modeVotes[u.playerId] === moid).map((u) => u.username);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6 bg-black/82 backdrop-blur-sm">
      <div className="w-full max-w-4xl bg-[#0b0f17] border border-slate-700/60 rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/90">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-red-400">
              Pre-Match Tactical Vote
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-100 mt-0.5">
              Vote Area &amp; Survival Mode
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {vote.voters.length > 1 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#131924] border border-slate-700/60 text-xs text-sky-300">
                <Users className="w-3.5 h-3.5" />
                <span>{vote.voters.length} Operatives Voting</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/50 border border-red-700/50 text-xs font-mono-num font-bold text-red-300">
              <Timer className="w-3.5 h-3.5" />
              <span>{secondsLeft}s</span>
            </div>
          </div>
        </div>

        {/* Section 1: Vote Area (1 of 3 maps) */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <MapPin className="w-4 h-4 text-red-500" />
              <span>1. Select Contamination Area (3 Options)</span>
            </div>
            <span className="text-xs text-slate-400">
              {myMapVote ? `Voted: ${MAPS[myMapVote]?.name}` : 'Pick 1 area'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                  className={`text-left p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                    selected
                      ? 'bg-red-950/45 border-red-500 shadow-[0_0_24px_rgba(220,38,38,0.22)]'
                      : 'bg-[#121822] border-slate-700/50 hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-display font-bold text-base text-slate-100">{m.name}</div>
                      <div className="text-xs text-slate-400">{m.subtitle}</div>
                    </div>
                    <span className="font-mono-num text-xs font-bold px-2 py-0.5 rounded bg-slate-900/90 text-amber-400 shrink-0">
                      {votes} {votes === 1 ? 'vote' : 'votes'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300/90 mt-2.5 line-clamp-2 leading-relaxed">
                    {m.description}
                  </p>

                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-amber-400 font-mono-num">
                      Hazard {m.difficultyRating}/5
                    </span>
                    {selected ? (
                      <span className="flex items-center gap-1 text-red-300 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Selected
                      </span>
                    ) : (
                      <span className="text-slate-500">Click to vote</span>
                    )}
                  </div>
                  {voters.length > 0 && (
                    <div className="mt-1.5 text-[11px] text-sky-300 truncate">
                      {voters.join(', ')}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Vote Mode (1 of 3 gameplay modes) */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Flame className="w-4 h-4 text-amber-400" />
              <span>2. Select Gameplay Mode (3 Options)</span>
            </div>
            <span className="text-xs text-slate-400">
              {myModeVote ? `Voted: ${GAME_MODES[myModeVote]?.name}` : 'Pick 1 mode'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {vote.modeCandidates.map((moid) => {
              const mode = GAME_MODES[moid];
              if (!mode) return null;
              const selected = myModeVote === moid;
              const votes = countModeVotes(moid);
              const voters = votersForMode(moid);
              return (
                <button
                  key={moid}
                  onClick={() => onVoteMode(moid)}
                  className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                    selected
                      ? 'bg-amber-950/35 border-amber-500 shadow-[0_0_24px_rgba(245,158,11,0.18)]'
                      : 'bg-[#121822] border-slate-700/50 hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-display font-bold text-base text-slate-100">{mode.name}</div>
                    <span className="font-mono-num text-xs font-bold px-2 py-0.5 rounded bg-slate-900/90 text-amber-400 shrink-0">
                      {votes} {votes === 1 ? 'vote' : 'votes'}
                    </span>
                  </div>
                  <div className="text-xs font-medium text-amber-300 mt-1">{mode.tagline}</div>
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                    {mode.description}
                  </p>
                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1 text-slate-400">
                      <Skull className="w-3.5 h-3.5 text-red-400" />
                      Boss every {mode.bossInterval} waves
                    </span>
                    {selected && (
                      <span className="flex items-center gap-1 text-amber-300 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Voted
                      </span>
                    )}
                  </div>
                  {voters.length > 0 && (
                    <div className="mt-1.5 text-[11px] text-sky-300 truncate">
                      {voters.join(', ')}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Bar */}
        <div className="mt-6 pt-4 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            Unlimited waves enabled · Abomination Titan spawns every 5 waves · Press H for Medkit
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
            <button
              onClick={onDeployNow}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-display font-bold text-white transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isHost ? 'Deploy Into Match' : 'Lock Vote'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
