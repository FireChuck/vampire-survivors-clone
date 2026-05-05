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

    // Visual: colored rectangle with type-specific details
    this._graphics = scene.add.graphics();
    this._drawVisual();
    this.setDepth(5);
  }

  _drawVisual() {
    this._graphics.clear();
    const hw = this.size[0] / 2;
    const hh = this.size[1] / 2;

    // HP Bar — only show when damaged
    if (this.hp < this.maxHp) {
      this._drawHPBar();
    }

    switch (this.enemyTypeKey) {
      case 'bat':
        this._graphics.fillStyle(this.color, 1);
        this._graphics.fillTriangle(0, 0, -hw, -hh, -hw, hh);
        this._graphics.fillTriangle(0, 0, hw, -hh, hw, hh);
        this._graphics.fillCircle(0, 0, hw * 0.5);
        this._graphics.fillStyle(0xff0000, 1);
        this._graphics.fillCircle(-2, -2, 1.5);
        this._graphics.fillCircle(2, -2, 1.5);
        break;

      case 'ghost':
        this._graphics.fillStyle(this.color, 0.6);
        this._graphics.fillCircle(0, -hh * 0.3, hw);
        this._graphics.fillRect(-hw, -hh * 0.3, this.size[0], hh * 1.3);
        for (let i = 0; i < 3; i++) {
          this._graphics.fillCircle(-hw + (this.size[0] / 3) * i + hw / 3, hh, hw / 3);
        }
        this._graphics.fillStyle(0x000000, 0.8);
        this._graphics.fillCircle(-3, -3, 2);
        this._graphics.fillCircle(3, -3, 2);
        break;

      case 'slime':
        this._graphics.fillStyle(this.color, 0.8);
        this._graphics.fillEllipse(0, hh * 0.2, this.size[0] * 1.1, this.size[1] * 0.8);
        this._graphics.fillStyle(0xffffff, 0.4);
        this._graphics.fillCircle(-3, -2, 3);
        break;

      case 'demon':
        this._graphics.fillStyle(this.color, 1);
        this._graphics.fillRect(-hw, -hh, this.size[0], this.size[1]);
        this._graphics.fillStyle(0x660000, 1);
        this._graphics.fillTriangle(-hw, -hh, -hw - 4, -hh - 10, -hw + 6, -hh);
        this._graphics.fillTriangle(hw, -hh, hw + 4, -hh - 10, hw - 6, -hh);
        this._graphics.fillStyle(0xffff00, 1);
        this._graphics.fillCircle(-4, -3, 2.5);
        this._graphics.fillCircle(4, -3, 2.5);
        break;

      case 'spider':
        this._graphics.fillStyle(this.color, 1);
        this._graphics.fillCircle(0, 0, hw * 0.6);
        this._graphics.lineStyle(1, this.color, 0.8);
        for (let i = 0; i < 4; i++) {
          const angle = (Math.PI * 0.3) + (Math.PI * 0.4 / 3) * i;
          this._graphics.lineBetween(
            -Math.cos(angle) * hw * 0.5, -Math.sin(angle) * hw * 0.5,
            -Math.cos(angle) * hw * 1.3, -Math.sin(angle) * hw * 1.3
          );
          this._graphics.lineBetween(
            Math.cos(angle) * hw * 0.5, -Math.sin(angle) * hw * 0.5,
            Math.cos(angle) * hw * 1.3, -Math.sin(angle) * hw * 1.3
          );
        }
        this._graphics.fillStyle(0xff0000, 1);
        this._graphics.fillCircle(-2, -2, 1);
        this._graphics.fillCircle(2, -2, 1);
        break;

      case 'golem':
        this._graphics.fillStyle(this.color, 1);
        this._graphics.fillRect(-hw, -hh, this.size[0], this.size[1]);
        this._graphics.lineStyle(1, 0x554433, 0.5);
        this._graphics.lineBetween(-hw + 4, -hh + 5, hw - 4, -hh + 8);
        this._graphics.lineBetween(-hw + 2, 0, hw - 6, 3);
        this._graphics.lineBetween(-hw + 5, hh - 6, hw - 3, hh - 4);
        this._graphics.fillStyle(0xffaa00, 1);
        this._graphics.fillCircle(-5, -4, 3);
        this._graphics.fillCircle(5, -4, 3);
        break;

      case 'skeleton':
        this._graphics.fillStyle(this.color, 1);
        this._graphics.fillRect(-hw, -hh, this.size[0], this.size[1]);
        this._graphics.fillStyle(0x000000, 0.6);
        this._graphics.fillCircle(-3, -4, 2);
        this._graphics.fillCircle(3, -4, 2);
        this._graphics.fillRect(-3, 2, 6, 2);
        break;

      default: // zombie
        this._graphics.fillStyle(this.color, 1);
        this._graphics.fillRect(-hw, -hh, this.size[0], this.size[1]);
        this._graphics.lineStyle(1, 0x000000, 0.5);
        this._graphics.strokeRect(-hw, -hh, this.size[0], this.size[1]);
        this._graphics.fillStyle(0xffff00, 0.8);
        this._graphics.fillCircle(-3, -3, 2);
        this._graphics.fillCircle(3, -3, 2);
        break;
    }

    this._graphics.setDepth(5);
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

    // Update graphics
    this._graphics.setPosition(this.x, this.y);
  }

  takeDamage(amount) {
    this.hp -= amount;

    // Flash white on hit (preserves HP bar area)
    this._graphics.clear();
    this._graphics.fillStyle(0xffffff, 0.9);
    this._graphics.fillRect(-this.size[0] / 2, -this.size[1] / 2, this.size[0], this.size[1]);

    // Spawn damage number
    this._spawnDamageNumber(amount);

    this.scene.time.delayedCall(80, () => {
      if (this.active) this._drawVisual();
    });

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
    // Particle + audio handled by GameScene via events

    // Emit event
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

  // Death particles now handled by ParticleSystem via enemyKilled event

  _drawHPBar() {
    const barWidth = this.size[0] + 4;
    const barHeight = 3;
    const y = -this.size[1] / 2 - 8;
    const ratio = Math.max(0, this.hp / this.maxHp);

    // Background
    this._graphics.fillStyle(0x333333, 0.8);
    this._graphics.fillRect(-barWidth / 2, y, barWidth, barHeight);

    // HP Fill (green → yellow → red)
    const color = ratio > 0.5 ? 0x22cc22 : ratio > 0.25 ? 0xcccc22 : 0xcc2222;
    this._graphics.fillStyle(color, 1);
    this._graphics.fillRect(-barWidth / 2, y, barWidth * ratio, barHeight);
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
    if (this._graphics) this._graphics.destroy();
    super.destroy();
  }
}
