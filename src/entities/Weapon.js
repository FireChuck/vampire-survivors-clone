// Weapon.js — Vampire Survivors Clone
// Projectile entity supporting Projectile, Melee, AOE, and Aura types

class Weapon extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, weaponTypeKey, direction, stats) {
    super(scene, x, y, null);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const type = WEAPON_TYPES[weaponTypeKey] || WEAPON_TYPES.staff;
    this.weaponTypeKey = weaponTypeKey;
    this.color = type.color;
    this.damage = stats.damage || type.damage;
    this.piercing = stats.piercing !== undefined ? stats.piercing : type.piercing;
    this.range = stats.range || type.range;
    this.aoe = stats.aoe || type.aoe || false;
    this.aura = stats.aura || type.aura || false;
    this.melee = stats.melee || type.melee || false;
    this.cooldown = stats.cooldown || type.cooldown;

    // Projectile size
    this._projSize = type.projectileSize || 6;
    this.body.setCircle(Math.max(2, this._projSize), 0, 0);

    // Movement
    this._speed = stats.speed !== undefined ? stats.speed : type.speed;
    this._direction = direction;

    // Lifetime
    this._lifetime = 0;
    this._maxLifetime = this._speed > 0 ? (this.range / this._speed) * 1000 + 200 : 99999;

    // Melee lifetime: short swing
    if (this.melee) {
      this._maxLifetime = 300;
    }

    // Track hit enemies for piercing
    this._hitEnemies = new Set();
    this._hitsRemaining = this.piercing;

    // Origin for range check
    this._originX = x;
    this._originY = y;

    // Melee: spawn at distance, no velocity
    if (this.melee && this._direction) {
      this.setPosition(
        x + this._direction.x * this.range * 0.6,
        y + this._direction.y * this.range * 0.6
      );
      this._originX = this.x;
      this._originY = this.y;
    } else if (this._speed > 0 && this._direction) {
      this.body.setVelocity(
        this._direction.x * this._speed,
        this._direction.y * this._speed
      );
    }

    // Visual
    this._graphics = scene.add.graphics();
    this._drawVisual();
    this.setDepth(15);
  }

  _drawVisual() {
    this._graphics.clear();

    if (this.aura) {
      // Aura: pulsing ring
      this._graphics.lineStyle(2, this.color, 0.4);
      this._graphics.strokeCircle(0, 0, this.range);
      this._graphics.fillStyle(this.color, 0.1);
      this._graphics.fillCircle(0, 0, this.range);
    } else if (this.melee) {
      // Melee: line/arc
      if (this._direction) {
        const angle = Math.atan2(this._direction.y, this._direction.x);
        this._graphics.lineStyle(3, this.color, 0.8);
        this._graphics.beginPath();
        this._graphics.arc(0, 0, this.range * 0.6, angle - 0.6, angle + 0.6);
        this._graphics.strokePath();
        // Tip
        this._graphics.fillStyle(this.color, 0.6);
        this._graphics.fillCircle(
          Math.cos(angle) * this.range * 0.6,
          Math.sin(angle) * this.range * 0.6,
          4
        );
      }
    } else if (this.aoe) {
      // AOE projectile: larger with glow
      this._graphics.fillStyle(this.color, 0.9);
      this._graphics.fillCircle(0, 0, this._projSize);
      this._graphics.fillStyle(this.color, 0.3);
      this._graphics.fillCircle(0, 0, this._projSize + 5);
      // Inner bright core
      this._graphics.fillStyle(0xffffff, 0.6);
      this._graphics.fillCircle(0, 0, this._projSize * 0.4);
    } else {
      // Normal projectile
      this._graphics.fillStyle(this.color, 0.9);
      this._graphics.fillCircle(0, 0, this._projSize);
      // Glow
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
    const finalDamage = this.damage * (this.scene.player ? this.scene.player.stats.damageMultiplier : 1);
    enemy.takeDamage(finalDamage);

    // AOE: damage nearby enemies
    if (this.aoe) {
      this.scene.events.emit('weaponAOE', {
        x: this.x,
        y: this.y,
        range: this.range * 0.5,
        damage: finalDamage * 0.5,
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

    // Aura: don't despawn, follow player
    if (this.aura) {
      if (this.scene.player && this.scene.player.active) {
        this.setPosition(this.scene.player.x, this.scene.player.y);
        this._graphics.setPosition(this.x, this.y);
        // Pulse effect
        const pulse = Math.sin(time * 0.005) * 0.15 + 0.4;
        this._graphics.clear();
        this._graphics.lineStyle(2, this.color, pulse);
        this._graphics.strokeCircle(0, 0, this.range);
        this._graphics.fillStyle(this.color, pulse * 0.2);
        this._graphics.fillCircle(0, 0, this.range);
        this._graphics.setDepth(15);
      }
      return;
    }

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
    const player = this.scene.player;
    if (player && player.active) {
      const margin = 200;
      if (
        this.x < player.x - margin || this.x > player.x + margin ||
        this.y < player.y - margin || this.y > player.y + margin
      ) {
        this.destroy();
        return;
      }
    }

    // Update visual
    this._graphics.setPosition(this.x, this.y);
  }

  destroy() {
    if (this._graphics) this._graphics.destroy();
    super.destroy();
  }
}
