// NecromancerEnemy.js — DLC Enemy: Necromancer
// Summons skeleton minions via ObjectPool. On death, all skeletons die.
// Appears in waves from wave 10+, as DLC spawn, and as a boss variant.

class NecromancerEnemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, null);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.enemyTypeKey = 'necromancer';
    this.enemyTypeName = 'Necromancer';
    this.hp = 100;
    this.maxHp = 100;
    this.speed = 45;
    this.damage = 8;
    this.xpValue = 25;
    this.color = 0x7700bb;
    this.size = [28, 28];

    this.body.setSize(28, 28);
    this.body.setOffset(-14, -14);

    this._damageCooldown = false;
    this._summonTimer = 0;
    this._summonInterval = 2500; // summon every 2.5s
    this._maxMinions = 6;
    this._minions = [];
    this._animTimer = 0;
    this._summonFlashTimer = 0;

    // Visual — own graphics (like SummonerEnemy pattern)
    this._graphics = scene.add.graphics();
    this._graphics.setDepth(5);
    this._drawVisual();
  }

  _drawVisual() {
    const g = this._graphics;
    g.clear();
    const hw = 14;

    // Dark aura ring
    g.lineStyle(1.5, 0x7700bb, 0.3);
    g.strokeCircle(0, 0, hw + 5);

    // Robed body — dark purple triangle-ish
    g.fillStyle(0x550088, 0.9);
    g.fillTriangle(0, -hw, -hw, hw * 0.8, hw, hw * 0.8);

    // Hood/cowl
    g.fillStyle(0x330066, 1);
    g.fillCircle(0, -hw * 0.3, hw * 0.7);

    // Glowing eyes
    g.fillStyle(0xff00ff, 1);
    g.fillCircle(-4, -hw * 0.35, 2.5);
    g.fillCircle(4, -hw * 0.35, 2.5);

    // Skull staff indicator
    g.fillStyle(0xccccaa, 0.8);
    g.fillRect(hw * 0.5, -hw * 0.2, 3, hw * 1.2);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(hw * 0.5 + 1.5, -hw * 0.3, 4);
    g.fillStyle(0x000000, 0.7);
    g.fillCircle(hw * 0.5, -hw * 0.35, 1);
    g.fillCircle(hw * 0.5 + 3, -hw * 0.35, 1);

    // Summon flash (brief glow after summoning)
    if (this._summonFlashTimer > 0) {
      g.fillStyle(0xbb66ee, this._summonFlashTimer / 300);
      g.fillCircle(0, 0, hw + 8);
    }

    g.setPosition(this.x, this.y);
  }

  update(time, delta, player, speedMultiplier) {
    if (!player || !player.active) return;
    if (!this.active) return;

    const spdMult = speedMultiplier || 1;
    this._animTimer += delta;

    if (this._summonFlashTimer > 0) {
      this._summonFlashTimer -= delta;
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    // AI: Kite — maintain ~180px distance, back away when close
    const preferredDist = 180;
    let moveX = dx / dist;
    let moveY = dy / dist;
    let speed = this.speed;

    if (dist < preferredDist - 40) {
      moveX = -dx / dist;
      moveY = -dy / dist;
      speed = this.speed * 1.3;
    } else if (dist > preferredDist + 60) {
      speed = this.speed * 0.8;
    } else {
      // Strafe around player
      const strafeAngle = this._animTimer / 2000;
      moveX = -dy / dist * 0.6 + dx / dist * 0.2;
      moveY = dx / dist * 0.6 + dy / dist * 0.2;
      speed = this.speed * 0.5;
    }

    this.setVelocity(moveX * speed * spdMult, moveY * speed * spdMult);

    // Summon timer
    this._summonTimer += delta;
    if (this._summonTimer >= this._summonInterval) {
      this._summonTimer = 0;
      this._summonMinion();
    }

    // Clean dead minion references
    for (let i = this._minions.length - 1; i >= 0; i--) {
      if (!this._minions[i] || !this._minions[i].active) {
        this._minions.splice(i, 1);
      }
    }

    // Redraw
    this._drawVisual();

    // HP bar
    if (this.hp < this.maxHp) {
      this._drawHPBar();
    }
  }

  _summonMinion() {
    const aliveMinions = this._minions.filter(m => m && m.active);
    if (aliveMinions.length >= this._maxMinions) return;

    const scene = this.scene;
    const angle = Math.random() * Math.PI * 2;
    const mx = this.x + Math.cos(angle) * 35;
    const my = this.y + Math.sin(angle) * 35;

    const minion = new SkeletonMinion(scene, mx, my, this);
    scene.enemyGroup.add(minion);
    scene.enemies.push(minion);
    this._minions.push(minion);

    // Summon flash
    this._summonFlashTimer = 300;

    // Spawn particle
    if (scene.particleSystem) {
      scene.particleSystem.emitDeath(mx, my, 0xbb66ee, 4);
    }
  }

  _drawHPBar() {
    const g = this._graphics;
    const barW = 32;
    const barH = 3;
    const y = -20;
    const ratio = Math.max(0, this.hp / this.maxHp);

    g.fillStyle(0x333333, 0.8);
    g.fillRect(-barW / 2, y, barW, barH);
    const c = ratio > 0.5 ? 0x22cc22 : ratio > 0.25 ? 0xcccc22 : 0xcc2222;
    g.fillStyle(c, 1);
    g.fillRect(-barW / 2, y, barW * ratio, barH);
  }

  takeDamage(amount) {
    this.hp -= amount;

    // Flash
    this._graphics.clear();
    this._graphics.fillStyle(0xffffff, 0.9);
    this._graphics.fillCircle(0, 0, 14);

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
      this.y - 22,
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

    this.scene.tweens.add({
      targets: text,
      y: text.y - 40,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => text.destroy()
    });
  }

  onDeath() {
    this.scene.events.emit('enemyKilled', {
      x: this.x,
      y: this.y,
      xpValue: this.xpValue,
      enemyType: 'necromancer',
      color: this.color
    });

    // Kill all skeleton minions on death
    for (const minion of this._minions) {
      if (minion && minion.active) {
        // Death burst particle
        if (this.scene.particleSystem) {
          this.scene.particleSystem.emitDeath(minion.x, minion.y, 0x7700bb, 3);
        }
        minion.destroy();
      }
    }
    this._minions = [];

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
    this.scene.time.delayedCall(800, () => {
      if (this.active) this._damageCooldown = false;
    });
  }

  getMinionCount() {
    return this._minions.filter(m => m && m.active).length;
  }

  destroy() {
    if (this._graphics) this._graphics.destroy();
    super.destroy();
  }
}

