// Player.js — Vampire Survivors Clone
// Player entity extending Phaser.Physics.Arcade.Sprite

class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, null);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setCircle(14, 0, 0);
    this.body.setCollideWorldBounds(true);

    // Core stats
    this.hp = 100;
    this.maxHp = 100;
    this.speed = 200;
    this.xp = 0;
    this.level = 1;
    this.pickupRange = 60;
    this.damage = 10;
    this.attackSpeed = 1.0;

    // Nested stats for UpgradeSystem compatibility
    this.stats = {
      speed: this.speed,
      maxHp: this.maxHp,
      damageMultiplier: 1,
      armor: 0,
      hpRegen: 0,
      xpMultiplier: 1,
      cooldownReduction: 0,
      timeSlow: 0,
      explosionOnKill: false,
      thorns: 0,
      lifeSteal: 0
    };

    // XP needed for next level
    this._getXpNeeded = () => Math.floor(10 * Math.pow(this.level, 1.5));

    // Weapons array (populated by WeaponSystem)
    this.weapons = [];

    // Reference to AbilitySystem (set by GameScene)
    this.abilitySystem = null;

    // Invincibility after taking damage
    this._invincible = false;
    this._invincibleTimer = null;
    this._invincibleDuration = 800;

    // Visual: blue circle via Graphics
    this._graphics = scene.add.graphics();
    this._drawVisual();
  }

  _drawVisual() {
    this._graphics.clear();
    // Body
    this._graphics.fillStyle(0x4488ff, 1);
    this._graphics.fillCircle(0, 0, 14);
    // Highlight
    this._graphics.fillStyle(0x88bbff, 1);
    this._graphics.fillCircle(-3, -3, 5);
    // Invincibility ring
    if (this._invincible) {
      this._graphics.lineStyle(2, 0xffffff, 0.7);
      this._graphics.strokeCircle(0, 0, 16);
    }
    this._graphics.setDepth(10);
  }

  move(x, y) {
    // Sync speed from stats
    this.speed = this.stats.speed;

    const len = Math.sqrt(x * x + y * y);
    if (len > 0) {
      this.setVelocity(x / len * this.speed, y / len * this.speed);
    } else {
      this.setVelocity(0, 0);
    }
  }

  takeDamage(amount) {
    if (this._invincible) return;

    // Apply armor
    const reduced = Math.max(1, amount - this.stats.armor);
    this.hp = Math.max(0, this.hp - reduced);

    // Flash effect
    this.setTintFill(0xff0000);
    this.scene.time.delayedCall(100, () => {
      if (this.active) this.clearTint();
    });

    // Screen shake
    if (this.scene.cameras && this.scene.cameras.main) {
      this.scene.cameras.main.shake(200, 0.01);
    }

    // Invincibility frames
    this._invincible = true;
    if (this._invincibleTimer) this._invincibleTimer.remove();
    this._invincibleTimer = this.scene.time.delayedCall(this._invincibleDuration, () => {
      this._invincible = false;
      if (this.active) this._drawVisual();
    });

    if (this.hp <= 0) {
      this.die();
    }

    return reduced;
  }

  die() {
    this.setTint(0xff0000);
    this.body.enable = false;

    // Death particles
    this._spawnDeathParticles();

    // Let GameScene handle the GameOver transition (proper cleanup)
    this.scene.time.delayedCall(500, () => {
      if (this.scene._triggerGameOver) {
        this.scene._triggerGameOver();
      }
    });
  }

  _spawnDeathParticles() {
    const particles = this.scene.add.graphics();
    const pList = [];
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 / 12) * i;
      pList.push({
        x: this.x, y: this.y,
        vx: Math.cos(angle) * (100 + Math.random() * 80),
        vy: Math.sin(angle) * (100 + Math.random() * 80),
        alpha: 1
      });
    }
    const elapsed = { t: 0 };
    const event = this.scene.time.addEvent({
      delay: 16, repeat: 30, callback: () => {
        elapsed.t += 16;
        particles.clear();
        for (const p of pList) {
          p.x += p.vx * 0.016;
          p.y += p.vy * 0.016;
          p.alpha -= 0.03;
          if (p.alpha > 0) {
            particles.fillStyle(0x4488ff, p.alpha);
            particles.fillCircle(p.x, p.y, 4);
          }
        }
      }
    });
    this.scene.time.delayedCall(600, () => { particles.destroy(); event.destroy(); });
  }

  heal(amount) {
    this.hp = Math.min(this.hp + amount, this.maxHp);
  }

  addXp(amount) {
    this.xp += Math.floor(amount * this.stats.xpMultiplier);
  }

  getStats() {
    return {
      hp: this.hp,
      maxHp: this.maxHp,
      speed: Math.round(this.speed),
      xp: this.xp,
      xpNeeded: this._getXpNeeded(),
      level: this.level,
      pickupRange: Math.round(this.pickupRange),
      damage: Math.round(this.damage),
      attackSpeed: parseFloat(this.attackSpeed.toFixed(2)),
      weaponCount: this.weapons.length
    };
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);

    // HP regen
    if (this.stats.hpRegen > 0 && this.hp < this.maxHp) {
      this.hp = Math.min(this.hp + this.stats.hpRegen * delta / 1000, this.maxHp);
    }

    // Update graphics position
    this._graphics.setPosition(this.x, this.y);

    // Invincibility blink
    if (this._invincible) {
      this._graphics.setVisible(Math.floor(time / 80) % 2 === 0);
    } else {
      this._graphics.setVisible(true);
    }
  }

  /** Activate ability by slot index — called from AbilitySystem or directly */
  activateAbility(slotIdx) {
    if (this.abilitySystem) {
      return this.abilitySystem.activateSlot(slotIdx);
    }
    return false;
  }

  destroy() {
    if (this._graphics) this._graphics.destroy();
    if (this._invincibleTimer) this._invincibleTimer.remove();
    if (this.abilitySystem) this.abilitySystem.destroy();
    super.destroy();
  }
}
