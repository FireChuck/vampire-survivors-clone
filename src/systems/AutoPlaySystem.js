// AutoPlaySystem.js — Bot that controls the player automatically
// Activated via URL param ?autoplay=true (sets window.GAME_CONFIG.autoPlay)

class AutoPlaySystem {
  constructor(scene) {
    this.scene = scene;
    this.active = !!(window.GAME_CONFIG && window.GAME_CONFIG.autoPlay);
    this._wanderAngle = Math.random() * Math.PI * 2;
    this._wanderTimer = 0;
    this._wanderCooldown = 1000 + Math.random() * 1500; // 800-2300ms → use 1000+rand*1500 ≈ 1000-2500
  }

  update(time, delta) {
    if (!this.active) return;

    const player = this.scene.player;
    if (!player || !player.body) return;

    // If upgrade menu is showing, auto-select first upgrade
    if (this.scene.upgradeSystem && this.scene.upgradeSystem.paused) {
      this._autoSelectUpgrade();
      return; // Don't move while upgrade screen is open
    }

    this._moveTowardNearestEnemy(player, delta);
  }

  _moveTowardNearestEnemy(player, delta) {
    const enemies = this.scene.enemies;
    if (!enemies || enemies.length === 0) {
      this._wander(player, delta);
      return;
    }

    // Find nearest enemy (distance² compare — max 1 distance calc per frame via early break on first)
    let nearest = null;
    let nearestDistSq = Infinity;

    const px = player.x;
    const py = player.y;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      const dx = e.x - px;
      const dy = e.y - py;
      const distSq = dx * dx + dy * dy;
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearest = e;
      }
    }

    const threshold = 400;
    if (nearest && nearestDistSq < threshold * threshold) {
      // Move toward nearest enemy
      const dx = nearest.x - px;
      const dy = nearest.y - py;
      const dist = Math.sqrt(nearestDistSq);
      if (dist > 0) {
        const nx = dx / dist;
        const ny = dy / dist;
        const speed = player.speed || 160;
        player.body.setVelocity(nx * speed, ny * speed);
      }
    } else {
      this._wander(player, delta);
    }
  }

  _wander(player, delta) {
    this._wanderTimer += delta;
    if (this._wanderTimer >= this._wanderCooldown) {
      this._wanderAngle = Math.random() * Math.PI * 2;
      this._wanderTimer = 0;
      this._wanderCooldown = 800 + Math.random() * 1500; // 800-2300ms
    }

    const speed = (player.speed || 160) * 0.6;
    const vx = Math.cos(this._wanderAngle) * speed;
    const vy = Math.sin(this._wanderAngle) * speed;
    player.body.setVelocity(vx, vy);
  }

  _autoSelectUpgrade() {
    // The upgrade timer auto-closes at 0, selecting nothing.
    // We force-select by triggering the first card's pointerdown immediately.
    const ui = this.scene.upgradeSystem._uiContainer;
    if (!ui) return;

    // Find the first interactive card (Rectangle with listeners)
    const cards = ui.list.filter(
      (c) => c.type === 'Rectangle' && c.input && c.input.enabled
    );

    if (cards.length > 0) {
      cards[0].emit('pointerdown');
    }
  }
}
