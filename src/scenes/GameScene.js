// GameScene.js — Main gameplay scene
// Uses Player, Enemy, Weapon, XPOrb classes directly

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    // Physics groups
    this.enemyGroup = this.physics.add.group({ runChildUpdate: false });
    this.projectileGroup = this.physics.add.group({ runChildUpdate: false });
    this.xpOrbGroup = this.physics.add.group({ runChildUpdate: false });

    // Input
    this.inputManager = new InputManager(this);

    // Player (uses Player class directly)
    this.player = new Player(this, 400, 300);

    // Camera follow player
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setZoom(1.0);

    // World bounds
    this.physics.world.setBounds(-GAME_CONFIG.worldWidth / 2, -GAME_CONFIG.worldHeight / 2,
      GAME_CONFIG.worldWidth, GAME_CONFIG.worldHeight);
    this.player.body.setCollideWorldBounds(true);

    // Systems
    this.hud = new HUD(this);
    this.upgradeSystem = new UpgradeSystem(this, this.player, this.hud);

    // Weapon system — tracks weapons and auto-attack timers
    this._weapons = [];
    this._weaponTimers = {};
    this._activeProjectiles = [];
    this._auraWeapons = [];

    // Give starter weapon: Magic Staff
    this._addWeapon('staff');

    // State
    this.score = 0;
    this.killCount = 0;
    this.enemies = [];
    this.xpOrbs = [];
    this.gameTime = 0;
    this.gameOverTriggered = false;
    this.spawnTimer = 0;

    // Spawn intervals
    this.spawnInterval = GAME_CONFIG.spawnIntervalStart;
    this._lastSpawnTime = 0;

    // HUD init
    this.hud.updateHP(this.player.hp, this.player.maxHp);
    this.hud.startTimer();

    // ── Collisions ──

    // Player ↔ Enemy (overlap, handles damage via cooldown)
    this.physics.add.overlap(this.player, this.enemyGroup, (player, enemy) => {
      this._onPlayerHitEnemy(enemy);
    });

    // Projectile ↔ Enemy
    this.physics.add.overlap(this.projectileGroup, this.enemyGroup, (proj, enemy) => {
      this._onProjectileHit(proj, enemy);
    });

    // Player ↔ XP Orb
    this.physics.add.overlap(this.player, this.xpOrbGroup, (player, orb) => {
      this._onPlayerCollectXP(orb);
    });

    // Listen for enemy death events (XP orb spawn + score)
    this.events.on('enemyKilled', (data) => {
      this._spawnXPOrb(data.x, data.y, data.xpValue);
      this.score += data.xpValue * 10;
    });

    // Listen for AOE events
    this.events.on('weaponAOE', (data) => {
      this._applyAOE(data);
    });

    // Listen for player level-up
    this.events.on('playerLevelUp', () => {
      this.upgradeSystem.addXP(0); // trigger XP check for display
      if (this.hud) {
        this.hud.updateHP(this.player.hp, this.player.maxHp);
      }
    });

    // Draw ground grid
    this._drawGround();

    // Start spawning
    this.spawnTimer = this.time.now;
  }

  _drawGround() {
    const g = this.add.graphics();
    g.lineStyle(1, 0x222244, 0.3);
    const hw = GAME_CONFIG.worldWidth / 2;
    const hh = GAME_CONFIG.worldHeight / 2;
    const ts = GAME_CONFIG.tileSize;
    for (let x = -hw; x <= hw; x += ts) {
      g.lineBetween(x, -hh, x, hh);
    }
    for (let y = -hh; y <= hh; y += ts) {
      g.lineBetween(-hw, y, hw, y);
    }
    g.setDepth(0);
  }

  // ── Weapons ──

  _addWeapon(weaponKey) {
    const type = WEAPON_TYPES[weaponKey];
    if (!type) return;

    if (type.aura) {
      // Aura: create persistent entity around player
      const aura = new Weapon(this, this.player.x, this.player.y, weaponKey, { x: 0, y: 0 }, type);
      this._auraWeapons.push(aura);
      this._weapons.push({ key: weaponKey, type: type, timer: 0 });
    } else {
      this._weapons.push({ key: weaponKey, type: type, timer: 0 });
    }
  }

  _updateWeapons(time, delta) {
    for (const w of this._weapons) {
      w.timer += delta;

      // Apply cooldown reduction
      const cooldown = w.type.cooldown * (1 - this.player.stats.cooldownReduction);

      if (cooldown <= 0) continue; // aura handled separately

      if (w.timer >= cooldown) {
        w.timer = 0;
        this._fireWeapon(w.key, w.type);
      }
    }
  }

  _fireWeapon(weaponKey, type) {
    const target = this._findNearestEnemy(type.range * 1.5);
    if (!target && !type.aura) return;

    const px = this.player.x;
    const py = this.player.y;

    if (type.aura) return; // handled separately

    let direction;
    if (target) {
      const dx = target.x - px;
      const dy = target.y - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      direction = { x: dx / dist, y: dy / dist };
    } else {
      // Fire in player facing direction (last movement)
      direction = { x: 1, y: 0 };
    }

    // Apply player damage multiplier
    const stats = {
      damage: type.damage * this.player.stats.damageMultiplier,
      speed: type.speed,
      piercing: type.piercing,
      range: type.range,
      aoe: type.aoe,
      melee: type.melee,
      aura: type.aura
    };

    const proj = new Weapon(this, px, py, weaponKey, direction, stats);
    this.projectileGroup.add(proj);
    this._activeProjectiles.push(proj);
  }

  _findNearestEnemy(maxRange) {
    if (!this.enemies.length) return null;

    const px = this.player.x;
    const py = this.player.y;
    let nearest = null;
    let minDist = maxRange * maxRange;

    for (const enemy of this.enemies) {
      if (!enemy || !enemy.active) continue;
      const dx = enemy.x - px;
      const dy = enemy.y - py;
      const dist = dx * dx + dy * dy;
      if (dist < minDist) {
        minDist = dist;
        nearest = enemy;
      }
    }

    return nearest;
  }

  _applyAOE(data) {
    for (const enemy of this.enemies) {
      if (!enemy || !enemy.active) continue;
      if (enemy === data.exclude) continue;
      const dx = enemy.x - data.x;
      const dy = enemy.y - data.y;
      if (dx * dx + dy * dy < data.range * data.range) {
        enemy.takeDamage(data.damage);
      }
    }
  }

  // ── Enemy Spawning ──

  _spawnEnemy() {
    if (this.enemies.length >= GAME_CONFIG.maxEnemies) return;

    // Pick available types based on game time
    const typeKeys = Object.keys(ENEMY_TYPES).filter(k =>
      this.gameTime >= (ENEMY_TYPES[k].minTime || 0)
    );

    if (!typeKeys.length) return;

    const typeKey = typeKeys[Math.floor(Math.random() * typeKeys.length)];

    // Spawn outside camera view, around player
    const angle = Math.random() * Math.PI * 2;
    const dist = 500 + Math.random() * 100;
    const x = this.player.x + Math.cos(angle) * dist;
    const y = this.player.y + Math.sin(angle) * dist;

    // Scale HP with game time
    const hpScale = 1 + this.gameTime / 60000;
    const type = ENEMY_TYPES[typeKey];

    const enemy = new Enemy(this, x, y, typeKey);
    enemy.hp = Math.floor(enemy.hp * hpScale);
    enemy.maxHp = enemy.hp;

    this.enemyGroup.add(enemy);
    this.enemies.push(enemy);
  }

  // ── Collision Handlers ──

  _onPlayerHitEnemy(enemy) {
    if (!enemy || !enemy.active) return;
    if (!enemy.canDamagePlayer()) return;
    if (this.upgradeSystem.paused) return; // No damage during level-up

    const damage = enemy.damage;
    const actual = this.player.takeDamage(damage);

    enemy.startDamageCooldown();

    if (this.hud) {
      this.hud.updateHP(this.player.hp, this.player.maxHp);
    }

    // Golem area damage
    if (enemy.enemyTypeKey === 'golem') {
      // Extra damage pulse handled by golem's stop behavior
    }

    if (this.player.hp <= 0 && !this.gameOverTriggered) {
      this._triggerGameOver();
    }
  }

  _onProjectileHit(proj, enemy) {
    if (!proj || !proj.active) return;
    if (!enemy || !enemy.active) return;

    // Only Weapon class projectiles handle hits
    if (typeof proj.onHitEnemy === 'function') {
      proj.onHitEnemy(enemy);
    }
  }

  _spawnXPOrb(x, y, value) {
    const orb = new XPOrb(this, x, y, value);
    this.xpOrbGroup.add(orb);
    this.xpOrbs.push(orb);
  }

  _onPlayerCollectXP(orb) {
    if (!orb || !orb.active) return;

    orb.collect(this.player);

    // Remove from tracking
    const idx = this.xpOrbs.indexOf(orb);
    if (idx !== -1) this.xpOrbs.splice(idx, 1);

    // Update XP via upgrade system
    this.upgradeSystem.addXP(0); // XP already added in orb.collect()

    if (this.hud) {
      this.hud.updateXP(this.player.xp, this.upgradeSystem.xpToNext, this.player.level);
    }
  }

  _triggerGameOver() {
    if (this.gameOverTriggered) return;
    this.gameOverTriggered = true;

    // Stop all systems
    this.inputManager.destroy();
    this.upgradeSystem.destroy();
    this.hud.destroy();

    const stats = {
      score: this.score,
      killCount: this.killCount,
      level: this.player.level,
      time: this.hud ? this.hud.getElapsedTime() : 0
    };

    this.time.delayedCall(600, () => {
      this.scene.stop('GameScene');
      this.scene.start('GameOverScene', stats);
    });
  }

  // ── Main Update Loop ──

  update(time, delta) {
    if (this.upgradeSystem.paused || this.gameOverTriggered) return;

    this.gameTime += delta;

    // Player movement
    const move = this.inputManager.getMovementVector();
    this.player.move(move.x, move.y);

    // HP regen HUD update
    if (this.player.stats.hpRegen > 0 && this.hud) {
      this.hud.updateHP(this.player.hp, this.player.maxHp);
    }

    // XP bar
    if (this.hud) {
      this.hud.updateXP(this.player.xp, this.upgradeSystem.xpToNext, this.player.level);
    }

    // Weapons
    this._updateWeapons(time, delta);

    // Update active projectiles
    for (let i = this._activeProjectiles.length - 1; i >= 0; i--) {
      const p = this._activeProjectiles[i];
      if (!p || !p.active) {
        this._activeProjectiles.splice(i, 1);
      } else {
        p.update(time, delta);
      }
    }

    // Update aura weapons
    for (const aura of this._auraWeapons) {
      if (aura.active) {
        // Aura damage: check enemies in range every frame
        for (const enemy of this.enemies) {
          if (!enemy || !enemy.active) continue;
          const dx = enemy.x - this.player.x;
          const dy = enemy.y - this.player.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < aura.range) {
            // Aura ticks: damage every 500ms
            if (!enemy._auraTickTime) enemy._auraTickTime = 0;
            enemy._auraTickTime += delta;
            if (enemy._auraTickTime >= 500) {
              enemy._auraTickTime = 0;
              const dmg = aura.damage * this.player.stats.damageMultiplier;
              enemy.takeDamage(dmg);
            }
          }
        }
        aura.update(time, delta);
      }
    }

    // Enemy spawning — difficulty increases
    this.spawnInterval = Math.max(GAME_CONFIG.spawnIntervalMin,
      GAME_CONFIG.spawnIntervalStart - (this.gameTime / 1000 / 60) * GAME_CONFIG.spawnIntervalDecrease);

    if (this.gameTime - this._lastSpawnTime > this.spawnInterval) {
      this._lastSpawnTime = this.gameTime;
      this._spawnEnemy();
      // Spawn extra enemies as time goes on
      if (this.gameTime > 60000) this._spawnEnemy();
      if (this.gameTime > 120000) this._spawnEnemy();
      if (this.gameTime > 180000) this._spawnEnemy();
    }

    // Update enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy || !enemy.active) {
        this.enemies.splice(i, 1);
      } else {
        enemy.update(time, delta, this.player);
      }
    }

    // Update XP orbs — attraction to player
    for (let i = this.xpOrbs.length - 1; i >= 0; i--) {
      const orb = this.xpOrbs[i];
      if (!orb || !orb.active) {
        this.xpOrbs.splice(i, 1);
      } else {
        orb.attractTo(this.player);
      }
    }

    // HUD updates
    if (this.hud) {
      this.hud.updateScore(this.score);
      this.hud.updateKills(this.killCount);
      this.hud.updateEnemyCount(this.enemies.length);
    }
  }
}
