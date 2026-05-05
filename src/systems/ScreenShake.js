// ScreenShake.js — Camera shake with intensity levels and damage-based scaling
// Usage: scene.screenShake.shake('playerHit') or scene.screenShake.shake('explosion')
// New: scene.screenShake.shakeDamage(amount) for dynamic damage-based shake

class ScreenShake {
  constructor(scene) {
    this.scene = scene;
    this._shaking = false;
    this.enabled = true;

    // Intensity presets: { duration (ms), intensity (0-1) }
    this.presets = {
      playerHit:  { duration: 150, intensity: 0.004 },
      bossSpawn:  { duration: 300, intensity: 0.008 },
      explosion:  { duration: 400, intensity: 0.015 },
      levelUp:    { duration: 200, intensity: 0.005 },
      crit:       { duration: 100, intensity: 0.006 },
      bossDeath:  { duration: 600, intensity: 0.020 }
    };

    // Damage-based shake thresholds
    this.damageThresholds = {
      light:  { max: 15,  duration: 80,  intensity: 0.002 },
      medium: { max: 40,  duration: 130, intensity: 0.005 },
      heavy:  { max: 80,  duration: 200, intensity: 0.010 },
      massive:{ max: Infinity, duration: 350, intensity: 0.018 }
    };
  }

  /**
   * Trigger a camera shake by preset name or custom params.
   * @param {string} presetName - key from this.presets
   * @param {object} [override] - optional { duration, intensity }
   */
  shake(presetName, override) {
    if (!this.enabled) return;
    const p = override || this.presets[presetName];
    if (!p) return;

    this._doShake(p.duration, p.intensity);
  }

  /**
   * Damage-based shake — intensity scales with damage amount.
   * Light hits (≤15) = subtle, Massive hits (>80) = heavy screen shake.
   * @param {number} damageAmount - the damage dealt/received
   * @param {boolean} isCrit - if true, boost intensity by 40%
   */
  shakeDamage(damageAmount, isCrit) {
    const thresholds = this.damageThresholds;
    let config = thresholds.light;

    if (damageAmount > thresholds.heavy.max) config = thresholds.massive;
    else if (damageAmount > thresholds.medium.max) config = thresholds.heavy;
    else if (damageAmount > thresholds.light.max) config = thresholds.medium;

    // Critical hits get a noticeable boost
    if (isCrit) {
      config = {
        duration: Math.min(config.duration * 1.3, 500),
        intensity: config.intensity * 1.4
      };
    }

    // Smooth interpolation within threshold range for natural feel
    const range = config.max === Infinity ? 40 : (config.max - (config === thresholds.light ? 0 : this._prevThresholdMax(config)));
    const intensity = config.intensity;

    this._doShake(config.duration, intensity);
  }

  _prevThresholdMax(config) {
    const t = this.damageThresholds;
    if (config === t.medium) return t.light.max;
    if (config === t.heavy) return t.medium.max;
    return t.heavy.max;
  }

  /**
   * Custom shake with explicit duration and intensity.
   */
  custom(duration, intensity) {
    this.shake(null, { duration, intensity });
  }

  _doShake(duration, intensity) {
    const cam = this.scene.cameras.main;
    if (!cam) return;

    // Don't stack shakes — only apply if not currently shaking or new one is stronger
    if (this._shaking && intensity <= this._lastIntensity) return;

    cam.shake(duration, intensity);
    this._shaking = true;
    this._lastIntensity = intensity;

    // Natural decay: auto-reset flag when shake ends
    this.scene.time.delayedCall(duration + 50, () => {
      this._shaking = false;
      this._lastIntensity = 0;
    });
  }

  get isActive() {
    return this._shaking;
  }
}
