// MiniBoss.js — Vampire Survivors Clone
// Mini-boss enemies that spawn every 3 waves. Only one active at a time.
// Types: Swarm Queen, Golem, Shadow Mage

class MiniBoss extends Enemy {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {string} miniBossType — 'swarm_queen' | 'golem' | 'shadow_mage'
   * @param {number} wave — current wave number for HP scaling
   */
  constructor(scene, x, y, miniBossType, wave) {
    super(scene, x, y, 'golem'); // base type for collision/physics

    this.isMiniBoss = true;
    this.miniBossType = miniBossType;
    this.isBoss = true; // reuse Boss flag for screen-edge indicators

    switch (miniBossType) {
      case 'swarm_queen':
        this._initSwarmQueen(wave);
        break;
      case 'golem':
        this._initGolem(wave);
        break;
      case 'shadow_mage':
        this._initShadowMage(wave);
        break;
    }

    // HP Bar (dedicated graphics — Boss pattern)
    this._hpBarBg = scene.add.graphics();
    this._hpBarFill = scene.add.graphics();
    this._hpBarBg.setDepth(40);
    this._hpBarFill.setDepth(41);

    // Name label
    this._nameText = scene.add.text(0, 0, this.miniBossName, {
      fontSize: '11px',
      fontFamily: 'Arial, sans-serif',
      color: '#ff8844',
      fontStyle: 'bold',
      stroke: '#000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(42);

    this._updateHUDPositions();
  }

  // ── Type Initializers ──

  _initSwarmQueen(wave) {
    this.miniBossName = 'Swarm Queen';
    this.hp = wave * 50;
    this.maxHp = this.hp;
    this.speed = 40;
    this.damage = 5;
    this.xpValue = wave * 10;
    this.color = 0xaa00aa;
    this.size = [36, 36];
    this.body.setSize(36, 36);
    this.body.setOffset(-18, -18);

    this._summonTimer = 0;
    this._summonInterval = 1000; // 1 bat per second
    this._minions = [];
  }

  _initGolem(wave) {
    this.miniBossName = 'Golem';
    this.hp = wave * 80;
    this.maxHp = this.hp;
    this.speed = 30;
    this.damage = 15;
    this.xpValue = wave * 12;
    this.color = 0x887744;
    this.size = [48, 48];
    this.body.setSize(48, 48);
    this.body.setOffset(-24, -24);

    this._slamTimer = 0;
    this._slamInterval = 4000;
    this._slamActive = false;
    this._slamRadius = 100;
  }

  _initShadowMage(wave) {
    this.miniBossName = 'Shadow Mage';
    this.hp = wave * 40;
    this.maxHp = this.hp;
    this.speed = 50;
    this.damage = 10;
    this.xpValue = wave * 10;
    this.color = 0x440088;
    this.size = [32, 32];
    this.body.setSize(32, 32);
    this.body.setOffset(-16, -16);

    this._teleportTimer = 0;
    this._teleportInterval = 3000;
    this._boltTimer = 0;
    this._boltInterval = 1500;
    this._projectiles = [];
  }

  // ── Update ──

  update(time, delta, player, speedMultiplier) {
    if (!player || !player.active || !this.active) return;

    var spdMult = speedMultiplier || 1;

    // Type-specific behavior
    switch (this.miniBossType) {
      case 'swarm_queen':
        this._updateSwarmQueen(time, delta, player, spdMult);
        break;
      case 'golem':
        this._updateGolem(time, delta, player, spdMult);
        break;
      case 'shadow_mage':
        this._updateShadowMage(time, delta, player, spdMult);
        break;
    }

    this._updateHUDPositions();
  }

  // ── Swarm Queen ──

  _updateSwarmQueen(time, delta, player, spdMult) {
    // Move toward player slowly
    var dx = player.x - this.x;
    var dy = player.y - this.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1) {
      this.body.setVelocity((dx / dist) * this.speed * spdMult, (dy / dist) * this.speed * spdMult);
    }

    // Summon bats
    this._summonTimer += delta;
    if (this._summonTimer >= this._summonInterval && this._minions.length < 12) {
      this._summonTimer = 0;
      this._spawnBat(player);
    }

    // Clean dead minions
    this._minions = this._minions.filter(function(m) { return m && m.active; });
  }

  _spawnBat(player) {
    var scene = this.scene;
    if (scene.enemies.length >= GAME_CONFIG.maxEnemies) return;

    var angle = Math.random() * Math.PI * 2;
    var dist = 30 + Math.random() * 20;
    var bx = this.x + Math.cos(angle) * dist;
    var by = this.y + Math.sin(angle) * dist;

    var bat = new Enemy(scene, bx, by, 'bat');
    // Minions are weaker
    bat.hp = Math.floor(bat.hp * 0.5);
    bat.maxHp = bat.hp;
    bat.xpValue = Math.floor(bat.xpValue * 0.5);

    scene.enemyGroup.add(bat);
    scene.enemies.push(bat);
    this._minions.push(bat);
  }

  // ── Golem ──

  _updateGolem(time, delta, player, spdMult) {
    // Move toward player (slow but steady)
    var dx = player.x - this.x;
    var dy = player.y - this.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1) {
      this.body.setVelocity((dx / dist) * this.speed * spdMult, (dy / dist) * this.speed * spdMult);
    }

    // Slam attack
    this._slamTimer += delta;
    if (this._slamTimer >= this._slamInterval && dist < 120) {
      this._slamTimer = 0;
      this._slamAttack(player);
    }
  }

