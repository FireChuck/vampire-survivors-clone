// Weapon.js — Vampire Survivors Clone
// Projectile entity extending Phaser.Physics.Arcade.Sprite

class Weapon extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, weaponType, direction, stats) {
    super(scene, x, y, null);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const type = WEAPON_TYPES[weaponType] || WEAPON_TYPES.staff;
    this.weaponType = weaponType;
    this.color = type.color;
    this.damage = stats.damage || type.damage;
    this.piercing = stats.piercing || type.piercing;
    this.range = stats.range || type.range;
    this.aoe = stats.aoe || type.aoe || false;
    this.aura = stats.aura || type.aura || false;
    this.melee = stats.melee || type.melee || false;

    // Projectile size
    this._projSize = type.projectileSize || 6;
    this.body.setCircle(this._projSize, 0, 0);

    // Movement
    this._speed = stats.speed || type.speed;
    this._direction = direction; // { x, y } normalized

    // Lifetime tracking
    this._lifetime = 0;
    this._maxLifetime = this._speed > 0 ? (this.range / this._speed) * 1000 + 200 : 99999;

    // Track hit enemies for piercing
    this._hitEnemies = new Set();
    this._hitsRemaining = this.piercing;

    // Origin position for range check
    this._originX = x;
    this._originY = y;

    // Start movement
    if (this._speed > 0 && this._direction) {
      this.body.setVelocity(
        this._direction.x * this._speed,
        this._direction.y * this._speed
      );
    }

    // Visual: small colored circle
    this._graphics = scene.add.graphics();
    this._drawVisual();
    this.setDepth(15);
  }

  _drawVisual() {
    this._graphics.clear();
    if (this._projSize > 0) {
      this._graphics.fillStyle(this.color, 0.9);
      this._graphics.fillCircle(0, 0, this._projSize);
      // Glow effect
      this._graphics.fillStyle(this.color, 0.3);
      this._graphics.fillCircle(0, 0, this._projSize + 3);
    }
    this._graphics.setPosition(this.x, this.y);
    this._graphics.setDepth(15);
  }

  onHitEnemy(enemy) {
    if (this._hitEnemies.has(enemy)) return false;

    this._hitEnemies.add(enemy);
    this._hitsRemaining--;

    // Apply damage
    enemy.takeDamage(this.damage);

    // AOE: damage nearby enemies
    if (this.aoe) {
      this.scene.events.emit('weaponAOE', {
        x: this.x,
        y: this.y,
        range: this.range * 0.5,
        damage: this.damage * 0.5,
        exclude: enemy,
        source: this
      });
    }

    if (this._hitsRemaining <= 0) {
      this.destroy();
      return true;
    }
    return true;
  }

  update(time, delta) {
    this._lifetime += delta;

    // Despawn conditions
    if (this._lifetime > this._maxLifetime) {
      this.destroy();
      return;
    }

    // Range check
    const dx = this.x - this._originX;
    const dy = this.y - this._originY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > this.range + 50) {
      this.destroy();
      return;
    }

    // Off screen despawn
    const cam = this.scene.cameras.main;
    const margin = 100;
    if (
      this.x < cam.scrollX - margin ||
      this.x > cam.scrollX + cam.width + margin ||
      this.y < cam.scrollY - margin ||
      this.y > cam.scrollY + cam.height + margin
    ) {
      this.destroy();
      return;
    }

    // Update visual position
    this._graphics.setPosition(this.x, this.y);
  }

  destroy() {
    if (this._graphics) this._graphics.destroy();
    super.destroy();
  }
}
