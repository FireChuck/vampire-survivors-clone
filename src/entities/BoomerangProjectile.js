// BoomerangProjectile.js — Vampire Survivors Clone
// Dedicated boomerang projectile: flies to mouse position, returns to player
// Piercing on both outbound and return trip, spinning visual

class BoomerangProjectile extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, direction, stats) {
    super(scene, x, y, null);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const type = WEAPON_TYPES.boomerang_dedicated;
    this.weaponTypeKey = 'boomerang_dedicated';
    this.color = type.color;
    this.damage = (stats.damage || type.damage) * (scene.player ? scene.player.stats.damageMultiplier : 1);
    this.level = stats.level || 1;
    this.range = stats.range || type.range;
    this.piercing = 999; // Piercing both ways
    this._speed = type.speed;
    this._direction = direction;
    this._hitEnemies = new Set();

    // Boomerang state
    this._phase = 'out'; // out, return
    this._targetX = x + direction.x * this.range;
    this._targetY = y + direction.y * this.range;
    this._originX = x;
    this._originY = y;
    this._maxDist = 0;
    this._spinAngle = 0;

    // Level scaling
    if (this.level >= 2) {
      this._spreadCount = 2;
      this._spreadAngle = 0.26; // ~15 degrees
    }
    if (this.level >= 3) {
      this._spreadCount = 3;
      this._spreadAngle = 0.26;
      this._projSize = 10; // Larger
    } else {
      this._spreadCount = 1;
      this._projSize = 8;
    }

    // Physics body
    this.body.setCircle(this._projSize, 0, 0);
    this.body.setVelocity(this._direction.x * this._speed, this._direction.y * this._speed);

    // Visual
    this._graphics = scene.add.graphics();
    this._drawVisual();
    this.setDepth(15);
  }

  _drawVisual() {
    this._graphics.clear();

    const size = this._projSize;

    // Spinning square boomerang
    this._graphics.save();
    this._graphics.rotateCanvas(0, 0, this._spinAngle);

    // Main body
    this._graphics.fillStyle(this.color, 0.9);
    this._graphics.fillRect(-size, -size / 3, size * 2, size * 0.66);

    // Curved arms (two arcs)
    this._graphics.lineStyle(2, 0xffcc00, 0.8);
    this._graphics.beginPath();
    this._graphics.arc(size * 0.5, 0, size * 0.7, -1.2, 1.2);
    this._graphics.strokePath();
    this._graphics.beginPath();
    this._graphics.arc(-size * 0.5, 0, size * 0.7, Math.PI - 1.2, Math.PI + 1.2);
    this._graphics.strokePath();

    // Center dot
    this._graphics.fillStyle(0xffffff, 0.8);
    this._graphics.fillCircle(0, 0, 2);

    this._graphics.restore();
    this._graphics.setPosition(this.x, this.y);
    this._graphics.setDepth(15);
  }

  update(time, delta) {
    this._spinAngle += delta * 0.01; // Spin speed

    if (this._phase === 'out') {
      // Track distance traveled
      const dx = this.x - this._originX;
      const dy = this.y - this._originY;
      this._maxDist = Math.sqrt(dx * dx + dy * dy);

      if (this._maxDist >= this.range) {
        this._phase = 'return';
        // Reset hit tracking for return trip
        this._hitEnemies.clear();
      }
    }

    if (this._phase === 'return') {
      // Fly back to player
      const player = this.scene.player;
      if (player && player.active) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 25) {
          this.destroy();
          return;
        }

        // Accelerate slightly on return
        const returnSpeed = this._speed * 1.2;
        this.body.setVelocity(dx / dist * returnSpeed, dy / dist * returnSpeed);
      }
    }

    // Off screen despawn
    const player = this.scene.player;
    if (player && player.active) {
      const margin = 400; // Wider margin for return trip
      if (
        this.x < player.x - margin || this.x > player.x + margin ||
        this.y < player.y - margin || this.y > player.y + margin
      ) {
        this.destroy();
        return;
      }
    }

    this._drawVisual();
  }

  onHitEnemy(enemy) {
    if (this._hitEnemies.has(enemy)) return false;

    this._hitEnemies.add(enemy);
    enemy.takeDamage(this.damage);

    // Life steal
    if (this.scene.player && this.scene.player.stats.lifeSteal > 0) {
      this.scene.player.heal(this.damage * this.scene.player.stats.lifeSteal);
    }

    return true; // Don't destroy — piercing
  }

  destroy() {
    if (this._graphics) this._graphics.destroy();
    super.destroy();
  }
}