  _slamAttack(player) {
    var scene = this.scene;
    var self = this;

    // Knockback all enemies (and player) in radius
    if (scene.screenShake) scene.screenShake.shake('hit');

    // Damage player if in range
    var dx = player.x - this.x;
    var dy = player.y - this.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < this._slamRadius && player.active) {
      player.takeDamage(this.damage);
      // Knockback
      if (dist > 1) {
        player.body.setVelocity((dx / dist) * 300, (dy / dist) * 300);
        scene.time.delayedCall(300, function() {
          if (player.active) player.body.setVelocity(0, 0);
        });
      }
    }

    // Visual shockwave
    var shockwave = scene.add.graphics().setDepth(8);
    var radius = 0;
    var tween = scene.tweens.add({
      targets: { r: 0 },
      r: this._slamRadius,
      duration: 400,
      onUpdate: function(tween, target) {
        shockwave.clear();
        shockwave.lineStyle(3, 0xccaa44, 1 - target.r / self._slamRadius);
        shockwave.strokeCircle(self.x, self.y, target.r);
      },
      onComplete: function() {
        shockwave.destroy();
      }
    });
  }

  // ── Shadow Mage ──

  _updateShadowMage(time, delta, player, spdMult) {
    var dx = player.x - this.x;
    var dy = player.y - this.y;
    var dist = Math.sqrt(dx * dx + dy * dy);

    // Teleport
    this._teleportTimer += delta;
    if (this._teleportTimer >= this._teleportInterval) {
      this._teleportTimer = 0;
      this._teleport(player);
    }

    // Fire homing dark bolts
    this._boltTimer += delta;
    if (this._boltTimer >= this._boltInterval) {
      this._boltTimer = 0;
      this._fireDarkBolt(player);
    }

    // Slow drift toward player
    if (dist > 1) {
      this.body.setVelocity((dx / dist) * this.speed * 0.5 * spdMult, (dy / dist) * this.speed * 0.5 * spdMult);
    }
  }

  _teleport(player) {
    // Teleport to random position near player (200-350px away)
    var angle = Math.random() * Math.PI * 2;
    var dist = 200 + Math.random() * 150;
    this.setPosition(player.x + Math.cos(angle) * dist, player.y + Math.sin(angle) * dist);

    // Teleport visual — fade out/in effect
    var scene = this.scene;
    var fadeGfx = scene.add.graphics().setDepth(6);
    fadeGfx.fillStyle(0x8800ff, 0.6);
    fadeGfx.fillCircle(this.x, this.y, 20);
    scene.tweens.add({
      targets: fadeGfx,
      alpha: 0,
      duration: 500,
      onComplete: function() { fadeGfx.destroy(); }
    });
  }

  _fireDarkBolt(player) {
    if (!player || !player.active) return;
    var scene = this.scene;

    var dx = player.x - this.x;
    var dy = player.y - this.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    var bolt = scene.physics.add.sprite(this.x, this.y, null);
    scene.physics.add.existing(bolt);
    bolt.body.setSize(10, 10);
    bolt.body.setOffset(-5, -5);
    bolt.setDepth(10);
    bolt._isEliteProjectile = true;
    bolt._damage = Math.floor(this.damage * 0.7);
    bolt._lifetime = 4000;

    // Homing: initially aim at player, then slowly track
    var speed = 150;
    bolt.body.setVelocity((dx / dist) * speed, (dy / dist) * speed);

    // Visual
    var boltGfx = scene.add.graphics().setDepth(10);
    bolt._gfx = boltGfx;

    // Homing update
    var homingEvent = scene.time.addEvent({
      delay: 100,
      loop: true,
      callback: function() {
        if (!bolt.active || !player.active) {
          homingEvent.destroy();
          return;
        }
        var bx = player.x - bolt.x;
        var by = player.y - bolt.y;
        var bd = Math.sqrt(bx * bx + by * by);
        if (bd > 1) {
          var currentSpeed = Math.sqrt(bolt.body.velocity.x * bolt.body.velocity.x + bolt.body.velocity.y * bolt.body.velocity.y);
          bolt.body.setVelocity((bx / bd) * currentSpeed, (by / bd) * currentSpeed);
        }
      }
    });

    // Collision with player
    scene.physics.add.overlap(bolt, scene.player, function(b, pl) {
      if (pl && pl.active && pl.takeDamage) {
        pl.takeDamage(b._damage);
      }
      homingEvent.destroy();
      b.destroy();
      if (b._gfx) b._gfx.destroy();
    });

    // Auto-destroy after lifetime
    scene.time.delayedCall(bolt._lifetime, function() {
      homingEvent.destroy();
      if (bolt && bolt.active) {
        bolt.destroy();
        if (bolt._gfx) bolt._gfx.destroy();
      }
    });
  }

  // ── HUD ──

  _updateHUDPositions() {
    if (!this.active) return;
    var barWidth = this.size[0] + 16;
    var barHeight = 5;
    var barY = this.y - this.size[1] / 2 - 18;
    var ratio = Math.max(0, this.hp / this.maxHp);

    // HP Bar
    this._hpBarBg.clear();
    this._hpBarBg.fillStyle(0x111111, 0.9);
    this._hpBarBg.fillRect(this.x - barWidth / 2, barY, barWidth, barHeight);
    this._hpBarBg.lineStyle(0.5, 0x666666, 0.5);
    this._hpBarBg.strokeRect(this.x - barWidth / 2, barY, barWidth, barHeight);

    this._hpBarFill.clear();
    var barColor = ratio > 0.5 ? 0xff8844 : ratio > 0.25 ? 0xff6622 : 0xff2200;
    this._hpBarFill.fillStyle(barColor, 0.9);
    this._hpBarFill.fillRect(this.x - barWidth / 2, barY, barWidth * ratio, barHeight);

    // Name label
    this._nameText.setPosition(this.x, barY - 8);
  }

  // ── Cleanup ──

  destroy() {
    // Kill minions (Swarm Queen)
    for (var i = 0; i < this._minions.length; i++) {
      if (this._minions[i] && this._minions[i].active) {
        this._minions[i].destroy();
      }
    }
    this._minions = [];

    // Kill projectiles (Shadow Mage)
    for (var j = 0; j < this._projectiles.length; j++) {
      if (this._projectiles[j] && this._projectiles[j].active) {
        this._projectiles[j].destroy();
      }
    }
    this._projectiles = [];

    if (this._hpBarBg) this._hpBarBg.destroy();
    if (this._hpBarFill) this._hpBarFill.destroy();
    if (this._nameText) this._nameText.destroy();

    if (typeof super.destroy === 'function') {
      super.destroy();
    }
  }
}
