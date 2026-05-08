// ParticleSystem.js — Canvas-based particle effects via Phaser Graphics
// High performance: uses a single Graphics object per layer, no individual GameObjects

class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this._particles = [];
    this._graphics = scene.add.graphics();
    this._graphics.setDepth(25);
    this._pool = [];
    this._maxActive = 500; // Hard cap on active particles
    this._poolMax = 200;   // Pre-alloc pool size limit
    this._recycledTotal = 0;
    this._spawnsDenied = 0;

    // QoL T4: Particle Quality Setting (Low/Med/High)
    this._qualityLevel = 'high'; // default
    this._loadQualitySetting();
    // Auto-set low quality on mobile devices
    if (window.IS_MOBILE) {
      this._qualityLevel = 'low';
    }
    this._applyQualityLevel();
  }

  // ── QoL T4: Particle Quality ──

  _loadQualitySetting() {
    try {
      const saved = localStorage.getItem('vs_particle_quality');
      if (saved === 'low' || saved === 'medium' || saved === 'high') {
        this._qualityLevel = saved;
      }
    } catch (e) { /* ignore */ }
  }

  _applyQualityLevel() {
    switch (this._qualityLevel) {
      case 'low': this._maxActive = 150; break;
      case 'medium': this._maxActive = 300; break;
      case 'high': this._maxActive = 500; break;
    }
  }

  setQuality(level) {
    if (level !== 'low' && level !== 'medium' && level !== 'high') return;
    this._qualityLevel = level;
    this._applyQualityLevel();
    try {
      localStorage.setItem('vs_particle_quality', level);
    } catch (e) { /* ignore */ }
  }

  getQuality() {
    return this._qualityLevel;
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

  emitDeath(x, y, color, count, enemyType) {
    const n = count || 8;
    const c = color || 0xff4444;
    const type = enemyType || 'default';

    // Pick a random variant for this enemy type
    const variant = Math.floor(Math.random() * 3);

    switch (variant) {
      case 0: // Standard burst — radial scatter
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
        break;

      case 1: // Spiral burst — particles spiral outward
        for (let i = 0; i < n; i++) {
          const angle = (i / n) * Math.PI * 4 + Math.random() * 0.5;
          const speed = 50 + Math.random() * 80 + (i / n) * 40;
          this._add({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 250 + Math.random() * 250,
            maxLife: 500,
            size: 1.5 + Math.random() * 3,
            color: c,
            alpha: 1,
            shrink: true,
            gravity: 40
          });
        }
        break;

      case 2: // Scatter + rising wisps — fragments fall, wisps float up
        for (let i = 0; i < Math.ceil(n * 0.6); i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 60 + Math.random() * 100;
          this._add({
            x: x + (Math.random() - 0.5) * 10,
            y: y + (Math.random() - 0.5) * 10,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 20,
            life: 200 + Math.random() * 200,
            maxLife: 400,
            size: 2 + Math.random() * 3.5,
            color: c,
            alpha: 1,
            shrink: true,
            gravity: 120
          });
        }
        // Rising wisps (lighter, float upward)
        for (let i = 0; i < Math.ceil(n * 0.4); i++) {
          this._add({
            x: x + (Math.random() - 0.5) * 14,
            y: y,
            vx: (Math.random() - 0.5) * 30,
            vy: -40 - Math.random() * 50,
            life: 400 + Math.random() * 300,
            maxLife: 700,
            size: 1 + Math.random() * 2,
            color: this._lightenColor(c, 0.3),
            alpha: 0.8,
            shrink: true,
            gravity: -15
          });
        }
        break;
    }

    // Boss death: add a massive secondary explosion regardless of variant
    if (type === 'boss' || type === 'necromancer' || type === 'dragon' || type === 'giant' || type === 'tank') {
      this.emitBossDeath(x, y, c);
    }
  }

  emitBossDeath(x, y, color) {
    // Layer 1: Massive radial fire burst
    const fireCount = 30;
    for (let i = 0; i < fireCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 200;
      const colors = [0xff4400, 0xff6600, 0xffaa00, 0xff2200, 0xffcc00, color || 0xff4444];
      this._add({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 400 + Math.random() * 400,
        maxLife: 800,
        size: 3 + Math.random() * 5,
        color: colors[i % colors.length],
        alpha: 1,
        shrink: true,
        gravity: 60
      });
    }

    // Layer 2: Debris chunks — heavy, fast, dark
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 150 + Math.random() * 180;
      this._add({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        life: 500 + Math.random() * 300,
        maxLife: 800,
        size: 4 + Math.random() * 4,
        color: 0x444444,
        alpha: 0.9,
        shrink: true,
        gravity: 200
      });
    }

    // Layer 3: Shockwave ring (expanding smoke ring)
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      this._add({
        x: x + Math.cos(angle) * 30,
        y: y + Math.sin(angle) * 30,
        vx: Math.cos(angle) * 160,
        vy: Math.sin(angle) * 160,
        life: 300 + Math.random() * 200,
        maxLife: 500,
        size: 6 + Math.random() * 3,
        color: 0x888888,
        alpha: 0.4,
        shrink: false,
        grow: true,
        gravity: 0
      });
    }

    // Screen flash
    if (this.scene && this.scene.cameras && this.scene.cameras.main) {
      const sw = this.scene.scale.width;
      const sh = this.scene.scale.height;
      const flash = this.scene.add.rectangle(sw / 2, sh / 2, sw, sh, 0xffffff, 0)
        .setDepth(998).setScrollFactor(0);
      this.scene.tweens.add({
        targets: flash,
        alpha: 0.4,
        duration: 80,
        yoyo: true,
        hold: 30,
        onComplete: () => flash.destroy()
      });
    }
  }

  _lightenColor(color, amount) {
    const r = Math.min(255, ((color >> 16) & 0xff) + Math.floor(255 * amount));
    const g = Math.min(255, ((color >> 8) & 0xff) + Math.floor(255 * amount));
    const b = Math.min(255, (color & 0xff) + Math.floor(255 * amount));
    return (r << 16) | (g << 8) | b;
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
    // Enforce hard cap — skip spawn if at limit
    if (this._particles.length >= this._maxActive) {
      this._spawnsDenied++;
      return;
    }

    // Reuse from pool or create new
    let p;
    if (this._pool.length > 0) {
      p = this._pool.pop();
      this._recycledTotal++;
    } else {
      p = { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, size: 0, color: 0, alpha: 1, shrink: false, grow: false, gravity: 0 };
    }

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
        // Trim pool to prevent unbounded growth
        if (this._pool.length < this._poolMax) {
          this._pool.push(p);
        }
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
