// VignetteSystem.js — Red vignette overlay when HP < 30%
// Smooth fade based on HP ratio, pulse effect when low

class VignetteSystem {
  constructor(scene) {
    this.scene = scene;
    this._graphics = scene.add.graphics();
    this._graphics.setScrollFactor(0).setDepth(49);
    this._alpha = 0;
    this._targetAlpha = 0;
    this._pulseTimer = 0;
    this._warningThreshold = 0.30; // 30% HP
  }

  update(delta) {
    const player = this.scene.player;
    if (!player || !player.active) return;

    const hpRatio = player.hp / player.maxHp;

    if (hpRatio < this._warningThreshold) {
      // Intensity increases as HP drops (0.15 at 29%, 0.5 at 1%)
      const urgency = 1 - (hpRatio / this._warningThreshold);
      this._targetAlpha = 0.15 + urgency * 0.35;

      // Pulse effect when very low HP (< 15%)
      if (hpRatio < 0.15) {
        this._pulseTimer += delta;
        const pulseSpeed = 0.003 + (1 - hpRatio / 0.15) * 0.003;
        const pulse = Math.sin(this._pulseTimer * pulseSpeed) * 0.5 + 0.5;
        this._targetAlpha += pulse * 0.15;
      }
    } else {
      this._targetAlpha = 0;
    }

    // Smooth interpolation
    const lerpSpeed = 0.003;
    this._alpha += (this._targetAlpha - this._alpha) * Math.min(1, delta * lerpSpeed);

    // Draw if visible
    this._graphics.clear();
    if (this._alpha < 0.005) return;

    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;

    // Radial vignette: draw dark red border, transparent center
    // Using layered rectangles from outside in
    const layers = 8;
    for (let i = 0; i < layers; i++) {
      const t = i / layers;
      const inset = t * Math.min(sw, sh) * 0.35;
      const alpha = this._alpha * (1 - t) * (1 - t);

      this._graphics.fillStyle(0xff0000, alpha);
      this._graphics.fillRect(inset, inset, sw - inset * 2, sh - inset * 2);
    }
  }

  destroy() {
    if (this._graphics) {
      this._graphics.destroy();
      this._graphics = null;
    }
  }
}
