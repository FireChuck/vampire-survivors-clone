// Enemy.js — Vampire Survivors Clone
// Enemy entity with distinct AI behaviors per type

class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, enemyTypeKey) {
    super(scene, x, y, null);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const type = ENEMY_TYPES[enemyTypeKey] || ENEMY_TYPES.bat;
    this.enemyTypeKey = enemyTypeKey;
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

    // AI state
    this._aiTimer = 0;
    this._zigzagDir = 1;
    this._zigzagTimer = 0;
    this._chargeSpeed = 0;
    this._isCharging = false;
    this._erraticAngle = 0;
    this._erraticTimer = 0;
    this._bounceTimer = 0;
    this._bounceVy = 0;

    // Visual: uses shared batch graphics from scene (set via Enemy.setBatchGraphics)
    this._graphics = null; // no individual graphics — batch rendering
    this._flashTimer = 0;
    this.setDepth(5);
  }

  /** Static shared graphics — set once by GameScene */
  static _batchGraphics = null;
  static setBatchGraphics(gfx) { Enemy._batchGraphics = gfx; }
  static getBatchGraphics() { return Enemy._batchGraphics; }

  _drawVisual(gfx) {
    if (!gfx) gfx = Enemy._batchGraphics;
    if (!gfx) return;
    const hw = this.size[0] / 2;
    const hh = this.size[1] / 2;
    const px = this.x;
    const py = this.y;

    // HP Bar — only show when damaged
    if (this.hp < this.maxHp) {
      this._drawHPBar(gfx, px, py);
    }

    switch (this.enemyTypeKey) {
      case 'bat':
        gfx.fillStyle(this.color, 1);
        gfx.fillTriangle(px, py, px - hw, py - hh, px - hw, py + hh);
        gfx.fillTriangle(px, py, px + hw, py - hh, px + hw, py + hh);
        gfx.fillCircle(px, py, hw * 0.5);
        gfx.fillStyle(0xff0000, 1);
        gfx.fillCircle(px - 2, py - 2, 1.5);
        gfx.fillCircle(px + 2, py - 2, 1.5);
        break;

      case 'ghost':
        gfx.fillStyle(this.color, 0.6);
        gfx.fillCircle(px, py - hh * 0.3, hw);
        gfx.fillRect(px - hw, py - hh * 0.3, this.size[0], hh * 1.3);
        for (let i = 0; i < 3; i++) {
          gfx.fillCircle(px - hw + (this.size[0] / 3) * i + hw / 3, py + hh, hw / 3);
        }
        gfx.fillStyle(0x000000, 0.8);
        gfx.fillCircle(px - 3, py - 3, 2);
        gfx.fillCircle(px + 3, py - 3, 2);
        break;

      case 'slime':
        gfx.fillStyle(this.color, 0.8);
        gfx.fillEllipse(px, py + hh * 0.2, this.size[0] * 1.1, this.size[1] * 0.8);
        gfx.fillStyle(0xffffff, 0.4);
        gfx.fillCircle(px - 3, py - 2, 3);
        break;

      case 'demon':
        gfx.fillStyle(this.color, 1);
        gfx.fillRect(px - hw, py - hh, this.size[0], this.size[1]);
        gfx.fillStyle(0x660000, 1);
        gfx.fillTriangle(px - hw, py - hh, px - hw - 4, py - hh - 10, px - hw + 6, py - hh);
        gfx.fillTriangle(px + hw, py - hh, px + hw + 4, py - hh - 10, px + hw - 6, py - hh);
        gfx.fillStyle(0xffff00, 1);
        gfx.fillCircle(px - 4, py - 3, 2.5);
        gfx.fillCircle(px + 4, py - 3, 2.5);
        break;

      case 'spider':
        gfx.fillStyle(this.color, 1);
        gfx.fillCircle(px, py, hw * 0.6);
        gfx.lineStyle(1, this.color, 0.8);
        for (let i = 0; i < 4; i++) {
          const angle = (Math.PI * 0.3) + (Math.PI * 0.4 / 3) * i;
          gfx.lineBetween(
            px - Math.cos(angle) * hw * 0.5, py - Math.sin(angle) * hw * 0.5,
            px - Math.cos(angle) * hw * 1.3, py - Math.sin(angle) * hw * 1.3
          );
          gfx.lineBetween(
            px + Math.cos(angle) * hw * 0.5, py - Math.sin(angle) * hw * 0.5,
            px + Math.cos(angle) * hw * 1.3, py - Math.sin(angle) * hw * 1.3
          );
        }
        gfx.fillStyle(0xff0000, 1);
        gfx.fillCircle(px - 2, py - 2, 1);
        gfx.fillCircle(px + 2, py - 2, 1);
        break;

      case 'golem':
        gfx.fillStyle(this.color, 1);
        gfx.fillRect(px - hw, py - hh, this.size[0], this.size[1]);
        gfx.lineStyle(1, 0x554433, 0.5);
        gfx.lineBetween(px - hw + 4, py - hh + 5, px + hw - 4, py - hh + 8);
        gfx.lineBetween(px - hw + 2, py, px + hw - 6, py + 3);
        gfx.lineBetween(px - hw + 5, py + hh - 6, px + hw - 3, py + hh - 4);
        gfx.fillStyle(0xffaa00, 1);
        gfx.fillCircle(px - 5, py - 4, 3);
        gfx.fillCircle(px + 5, py - 4, 3);
        break;

      case 'skeleton':
        gfx.fillStyle(this.color, 1);
        gfx.fillRect(px - hw, py - hh, this.size[0], this.size[1]);
        gfx.fillStyle(0x000000, 0.6);
        gfx.fillCircle(px - 3, py - 4, 2);
        gfx.fillCircle(px + 3, py - 4, 2);
        gfx.fillRect(px - 3, py + 2, 6, 2);
        break;

      default: // zombie
        gfx.fillStyle(this.color, 1);
        gfx.fillRect(px - hw, py - hh, this.size[0], this.size[1]);
        gfx.lineStyle(1, 0x000000, 0.5);
        gfx.strokeRect(px - hw, py - hh, this.size[0], this.size[1]);
        gfx.fillStyle(0xffff00, 0.8);
        gfx.fillCircle(px - 3, py - 3, 2);
        gfx.fillCircle(px + 3, py - 3, 2);
        break;
    }
  }

  update(time, delta, player, speedMultiplier) {
    if (!player || !player.active) return;

    // Speed multiplier from Time Warp passive (default 1)
    const spdMult = speedMultiplier || 1;

    this._aiTimer += delta;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const baseDirX = dx / dist;
    const baseDirY = dy / dist;

    let moveX = baseDirX;
    let moveY = baseDirY;
    let speed = this.speed;

    // Distinct behaviors per type
    switch (this.enemyTypeKey) {
      case 'bat':
        // Zigzag movement — fast, unpredictable
        this._zigzagTimer += delta;
        if (this._zigzagTimer > 300) {
          this._zigzagDir *= -1;
          this._zigzagTimer = 0;
        }
        // Perpendicular zigzag
        moveX = baseDirX + (-baseDirY) * this._zigzagDir * 0.6;
        moveY = baseDirY + baseDirX * this._zigzagDir * 0.6;
        break;

      case 'skeleton':
        // Direct chase — steady, no tricks
        break;

      case 'zombie':
        // Slow, but speeds up when close (under 100px)
        if (dist < 100) speed = this.speed * 1.5;
        break;

      case 'ghost':
        // Phases — stops briefly, then dashes
        if (!this._isCharging && dist < 150) {
          this._isCharging = true;
          this._chargeSpeed = this.speed * 2.5;
        }
        if (this._isCharging) {
          speed = this._chargeSpeed;
          this._chargeSpeed *= 0.98; // slow down dash
          if (this._chargeSpeed < this.speed) this._isCharging = false;
        }
        break;

      case 'slime':
        // Bouncing movement — periodic vertical bounce
        this._bounceTimer += delta;
        if (this._bounceTimer > 600) {
          this._bounceVy = -200;
          this._bounceTimer = 0;
        }
        this._bounceVy += 600 * (delta / 1000); // gravity
        moveY += (this._bounceVy / this.speed) * 0.5;
        break;

      case 'demon':
        // Charges when close, otherwise walks
        if (dist < 200) {
          speed = this.speed * 2;
        } else {
          speed = this.speed * 0.6;
        }
        break;

      case 'spider':
        // Erratic direction changes
        this._erraticTimer += delta;
        if (this._erraticTimer > 200 + Math.random() * 300) {
          this._erraticAngle = (Math.random() - 0.5) * 1.5;
          this._erraticTimer = 0;
        }
        const angle = Math.atan2(baseDirY, baseDirX) + this._erraticAngle;
        moveX = Math.cos(angle);
        moveY = Math.sin(angle);
        break;

      case 'golem':
        // Very slow but steady — damages in area when close
        if (dist < 60) {
          // Area damage pulse (handled in collision)
          speed = 0;
        }
        break;
    }

    // Normalize and apply
    const moveLen = Math.sqrt(moveX * moveX + moveY * moveY);
    if (moveLen > 0) {
      this.setVelocity(moveX / moveLen * speed * spdMult, moveY / moveLen * speed * spdMult);
    }
    // Note: no per-enemy graphics update — batch rendering handles this in GameScene
  }

  takeDamage(amount) {
    this.hp -= amount;

    // Flash timer — batch renderer will check this
    this._flashTimer = 80;

    // Spawn damage number
    this._spawnDamageNumber(amount);

    if (this.hp <= 0) {
      this.onDeath();
    }
  }

  _spawnDamageNumber(amount) {
    const text = this.scene.add.text(
      this.x + (Math.random() - 0.5) * 20,
      this.y - this.size[1] / 2 - 5,
      Math.floor(amount).toString(),
      {
        fontSize: amount >= 20 ? '16px' : '12px',
        fontFamily: 'Arial, sans-serif',
        color: amount >= 20 ? '#ff4444' : '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      }
    ).setOrigin(0.5).setDepth(30);

    // Float up and fade
    const startY = text.y;
    this.scene.tweens.add({
      targets: text,
      y: startY - 40,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => text.destroy()
    });
  }

  onDeath() {
    // Emit event (particles + audio handled by CollisionManager event listeners)
    this.scene.events.emit('enemyKilled', {
      x: this.x,
      y: this.y,
      xpValue: this.xpValue,
      enemyType: this.enemyTypeKey,
      color: this.color,
      isBoss: !!this.isBoss
    });

    // Emit boss/mini-boss specific events for chest spawning
    if (this.isBoss && !this.isMiniBoss) {
      this.scene.events.emit('bossKilled', { x: this.x, y: this.y });
    } else if (this.isMiniBoss) {
      this.scene.events.emit('miniBossKilled', { x: this.x, y: this.y });
    }

    if (this.scene.killCount !== undefined) {
      this.scene.killCount++;
    }

    // Immediate destroy — batch renderer handles visuals
    this.destroy();
  }

  // Death particles now handled by ParticleSystem via enemyKilled event

  _drawHPBar(gfx, px, py) {
    const barWidth = this.size[0] + 4;
    const barHeight = 3;
    const y = py - this.size[1] / 2 - 8;
    const ratio = Math.max(0, this.hp / this.maxHp);

    // Background
    gfx.fillStyle(0x333333, 0.8);
    gfx.fillRect(px - barWidth / 2, y, barWidth, barHeight);

    // HP Fill (green → yellow → red)
    const color = ratio > 0.5 ? 0x22cc22 : ratio > 0.25 ? 0xcccc22 : 0xcc2222;
    gfx.fillStyle(color, 1);
    gfx.fillRect(px - barWidth / 2, y, barWidth * ratio, barHeight);
  }

  canDamagePlayer() {
    return !this._damageCooldown;
  }

  // ── HP/DMG Scaling (called from GameScene spawn) ──
  applyTimeScaling(gameTimeSeconds) {
    const timeMinutes = gameTimeSeconds / 60;
    const hpScale = 1 + (timeMinutes * 0.1); // +10% HP per minute
    const dmgScale = 1 + (timeMinutes * 0.1); // +10% DMG per minute
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

    // Despawn only if player is dead
    const player = this.scene.player;
    if (player && !player.active) {
      this.destroy();
      return;
    }

    // Despawn if VERY far from player (way beyond visible range)
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
    // No individual graphics to destroy — batch rendering
    super.destroy();
  }
}
