// Minimap.js — Radar-style minimap overlay
// Fixed to screen, bottom-right corner, 150x150px
// Shows player (blue), enemies (red), XP orbs (green), world bounds

class Minimap {
  constructor(scene) {
    this.scene = scene;
    this.size = 150;
    this.padding = 12;
    this.frameSkip = 3; // update every 3rd frame
    this._frameCount = 0;

    const ww = GAME_CONFIG.worldWidth;
    const wh = GAME_CONFIG.worldHeight;

    // Background panel
    this._bg = scene.add.graphics();
    this._bg.setScrollFactor(0);
    this._bg.setDepth(1000);

    // Minimap content
    this._gfx = scene.add.graphics();
    this._gfx.setScrollFactor(0);
    this._gfx.setDepth(1001);

    // Position: bottom-right
    this._x = scene.cameras.main.width - this.size - this.padding;
    this._y = scene.cameras.main.height - this.size - this.padding;

    // Scale factors
    this._scaleX = this.size / ww;
    this._scaleY = this.size / wh;
  }

  update() {
    this._frameCount++;
    if (this._frameCount % this.frameSkip !== 0) return;

    const g = this._gfx;
    g.clear();

    const ox = this._x;
    const oy = this._y;
    const sx = this._scaleX;
    const sy = this._scaleY;
    const scene = this.scene;

    // Background
    this._bg.clear();
    this._bg.fillStyle(0x000000, 0.6);
    this._bg.fillRect(ox - 2, oy - 2, this.size + 4, this.size + 4);
    this._bg.lineStyle(1, 0x888888, 0.8);
    this._bg.strokeRect(ox - 2, oy - 2, this.size + 4, this.size + 4);

    // XP orbs (green dots, small)
    const orbs = scene.xpOrbs;
    if (orbs && orbs.length < 200) { // skip if too many for perf
      g.fillStyle(0x00ff00, 0.7);
      for (let i = 0; i < orbs.length; i++) {
        const o = orbs[i];
        if (!o || !o.active) continue;
        g.fillCircle(ox + (o.x + GAME_CONFIG.worldWidth / 2) * sx, oy + (o.y + GAME_CONFIG.worldHeight / 2) * sy, 1);
      }
    }

    // Enemies (red dots)
    const enemies = scene.enemies;
    g.fillStyle(0xff3333, 0.8);
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e || !e.active) continue;
      g.fillCircle(ox + (e.x + GAME_CONFIG.worldWidth / 2) * sx, oy + (e.y + GAME_CONFIG.worldHeight / 2) * sy, 1.5);
    }

    // Player (blue dot, larger)
    const p = scene.player;
    if (p) {
      g.fillStyle(0x3399ff, 1);
      g.fillCircle(ox + (p.x + GAME_CONFIG.worldWidth / 2) * sx, oy + (p.y + GAME_CONFIG.worldHeight / 2) * sy, 3);
    }
  }

  destroy() {
    if (this._gfx) this._gfx.destroy();
    if (this._bg) this._bg.destroy();
    this._gfx = null;
    this._bg = null;
  }
}