// SkeletonMinion — Lightweight skeleton summoned by Necromancer
// Reuses skeleton visuals from enemyTypes but is a distinct class for tracking owner
class SkeletonMinion extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, owner) {
    super(scene, x, y, null);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.enemyTypeKey = 'skeleton_minion';
    this.enemyTypeName = 'Skeleton Minion';
    this.hp = 15;
    this.maxHp = 15;
    this.speed = 95;
    this.damage = 5;
    this.xpValue = 3;
    this.color = 0xccccaa;
    this.size = [16, 20];
    this._owner = owner;

    this.body.setSize(16, 20);
    this.body.setOffset(-8, -10);

    this._damageCooldown = false;
    this._animTimer = Math.random() * Math.PI * 2;

    // Use batch graphics if available (like base Enemy), otherwise own graphics
    this._graphics = scene.add.graphics();
    this._graphics.setDepth(5);
    this._drawVisual();
  }

  _drawVisual() {
    const g = this._graphics;
    g.clear();
    const hw = 8;
    const hh = 10;

    // Skeleton body — bone-colored rectangle
    g.fillStyle(0xccccaa, 0.9);
    g.fillRect(-hw, -hh, this.size[0], this.size[1]);

    // Skull face
    g.fillStyle(0x000000, 0.6);
    g.fillCircle(-3, -4, 2);
    g.fillCircle(3, -4, 2);
    g.fillRect(-3, 2, 6, 2);

    // Purple tint (necromancer link)
    g.fillStyle(0x7700bb, 0.15);
    g.fillRect(-hw, -hh, this.size[0], this.size[1]);

    g.setPosition(this.x, this.y);
  }

  update(time, delta, player, speedMultiplier) {
    if (!player || !player.active) return;
    if (!this.active) return;

    const spdMult = speedMultiplier || 1;
    this._animTimer += delta;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    // Direct chase with slight wobble
    const wobble = Math.sin(this._animTimer / 200) * 0.3;
    const dirX = dx / dist + (-dy / dist) * wobble;
    const dirY = dy / dist + (dx / dist) * wobble;
    const len = Math.sqrt(dirX * dirX + dirY * dirY);

    this.setVelocity(dirX / len * this.speed * spdMult, dirY / len * this.speed * spdMult);
    this._graphics.setPosition(this.x, this.y);
  }

  takeDamage(amount) {
    this.hp -= amount;

    // Flash
    this._graphics.clear();
    this._graphics.fillStyle(0xffffff, 0.9);
    this._graphics.fillRect(-8, -10, 16, 20);

    this.scene.time.delayedCall(60, () => {
      if (this.active) this._drawVisual();
    });

    if (this.hp <= 0) this.onDeath();
  }

  onDeath() {
    this.scene.events.emit('enemyKilled', {
      x: this.x,
      y: this.y,
      xpValue: this.xpValue,
      enemyType: 'skeleton_minion',
      color: this.color
    });

    // Remove from owner's minion list
    if (this._owner && this._owner._minions) {
      const idx = this._owner._minions.indexOf(this);
      if (idx !== -1) this._owner._minions.splice(idx, 1);
    }

    this.destroy();
  }

  canDamagePlayer() {
    return !this._damageCooldown;
  }

  startDamageCooldown() {
    this._damageCooldown = true;
    this.scene.time.delayedCall(600, () => {
      if (this.active) this._damageCooldown = false;
    });
  }

  destroy() {
    if (this._graphics) this._graphics.destroy();
    super.destroy();
  }
}