// Enemy.js — Vampire Survivors Clone
// Enemy entity extending Phaser.Physics.Arcade.Sprite

class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, enemyType) {
    super(scene, x, y, null);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const type = ENEMY_TYPES[enemyType] || ENEMY_TYPES.bat;
    this.enemyType = enemyType;
    this.hp = type.hp;
    this.maxHp = type.hp;
    this.speed = type.speed;
    this.damage = type.damage;
    this.xpValue = type.xpValue;
    this.color = type.color;
    this.size = type.size;

    // Collision body
    const hw = Math.floor(this.size[0] / 2);
    const hh = Math.floor(this.size[1] / 2);
    this.body.setSize(this.size[0], this.size[1]);
    this.body.setOffset(-hw, -hh);

    // Damage cooldown to prevent hitting player every frame
    this._damageCooldown = false;
    this._damageCooldownTime = 800; // ms

    // Visual: colored rectangle
    this._graphics = scene.add.graphics();
    this._drawVisual();

    this.setDepth(5);
  }

  _drawVisual() {
    this._graphics.clear();
    const hw = this.size[0] / 2;
    const hh = this.size[1] / 2;
    this._graphics.fillStyle(this.color, 1);
    this._graphics.fillRect(this.x - hw, this.y - hh, this.size[0], this.size[1]);

    // Darker outline
    this._graphics.lineStyle(1, 0x000000, 0.5);
    this._graphics.strokeRect(this.x - hw, this.y - hh, this.size[0], this.size[1]);
    this._graphics.setDepth(5);
  }

  update(player) {
    if (!player || !player.active) return;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 1) {
      this.setVelocity(dx / dist * this.speed, dy / dist * this.speed);
    }

    // Update graphics
    this._graphics.setPosition(this.x, this.y);
  }

  takeDamage(amount) {
    this.hp -= amount;

    // Flash white on hit
    this._graphics.clear();
    const hw = this.size[0] / 2;
    const hh = this.size[1] / 2;
    this._graphics.fillStyle(0xffffff, 1);
    this._graphics.fillRect(-hw, -hh, this.size[0], this.size[1]);
    this._graphics.setPosition(this.x, this.y);

    this.scene.time.delayedCall(80, () => {
      if (this.active) this._drawVisual();
    });

    if (this.hp <= 0) {
      this.onDeath();
    }
  }

  onDeath() {
    // Emit event with position so GameScene can spawn XP orb
    this.scene.events.emit('enemyKilled', {
      x: this.x,
      y: this.y,
      xpValue: this.xpValue,
      enemyType: this.enemyType
    });

    // Kill count
    if (this.scene.killCount !== undefined) {
      this.scene.killCount++;
    }

    this.destroy();
  }

  canDamagePlayer() {
    return !this._damageCooldown;
  }

  startDamageCooldown() {
    this._damageCooldown = true;
    this.scene.time.delayedCall(this._damageCooldownTime, () => {
      this._damageCooldown = false;
    });
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);

    // Despawn if way off screen
    if (this.active) {
      const margin = 200;
      const cam = this.scene.cameras.main;
      if (
        this.x < cam.scrollX - margin ||
        this.x > cam.scrollX + cam.width + margin ||
        this.y < cam.scrollY - margin ||
        this.y > cam.scrollY + cam.height + margin
      ) {
        // Only destroy if far from player too
        const player = this.scene.player;
        if (player && !player.active) {
          this.destroy();
        }
      }
    }
  }

  destroy() {
    if (this._graphics) this._graphics.destroy();
    super.destroy();
  }
}
