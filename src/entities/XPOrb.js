// XPOrb.js — Vampire Survivors Clone
// XP collectible entity extending Phaser.Physics.Arcade.Sprite

class XPOrb extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, value) {
    super(scene, x, y, null);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.value = value || 5;
    this.speed = 120;
    this._attracted = false;
    this._attractSpeed = 350;

    // Size based on value
    this._radius = this.value >= 20 ? 8 : this.value >= 10 ? 6 : 4;

    this.body.setCircle(this._radius, 0, 0);
    this.body.setImmovable(true);

    // Visual: green circle with glow
    this._graphics = scene.add.graphics();
    this._drawVisual();
    this.setDepth(3);

    // Slight bobbing animation
    this._bobOffset = Math.random() * Math.PI * 2;
  }

  _drawVisual() {
    this._graphics.clear();
    // Outer glow
    this._graphics.fillStyle(0x22ff22, 0.2);
    this._graphics.fillCircle(0, 0, this._radius + 4);
    // Main orb
    this._graphics.fillStyle(0x44ee44, 1);
    this._graphics.fillCircle(0, 0, this._radius);
    // Highlight
    this._graphics.fillStyle(0x88ff88, 0.8);
    this._graphics.fillCircle(-this._radius * 0.3, -this._radius * 0.3, this._radius * 0.4);
    this._graphics.setPosition(this.x, this.y);
    this._graphics.setDepth(3);
  }

  attractTo(player) {
    if (!player || !player.active) return;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= player.pickupRange) {
      // Magnetic attraction
      this._attracted = true;
      const speed = this._attractSpeed;
      this.setVelocity(dx / dist * speed, dy / dist * speed);
    } else if (dist <= player.pickupRange * 2) {
      // Gentle pull
      const speed = this.speed * 0.5;
      this.setVelocity(dx / dist * speed, dy / dist * speed);
    } else {
      // Slow drift toward player
      const speed = this.speed * 0.15;
      this.setVelocity(dx / dist * speed, dy / dist * speed);
    }
  }

  collect(player) {
    player.addXp(this.value);
    this.collectEffect();
    this.destroy();
  }

  collectEffect() {
    // Simple scale-up fade effect
    if (this._graphics) {
      this._graphics.clear();
      this._graphics.fillStyle(0x88ff88, 0.5);
      this._graphics.fillCircle(0, 0, this._radius + 6);
      this._graphics.setPosition(this.x, this.y);
      this.scene.time.delayedCall(100, () => {
        if (this._graphics) this._graphics.destroy();
      });
    }
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);

    // Update graphics position with bobbing
    if (this.active && this._graphics) {
      const bob = Math.sin(time * 0.003 + this._bobOffset) * 2;
      this._graphics.setPosition(this.x, this.y + bob);
    }
  }

  destroy() {
    if (this._graphics) this._graphics.destroy();
    super.destroy();
  }
}
