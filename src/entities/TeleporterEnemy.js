// TeleporterEnemy.js — Vampire Survivors Clone
// Blinks to the player every 3-4 seconds with visual fade effects

class TeleporterEnemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, null);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const type = ENEMY_TYPES.teleporter;
    this.enemyTypeKey = 'teleporter';
    this.enemyTypeName = type.name;
    this.hp = type.hp;
    this.maxHp = type.hp;
    this.speed = type.speed;
    this.damage = type.damage;
    this.xpValue = type.xpValue;
    this.color = type.color;
    this.size = type.size;
    this._minTime = type.minTime || 0;

    // Collision body
    this.body.setSize(this.size[0], this.size[1]);
    this.body.setOffset(-this.size[0] / 2, -this.size[1] / 2);

    // Damage cooldown
    this._damageCooldown = false;
    this._damageCooldownTime = 800;

    // Teleporter state
    this._teleportTimer = 0;
    this._teleportInterval = 3000 + Math.random() * 1000; // 3-4 seconds
    this._isTeleporting = false;
    this._teleportPhase = 'idle'; // idle, fadeout, appear, fadein
    this._teleportPhaseTimer = 0;
    this._teleportAlpha = 1;

    // Visual
    this._graphics = scene.add.graphics();
    this._drawVisual();
    this.setDepth(5);
  }

  _drawVisual() {
    this._graphics.clear();
    const hw = this.size[0] / 2;
    const hh = this.size[1] / 2;

    // HP Bar
    if (this.hp < this.maxHp) {
      this._drawHPBar();
    }

    // Teleporter: diamond shape with inner glow
    this._graphics.fillStyle(this.color, this._teleportAlpha);

    // Diamond body
    this._graphics.beginPath();
    this._graphics.moveTo(0, -hh);
    this._graphics.lineTo(hw, 0);
    this._graphics.lineTo(0, hh);
    this._graphics.lineTo(-hw, 0);
    this._graphics.closePath();
    this._graphics.fillPath();

    // Inner glow
    this._graphics.fillStyle(0xcc88ff, this._teleportAlpha * 0.5);
    this._graphics.fillCircle(0, 0, hw * 0.4);

    // Eyes
    this._graphics.fillStyle(0xff0000, this._teleportAlpha);
    this._graphics.fillCircle(-3, -2, 2);
    this._graphics.fillCircle(3, -2, 2);

    // Pre-teleport warning: red blink ring
    if (this._teleportPhase === 'fadeout' || (this._teleportPhase === 'idle' && this._teleportTimer > this._teleportInterval - 500)) {
      const pulse = Math.sin(Date.now() * 0.015) * 0.5 + 0.5;
      this._graphics.lineStyle(2, 0xff0000, pulse * this._teleportAlpha);
      this._graphics.strokeCircle(0, 0, hw + 4);
    }

    this._graphics.setDepth(5);
  }

  update(time, delta, player, speedMultiplier) {
    if (!player || !player.active) return;

    const spdMult = speedMultiplier || 1;
    this._teleportTimer += delta;

    // Teleport state machine
    if (this._teleportPhase === 'idle') {
      // Normal chase
      if (this._teleportTimer >= this._teleportInterval) {
        // Start teleport sequence
        this._teleportPhase = 'fadeout';
        this._teleportPhaseTimer = 0;
        this._teleportTimer = 0;
        this._teleportInterval = 3000 + Math.random() * 1000; // Reset with new random interval
      }
    }

    if (this._teleportPhase === 'fadeout') {
      // Fade out over 300ms
      this._teleportPhaseTimer += delta;
      this._teleportAlpha = 1 - (this._teleportPhaseTimer / 300);
      if (this._teleportPhaseTimer >= 300) {
        // Teleport to near player (±100px)
        this._teleportPhase = 'appear';
        this._teleportPhaseTimer = 0;
        const offsetX = (Math.random() - 0.5) * 200;
        const offsetY = (Math.random() - 0.5) * 200;
        this.setPosition(player.x + offsetX, player.y + offsetY);
        this.body.reset(this.x, this.y);

        // Spawn teleport particles at old position (handled by leaving visual trace)
        this._spawnTeleportFX();
      }
      this._drawVisual();
      this._graphics.setPosition(this.x, this.y);
      this.setAlpha(Math.max(0, this._teleportAlpha));
      return; // Don't move during fadeout
    }

    if (this._teleportPhase === 'appear') {
      // Brief pause then fade in
      this._teleportPhaseTimer += delta;
      this._teleportAlpha = Math.min(1, this._teleportPhaseTimer / 300);
      if (this._teleportPhaseTimer >= 300) {
        this._teleportPhase = 'fadein';
        this._teleportPhaseTimer = 0;
      }
      this._drawVisual();
      this._graphics.setPosition(this.x, this.y);
      this.setAlpha(this._teleportAlpha);
      return; // Don't move during appear
    }

    if (this._teleportPhase === 'fadein') {
      this._teleportPhaseTimer += delta;
      this._teleportAlpha = 1;
      if (this._teleportPhaseTimer >= 200) {
        this._teleportPhase = 'idle';
        this._teleportTimer = 0;
      }
    }

    // Normal chase movement
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const moveX = dx / dist;
    const moveY = dy / dist;

    this.setVelocity(moveX * this.speed * spdMult, moveY * this.speed * spdMult);

    this._drawVisual();
    this._graphics.setPosition(this.x, this.y);
    this.setAlpha(1);
  }

  _spawnTeleportFX() {
    // Purple burst effect at teleport location
    const g = this.scene.add.graphics();
    g.fillStyle(0x8844ff, 0.6);
    g.fillCircle(this.x, this.y, 20);
    g.setDepth(10);
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 400,
      onComplete: () => g.destroy()
    });
  }

  takeDamage(amount) {
    this.hp -= amount;

    this._graphics.clear();
    this._graphics.fillStyle(0xffffff, 0.9);
    this._graphics.fillRect(-this.size[0] / 2, -this.size[1] / 2, this.size[0], this.size[1]);

    // NOTE: Damage numbers handled by CollisionManager via pooled DamageNumbers system

    this.scene.time.delayedCall(80, () => {
      if (this.active) this._drawVisual();
    });

    if (this.hp <= 0) {
      this.onDeath();
    }
  }

  onDeath() {
    this.scene.events.emit('enemyKilled', {
      x: this.x,
      y: this.y,
      xpValue: this.xpValue,
      enemyType: this.enemyTypeKey
    });

    if (this.scene.killCount !== undefined) {
      this.scene.killCount++;
    }

    this.destroy();
  }

  _drawHPBar() {
    const barWidth = this.size[0] + 4;
    const barHeight = 3;
    const y = -this.size[1] / 2 - 8;
    const ratio = Math.max(0, this.hp / this.maxHp);

    this._graphics.fillStyle(0x333333, 0.8);
    this._graphics.fillRect(-barWidth / 2, y, barWidth, barHeight);

    const color = ratio > 0.5 ? 0x22cc22 : ratio > 0.25 ? 0xcccc22 : 0xcc2222;
    this._graphics.fillStyle(color, 1);
    this._graphics.fillRect(-barWidth / 2, y, barWidth * ratio, barHeight);
  }

  canDamagePlayer() {
    return !this._damageCooldown && this._teleportPhase === 'idle';
  }

  applyTimeScaling(gameTimeSeconds) {
    const timeMinutes = gameTimeSeconds / 60;
    const hpScale = 1 + (timeMinutes * 0.1);
    const dmgScale = 1 + (timeMinutes * 0.1);
    this.hp = Math.floor(this.hp * hpScale);
    this.maxHp = this.hp;
    this.damage = Math.floor(this.damage * dmgScale);
  }

  startDamageCooldown() {
    this._damageCooldown = true;
    this.scene.time.delayedCall(this._damageCooldownTime, () => {
      if (this.active) this._damageCooldown = false;
    });
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);

    if (!this.active) return;

    const player = this.scene.player;
    if (player && !player.active) {
      this.destroy();
      return;
    }

    const despawnDist = GAME_CONFIG ? GAME_CONFIG.enemyDespawnDistance : 1200;
    if (player) {
      const dx = this.x - player.x;
      const dy = this.y - player.y;
      if (dx * dx + dy * dy > despawnDist * despawnDist) {
        this.destroy();
      }
    }
  }

  destroy() {
    if (this._graphics) this._graphics.destroy();
    super.destroy();
  }
}
