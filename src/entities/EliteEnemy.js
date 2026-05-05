// EliteEnemy.js — Vampire Survivors Clone
// Elite variants of regular enemies with auras, enhanced stats, and special abilities.
// Spawn: 5% chance per enemy from minute 3 onward (via SpawnManager).

class EliteEnemy extends Enemy {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {string} baseTypeKey  — base enemy type (bat, skeleton, zombie, etc.)
   * @param {string} eliteVariant — 'chaser' | 'shooter' | 'boss'
   */
  constructor(scene, x, y, baseTypeKey, eliteVariant) {
    super(scene, x, y, baseTypeKey);

    this.isElite = true;
    this.eliteVariant = eliteVariant;

    // Override visuals: use individual graphics for aura effect
    // (base Enemy uses batch graphics, but elites need their own aura layer)
    this._auraGraphics = scene.add.graphics();
    this._auraGraphics.setDepth(4); // behind batch depth 5
    this._auraPulseTimer = 0;

    switch (eliteVariant) {
      case 'chaser':
        this._initChaser(scene);
        break;
      case 'shooter':
        this._initShooter(scene);
        break;
      case 'boss':
        this._initBossVariant(scene);
        break;
    }
  }

  // ── Variant Initializers ──

  _initChaser(scene) {
    this.eliteName = 'Elite ' + this.enemyTypeName;
    this.speed *= 1.5;
    this.xpValue *= 2;
    this.damage = Math.floor(this.damage * 1.3);
    this._shieldHits = 1;     // absorbs 1 hit
    this._auraColor = 0xffd700; // gold aura
    this.size = [this.size[0] + 4, this.size[1] + 4];
    this.body.setSize(this.size[0], this.size[1]);
    this.body.setOffset(-this.size[0] / 2, -this.size[1] / 2);
  }

  _initShooter(scene) {
    this.eliteName = 'Elite ' + this.enemyTypeName;
    this.xpValue *= 2;
    this.damage = Math.floor(this.damage * 1.2);
    this.speed *= 0.8; // slower to keep distance
    this._auraColor = 0x00ffff; // cyan aura
    this._burstTimer = 0;
    this._burstInterval = 2000; // shoot every 2s
    this._burstCount = 3;
    this._burstShots = 0;
    this._burstCooldown = 200; // ms between shots in a burst
    this._projectiles = [];
    this.size = [this.size[0] + 2, this.size[1] + 2];
    this.body.setSize(this.size[0], this.size[1]);
    this.body.setOffset(-this.size[0] / 2, -this.size[1] / 2);
  }

  _initBossVariant(scene) {
    this.eliteName = 'Elite ' + this.enemyTypeName;
    this.hp *= 3;
    this.maxHp = this.hp;
    this.xpValue *= 3;
    this.damage = Math.floor(this.damage * 1.5);
    this.speed *= 0.9;
    this._auraColor = 0xff0000; // red aura
    this._phaseTransitioned = false;
    this.size = [this.size[0] + 8, this.size[1] + 8];
    this.body.setSize(this.size[0], this.size[1]);
    this.body.setOffset(-this.size[0] / 2, -this.size[1] / 2);
  }

  // ── Update ──

  update(time, delta, player, speedMultiplier) {
    if (!player || !player.active || !this.active) return;

    // Phase transition for boss variant
    if (this.eliteVariant === 'boss' && !this._phaseTransitioned && this.hp < this.maxHp * 0.5) {
      this._phaseTransitioned = true;
      this.speed *= 1.4;
      this.damage = Math.floor(this.damage * 1.3);
      // Visual flash
      this._auraColor = 0xff4400;
    }

    // Shooter burst logic
    if (this.eliteVariant === 'shooter') {
      this._burstTimer += delta;
      if (this._burstShots > 0) {
        this._burstCooldown -= delta;
        if (this._burstCooldown <= 0) {
          this._fireProjectile(player);
          this._burstShots--;
          this._burstCooldown = 200;
        }
      } else if (this._burstTimer >= this._burstInterval) {
        this._burstTimer = 0;
        this._burstShots = this._burstCount - 1; // first shot now
        this._fireProjectile(player);
      }
    }

    // Call parent update for AI movement
    super.update(time, delta, player, speedMultiplier);

    // Draw aura
    this._auraPulseTimer += delta;
    this._drawAura();
  }

