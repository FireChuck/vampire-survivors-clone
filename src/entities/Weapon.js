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

    // Boomerang flag
    this.boomerang = stats.boomerang || type.boomerang || false;

    // Boomerang state
    this._boomerangPhase = 'out'; // 'out', 'turning', 'return'
    this._boomerangTurnTimer = 0;
    this._boomerangTurnDelay = this.range / this._speed * 1000 * 0.6; // Turn at 60% of range
    this._returnSpeed = this._speed * 1.2;

    // Projectile size — boosted for visibility and scales with level
    const baseProjSize = type.projectileSize || 6;
    this._weaponLevel = stats.level || 1;
    this._projSize = baseProjSize + 3 + (this._weaponLevel - 1) * 1.5;
    this.body.setCircle(Math.max(2, this._projSize), 0, 0);

    // Movement
    this._speed = stats.speed !== undefined ? stats.speed : type.speed;
    this._direction = direction;

    // Trail system
    this._trail = [];
    this._trailTimer = 0;

    // Lifetime
    this._lifetime = 0;
    this._maxLifetime = this._speed > 0 ? (this.range / this._speed) * 1000 + 200 : 99999;

    // Boomerang needs longer lifetime for return trip
    if (this.boomerang) {
      this._maxLifetime = (this.range / this._speed) * 1000 * 2.5;
    }

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

    // Glow radius scales with weapon level
    const glowExtra = (this._weaponLevel - 1) * 3;
    const glowAlpha = Math.min(0.7, 0.3 + (this._weaponLevel - 1) * 0.1);

    if (this.aura) {
      // Aura: pulsing ring with level-scaled range
      this._graphics.lineStyle(2, this.color, 0.4);
      this._graphics.strokeCircle(0, 0, this.range);
      this._graphics.fillStyle(this.color, 0.1);
      this._graphics.fillCircle(0, 0, this.range);
      // Level 3+: inner ring
      if (this._weaponLevel >= 3) {
        this._graphics.lineStyle(1, this.color, 0.3);
        this._graphics.strokeCircle(0, 0, this.range * 0.5);
      }
    } else if (this.melee) {
      // Melee: line/arc with level-scaled width
      if (this._direction) {
        const angle = Math.atan2(this._direction.y, this._direction.x);
        const arcWidth = 2 + (this._weaponLevel - 1) * 0.5;
        this._graphics.lineStyle(arcWidth, this.color, 0.8);
        this._graphics.beginPath();
        this._graphics.arc(0, 0, this.range * 0.6, angle - 0.6, angle + 0.6);
        this._graphics.strokePath();
        // Tip with glow
        this._graphics.fillStyle(this.color, 0.6);
        this._graphics.fillCircle(
          Math.cos(angle) * this.range * 0.6,
          Math.sin(angle) * this.range * 0.6,
          4 + (this._weaponLevel - 1)
        );
        // Level 3+: outer glow on tip
        if (this._weaponLevel >= 3) {
          this._graphics.fillStyle(this.color, 0.2);
          this._graphics.fillCircle(
            Math.cos(angle) * this.range * 0.6,
            Math.sin(angle) * this.range * 0.6,
            8 + (this._weaponLevel - 1) * 2
          );
        }
      }
    } else if (this.boomerang) {
      // Boomerang: spinning orange arc
      this._graphics.lineStyle(3, this.color, 1);
      this._graphics.beginPath();
      this._graphics.arc(0, 0, this._projSize, -0.8, 1.2);
      this._graphics.strokePath();
      this._graphics.lineStyle(2, 0xffcc00, 0.7);
      this._graphics.beginPath();
      this._graphics.arc(0, 0, this._projSize * 0.6, -0.5, 0.9);
      this._graphics.strokePath();
    } else if (this.aoe) {
      // AOE projectile: larger with bright glow, scaled by level
      this._graphics.fillStyle(this.color, 1.0);
      this._graphics.fillCircle(0, 0, this._projSize);
      this._graphics.fillStyle(this.color, glowAlpha);
      this._graphics.fillCircle(0, 0, this._projSize + 8 + glowExtra);
      // Inner bright core
      this._graphics.fillStyle(0xffffff, 0.9);
      this._graphics.fillCircle(0, 0, this._projSize * 0.5);
      // Level 3+: outer ring
      if (this._weaponLevel >= 3) {
        this._graphics.lineStyle(1, 0xffffff, 0.3);
        this._graphics.strokeCircle(0, 0, this._projSize + 4 + glowExtra);
      }
    } else {
      // Normal projectile — bright core + outer glow (level-scaled)
      this._graphics.fillStyle(this.color, glowAlpha);
      this._graphics.fillCircle(0, 0, this._projSize + 5 + glowExtra);
      this._graphics.fillStyle(this.color, 1.0);
      this._graphics.fillCircle(0, 0, this._projSize);
      // Bright core
      this._graphics.fillStyle(0xffffff, 0.8);
      this._graphics.fillCircle(0, 0, this._projSize * 0.4);
      // Level 3+: second orbit ring
      if (this._weaponLevel >= 3) {
        this._graphics.lineStyle(1, 0xffffff, 0.25);
        this._graphics.strokeCircle(0, 0, this._projSize + 2 + glowExtra * 0.5);
      }
    }

    this._graphics.setPosition(this.x, this.y);
    this._graphics.setDepth(15);
  }

  onHitEnemy(enemy) {
    if (this._hitEnemies.has(enemy)) return false;

    this._hitEnemies.add(enemy);
    this._hitsRemaining--;

    // Apply damage (with critical hit check)
    const player = this.scene.player;
    const baseDamage = this.damage * (player ? player.stats.damageMultiplier : 1);
    const isCrit = player && Math.random() < (player.stats.critChance || 0);
    const finalDamage = isCrit ? baseDamage * 2 : baseDamage;
    enemy.takeDamage(finalDamage);

    // Life steal: heal player for % of damage dealt
    if (this.scene.player && this.scene.player.stats.lifeSteal > 0) {
      const healAmount = finalDamage * this.scene.player.stats.lifeSteal;
      this.scene.player.heal(healAmount);
    }

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

    // Boomerang behavior
    if (this.boomerang) {
      this._boomerangTurnTimer += delta;

      if (this._boomerangPhase === 'out' && this._boomerangTurnTimer >= this._boomerangTurnDelay) {
        this._boomerangPhase = 'return';
      }

      if (this._boomerangPhase === 'return') {
        // Fly back to player
        const player = this.scene.player;
        if (player && player.active) {
          const dx = player.x - this.x;
          const dy = player.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 30) {
            // Reached player — destroy
            this.destroy();
            return;
          }

          const returnSpeed = this._returnSpeed;
          this.body.setVelocity(dx / dist * returnSpeed, dy / dist * returnSpeed);
        }
      }
    }

    // Despawn conditions
    if (this._lifetime > this._maxLifetime) {
      this.destroy();
      return;
    }

    // Range check (skip for boomerangs in return phase)
    if (!this.boomerang || this._boomerangPhase === 'out') {
      const dx = this.x - this._originX;
      const dy = this.y - this._originY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > this.range + 50) {
        this.destroy();
        return;
      }
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
