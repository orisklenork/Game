import { WeaponId } from '../shared/gameData';

class HorrorAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicNodes: AudioNode[] = [];
  private bossMode = false;
  private muted = false;
  private musicVolume = 0.35;
  private sfxVolume = 0.7;
  private musicPlaying = false;
  private heartbeatTimer: number | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 1;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock() {
    this.ensureContext();
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.03);
    }
  }

  public isMuted() {
    return this.muted;
  }

  public setVolumes(sfx: number, music: number) {
    this.sfxVolume = sfx;
    this.musicVolume = music;
    if (this.sfxGain && this.ctx) this.sfxGain.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
    if (this.musicGain && this.ctx) this.musicGain.gain.setTargetAtTime(music, this.ctx.currentTime, 0.05);
  }

  public startAmbientMusic() {
    const ctx = this.ensureContext();
    if (!ctx || !this.musicGain || this.musicPlaying) return;
    this.musicPlaying = true;

    // Dark sub-bass drone + eerie detuned fifth
    const freqs = [46.25, 69.3, 92.5];
    for (const f of freqs) {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = f < 60 ? 'sawtooth' : 'triangle';
      osc.frequency.value = f;
      filter.type = 'lowpass';
      filter.frequency.value = 180;
      g.gain.value = f < 60 ? 0.14 : 0.07;
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.musicGain);
      osc.start();
      this.musicNodes.push(osc, filter, g);
    }

    // Slow horror pulse / boss tension
    this.heartbeatTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicGain || this.muted || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(this.bossMode ? 68 : 48, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.25);
      g.gain.setValueAtTime(this.bossMode ? 0.28 : 0.1, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(g);
      g.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + 0.38);
    }, 950);
  }

  public setBossMusic(active: boolean) {
    this.bossMode = active;
  }

  public stopMusic() {
    this.musicPlaying = false;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    for (const n of this.musicNodes) {
      if ('stop' in n && typeof (n as any).stop === 'function') {
        try {
          (n as any).stop();
        } catch {}
      }
      n.disconnect();
    }
    this.musicNodes = [];
  }

  private createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  public playUiClick() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.045);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  public playGunshot(weaponId: WeaponId, volumeScale = 1) {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    const now = ctx.currentTime;

    if (weaponId === 'combat_knife' || weaponId === 'karambit' || weaponId === 'machete' || weaponId === 'tomahawk' || weaponId === 'katana') {
      this.playMeleeSlash();
      return;
    }

    if (weaponId === 'frag_grenade' || weaponId === 'molotov' || weaponId === 'pipe_bomb' || weaponId === 'thermite' || weaponId === 'shock_grenade') {
      this.playThrow();
      return;
    }

    if (weaponId === 'plasma' || weaponId === 'plasma_cannon') {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(weaponId === 'plasma' ? 1150 : 880, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.2);
      g.gain.setValueAtTime((weaponId === 'plasma' ? 0.38 : 0.24) * volumeScale, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.23);
      return;
    }

    if (weaponId === 'flamethrower') {
      const noise = ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer(ctx, 0.1);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 620;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.22 * volumeScale, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      noise.connect(filter);
      filter.connect(g);
      g.connect(this.sfxGain);
      noise.start(now);
      return;
    }

    const isSuppressed = weaponId === 'usp45' || weaponId === 'as_val' || weaponId === 'vss';
    const isShotgun = weaponId === 'shotgun' || weaponId === 'sawed_off' || weaponId === 'spas12' || weaponId === 'ksg12' || weaponId === 'aa12';
    const isSniper = weaponId === 'sniper' || weaponId === 'awp' || weaponId === 'barrett' || weaponId === 'mk14';
    const isHeavy = weaponId === 'deagle' || weaponId === 'revolver' || weaponId === 'rpg';

    const dur = isShotgun || isSniper || weaponId === 'rpg' ? 0.28 : isSuppressed ? 0.08 : 0.12;
    const noise = ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(ctx, dur);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = isSuppressed ? 2100 : isShotgun ? 640 : isSniper || isHeavy ? 880 : 1450;
    filter.Q.value = isSuppressed ? 1.4 : 0.7;

    const g = ctx.createGain();
    const peak = (isSuppressed ? 0.22 : isShotgun || isSniper || isHeavy ? 0.65 : 0.4) * volumeScale;
    g.gain.setValueAtTime(peak, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    noise.start(now);

    if (!isSuppressed) {
      const thump = ctx.createOscillator();
      const tg = ctx.createGain();
      thump.type = 'sine';
      thump.frequency.setValueAtTime(isSniper || isHeavy ? 185 : 130, now);
      thump.frequency.exponentialRampToValueAtTime(36, now + 0.09);
      tg.gain.setValueAtTime(0.34 * volumeScale, now);
      tg.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      thump.connect(tg);
      tg.connect(this.sfxGain);
      thump.start(now);
      thump.stop(now + 0.11);
    }
  }

  public playMeleeSlash() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(ctx, 0.12);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1900, now);
    filter.frequency.exponentialRampToValueAtTime(650, now + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    noise.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    noise.start(now);
  }

  public playThrow() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.11);
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playExplosion(kind = 'frag_grenade') {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    const now = ctx.currentTime;
    const dur = kind === 'molotov' ? 0.35 : 0.55;
    const noise = ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(ctx, dur);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(kind === 'molotov' ? 1200 : 480, now);
    filter.frequency.exponentialRampToValueAtTime(90, now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.65, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    noise.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    noise.start(now);

    const boom = ctx.createOscillator();
    const bg = ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(110, now);
    boom.frequency.exponentialRampToValueAtTime(24, now + 0.4);
    bg.gain.setValueAtTime(0.5, now);
    bg.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    boom.connect(bg);
    bg.connect(this.sfxGain);
    boom.start(now);
    boom.stop(now + 0.45);
  }

  public playChatPing() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(760, now);
    osc.frequency.exponentialRampToValueAtTime(1040, now + 0.06);
    g.gain.setValueAtTime(0.1, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playReload() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    const now = ctx.currentTime;
    [0, 0.24].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(idx === 0 ? 380 : 620, now + offset);
      osc.frequency.exponentialRampToValueAtTime(160, now + offset + 0.05);
      g.gain.setValueAtTime(0.16, now + offset);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.06);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(now + offset);
      osc.stop(now + offset + 0.065);
    });
  }

  public playHitMarker(killed = false) {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(killed ? 980 : 680, now);
    osc.frequency.exponentialRampToValueAtTime(killed ? 1480 : 420, now + 0.07);
    g.gain.setValueAtTime(killed ? 0.26 : 0.15, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playMonsterGrowl(isBoss = false) {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(isBoss ? 58 : 95, now);
    osc.frequency.linearRampToValueAtTime(isBoss ? 36 : 62, now + 0.42);
    filter.type = 'lowpass';
    filter.frequency.value = isBoss ? 260 : 420;
    g.gain.setValueAtTime(0.01, now);
    g.gain.linearRampToValueAtTime(isBoss ? 0.34 : 0.18, now + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.48);
  }

  public playMonsterDeath() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.28);
    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.31);
  }

  public playCoinPickup() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.055);
      g.gain.setValueAtTime(0.18, now + i * 0.055);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.14);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(now + i * 0.055);
      osc.stop(now + i * 0.055 + 0.15);
    });
  }

  public playHeal() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.25);
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  public playPlayerHurt() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.18);
    g.gain.setValueAtTime(0.32, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  public playFootstep() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;
    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(ctx, 0.05);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 340;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    noise.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    noise.start(now);
  }
}

export const audioEngine = new HorrorAudioEngine();
