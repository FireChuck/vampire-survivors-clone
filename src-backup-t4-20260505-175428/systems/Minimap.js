// Minimap.js — Radar-style minimap overlay
// Fixed to screen, bottom-right corner, 150x150px
// Shows player (arrow), enemies (colored by type), XP orbs (green), world bounds
// Biome background tint, boss indicators, XP gem cluster indicators

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

    // Enemy type → minimap color mapping
    this._enemyColorMap = {
      bat: 0x8844aa,        // purple
      skeleton: 0xccccaa,   // bone white
      zombie: 0x44cc44,     // green
      slime: 0x44ff44,      // bright green
      spider: 0x9933cc,     // purple
      ghost: 0x6699cc,      // blue-ish
      demon: 0xff3333,      // red
      golem: 0x887766,      // brown
      teleporter: 0x8844ff  // violet
    };

    // Biome background colors
    this._biomeColors = {
      grassland: 0x1a331a,
      graveyard: 0x222222,
      dark_forest: 0x0f1a0f,
      default: 0x1a1a2a
    };

    // XP orb cluster tracking (avoid per-orb drawing when too many)
    this._xpClusters = [];
    this._xpClusterTimer = 0;
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
    const ww = GAME_CONFIG.worldWidth;
    const wh = GAME_CONFIG.worldHeight;
    const halfW = ww / 2;
    const halfH = wh / 2;

    // ── Biome background tint ──
    this._bg.clear();
    let bgColor = this._biomeColors.default;
    if (scene.biomeManager && scene.biomeManager.currentBiome) {
      bgColor = this._biomeColors[scene.biomeManager.currentBiome.name] || this._biomeColors.default;
    }
    this._bg.fillStyle(bgColor, 0.7);
    this._bg.fillRect(ox, oy, this.size, this.size);
    this._bg.lineStyle(1, 0x666666, 0.8);
    this._bg.strokeRect(ox, oy, this.size, this.size);

    // ── XP orb cluster indicators ──
    // Instead of drawing every orb, find clusters and draw small green dots
    this._xpClusterTimer++;
    if (this._xpClusterTimer % 9 === 0) {
      this._xpClusters = [];
      const orbs = scene.xpOrbs;
      if (orbs && orbs.length < 300) {
        for (let i = 0; i < orbs.length; i++) {
          const o = orbs[i];
          if (!o || !o.active) continue;
          this._xpClusters.push({
            x: ox + (o.x + halfW) * sx,
            y: oy + (o.y + halfH) * sy
          });
        }
      }
    }
    // Draw XP dots (batched — single fillStyle)
    if (this._xpClusters.length > 0 && this._xpClusters.length < 200) {
      g.fillStyle(0x44ff44, 0.6);
      for (let i = 0; i < this._xpClusters.length; i++) {
        const c = this._xpClusters[i];
        g.fillCircle(c.x, c.y, 1);
      }
    }

    // ── Enemies — colored by type ──
    const enemies = scene.enemies;
    // Batch by color for fewer state changes
    const colorBuckets = {};
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e || !e.active) continue;

      let color;
      let dotSize = 1.5;

      if (e.isBoss) {
        color = 0xffd700; // gold for bosses
        dotSize = 4;
      } else {
        color = this._enemyColorMap[e.enemyTypeKey] || 0xff3333;
        // Shooters/ranged types slightly larger
        if (e.enemyTypeKey === 'skeleton' || e.enemyTypeKey === 'spider') dotSize = 2;
      }

      const mx = ox + (e.x + halfW) * sx;
      const my = oy + (e.y + halfH) * sy;

      if (!colorBuckets[color]) colorBuckets[color] = [];
      colorBuckets[color].push({ x: mx, y: my, size: dotSize });
    }

    // Draw batched by color
    const colorKeys = Object.keys(colorBuckets);
    for (let c = 0; c < colorKeys.length; c++) {
      const color = colorKeys[c];
      const dots = colorBuckets[color];
      const isBossColor = color === 0xffd700;
      g.fillStyle(color, isBossColor ? 1 : 0.8);
      for (let d = 0; d < dots.length; d++) {
        g.fillCircle(dots[d].x, dots[d].y, dots[d].size);
      }
      // Boss pulsing glow
      if (isBossColor) {
        for (let d = 0; d < dots.length; d++) {
          g.lineStyle(1, 0xffd700, 0.4);
          g.strokeCircle(dots[d].x, dots[d].y, 6);
        }
      }
    }

    // ── Player arrow ──
    const p = scene.player;
    if (p) {
      const px = ox + (p.x + halfW) * sx;
      const py = oy + (p.y + halfH) * sy;

      // Direction arrow (based on velocity)
      let angle = 0;
      if (p.body) {
        const vx = p.body.velocity.x;
        const vy = p.body.velocity.y;
        if (vx !== 0 || vy !== 0) {
          angle = Math.atan2(vy, vx);
        }
      }

      // Arrow shape
      g.fillStyle(0x3399ff, 1);
      const arrowSize = 4;
      const tipX = px + Math.cos(angle) * arrowSize;
      const tipY = py + Math.sin(angle) * arrowSize;
      const leftX = px + Math.cos(angle + 2.5) * arrowSize * 0.7;
      const leftY = py + Math.sin(angle + 2.5) * arrowSize * 0.7;
      const rightX = px + Math.cos(angle - 2.5) * arrowSize * 0.7;
      const rightY = py + Math.sin(angle - 2.5) * arrowSize * 0.7;
      g.fillTriangle(tipX, tipY, leftX, leftY, rightX, rightY);

      // Player dot (center, always visible)
      g.fillStyle(0x66bbff, 1);
      g.fillCircle(px, py, 2.5);
    }

    // ── Camera viewport indicator ──
    const cam = scene.cameras.main;
    if (cam) {
      const camLeft = ox + (cam.scrollX + halfW) * sx;
      const camTop = oy + (cam.scrollY + halfH) * sy;
      const camW = cam.width * sx;
      const camH = cam.height * sy;
      g.lineStyle(1, 0xffffff, 0.25);
      g.strokeRect(camLeft, camTop, camW, camH);
    }
  }

  destroy() {
    if (this._gfx) this._gfx.destroy();
    if (this._bg) this._bg.destroy();
    this._gfx = null;
    this._bg = null;
  }
}
