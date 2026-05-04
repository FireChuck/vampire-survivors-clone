// Player.js — Vampire Survivors Clone
// Player entity extending Phaser.Physics.Arcade.Sprite

class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, null);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setCircle(14, 0, 0);
    this.body.setCollideWorldBounds(true);

    // Stats
    this.hp = 100;
    this.maxHp = 100;
    this.speed = 200;
    this.xp = 0;
    this.level = 1;
    this.pickupRange = 50;
    this.damage = 10;
    this.attackSpeed = 1.0;

    // XP needed for next level: 10 * level^1.5
    this._getXpNeeded = () => Math.floor(10 * Math.pow(this.level, 1.5));

    // Weapons array (populated by GameScene)
    this.weapons = [];

    // Invincibility after taking damage
    this._invincible = false;
    this._invincibleTimer = null;

    // Visual: blue circle via Graphics
    this._graphics = scene.add.graphics();
    this._drawVisual();
  }

  _drawVisual() {
    this._graphics.clear();
    this._graphics.fillStyle(0x4488ff, 1);
    this._graphics.fillCircle(this.x, this.y, 14);
    this._graphics.fillStyle(0x88bbff, 1);
    this._graphics.fillCircle(this.x - 3, this.y - 3, 5);
    this._graphics.setDepth(10);
  }

  move(x, y) {
    // Normalize diagonal movement
    const len = Math.sqrt(x * x + y * y);
    if (len > 0) {
      this.setVelocity(x / len * this.speed, y / len * this.speed);
    } else {
      this.setVelocity(0, 0);
    }
  }

  takeDamage(amount) {
    if (this._invincible) return;

    this.hp = Math.max(0, this.hp - amount);

    // Flash effect
    this.setTintFill(0xff0000);
    this.scene.time.delayedCall(100, () => {
      if (this.active) this.clearTint();
    });

    // Invincibility frames (500ms)
    this._invincible = true;
    if (this._invincibleTimer) this._invincibleTimer.remove();
    this._invincibleTimer = this.scene.time.delayedCall(500, () => {
      this._invincible = false;
    });

    if (this.hp <= 0) {
      this.die();
    }
  }

  die() {
    this.setTint(0xff0000);
    this.body.enable = false;
    this.scene.time.delayedCall(500, () => {
      this.scene.scene.start('GameOverScene', {
        time: this.scene.hud ? this.scene.hud.elapsedTime : 0,
        level: this.level,
        kills: this.scene.killCount || 0
      });
    });
  }

  heal(amount) {
    this.hp = Math.min(this.hp + amount, this.maxHp);
  }

  addXp(amount) {
    this.xp += amount;
    const needed = this._getXpNeeded();
    if (this.xp >= needed) {
      this.xp -= needed;
      this.levelUp();
    }
  }

  levelUp() {
    this.level++;
    // Heal 20% of maxHp on level up
    this.hp = Math.min(this.hp + Math.floor(this.maxHp * 0.2), this.maxHp);
    // Emit event for GameScene to handle upgrade selection
    this.scene.events.emit('playerLevelUp', this);
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
    // Update graphics position
    this._graphics.setPosition(this.x, this.y);
  }

  destroy() {
    if (this._graphics) this._graphics.destroy();
    if (this._invincibleTimer) this._invincibleTimer.remove();
    super.destroy();
  }
}
