// SpeedBuffPickup.js — Vampire Survivors Clone
// "Swift Boots" pickup: grants +30% movement speed for 10 seconds
// Spawns periodically (every 30s) near the player

class SpeedBuffPickup extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, null);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setCircle(10, 0, 0);
    this.body.setImmovable(true);

    // Buff parameters
    this.speedBoostPercent = 30;  // +30% movement speed
    this.buffDuration = 10000;    // 10 seconds

    // Visual: golden-yellow boot icon with glow
    this._graphics = scene.add.graphics();
    this._radius = 10;
    this._drawVisual();
    this.setDepth(3);

    // Bobbing animation
    this._bobOffset = Math.random() * Math.PI * 2;

    // Despawn after 15 seconds if not collected
    scene.time.delayedCall(15000, () => {
      if (this.active) this._despawn();
    });
  }

  _drawVisual() {
    this._graphics.clear();
    // Outer glow (golden)
    this._graphics.fillStyle(0xffcc00, 0.25);
    this._graphics.fillCircle(0, 0, this._radius + 6);
    // Main circle (gold)
    this._graphics.fillStyle(0xffaa00, 1);
    this._graphics.fillCircle(0, 0, this._radius);
    // Boot icon (simple arrow-up shape suggesting speed)
    this._graphics.fillStyle(0xffffff, 0.9);
    this._graphics.fillTriangle(-4, 4, 4, 4, 0, -6);
    // Highlight
    this._graphics.fillStyle(0xffee88, 0.7);
    this._graphics.fillCircle(-3, -3, 3);
    this._graphics.setPosition(this.x, this.y);
    this._graphics.setDepth(3);
  }

  collect(player) {
    if (!player || !player.active) return;

    const originalSpeed = player.speed;
    const boostedSpeed = Math.round(originalSpeed * (1 + this.speedBoostPercent / 100));
    player.speed = boostedSpeed;
    player.stats.speed = boostedSpeed;

    // Visual feedback: flash the pickup
    if (this._graphics) {
      this._graphics.clear();
      this._graphics.fillStyle(0xffff00, 0.8);
      this._graphics.fillCircle(0, 0, 20);
      this._graphics.setPosition(this.x, this.y);
    }

    // Show buff notification via HUD if available
    if (this.scene.hud && this.scene.hud.showBuffNotification) {
      this.scene.hud.showBuffNotification('⚡ Swift Boots! +30% Speed (10s)');
    }

    // Remove buff after duration
    this.scene.time.delayedCall(this.buffDuration, () => {
      if (player.active && player.speed === boostedSpeed) {
        player.speed = originalSpeed;
        player.stats.speed = originalSpeed;
      }
    });

    this.destroy();
  }

  _despawn() {
    // Fade out effect
    if (this._graphics) {
      this._graphics.clear();
      this._graphics.fillStyle(0xffaa00, 0.3);
      this._graphics.fillCircle(0, 0, this._radius);
      this._graphics.setPosition(this.x, this.y);
    }
    this.scene.time.delayedCall(300, () => {
      if (this.active) this.destroy();
    });
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);

    if (this.active && this._graphics) {
      const bob = Math.sin(time * 0.004 + this._bobOffset) * 2;
      this._graphics.setPosition(this.x, this.y + bob);
    }
  }

  destroy() {
    if (this._graphics) this._graphics.destroy();
    super.destroy();
  }
}
