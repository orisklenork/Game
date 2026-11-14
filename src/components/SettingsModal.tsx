import React from 'react';
import { Volume2, VolumeX, X } from 'lucide-react';

export interface GameSettings {
  quality: 'low' | 'medium' | 'high';
  sensitivity: number;
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;
  mobileMode: 'auto' | 'on' | 'off';
}

interface Props {
  settings: GameSettings;
  onChange: (next: GameSettings) => void;
  onClose: () => void;
}

export function SettingsModal({ settings, onChange, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/75">
      <div className="w-full max-w-xl bg-[#0d1118] border border-slate-700/40 rounded-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl font-bold text-slate-100">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Graphics Quality */}
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">Graphics Quality</label>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => onChange({ ...settings, quality: q })}
                  className={`py-2 px-4 rounded-lg text-sm font-medium capitalize transition-colors cursor-pointer ${
                    settings.quality === q
                      ? 'bg-red-600 text-white'
                      : 'bg-[#131924] border border-slate-700/40 text-slate-300 hover:text-white'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Mouse Sensitivity */}
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium text-slate-200">Aim Sensitivity</span>
              <span className="font-mono-num text-slate-400">{(settings.sensitivity * 1000).toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={0.0008}
              max={0.0055}
              step={0.0002}
              value={settings.sensitivity}
              onChange={(e) => onChange({ ...settings, sensitivity: parseFloat(e.target.value) })}
              className="w-full accent-red-600 cursor-pointer"
            />
          </div>

          {/* Audio Controls */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-200">Audio Output</span>
              <button
                onClick={() => onChange({ ...settings, muted: !settings.muted })}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#131924] border border-slate-700/40 text-xs text-slate-200 hover:border-slate-500 cursor-pointer"
              >
                {settings.muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                <span>{settings.muted ? 'Muted' : 'Sound Active'}</span>
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Sound Effects</span>
                <span className="font-mono-num">{Math.round(settings.sfxVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.sfxVolume}
                onChange={(e) => onChange({ ...settings, sfxVolume: parseFloat(e.target.value) })}
                className="w-full accent-red-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Horror Ambient Music</span>
                <span className="font-mono-num">{Math.round(settings.musicVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.musicVolume}
                onChange={(e) => onChange({ ...settings, musicVolume: parseFloat(e.target.value) })}
                className="w-full accent-red-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Mobile Touch Controls */}
          <div className="pt-2 border-t border-slate-800">
            <label className="block text-sm font-medium text-slate-200 mb-2">Touch Controls</label>
            <div className="grid grid-cols-3 gap-2">
              {(['auto', 'on', 'off'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => onChange({ ...settings, mobileMode: m })}
                  className={`py-2 px-4 rounded-lg text-sm font-medium capitalize transition-colors cursor-pointer ${
                    settings.mobileMode === m
                      ? 'bg-red-600 text-white'
                      : 'bg-[#131924] border border-slate-700/40 text-slate-300 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Controls Summary */}
          <div className="pt-2 border-t border-slate-800 text-xs text-slate-400 space-y-1.5">
            <div className="font-medium text-slate-200 mb-1">Desktop Controls</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span>Move: W A S D</span>
              <span>Aim / Fire: Mouse / Left Click</span>
              <span>Sprint: Left Shift</span>
              <span>Aim Down Sights: Right Click</span>
              <span>Jump: Space</span>
              <span>Reload: R</span>
              <span>Switch Weapon: 1–7 / Scroll</span>
              <span>Buy Medkit (Max 3): H or B</span>
              <span>Flashlight: F</span>
              <span>Pause: ESC</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