  _fireProjectile(player) {
    if (!player || !player.active) return;
    var dx = player.x - this.x;
    var dy = player.y - this.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;
    var speed = 200;

    var proj = this.scene.physics.add.sprite(this.x, this.y, null);
    this.scene.physics.add.existing(proj);
    proj.body.setSize(8, 8);
    proj.body.setOffset(-4, -4);
    proj.setDepth(10);
    proj.body.setVelocity((dx / dist) * speed, (dy / dist) * speed);
    proj._isEliteProjectile = true;
    proj._damage = Math.floor(this.damage * 0.6);

    // Simple visual: cyan circle
    var projGfx = this.scene.add.graphics().setDepth(10);
    proj._gfx = projGfx;

    // Collision with player
    this.scene.physics.add.overlap(proj, this.scene.player, function(p, pl) {
      if (pl && pl.active && pl.takeDamage) {
        pl.takeDamage(p._damage);
      }
      p.destroy();
      if (p._gfx) p._gfx.destroy();
    });

    // Auto-destroy after 3s
    this.scene.time.delayedCall(3000, function() {
      if (proj && proj.active) {
        proj.destroy();
        if (proj._gfx) proj._gfx.destroy();
      }
    });
  }

  // ── Aura Drawing ──

  _drawAura() {
    var g = this._auraGraphics;
    g.clear();
    var pulse = 0.3 + Math.sin(this._auraPulseTimer / 400) * 0.15;
    var hw = this.size[0] / 2 + 6;

    // Outer glow ring
    g.lineStyle(2, this._auraColor, pulse);
    g.strokeCircle(this.x, this.y, hw);

    // Inner subtle fill
    g.fillStyle(this._auraColor, pulse * 0.15);
    g.fillCircle(this.x, this.y, hw - 2);

    // HP indicator strip (4px bar for elites)
    this._drawEliteHPStrip(g);
  }

  _drawEliteHPStrip(g) {
    var barWidth = this.size[0] + 8;
    var barHeight = 4;
    var barX = this.x - barWidth / 2;
    var barY = this.y - this.size[1] / 2 - 10;
    var ratio = Math.max(0, this.hp / this.maxHp);

    // Background
    g.fillStyle(0x111111, 0.9);
    g.fillRect(barX, barY, barWidth, barHeight);

    // Fill with aura color
    g.fillStyle(this._auraColor, 0.9);
    g.fillRect(barX, barY, barWidth * ratio, barHeight);

    // Border
    g.lineStyle(0.5, 0xffffff, 0.3);
    g.strokeRect(barX, barY, barWidth, barHeight);
  }

  // ── Shield (Chaser variant) ──

  takeDamage(amount) {
    if (this.eliteVariant === 'chaser' && this._shieldHits > 0) {
      this._shieldHits--;
      // Shield break visual flash
      this._auraColor = 0xffffff;
      this.scene.time.delayedCall(200, function() {
        if (this.active) this._auraColor = 0xffd700;
      }.bind(this));
      return; // no damage taken
    }
    if (typeof super.takeDamage === 'function') {
      super.takeDamage(amount);
    } else {
      this.hp -= amount;
    }
  }

  // ── Cleanup ──

  destroy() {
    // Clean up projectiles
    for (var i = 0; i < this._projectiles.length; i++) {
      if (this._projectiles[i] && this._projectiles[i].active) {
        this._projectiles[i].destroy();
      }
    }
    this._projectiles = [];

    if (this._auraGraphics) {
      this._auraGraphics.destroy();
      this._auraGraphics = null;
    }

    if (typeof super.destroy === 'function') {
      super.destroy();
    }
  }
}
