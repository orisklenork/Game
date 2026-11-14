import React, { useEffect, useState } from 'react';
import { apiFetch, PlayerProfile, saveToken } from '../lib/api';
import { audioEngine } from '../game/audio';

interface Props {
  onAuthenticated: (profile: PlayerProfile, token: string) => void;
}

function validateUsernameLocally(raw: string): { valid: boolean; reason?: string } {
  const trimmed = raw.trim();
  if (trimmed.length < 3 || trimmed.length > 18) {
    return { valid: false, reason: 'Username must be 3–18 characters.' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return { valid: false, reason: 'Only letters, numbers, underscores, and hyphens allowed.' };
  }
  return { valid: true };
}

export function AuthOverlay({ onAuthenticated }: Props) {
  const [username, setUsername] = useState('');
  const [availability, setAvailability] = useState<{
    checked: boolean;
    valid: boolean;
    available: boolean;
    reason?: string;
    networkError?: boolean;
  }>({ checked: false, valid: false, available: false });
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const trimmed = username.trim();
  const localCheck = validateUsernameLocally(username);

  useEffect(() => {
    setError('');
    if (!trimmed) {
      setAvailability({ checked: false, valid: false, available: false });
      setChecking(false);
      return;
    }
    if (!localCheck.valid) {
      setAvailability({ checked: true, valid: false, available: false, reason: localCheck.reason });
      setChecking(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setChecking(true);
      try {
        const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(trimmed)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setAvailability({
            checked: true,
            valid: Boolean(data.valid),
            available: Boolean(data.available),
            reason: data.reason,
          });
        }
      } catch {
        if (!cancelled) {
          // Do not lock out submission on transient availability check failure; POST /register validates authoritatively
          setAvailability({ checked: false, valid: true, available: true, networkError: true });
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, localCheck.valid, localCheck.reason]);

  const canSubmit =
    localCheck.valid &&
    !submitting &&
    !(availability.checked && !availability.available);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    audioEngine.unlock();
    audioEngine.playUiClick();
    setSubmitting(true);
    setError('');
    try {
      const data = await apiFetch<{ token: string; profile: PlayerProfile }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: trimmed }),
      });
      saveToken(data.token);
      onAuthenticated(data.profile, data.token);
    } catch (err: any) {
      setError(err.message || 'Could not create operative profile.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-6 bg-black/75">
      <div className="w-full max-w-md bg-[#0d1118] border border-slate-700/40 rounded-xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <svg viewBox="0 0 40 40" className="w-9 h-9 text-red-600 shrink-0" fill="none">
            <rect x="3" y="3" width="34" height="34" rx="6" stroke="currentColor" strokeWidth="2.2" />
            <path d="M20 8V32M8 20H32" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="20" cy="20" r="5" fill="#dc2626" />
          </svg>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-wide text-slate-100 leading-none">NIGHTFALL</h1>
            <p className="text-xs text-slate-400 mt-1">Two-Player Survival Horror Shooter</p>
          </div>
        </div>

        <h2 className="font-display text-xl font-semibold text-slate-100 mb-2">Create Operative Profile</h2>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          Enter a callsign to begin. Your unique Player ID, loadout, coins, and rank are saved automatically with no password required.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username-input" className="block text-xs font-medium text-slate-300 mb-2">
              Callsign (Username Only)
            </label>
            <input
              id="username-input"
              type="text"
              autoFocus
              maxLength={18}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. GhostWarden"
              className="w-full px-4 py-3 rounded-lg bg-[#07090d] border border-slate-700/60 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
            />
            <div className="mt-2 min-h-[20px] text-xs">
              {checking && <span className="text-slate-400">Checking callsign availability...</span>}
              {!checking && availability.checked && availability.valid && availability.available && (
                <span className="text-emerald-400">Callsign available</span>
              )}
              {!checking && availability.checked && (!availability.valid || !availability.available) && (
                <span className="text-red-400">{availability.reason}</span>
              )}
              {!checking && !availability.checked && localCheck.valid && availability.networkError && (
                <span className="text-slate-400">Callsign format valid — click Enter Nightfall to register</span>
              )}
            </div>
          </div>

          {error && <div className="text-xs text-red-400 bg-red-950/50 border border-red-800/50 rounded-lg p-3">{error}</div>}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-3 px-6 rounded-lg font-display font-semibold text-base bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-500 text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating Operative...' : 'Enter Nightfall'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800/80 text-xs text-slate-500 flex items-center justify-between">
          <span>3–18 chars · Letters, numbers, _ and -</span>
          <span>+350 Starter Coins</span>
        </div>
      </div>
    </div>
  );
}
