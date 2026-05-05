// LightningChainProjectile.js — Vampire Survivors Clone
// Lightning Chain weapon: bouncing projectile that chains between 2-3 enemies
// Decreasing damage per bounce, lightning visual effect

class LightningChainProjectile extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, direction, stats) {
    super(scene, x, y, null);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this._speed = stats.speed || 500;
    this._damage = stats.damage || 18;
    this._maxBounces = stats.bounces || 3;
    this._bounceRange = stats.bounceRange || 200;
    this._damageFalloff = stats.damageFalloff || 0.7; // 30% less damage per bounce
    this._currentBounce = 0;
    this._weaponLevel = stats.level || 1;

    this._hitEnemies = new Set();
    this._lifetime = 0;
    this._maxLifetime = (stats.range || 600) / this._speed * 1000 + 500;

    this._direction = direction;
    this._originX = x;
    this._originY = y;

    this.body.setCircle(8, 0, 0);
    this.body.setVelocity(direction.x * this._speed, direction.y * this._speed);

    // Visual
    this._graphics = scene.add.graphics();
    this._trailGraphics = scene.add.graphics();
    this._chainGraphics = scene.add.graphics();
    this._trailTimer = 0;
    this._drawVisual();
    this.setDepth(15);
  }

  _drawVisual() {
    this._graphics.clear();

    // Core bolt
    const glowSize = 6 + this._weaponLevel;
    this._graphics.fillStyle(0xaaddff, 0.8);
    this._graphics.fillCircle(0, 0, glowSize);
    this._graphics.fillStyle(0xffffff, 1);
    this._graphics.fillCircle(0, 0, glowSize * 0.4);

    // Outer glow
    this._graphics.fillStyle(0x6699ff, 0.2);
    this._graphics.fillCircle(0, 0, glowSize * 2);

    this._graphics.setDepth(15);
  }

  update(time, delta) {
    if (!this.active) return;

    this._lifetime += delta;

    // Update trail
    this._trailTimer += delta;
    if (this._trailTimer > 30) {
      this._trailTimer = 0;
      this._trailGraphics.fillStyle(0x6699ff, 0.3);
      this._trailGraphics.fillCircle(this.x, this.y, 4);
    }

    // Fade trail
    if (this._trailGraphics.alpha > 0.1) {
      this._trailGraphics.setAlpha(this._trailGraphics.alpha - 0.02);
    }

    // Timeout
    if (this._lifetime > this._maxLifetime) {
      this._onExpire();
      return;
    }

    // Update visuals position
    this._graphics.setPosition(this.x, this.y);
  }

  // Called by collision system when hitting an enemy
  onHitEnemy(enemy) {
    if (this._hitEnemies.has(enemy)) return;
    this._hitEnemies.add(enemy);

    // Apply damage (decreasing per bounce)
    const bounceMultiplier = Math.pow(this._damageFalloff, this._currentBounce);
    const damage = Math.floor(this._damage * bounceMultiplier);
    enemy.takeDamage(damage);

    // Draw chain lightning to this enemy
    this._drawChainTo(this.x, this.y, enemy.x, enemy.y, damage);

    this._currentBounce++;

    if (this._currentBounce >= this._maxBounces) {
      this._onExpire();
      return;
    }

    // Find next target
    this._chainToNextTarget(enemy);
  }

  _chainToNextTarget(fromEnemy) {
    const scene = this.scene;
    const enemies = scene.enemies;
    let closestDist = this._bounceRange;
    let closestEnemy = null;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.active || this._hitEnemies.has(e)) continue;

      const dx = e.x - fromEnemy.x;
      const dy = e.y - fromEnemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < closestDist) {
        closestDist = dist;
        closestEnemy = e;
      }
    }

    if (closestEnemy) {
      // Redirect toward next target
      const dx = closestEnemy.x - this.x;
      const dy = closestEnemy.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0) {
        this.body.setVelocity((dx / dist) * this._speed * 1.2, (dy / dist) * this._speed * 1.2);
      }

      // Draw chain
      this._drawChainTo(fromEnemy.x, fromEnemy.y, closestEnemy.x, closestEnemy.y, 0);

      // Flash effect at bounce point
      this._spawnBounceFlash(fromEnemy.x, fromEnemy.y);
    } else {
      // No target found — expire
      this._onExpire();
    }
  }

  _drawChainTo(x1, y1, x2, y2, damage) {
    const scene = this.scene;
    const chain = scene.add.graphics();
    chain.setDepth(20);

    // Main chain line (jagged lightning)
    chain.lineStyle(2, 0xaaddff, 0.9);
    const segments = 6;
    let prevX = x1;
    let prevY = y1;

    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const nx = x1 + (x2 - x1) * t;
      const ny = y1 + (y2 - y1) * t;

      // Add jaggedness
      const jitter = 12;
      const jx = (i < segments) ? nx + (Math.random() - 0.5) * jitter : x2;
      const jy = (i < segments) ? ny + (Math.random() - 0.5) * jitter : y2;

      chain.lineBetween(prevX, prevY, jx, jy);
      prevX = jx;
      prevY = jy;
    }

    // Glow line (wider, fainter)
    chain.lineStyle(5, 0x4488ff, 0.2);
    chain.lineBetween(x1, y1, x2, y2);

    // Impact flash at target
    chain.fillStyle(0xffffff, 0.6);
    chain.fillCircle(x2, y2, 10);

    // Damage number at impact
    if (damage > 0) {
      scene.add.text(x2 + (Math.random() - 0.5) * 15, y2 - 15, Math.floor(damage).toString(), {
        fontSize: damage >= 20 ? '16px' : '12px',
        fontFamily: 'Arial, sans-serif',
        color: '#aaddff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5).setDepth(30);
    }

    // Fade out chain
    scene.tweens.add({
      targets: chain,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onComplete: () => chain.destroy()
    });
  }

  _spawnBounceFlash(x, y) {
    const scene = this.scene;
    const flash = scene.add.graphics();
    flash.fillStyle(0xaaddff, 0.6);
    flash.fillCircle(x, y, 15);
    flash.setDepth(20);

    scene.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 200,
      onComplete: () => flash.destroy()
    });
  }

  _onExpire() {
    // Final flash
    this._spawnBounceFlash(this.x, this.y);
    this.destroy();
  }

  destroy() {
    if (this._graphics) this._graphics.destroy();
    if (this._trailGraphics) this._trailGraphics.destroy();
    if (this._chainGraphics) this._chainGraphics.destroy();
    super.destroy();
  }
}
