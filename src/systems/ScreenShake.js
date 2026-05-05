// ScreenShake.js — Camera shake with intensity levels
// Usage: scene.screenShake.shake('playerHit') or scene.screenShake.shake('explosion')

class ScreenShake {
  constructor(scene) {
    this.scene = scene;
    this._shaking = false;

    // Intensity presets: { duration (ms), intensity (0-1) }
    this.presets = {
      playerHit:  { duration: 150, intensity: 0.004 },
      bossSpawn:  { duration: 300, intensity: 0.008 },
      explosion:  { duration: 400, intensity: 0.015 },
      levelUp:    { duration: 200, intensity: 0.005 },
      crit:       { duration: 100, intensity: 0.006 },
      bossDeath:  { duration: 600, intensity: 0.020 }
    };
  }

  /**
   * Trigger a camera shake by preset name or custom params.
   * @param {string} presetName - key from this.presets
   * @param {object} [override] - optional { duration, intensity }
   */
  shake(presetName, override) {
    const p = override || this.presets[presetName];
    if (!p) return;

    const cam = this.scene.cameras.main;
    if (!cam) return;

    cam.shake(p.duration, p.intensity);
    this._shaking = true;

    // Auto-reset flag when shake ends
    this.scene.time.delayedCall(p.duration + 50, () => {
      this._shaking = false;
    });
  }

  /**
   * Custom shake with explicit duration and intensity.
   */
  custom(duration, intensity) {
    this.shake(null, { duration, intensity });
  }

  get isActive() {
    return this._shaking;
  }
}
