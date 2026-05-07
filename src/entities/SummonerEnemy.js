// SummonerEnemy.js — DLC Enemy: Summoner
// Slow enemy that stays at distance and spawns Swarm Minions

class SummonerEnemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, null);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.enemyTypeKey = 'summoner';
    this.enemyTypeName = 'Summoner';
    this.hp = 80;
    this.maxHp = 80;
    this.speed = 40;
    this.damage = 5;
    this.xpValue = 15;
    this.color = 0x9944cc;
    this.size = [26, 26];

    this.body.setSize(26, 26);
    this.body.setOffset(-13, -13);

    this._damageCooldown = false;
    this._summonTimer = 0;
    this._summonInterval = 3000; // 3 seconds
    this._maxMinions = 5;
    this._minions = [];
    this._animTimer = 0;
    this._flashTimer = 0;

    // Visual
    this._graphics = scene.add.graphics();
    this._graphics.setDepth(5);
    this._drawVisual();
  }

  _drawVisual() {
    const g = this._graphics;
    g.clear();
    const hw = 13;

    // Aura ring (pulsing handled in update)
    g.lineStyle(1.5, 0x9944cc, 0.3);
    g.strokeCircle(0, 0, hw + 4);

    // Body
    g.fillStyle(0x9944cc, 0.8);
    g.fillCircle(0, 0, hw);

    // Inner glow
    g.fillStyle(0xbb66ee, 0.5);
    g.fillCircle(0, 0, hw * 0.6);

    // "S" symbol
    g.fillStyle(0xffffff, 0.9);
    g.fillRect(-4, -5, 8, 3);
    g.fillRect(-2, -3, 6, 3);
    g.fillRect(-4, 0, 8, 3);
    g.fillRect(-2, 3, 6, 3);
    g.fillRect(-4, 5, 8, 3);

    // Eyes
    g.fillStyle(0xff00ff, 1);
    g.fillCircle(-4, -3, 2);
    g.fillCircle(4, -3, 2);
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

    // AI: Stay at ~150px distance from player
    const preferredDist = 150;
    let moveX = dx / dist;
    let moveY = dy / dist;
    let speed = this.speed;

    if (dist < preferredDist - 30) {
      // Too close — back away
      moveX = -dx / dist;
      moveY = -dy / dist;
      speed = this.speed * 1.2;
    } else if (dist > preferredDist + 50) {
      // Too far — approach
      speed = this.speed;
    } else {
      // Sweet spot — slow drift
      speed = this.speed * 0.3;
    }

    this.setVelocity(moveX * speed * spdMult, moveY * speed * spdMult);

    // Summon timer
    this._summonTimer += delta;
    if (this._summonTimer >= this._summonInterval) {
      this._summonTimer = 0;
      this._summonMinion();
    }

    // Update minion references — remove dead ones
    for (let i = this._minions.length - 1; i >= 0; i--) {
      if (!this._minions[i] || !this._minions[i].active) {
        this._minions.splice(i, 1);
      }
    }

    // Pulsing aura visual
    this._graphics.clear();
    const pulseAlpha = 0.2 + Math.sin(this._animTimer / 300) * 0.15;
    this._graphics.lineStyle(1.5, 0x9944cc, pulseAlpha);
    this._graphics.strokeCircle(0, 0, 17);
    // Redraw body
    this._graphics.fillStyle(0x9944cc, 0.8);
    this._graphics.fillCircle(0, 0, 13);
    this._graphics.fillStyle(0xbb66ee, 0.5);
    this._graphics.fillCircle(0, 0, 8);
    this._graphics.fillStyle(0xffffff, 0.9);
    this._graphics.fillRect(-4, -5, 8, 3);
    this._graphics.fillRect(-2, -3, 6, 3);
    this._graphics.fillRect(-4, 0, 8, 3);
    this._graphics.fillRect(-2, 3, 6, 3);
    this._graphics.fillRect(-4, 5, 8, 3);
    this._graphics.fillStyle(0xff00ff, 1);
    this._graphics.fillCircle(-4, -3, 2);
    this._graphics.fillCircle(4, -3, 2);
    this._graphics.setPosition(this.x, this.y);

    // HP bar
    if (this.hp < this.maxHp) {
      const barW = 30;
      const barH = 3;
      const y = -18;
      const ratio = Math.max(0, this.hp / this.maxHp);
      this._graphics.fillStyle(0x333333, 0.8);
      this._graphics.fillRect(-barW / 2, y, barW, barH);
      const c = ratio > 0.5 ? 0x22cc22 : ratio > 0.25 ? 0xcccc22 : 0xcc2222;
      this._graphics.fillStyle(c, 1);
      this._graphics.fillRect(-barW / 2, y, barW * ratio, barH);
    }
  }

  _summonMinion() {
    // Check minion count (including dead references cleaned in update)
    const aliveMinions = this._minions.filter(m => m && m.active);
    if (aliveMinions.length >= this._maxMinions) return;

    const scene = this.scene;
    const angle = Math.random() * Math.PI * 2;
    const mx = this.x + Math.cos(angle) * 30;
    const my = this.y + Math.sin(angle) * 30;

    const minion = new SummonMinion(scene, mx, my, this);
    scene.enemyGroup.add(minion);
    scene.enemies.push(minion);
    this._minions.push(minion);

    // Spawn particle
    if (scene.particleSystem) {
      scene.particleSystem.emitDeath(mx, my, 0xbb66ee, 4);
    }
  }

  takeDamage(amount) {
    this.hp -= amount;

    // Flash — batch renderer will check this via _flashTimer
    this._flashTimer = 80;

    // NOTE: Damage numbers handled by CollisionManager via pooled DamageNumbers system

    if (this.hp <= 0) {
      this.onDeath();
    }
  }

  onDeath() {
    this.scene.events.emit('enemyKilled', {
      x: this.x,
      y: this.y,
      xpValue: this.xpValue,
      enemyType: 'summoner'
    });

    // Kill all minions on summoner death
    for (const minion of this._minions) {
      if (minion && minion.active) {
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

// SummonMinion — Small, fast, weak minion spawned by Summoner
class SummonMinion extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, owner) {
    super(scene, x, y, null);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.enemyTypeKey = 'swarm_minion';
    this.enemyTypeName = 'Swarm Minion';
    this.hp = 10;
    this.maxHp = 10;
    this.speed = 110;
    this.damage = 3;
    this.xpValue = 2;
    this.color = 0xcc88ff;
    this.size = [10, 10];
    this._owner = owner;

    this.body.setSize(10, 10);
    this.body.setOffset(-5, -5);

    this._damageCooldown = false;
    this._animTimer = Math.random() * Math.PI * 2;

    this._graphics = scene.add.graphics();
    this._graphics.setDepth(5);
    this._drawVisual();
  }

  _drawVisual() {
    const g = this._graphics;
    g.clear();
    // Small purple diamond
    g.fillStyle(0xcc88ff, 0.8);
    g.fillTriangle(0, -5, -5, 0, 5, 0);
    g.fillTriangle(0, 5, -5, 0, 5, 0);
    // Tiny eye
    g.fillStyle(0xff00ff, 1);
    g.fillCircle(0, -1, 1.5);
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

    const wobble = Math.sin(this._animTimer / 150) * 0.4;
    const dirX = dx / dist + (-dy / dist) * wobble;
    const dirY = dy / dist + (dx / dist) * wobble;
    const len = Math.sqrt(dirX * dirX + dirY * dirY);

    this.setVelocity(dirX / len * this.speed * spdMult, dirY / len * this.speed * spdMult);
    this._graphics.setPosition(this.x, this.y);
  }

  takeDamage(amount) {
    this.hp -= amount;
    // NOTE: Damage numbers handled by CollisionManager via pooled DamageNumbers system
    if (this.hp <= 0) this.onDeath();
  }

  onDeath() {
    this.scene.events.emit('enemyKilled', {
      x: this.x,
      y: this.y,
      xpValue: this.xpValue,
      enemyType: 'swarm_minion'
    });
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
