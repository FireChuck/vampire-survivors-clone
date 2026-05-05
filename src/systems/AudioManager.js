// AudioManager.js — Procedural SFX via Web Audio API
// No external audio files needed

class AudioManager {
  constructor(scene) {
    this.scene = scene;
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this._muted = false;
    this._volume = 0.5;

    // Lazy-init on first user interaction
    this._initOnInteraction();
  }

  _initOnInteraction() {
    const init = () => {
      if (this.ctx) return;
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this._volume;
        this.masterGain.connect(this.ctx.destination);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.7;
        this.sfxGain.connect(this.masterGain);

        // Compressor to prevent clipping with many simultaneous sounds
        this._compressor = this.ctx.createDynamicsCompressor();
        this._compressor.threshold.value = -20;
        this._compressor.knee.value = 10;
        this._compressor.ratio.value = 8;
        this._compressor.connect(this.masterGain);

        this.sfxGain.connect(this._compressor);
      } catch (e) {
        console.warn('AudioManager: Web Audio not available', e);
      }
    };

    document.addEventListener('pointerdown', init, { once: true });
    document.addEventListener('keydown', init, { once: true });
    document.addEventListener('touchstart', init, { once: true });

    // Also try resume on interaction (for suspended contexts)
    this._resumeHandler = () => this.resume();
    document.addEventListener('pointerdown', this._resumeHandler);
    document.addEventListener('keydown', this._resumeHandler);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // ── Utility ──

  _play(fn) {
    if (!this.ctx || this._muted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const t = this.ctx.currentTime;
    try { fn(t); } catch (e) { /* ignore audio errors */ }
  }

  _osc(type, freq, startT, duration, gainVal, dest) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startT);
    gain.gain.setValueAtTime(gainVal, startT);
    gain.gain.exponentialRampToValueAtTime(0.001, startT + duration);
    osc.connect(gain);
    gain.connect(dest || this.sfxGain);
    osc.start(startT);
    osc.stop(startT + duration + 0.05);
  }

  _noise(startT, duration, gainVal, dest) {
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainVal, startT);
    gain.gain.exponentialRampToValueAtTime(0.001, startT + duration);
    src.connect(gain);
    gain.connect(dest || this.sfxGain);
    src.start(startT);
    src.stop(startT + duration + 0.05);
  }

  // ── SFX Methods ──

  playHit() {
    this._play((t) => {
      // Short punchy thud
      this._osc('triangle', 200 + Math.random() * 80, t, 0.08, 0.25);
      this._noise(t, 0.05, 0.12);
    });
  }

  playEnemyDeath() {
    this._play((t) => {
      // Crunch + descending tone
      this._osc('sawtooth', 300, t, 0.15, 0.15);
      this._osc('sawtooth', 150, t + 0.05, 0.12, 0.1);
      this._noise(t, 0.1, 0.18);
    });
  }

  playPlayerHurt() {
    this._play((t) => {
      // Low rumble impact
      this._osc('sine', 80, t, 0.2, 0.3);
      this._osc('square', 120, t, 0.1, 0.08);
      this._noise(t, 0.15, 0.15);
    });
  }

  playLevelUp() {
    this._play((t) => {
      // Ascending arpeggio — triumphant
      this._osc('sine', 523, t, 0.15, 0.2);         // C5
      this._osc('sine', 659, t + 0.1, 0.15, 0.2);   // E5
      this._osc('sine', 784, t + 0.2, 0.15, 0.2);   // G5
      this._osc('sine', 1047, t + 0.3, 0.3, 0.25);  // C6
      // Shimmer
      this._noise(t + 0.25, 0.15, 0.05);
    });
  }

  playXPPickup() {
    this._play((t) => {
      // Tiny bright ping
      const freq = 800 + Math.random() * 400;
      this._osc('sine', freq, t, 0.06, 0.12);
    });
  }

  playWeaponFire(weaponType) {
    this._play((t) => {
      switch (weaponType) {
        case 'staff':
          // Magic bolt — whoosh + sparkle
          this._osc('sine', 600, t, 0.1, 0.15);
          this._osc('sine', 900, t + 0.03, 0.08, 0.1);
          this._noise(t, 0.06, 0.06);
          break;
        case 'cross':
          // Holy cross — resonant chime
          this._osc('sine', 1200, t, 0.12, 0.12);
          this._osc('triangle', 1800, t + 0.02, 0.1, 0.08);
          break;
        case 'dagger':
          // Quick slash — short noise burst
          this._noise(t, 0.04, 0.15);
          this._osc('sawtooth', 400, t, 0.03, 0.08);
          break;
        case 'fireball':
          // Fireball — low rumble + crackle
          this._osc('sawtooth', 100, t, 0.15, 0.2);
          this._noise(t, 0.12, 0.2);
          break;
        case 'lightning':
          // Lightning — sharp crack
          this._noise(t, 0.08, 0.3);
          this._osc('square', 2000 + Math.random() * 500, t, 0.05, 0.1);
          break;
        case 'garlic':
          // Garlic aura — soft pulse
          this._osc('sine', 200, t, 0.15, 0.06);
          this._osc('triangle', 300, t + 0.05, 0.1, 0.04);
          break;
        case 'whip':
          // Whip crack — sharp snap
          this._noise(t, 0.03, 0.25);
          this._osc('sawtooth', 3000, t, 0.02, 0.08);
          break;
        default:
          // Generic fire
          this._osc('sine', 500, t, 0.08, 0.12);
          this._noise(t, 0.05, 0.08);
      }
    });
  }

  playBossAppear() {
    this._play((t) => {
      // Dramatic low rumble + rising tension
      this._osc('sine', 50, t, 0.6, 0.25);
      this._osc('sawtooth', 80, t + 0.2, 0.4, 0.12);
      this._noise(t + 0.1, 0.3, 0.15);
      // Impact hit
      this._osc('square', 60, t + 0.5, 0.2, 0.2);
      this._noise(t + 0.5, 0.15, 0.25);
    });
  }

  playExplosion() {
    this._play((t) => {
      // Big boom
      this._osc('sine', 60, t, 0.3, 0.3);
      this._osc('sawtooth', 100, t, 0.25, 0.15);
      this._noise(t, 0.25, 0.35);
      // Debris rattle
      this._noise(t + 0.1, 0.15, 0.1);
    });
  }

  playGameOver() {
    this._play((t) => {
      // Descending sad tones
      this._osc('sine', 440, t, 0.3, 0.2);        // A4
      this._osc('sine', 370, t + 0.25, 0.3, 0.18);  // F#4
      this._osc('sine', 330, t + 0.5, 0.3, 0.16);   // E4
      this._osc('sine', 262, t + 0.75, 0.6, 0.2);   // C4
    });
  }

  playMenuClick() {
    this._play((t) => {
      this._osc('sine', 1000, t, 0.04, 0.15);
    });
  }

  playAmbient(biomeName) {
    // Ambient is a continuous drone — not practical with procedural-only approach
    // We keep the method for API compatibility but it's a no-op
    // Could be implemented with a looping oscillator if desired
  }

  // ── Controls ──

  toggleMute() {
    this._muted = !this._muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this._muted ? 0 : this._volume;
    }
    return this._muted;
  }

  setVolume(v) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this.masterGain && !this._muted) {
      this.masterGain.gain.value = this._volume;
    }
  }

  destroy() {
    if (this._resumeHandler) {
      document.removeEventListener('pointerdown', this._resumeHandler);
      document.removeEventListener('keydown', this._resumeHandler);
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
