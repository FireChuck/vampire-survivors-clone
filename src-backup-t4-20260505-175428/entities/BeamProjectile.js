// BeamProjectile.js — Vampire Survivors Clone
// Continuous laser beam weapon: fires toward mouse for 2s, then 1s cooldown
// Piercing by default — passes through all enemies in the beam path

class BeamProjectile extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, direction, stats) {
    super(scene, x, y, null);

    scene.add.existing(this);
    // Don't add to physics — beam uses overlap checks, not physics body
    // We still need it in the projectileGroup for collision detection

    const type = WEAPON_TYPES.beam;
    this.weaponTypeKey = 'beam';
    this.color = type.color;
    this.damage = (stats.damage || type.damage) * (scene.player ? scene.player.stats.damageMultiplier : 1);
    this.level = stats.level || 1;
    this.range = stats.range || type.range;
    this.piercing = 999; // Always piercing
    this._direction = direction;
    this._width = type.beamWidth || 4;
    this._hitEnemies = new Set();

    // Beam timing
    this._beamDuration = 2000; // 2 seconds active beam
    this._cooldownDuration = 1000; // 1 second cooldown
    this._phase = 'active'; // active, cooldown
    this._phaseTimer = 0;

    // Level scaling
    if (this.level >= 2) {
      this._width = 6;
      this.range = 500;
    }
    if (this.level >= 3) {
      this._width = 8;
      this.range = 600;
      this._slowEffect = true; // Slow enemies hit by beam
    }

    // Visual — beam line + glow
    this._graphics = scene.add.graphics();
    this._drawBeam();
    this.setDepth(15);

    // Damage tick timer — deal DPS
    this._dpsTimer = 0;
    this._dpsInterval = 100; // Tick every 100ms = 10 ticks/sec
    this._dpsPerTick = this.damage * (this._dpsInterval / 1000); // 8 * 0.1 = 0.8 per tick at level 1

    // Collision: manually check via spatialGrid each tick
    this.body.setSize(this._width, this.range);
    this.body.setOffset(-this._width / 2, 0);
  }

  _drawBeam() {
    this._graphics.clear();

    if (this._phase === 'cooldown') {
      // Flickering/fading beam during cooldown
      this._graphics.setAlpha(0.1);
      this._graphics.setPosition(this.x, this.y);
      return;
    }

    const angle = Math.atan2(this._direction.y, this._direction.x);
    const endX = Math.cos(angle) * this.range;
    const endY = Math.sin(angle) * this.range;

    // Outer glow
    this._graphics.lineStyle(this._width + 6, this.color, 0.2);
    this._graphics.beginPath();
    this._graphics.moveTo(0, 0);
    this._graphics.lineTo(endX, endY);
    this._graphics.strokePath();

    // Core beam
    this._graphics.lineStyle(this._width, this.color, 0.9);
    this._graphics.beginPath();
    this._graphics.moveTo(0, 0);
    this._graphics.lineTo(endX, endY);
    this._graphics.strokePath();

    // Bright center
    this._graphics.lineStyle(Math.max(1, this._width * 0.4), 0xffffff, 0.7);
    this._graphics.beginPath();
    this._graphics.moveTo(0, 0);
    this._graphics.lineTo(endX, endY);
    this._graphics.strokePath();

    // Beam tip glow
    this._graphics.fillStyle(this.color, 0.5);
    this._graphics.fillCircle(endX, endY, this._width + 3);

    // Slight flicker effect
    const flicker = 0.8 + Math.sin(Date.now() * 0.02) * 0.2;
    this._graphics.setAlpha(flicker);

    this._graphics.setPosition(this.x, this.y);
    this._graphics.setDepth(15);
  }

  update(time, delta) {
    this._phaseTimer += delta;

    if (this._phase === 'active') {
      // Update beam direction to follow mouse
      if (this.scene.inputManager) {
        const pointer = this.scene.inputManager.getPointer();
        if (pointer) {
          const dx = pointer.worldX - this.x;
          const dy = pointer.worldY - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 1) {
            this._direction = { x: dx / dist, y: dy / dist };
          }
        }
      }

      // Position beam at player
      if (this.scene.player && this.scene.player.active) {
        this.setPosition(this.scene.player.x, this.scene.player.y);
      }

      // DPS damage ticks
      this._dpsTimer += delta;
      if (this._dpsTimer >= this._dpsInterval) {
        this._dpsTimer = 0;
        this._applyDPSToEnemiesInBeam();
      }

      // Check beam duration
      if (this._phaseTimer >= this._beamDuration) {
        this._phase = 'cooldown';
        this._phaseTimer = 0;
      }

      this._drawBeam();
    } else if (this._phase === 'cooldown') {
      if (this._phaseTimer >= this._cooldownDuration) {
        // Reset for next firing cycle
        this._phase = 'active';
        this._phaseTimer = 0;
        this._hitEnemies.clear();
      }
      this._drawBeam();
    }
  }

  _applyDPSToEnemiesInBeam() {
    if (!this.scene.spatialGrid) return;

    const angle = Math.atan2(this._direction.y, this._direction.x);
    const endX = this.x + Math.cos(angle) * this.range;
    const endY = this.y + Math.sin(angle) * this.range;

    // Check all enemies within beam range
    const nearby = this.scene.spatialGrid.query(this.x, this.y, this.range + 50);
    const halfWidth = (this._width / 2) + 5; // Small tolerance

    for (const enemy of nearby) {
      if (!enemy || !enemy.active) continue;
      if (this._hitEnemies.has(enemy)) continue;

      // Point-to-line distance check
      if (this._pointToLineDistance(enemy.x, enemy.y, this.x, this.y, endX, endY) < halfWidth) {
        this._hitEnemies.add(enemy);
        enemy.takeDamage(this._dpsPerTick);

        // Life steal
        if (this.scene.player && this.scene.player.stats.lifeSteal > 0) {
          this.scene.player.heal(this._dpsPerTick * this.scene.player.stats.lifeSteal);

          // Vampire Touch: red particle on beam tick
          if (this.scene.player.stats.vampireTouchActive && this.scene.particleSystem) {
            this.scene.particleSystem.emitHit(enemy.x, enemy.y, 0xff2222);
          }
        }

        // Level 3: slow effect
        if (this._slowEffect && enemy._speedMultiplier === undefined) {
          enemy._speedMultiplier = 0.5;
          this.scene.time.delayedCall(500, () => {
            if (enemy.active) enemy._speedMultiplier = 1;
          });
        }
      }
    }
  }

  _pointToLineDistance(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = lenSq !== 0 ? dot / lenSq : -1;

    param = Math.max(0, Math.min(1, param));

    const xx = x1 + param * C;
    const yy = y1 + param * D;

    return Math.sqrt((px - xx) * (px - xx) + (py - yy) * (py - yy));
  }

  onHitEnemy(enemy) {
    // Beam handles its own damage via DPS ticks
    // This is for external collision system compatibility
    return false;
  }

  get isActive() {
    return this._phase === 'active';
  }

  get isCooldown() {
    return this._phase === 'cooldown';
  }

  destroy() {
    if (this._graphics) this._graphics.destroy();
    super.destroy();
  }
}
