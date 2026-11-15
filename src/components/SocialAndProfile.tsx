import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Check,
  Coins,
  Gift,
  RefreshCw,
  Search,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { ACHIEVEMENTS, getLevelFromXp, MAPS, WEAPONS, WeaponId } from '../shared/gameData';
import { apiFetch, PlayerProfile } from '../lib/api';
import { audioEngine } from '../game/audio';

interface Props {
  initialTab: 'friends' | 'leaderboard' | 'profile';
  profile: PlayerProfile;
  onProfileUpdated: (p: PlayerProfile) => void;
  onInviteToRoom?: (friendId: string) => void;
  inRoom: boolean;
  onClose: () => void;
}

type LeaderboardSort = 'kills' | 'wave' | 'wins' | 'level';

export function SocialAndProfile({
  initialTab,
  profile,
  onProfileUpdated,
  onInviteToRoom,
  inRoom,
  onClose,
}: Props) {
  const [tab, setTab] = useState<'friends' | 'leaderboard' | 'profile'>(initialTab);
  const [lbScope, setLbScope] = useState<'global' | 'friends'>('global');
  const [lbSort, setLbSort] = useState<LeaderboardSort>('kills');
  const [lbLoading, setLbLoading] = useState(false);
  const [lbError, setLbError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [friendsData, setFriendsData] = useState<{ friends: any[]; incoming: any[]; outgoing: any[] }>({
    friends: [],
    incoming: [],
    outgoing: [],
  });
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [matchHistory, setMatchHistory] = useState<any[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const lvlInfo = getLevelFromXp(profile.xp);
  const today = new Date().toISOString().slice(0, 10);
  const canClaimDaily = profile.lastDailyClaim !== today;

  const loadFriends = useCallback(async () => {
    try {
      const data = await apiFetch('/api/friends');
      setFriendsData(data);
    } catch {}
  }, []);

  const loadLeaderboard = useCallback(async (scope: 'global' | 'friends', sort: LeaderboardSort) => {
    setLbLoading(true);
    setLbError(null);
    try {
      const data = await apiFetch<{ entries: any[] }>(`/api/leaderboard?scope=${scope}&sort=${sort}`);
      setLeaderboard(Array.isArray(data?.entries) ? data.entries : []);
    } catch (err: any) {
      setLbError(err?.message || 'Unable to load rankings from server.');
      setLeaderboard([]);
    } finally {
      setLbLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const data = await apiFetch<{ matches: any[] }>('/api/matches/history');
      setMatchHistory(data.matches || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (tab === 'friends') loadFriends();
    if (tab === 'leaderboard') loadLeaderboard(lbScope, lbSort);
    if (tab === 'profile') loadHistory();
  }, [tab, lbScope, lbSort, loadFriends, loadLeaderboard, loadHistory]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQ.trim()) return;
    try {
      const data = await apiFetch<{ players: any[] }>(`/api/players/search?q=${encodeURIComponent(searchQ.trim())}`);
      setSearchResults(data.players);
    } catch {}
  };

  const sendRequest = async (target: string) => {
    audioEngine.playUiClick();
    try {
      const data = await apiFetch('/api/friends/request', {
        method: 'POST',
        body: JSON.stringify({ target }),
      });
      setFriendsData(data);
      setMsg('Friend request sent');
      setTimeout(() => setMsg(null), 2200);
    } catch (err: any) {
      setMsg(err.message);
      setTimeout(() => setMsg(null), 2200);
    }
  };

  const respondRequest = async (requestId: string, accept: boolean) => {
    audioEngine.playUiClick();
    try {
      const data = await apiFetch('/api/friends/respond', {
        method: 'POST',
        body: JSON.stringify({ requestId, accept }),
      });
      setFriendsData(data);
    } catch {}
  };

  const removeFriend = async (friendId: string) => {
    audioEngine.playUiClick();
    try {
      const data = await apiFetch(`/api/friends/${friendId}`, { method: 'DELETE' });
      setFriendsData(data);
    } catch {}
  };

  const claimDaily = async () => {
    audioEngine.playUiClick();
    try {
      const res = await apiFetch<{ profile: PlayerProfile; rewardCoins: number }>('/api/rewards/daily', {
        method: 'POST',
      });
      onProfileUpdated(res.profile);
      setMsg(`Claimed +${res.rewardCoins} daily coins`);
      setTimeout(() => setMsg(null), 2500);
    } catch (err: any) {
      setMsg(err.message);
    }
  };

  const claimMission = async (missionType: 'kills' | 'matches') => {
    audioEngine.playUiClick();
    try {
      const res = await apiFetch<{ profile: PlayerProfile; rewardCoins: number }>('/api/rewards/mission', {
        method: 'POST',
        body: JSON.stringify({ missionType }),
      });
      onProfileUpdated(res.profile);
      setMsg(`Mission reward claimed: +${res.rewardCoins} coins`);
      setTimeout(() => setMsg(null), 2500);
    } catch (err: any) {
      setMsg(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/80">
      <div className="w-full max-w-5xl bg-[#0d1118] border border-slate-700/40 rounded-xl p-6 shadow-2xl max-h-[92vh] flex flex-col">
        {/* Header Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            {(
              [
                ['profile', 'Player Profile'],
                ['friends', 'Friends'],
                ['leaderboard', 'Leaderboard'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => {
                  audioEngine.playUiClick();
                  setTab(id);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  tab === id ? 'bg-red-600 text-white' : 'bg-[#131924] text-slate-300 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {msg && (
          <div className="mt-3 px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-xs text-slate-100">
            {msg}
          </div>
        )}

        <div className="flex-1 overflow-y-auto mt-5 pr-1">
          {tab === 'profile' && (
            <div className="space-y-6">
              {/* Top Profile Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 bg-[#131924] border border-slate-700/40 rounded-xl p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-mono-num text-xs text-slate-400">Player ID: {profile.playerCode}</div>
                      <h2 className="font-display text-2xl font-bold text-slate-100 mt-0.5">{profile.username}</h2>
                      <div className="text-sm text-red-400 font-medium mt-0.5">
                        Level {lvlInfo.level} · {lvlInfo.rank}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Balance</div>
                      <div className="flex items-center justify-end gap-1.5 font-mono-num text-xl font-bold text-amber-400">
                        <Coins className="w-5 h-5" />
                        <span>{profile.coins.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* XP Bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span>XP Progress</span>
                      <span className="font-mono-num">
                        {lvlInfo.currentXp} / {lvlInfo.nextLevelXp} XP
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-900 rounded overflow-hidden">
                      <div
                        className="h-full bg-red-600"
                        style={{ width: `${Math.min(100, (lvlInfo.currentXp / lvlInfo.nextLevelXp) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Key Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800 text-xs">
                    <div>
                      <div className="text-slate-400">Total Kills</div>
                      <div className="font-mono-num text-lg font-bold text-slate-100">{profile.stats.totalKills}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Matches Won</div>
                      <div className="font-mono-num text-lg font-bold text-slate-100">
                        {profile.stats.matchesWon} / {profile.stats.matchesPlayed}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">Best Wave</div>
                      <div className="font-mono-num text-lg font-bold text-slate-100">{profile.stats.highestWave}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Favorite Gun</div>
                      <div className="font-semibold text-sm text-slate-100 mt-1">
                        {WEAPONS[profile.stats.favoriteWeapon as WeaponId]?.name || 'M9 Tactical'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Daily Rewards & Missions */}
                <div className="bg-[#131924] border border-slate-700/40 rounded-xl p-5 space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-display font-semibold text-sm text-slate-100 flex items-center gap-1.5">
                        <Gift className="w-4 h-4 text-amber-400" />
                        Daily Supply Drop
                      </span>
                      <span className="font-mono-num text-xs text-slate-400">Streak {profile.dailyStreak}</span>
                    </div>
                    <button
                      onClick={claimDaily}
                      disabled={!canClaimDaily}
                      className="mt-2.5 w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 text-xs font-semibold text-white cursor-pointer"
                    >
                      {canClaimDaily ? 'Claim Daily Coins' : 'Claimed Today'}
                    </button>
                  </div>

                  <div className="pt-3 border-t border-slate-800 space-y-2.5">
                    <div className="text-xs font-semibold text-slate-300">Daily Missions</div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div>
                        <div className="text-slate-200">Eliminate 25 Monsters</div>
                        <div className="font-mono-num text-slate-400">{Math.min(25, profile.dailyMission.killsToday)} / 25</div>
                      </div>
                      <button
                        onClick={() => claimMission('kills')}
                        disabled={profile.dailyMission.claimedKills || profile.dailyMission.killsToday < 25}
                        className="px-2.5 py-1.5 rounded bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold cursor-pointer"
                      >
                        {profile.dailyMission.claimedKills ? 'Done' : '+180c'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div>
                        <div className="text-slate-200">Play 2 Matches</div>
                        <div className="font-mono-num text-slate-400">{Math.min(2, profile.dailyMission.matchesToday)} / 2</div>
                      </div>
                      <button
                        onClick={() => claimMission('matches')}
                        disabled={profile.dailyMission.claimedMatches || profile.dailyMission.matchesToday < 2}
                        className="px-2.5 py-1.5 rounded bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold cursor-pointer"
                      >
                        {profile.dailyMission.claimedMatches ? 'Done' : '+200c'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Achievements */}
              <div>
                <h3 className="font-display text-base font-semibold text-slate-200 mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>Achievements ({profile.achievements.length}/{ACHIEVEMENTS.length})</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {ACHIEVEMENTS.map((a) => {
                    const unlocked = profile.achievements.includes(a.id);
                    return (
                      <div
                        key={a.id}
                        className={`p-3.5 rounded-lg border ${
                          unlocked
                            ? 'bg-emerald-950/25 border-emerald-700/50'
                            : 'bg-[#131924] border-slate-700/40 opacity-75'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-slate-100">{a.name}</span>
                          <span className="font-mono-num text-xs text-amber-400">+{a.rewardCoins}c</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{a.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Match History */}
              <div>
                <h3 className="font-display text-base font-semibold text-slate-200 mb-3">Recent Match History</h3>
                {matchHistory.length === 0 ? (
                  <div className="text-xs text-slate-500 bg-[#131924] border border-slate-800 rounded-lg p-4">
                    No matches played yet. Deploy into a solo, 2-player survival, or 1v1 duel match to record history.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {matchHistory.map((m) => (
                      <div
                        key={m.id}
                        className="flex flex-wrap items-center justify-between gap-3 bg-[#131924] border border-slate-700/40 rounded-lg px-4 py-2.5 text-xs"
                      >
                        <div>
                          <span className={`font-semibold mr-2 ${m.victory ? 'text-emerald-400' : 'text-red-400'}`}>
                            {m.victory ? 'VICTORY' : 'DEFEAT'}
                          </span>
                          <span className="text-slate-200">{MAPS[m.map_id as keyof typeof MAPS]?.name || m.map_id}</span>
                          <span className="text-slate-500 mx-1.5">·</span>
                          <span className="text-slate-400 capitalize">{m.difficulty}</span>
                        </div>
                        <div className="font-mono-num text-slate-300 flex items-center gap-4">
                          <span>Waves: {m.waves_cleared}</span>
                          <span>Kills: {m.kills}</span>
                          <span className="text-amber-400">+{m.coins_earned}c</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'friends' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Search & Add Friends */}
              <div className="space-y-4">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQ}
                      onChange={(e) => setSearchQ(e.target.value)}
                      placeholder="Search username or NF-ID..."
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[#07090d] border border-slate-700/60 text-sm text-slate-100 focus:outline-none focus:border-red-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-semibold text-white cursor-pointer"
                  >
                    Search
                  </button>
                </form>

                {searchResults.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-slate-400">Search Results</div>
                    {searchResults.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between bg-[#131924] border border-slate-700/40 rounded-lg px-3.5 py-2.5"
                      >
                        <div className="text-xs">
                          <div className="font-semibold text-slate-100">
                            {p.username} <span className="text-slate-500 font-mono-num">({p.player_code})</span>
                          </div>
                          <div className="text-slate-400">
                            Lv.{p.level} · {p.rank} · {p.total_kills} kills
                          </div>
                        </div>
                        <button
                          onClick={() => sendRequest(p.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded bg-slate-700 hover:bg-red-600 text-xs text-white cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {friendsData.incoming.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="text-xs font-semibold text-amber-400">Incoming Friend Requests</div>
                    {friendsData.incoming.map((req) => (
                      <div
                        key={req.id}
                        className="flex items-center justify-between bg-[#131924] border border-amber-700/40 rounded-lg px-3.5 py-2.5"
                      >
                        <div className="text-xs">
                          <div className="font-semibold text-slate-100">{req.username}</div>
                          <div className="text-slate-400">Lv.{req.level} · {req.rank}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => respondRequest(req.id, true)}
                            className="px-2.5 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-xs text-white cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => respondRequest(req.id, false)}
                            className="px-2.5 py-1.5 rounded bg-slate-700 hover:bg-red-700 text-xs text-white cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Friends List */}
              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Users className="w-4 h-4 text-red-500" />
                  <span>Friends ({friendsData.friends.length})</span>
                </div>
                {friendsData.friends.length === 0 ? (
                  <div className="text-xs text-slate-500 bg-[#131924] border border-slate-800 rounded-lg p-4">
                    No friends added yet. Search for players by username or NF-ID to send a request.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {friendsData.friends.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between bg-[#131924] border border-slate-700/40 rounded-lg px-4 py-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-100">{f.username}</span>
                            <span className={`text-[11px] ${f.is_online ? 'text-emerald-400' : 'text-slate-500'}`}>
                              {f.is_online ? 'Online' : 'Offline'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 font-mono-num mt-0.5">
                            Lv.{f.level} · {f.total_kills} kills · {f.matches_won} wins
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {inRoom && f.is_online && onInviteToRoom && (
                            <button
                              onClick={() => onInviteToRoom(f.id)}
                              className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-xs text-white cursor-pointer"
                            >
                              Invite
                            </button>
                          )}
                          <button
                            onClick={() => removeFriend(f.id)}
                            className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 cursor-pointer"
                            title="Remove Friend"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'leaderboard' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {(['global', 'friends'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        audioEngine.playUiClick();
                        setLbScope(s);
                      }}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
                        lbScope === s ? 'bg-red-600 text-white' : 'bg-[#131924] text-slate-300 hover:text-white'
                      }`}
                    >
                      {s} Rankings
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {(
                    [
                      ['kills', 'By Kills'],
                      ['wave', 'By Best Wave'],
                      ['wins', 'By Wins'],
                      ['level', 'By Level'],
                    ] as const
                  ).map(([sKey, sLabel]) => (
                    <button
                      key={sKey}
                      onClick={() => {
                        audioEngine.playUiClick();
                        setLbSort(sKey);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                        lbSort === sKey
                          ? 'bg-amber-600 text-white'
                          : 'bg-[#131924] border border-slate-700/50 text-slate-300 hover:text-white'
                      }`}
                    >
                      {sLabel}
                    </button>
                  ))}

                  <button
                    onClick={() => loadLeaderboard(lbScope, lbSort)}
                    disabled={lbLoading}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#131924] border border-slate-700/50 hover:border-slate-500 text-xs text-slate-200 cursor-pointer disabled:opacity-50"
                    title="Refresh Leaderboard"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${lbLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {lbError && (
                <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-red-950/60 border border-red-700/60 text-xs text-red-200">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{lbError}</span>
                  </div>
                  <button
                    onClick={() => loadLeaderboard(lbScope, lbSort)}
                    className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-semibold cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}

              <div className="overflow-x-auto bg-[#131924] border border-slate-700/40 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">Operative</th>
                      <th className="py-3 px-4">Rank</th>
                      <th className="py-3 px-4 text-right">Level</th>
                      <th className="py-3 px-4 text-right">Kills</th>
                      <th className="py-3 px-4 text-right">Best Wave</th>
                      <th className="py-3 px-4 text-right">Bosses</th>
                      <th className="py-3 px-4 text-right">Wins</th>
                      <th className="py-3 px-4 text-right">Coins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lbLoading && leaderboard.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">
                          Loading operative rankings...
                        </td>
                      </tr>
                    ) : (
                      leaderboard.map((row, idx) => (
                        <tr
                          key={row.id}
                          className={`border-b border-slate-800/60 last:border-0 ${
                            row.id === profile.id ? 'bg-red-950/25' : ''
                          }`}
                        >
                          <td className="py-3 px-4 font-mono-num font-bold text-slate-300">
                            {idx === 0 ? <Trophy className="w-4 h-4 text-amber-400 inline" /> : idx + 1}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-100">
                            {row.username}
                            <span className="text-slate-500 font-mono-num ml-1.5">{row.player_code}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-300">{row.rank}</td>
                          <td className="py-3 px-4 text-right font-mono-num text-slate-200">{row.level}</td>
                          <td className="py-3 px-4 text-right font-mono-num font-semibold text-red-400">
                            {row.total_kills ?? 0}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-num text-sky-300">
                            {row.highest_wave ?? 0}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-num text-orange-300">
                            {row.boss_kills ?? 0}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-num text-slate-200">
                            {row.matches_won ?? 0}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-num text-amber-400">
                            {(row.coins ?? 0).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                    {!lbLoading && !lbError && leaderboard.length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-6 text-center text-slate-500">
                          No ranking entries found yet. Complete a match to claim the #1 spot.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
