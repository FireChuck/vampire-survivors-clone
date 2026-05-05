// ScreenEdgeIndicators.js — Vampire Survivors Clone
// Shows arrows at screen edges for off-screen bosses and important items

class ScreenEdgeIndicators {
  constructor(scene) {
    this.scene = scene;
    this.indicators = []; // { sprite, target, type }
    this._graphics = scene.add.graphics().setDepth(45).setScrollFactor(0);
    this._margin = 30;
    this._maxIndicators = 20;
  }

  addIndicator(target, type) {
    if (this.indicators.length >= this._maxIndicators) return;
    // Don't add duplicates
    if (this.indicators.find(ind => ind.target === target)) return;
    this.indicators.push({ target, type });
  }

  removeIndicator(target) {
    this.indicators = this.indicators.filter(ind => ind.target !== target);
  }

  update() {
    this._graphics.clear();
    if (!this.scene.player || !this.scene.player.active) {
      this.indicators = [];
      return;
    }

    const cam = this.scene.cameras.main;
    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;
    const scrollX = cam.scrollX;
    const scrollY = cam.scrollY;
    const zoom = cam.zoom;

    // Visible bounds in world coords
    const viewLeft = scrollX;
    const viewRight = scrollX + sw / zoom;
    const viewTop = scrollY;
    const viewBottom = scrollY + sh / zoom;

    // Padding: don't show indicators for targets just barely off-screen
    const pad = 50;

    for (let i = this.indicators.length - 1; i >= 0; i--) {
      const ind = this.indicators[i];
      const t = ind.target;

      // Remove if target no longer active
      if (!t || !t.active) {
        this.indicators.splice(i, 1);
        continue;
      }

      // Check if on-screen
      if (t.x >= viewLeft - pad && t.x <= viewRight + pad &&
          t.y >= viewTop - pad && t.y <= viewBottom + pad) {
        continue; // On-screen, don't draw indicator
      }

      // Calculate screen position of indicator (clamped to edge)
      const screenX = t.x - scrollX;
      const screenY = t.y - scrollY;
      const m = this._margin;

      const clampX = Math.max(m, Math.min(sw / zoom - m, screenX));
      const clampY = Math.max(m, Math.min(sh / zoom - m, screenY));

      // Determine which edge
      const atLeft = screenX <= m;
      const atRight = screenX >= sw / zoom - m;
      const atTop = screenY <= m;
      const atBottom = screenY >= sh / zoom - m;

      // Calculate arrow direction (from center of screen toward target)
      const centerX = sw / zoom / 2;
      const centerY = sh / zoom / 2;
      const angle = Math.atan2(screenY - centerY, screenX - centerX);

      // Choose color and size based on type
      let color, size, alpha;
      switch (ind.type) {
        case 'boss':
          color = 0xff2222;
          size = 10;
          alpha = 0.9;
          break;
        case 'item':
          color = 0x22ff44;
          size = 5;
          alpha = 0.6;
          break;
        case 'danger':
          color = 0xff8800;
          size = 8;
          alpha = 0.8;
          break;
        default:
          color = 0xffffff;
          size = 6;
          alpha = 0.5;
      }

      // Draw triangle arrow pointing toward target
      this._graphics.fillStyle(color, alpha);
      this._graphics.fillTriangle(
        clampX + Math.cos(angle) * size,
        clampY + Math.sin(angle) * size,
        clampX + Math.cos(angle + 2.5) * size * 0.6,
        clampY + Math.sin(angle + 2.5) * size * 0.6,
        clampX + Math.cos(angle - 2.5) * size * 0.6,
        clampY + Math.sin(angle - 2.5) * size * 0.6
      );

      // Distance label for bosses
      if (ind.type === 'boss' && this.scene.player) {
        const dx = t.x - this.scene.player.x;
        const dy = t.y - this.scene.player.y;
        const dist = Math.floor(Math.sqrt(dx * dx + dy * dy));
        this._graphics.fillStyle(0xff4444, 0.8);
        // Small distance text is expensive; use a simple dot pattern instead
      }
    }
  }

  destroy() {
    this.indicators = [];
    if (this._graphics) this._graphics.destroy();
  }
}
