// ParticleSystem.js — Canvas-based particle effects via Phaser Graphics
// High performance: uses a single Graphics object per layer, no individual GameObjects

class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this._particles = [];
    this._graphics = scene.add.graphics();
    this._graphics.setDepth(25);
    this._pool = [];
  }

  // ── Emit Methods ──

  emitHit(x, y, color) {
    const count = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 80;
      this._add({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 150 + Math.random() * 100,
        maxLife: 250,
        size: 2 + Math.random() * 2,
        color: color || 0xffffff,
        alpha: 1,
        shrink: true
      });
    }
  }

  emitDeath(x, y, color, count) {
    const n = count || 8;
    const c = color || 0xff4444;
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120;
      this._add({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        life: 300 + Math.random() * 300,
        maxLife: 600,
        size: 2 + Math.random() * 4,
        color: c,
        alpha: 1,
        shrink: true,
        gravity: 80
      });
    }
  }

  emitLevelUp(x, y) {
    // Radial gold sparkles — improved with expanding ring effect
    const count = 24;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 80 + Math.random() * 100;
      const colors = [0xffd700, 0xffaa00, 0xffff44, 0xffcc00, 0xffffff];
      this._add({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 600 + Math.random() * 300,
        maxLife: 900,
        size: 2 + Math.random() * 3,
        color: colors[i % colors.length],
        alpha: 1,
        shrink: true
      });
    }
    // Second inner ring (delayed burst)
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + 0.26;
      const speed = 50 + Math.random() * 40;
      this._add({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        life: 400 + Math.random() * 200,
        maxLife: 600,
        size: 1.5 + Math.random() * 2,
        color: 0xffffff,
        alpha: 0.9,
        shrink: true,
        gravity: -30
      });
    }
    // Rising sparkle column
    for (let i = 0; i < 8; i++) {
      this._add({
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 20,
        vy: -80 - Math.random() * 60,
        life: 500 + Math.random() * 400,
        maxLife: 900,
        size: 2 + Math.random() * 3,
        color: 0xffffff,
        alpha: 1,
        shrink: true,
        gravity: -20
      });
    }
  }

  emitXPPickup(x, y) {
    const count = 4;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 50;
      this._add({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        life: 200 + Math.random() * 100,
        maxLife: 300,
        size: 1.5 + Math.random() * 1.5,
        color: 0x88ff88,
        alpha: 0.9,
        shrink: true
      });
    }
  }

  emitExplosion(x, y, radius) {
    const r = radius || 40;
    const count = 12 + Math.floor(r / 10);
    // Fire particles
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 120;
      const colors = [0xff4400, 0xff6600, 0xffaa00, 0xff2200];
      this._add({
        x: x + (Math.random() - 0.5) * r * 0.5,
        y: y + (Math.random() - 0.5) * r * 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 200 + Math.random() * 300,
        maxLife: 500,
        size: 3 + Math.random() * 4,
        color: colors[i % colors.length],
        alpha: 1,
        shrink: true
      });
    }
    // Smoke
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 40;
      this._add({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        life: 400 + Math.random() * 300,
        maxLife: 700,
        size: 5 + Math.random() * 5,
        color: 0x555555,
        alpha: 0.5,
        shrink: false,
        grow: true
      });
    }

    // Screen-edge glow on big explosions (radius >= 50)
    if (r >= 50 && this.scene && this.scene.cameras && this.scene.cameras.main) {
      const sw = this.scene.scale.width;
      const sh = this.scene.scale.height;
      const glow = this.scene.add.rectangle(sw / 2, sh / 2, sw, sh, 0xff6600, 0)
        .setDepth(998).setScrollFactor(0);
      this.scene.tweens.add({
        targets: glow,
        alpha: 0.25,
        duration: 100,
        yoyo: true,
        hold: 50,
        onComplete: () => glow.destroy()
      });
    }
  }

  emitWeaponTrail(x, y, color) {
    const count = 2;
    for (let i = 0; i < count; i++) {
      this._add({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20,
        life: 100 + Math.random() * 80,
        maxLife: 180,
        size: 2 + Math.random() * 2,
        color: color || 0x88ccff,
        alpha: 0.7,
        shrink: true
      });
    }
  }

  // ── Internal ──

  _add(config) {
    // Reuse from pool or create new
    const p = this._pool.length > 0
      ? this._pool.pop()
      : { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, size: 0, color: 0, alpha: 1, shrink: false, grow: false, gravity: 0 };

    Object.assign(p, config);
    this._particles.push(p);
  }

  // ── Update (call in GameScene update loop) ──

  update(delta) {
    if (this._particles.length === 0) return;

    const g = this._graphics;
    g.clear();

    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.life -= delta;

      if (p.life <= 0) {
        this._particles.splice(i, 1);
        this._pool.push(p);
        continue;
      }

      // Physics
      const dt = delta / 1000;
      if (p.gravity) {
        p.vy += p.gravity * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Alpha fade
      const lifeRatio = p.life / p.maxLife;
      p.alpha = lifeRatio;

      // Size
      let size = p.size;
      if (p.shrink) {
        size = p.size * lifeRatio;
      } else if (p.grow) {
        size = p.size * (1 + (1 - lifeRatio) * 0.8);
      }
      size = Math.max(0.5, size);

      // Draw
      g.fillStyle(p.color, p.alpha);
      g.fillCircle(p.x, p.y, size);
    }
  }

  // ── Cleanup ──

  get activeCount() {
    return this._particles.length;
  }

  destroy() {
    this._particles.length = 0;
    this._pool.length = 0;
    if (this._graphics) {
      this._graphics.destroy();
      this._graphics = null;
    }
  }
}
