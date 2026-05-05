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

    // Meta Progression
    this.meta = new MetaProgression();
    this.meta.applyPermanentUpgrades(this.player);

    // Systems
    this.hud = new HUD(this);
    this.upgradeSystem = new UpgradeSystem(this, this.player, this.hud);

    // ── Performance Systems ──
    this.spatialGrid = new SpatialGrid(128, GAME_CONFIG.worldWidth, GAME_CONFIG.worldHeight);

    // Object pools
    this.projectilePool = new ObjectPool(
      () => {
        const p = new Weapon(this, -9999, -9999, 'staff', { x: 0, y: 0 }, WEAPON_TYPES.staff);
        this.projectileGroup.add(p);
        return p;
      },
      (obj) => {
        obj.body.reset(-9999, -9999);
        obj._hitCount = 0;
        obj._piercedEnemies = [];
      },
      20
    );

    this.xpOrbPool = new ObjectPool(
      () => {
        const o = new XPOrb(this, -9999, -9999, 5);
        this.xpOrbGroup.add(o);
        return o;
      },
      (obj) => {
        obj.x = -9999;
        obj.y = -9999;
        obj._attracted = false;
        obj.value = 5;
      },
      30
    );

    // Minimap
    this.minimap = new Minimap(this);

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
      this.killCount++;
      // Audio + particles
      if (this.audioManager) this.audioManager.playEnemyDeath();
      if (this.particleSystem) this.particleSystem.emitDeath(data.x, data.y);
      // Explosion on kill
      if (this.player.stats.explosionOnKill) {
        this._explosionOnKill(data.x, data.y);
      }
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
      if (this.audioManager) this.audioManager.playLevelUp();
      if (this.particleSystem) this.particleSystem.emitLevelUp(this.player.x, this.player.y);
    });

    // Listen for upgrade events from UpgradeSystem
    this.events.on('upgradeNewWeapon', () => {
      this._handleNewWeaponUpgrade();
    });
    this.events.on('upgradeWeaponLevel', () => {
      this._handleWeaponLevelUpgrade();
    });

    // ── Biome System ──
    this._currentBiome = null;
    this._biomeGraphics = this.add.graphics();
    this._biomeGraphics.setDepth(0);
    this._decorationPool = [];
    this._lastBiome = null;
    this._biomeTransitioning = false;
    this._biomeOverlay = null;
    this._biomeNameText = null;
    this._ambientParticles = [];
    this._initBiomes();

    // Draw ground grid (base layer under biome overlay)
    this._drawGround();

    // ── Screen-Edge Indicators ──
    this.screenEdgeIndicators = new ScreenEdgeIndicators(this);

    // ── Audio System ──
    this.audioManager = new AudioManager(this);

    // ── Wave/Boss System ──
    this.waveSystem = {
      currentWave: 0,
      waveTimer: 0,
      waveInterval: 60000,
      bossWaveInterval: 120000,
      lastWaveTime: 0,
      bossActive: false
    };

    // Wave display text
    this._waveText = this.add.text(this.scale.width / 2, 100, '', {
      fontSize: '24px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffd700',
      fontStyle: 'bold',
      stroke: '#000',
      strokeThickness: 3
    }).setOrigin(0.5).setScrollFactor(0).setDepth(50).setAlpha(0);

    // Boss warning text
    this._bossWarningText = this.add.text(this.scale.width / 2, 140, '', {
      fontSize: '18px',
      fontFamily: 'Arial, sans-serif',
      color: '#ff4444',
      fontStyle: 'bold',
      stroke: '#000',
      strokeThickness: 3
    }).setOrigin(0.5).setScrollFactor(0).setDepth(50).setAlpha(0);

    // ── Particle System ──
    this.particleSystem = new ParticleSystem(this);

    // Start spawning
    this.spawnTimer = this.time.now;
  }

  // ── Biome System ──

  _initBiomes() {
    // Create initial biome background and decorations
    this._updateBiome();
  }

  _updateBiome() {
    // Map player position to biomeDesign.js coordinate system
    // biomeDesign uses 0-4000, we use -2000 to 2000 (centered)
    const bx = this.player.x + GAME_CONFIG.worldWidth / 2;
    const by = this.player.y + GAME_CONFIG.worldHeight / 2;
    const biome = getBiomeAtPosition(bx, by);

    if (!biome) return;

    // Only update when biome changes
    if (this._lastBiome === biome.name) return;
    this._lastBiome = biome.name;
    this._currentBiome = biome;

    // Smooth color transition instead of flash
    this._smoothBiomeTransition(biome);

    // Spawn biome name overlay
    this._showBiomeName(biome.name);

    // Spawn ambient particles
    this._spawnAmbientParticles(biome.name);

    // Spawn decorations for this biome area
    this._spawnBiomeDecorations(biome);
  }

  _smoothBiomeTransition(biome) {
    // Create a full-screen overlay that fades from old bg to new bg
    if (this._biomeOverlay) this._biomeOverlay.destroy();

    const newColor = Phaser.Display.Color.IntegerToColor(biome.bgColor);
    const sw = this.scale.width;
    const sh = this.scale.height;

    this._biomeOverlay = this.add.rectangle(sw / 2, sh / 2, sw, sh, biome.bgColor, 0)
      .setDepth(49).setScrollFactor(0);

    this.tweens.add({
      targets: this._biomeOverlay,
      alpha: 0.6,
      duration: 400,
      ease: 'Sine.easeOut',
      yoyo: true,
      onComplete: () => {
        this.cameras.main.setBackgroundColor(newColor.rgba);
        if (this._biomeOverlay) {
          this._biomeOverlay.destroy();
          this._biomeOverlay = null;
        }
      }
    });
  }

  _showBiomeName(biomeName) {
    if (this._biomeNameText) this._biomeNameText.destroy();

    const displayName = biomeName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const sw = this.scale.width;

    this._biomeNameText = this.add.text(sw / 2, this.scale.height * 0.3, `~ ${displayName} ~`, {
      fontSize: '28px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(60).setScrollFactor(0).setAlpha(0);

    this.tweens.add({
      targets: this._biomeNameText,
      alpha: 1,
      duration: 600,
      ease: 'Sine.easeIn',
      hold: 1200,
      yoyo: true,
      onComplete: () => {
        if (this._biomeNameText) {
          this._biomeNameText.destroy();
          this._biomeNameText = null;
        }
      }
    });
  }

  _spawnAmbientParticles(biomeName) {
    // Clear old particles
    for (const p of this._ambientParticles) {
      if (p && p.active) p.destroy();
    }
    this._ambientParticles = [];

    // Only spawn a small pool for performance
    const count = 8;

    for (let i = 0; i < count; i++) {
      const ox = this.player.x + (Math.random() - 0.5) * 600;
      const oy = this.player.y + (Math.random() - 0.5) * 400;

      let color, size, alpha;
      switch (biomeName) {
        case 'graveyard':
          color = 0x888899;
          size = 4 + Math.random() * 6;
          alpha = 0.15 + Math.random() * 0.1;
          break;
        case 'dark_forest':
          color = 0x225522;
          size = 3 + Math.random() * 4;
          alpha = 0.2 + Math.random() * 0.15;
          break;
        case 'blood_lands':
          color = 0x882222;
          size = 3 + Math.random() * 3;
          alpha = 0.1 + Math.random() * 0.1;
          break;
        default:
          color = 0x666666;
          size = 3 + Math.random() * 3;
          alpha = 0.1;
      }

      const p = this.add.circle(ox, oy, size, color, alpha).setDepth(2);
      this._ambientParticles.push(p);

      // Slow float animation
      this.tweens.add({
        targets: p,
        x: ox + (Math.random() - 0.5) * 100,
        y: oy - 40 - Math.random() * 60,
        alpha: 0,
        duration: 4000 + Math.random() * 3000,
        ease: 'Sine.easeInOut',
        repeat: -1,
        delay: Math.random() * 2000,
        onRepeat: () => {
          // Reset position near player
          if (this.player && this.player.active) {
            p.x = this.player.x + (Math.random() - 0.5) * 600;
            p.y = this.player.y + (Math.random() - 0.5) * 400;
          }
        }
      });
    }
  }

  _spawnBiomeDecorations(biome) {
    // Clear old decorations
    for (const d of this._decorationPool) {
      if (d && d.active) d.destroy();
    }
    this._decorationPool = [];

    const decorations = getDecorationsForBiome(biome.name);
    if (!decorations.length) return;

    // Spawn decorations in a chunk around the player
    const chunkSize = 800;
    const cx = this.player.x;
    const cy = this.player.y;

    for (const decType of decorations) {
      const count = Math.floor(decType.density * chunkSize * chunkSize * 0.01);
      for (let i = 0; i < count; i++) {
        const x = cx + (Math.random() - 0.5) * chunkSize;
        const y = cy + (Math.random() - 0.5) * chunkSize;
        const g = this.add.graphics();
        const alpha = decType.alpha || 1.0;

        // Draw decoration based on type
        g.fillStyle(decType.color, alpha);

        switch (decType.type) {
          case 'tombstone':
          case 'pillar':
          case 'dead_tree':
            g.fillRect(x - decType.width / 2, y - decType.height, decType.width, decType.height);
            break;
          case 'cross':
            g.fillRect(x - 2, y - decType.height, 4, decType.height);
            g.fillRect(x - decType.width / 2, y - decType.height * 0.6, decType.width, 4);
            break;
          case 'tree':
            // Trunk
            g.fillStyle(0x5c3a1e, alpha);
            g.fillRect(x - 4, y - decType.height * 0.4, 8, decType.height * 0.4);
            // Canopy
            g.fillStyle(decType.color, alpha);
            g.fillCircle(x, y - decType.height * 0.6, decType.width / 2);
            break;
          case 'mushroom':
            g.fillRect(x - 2, y - 6, 4, 6);
            g.fillCircle(x, y - 8, decType.width / 2);
            break;
          case 'rock':
          case 'rubble':
            g.fillRoundedRect(x - decType.width / 2, y - decType.height / 2, decType.width, decType.height, 4);
            break;
          case 'bush':
            g.fillCircle(x, y, decType.width / 2);
            break;
          case 'fog_patch':
            g.fillCircle(x, y, decType.width / 2);
            break;
          case 'blood_pool':
          case 'bone_pile':
            g.fillEllipse(x, y, decType.width, decType.height * 0.6);
            break;
          case 'skull':
            g.fillCircle(x, y, decType.width / 2);
            g.fillStyle(0x1a1a1a, alpha);
            g.fillCircle(x - 3, y - 1, 2);
            g.fillCircle(x + 3, y - 1, 2);
            break;
          case 'corpse':
            g.fillRect(x - decType.width / 2, y - 4, decType.width, 8);
            break;
          case 'torch':
            g.fillRect(x - 2, y - decType.height, 4, decType.height);
            // Flame
            g.fillStyle(0xff6600, alpha);
            g.fillCircle(x, y - decType.height - 4, 6);
            g.fillStyle(0xffcc00, alpha * 0.7);
            g.fillCircle(x, y - decType.height - 6, 3);
            break;
          case 'crack':
            g.fillRect(x - decType.width / 2, y - 2, decType.width, 4);
            break;
          default:
            g.fillCircle(x, y, decType.width / 3);
        }

        g.setDepth(1);
        this._decorationPool.push(g);
      }
    }
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
      this._weapons.push({ key: weaponKey, type: type, timer: 0, level: 1 });
    } else {
      this._weapons.push({ key: weaponKey, type: type, timer: 0, level: 1 });
    }
  }

  _handleNewWeaponUpgrade() {
    const allKeys = Object.keys(WEAPON_TYPES);
    const ownedKeys = this._weapons.map(w => w.key);
    const available = allKeys.filter(k => !ownedKeys.includes(k));

    if (available.length === 0) return; // All weapons owned

    const pick = available[Math.floor(Math.random() * available.length)];
    this._addWeapon(pick);
  }

  _handleWeaponLevelUpgrade() {
    if (this._weapons.length === 0) return;

    const target = this._weapons[Math.floor(Math.random() * this._weapons.length)];
    target.level = (target.level || 1) + 1;

    // Scale weapon stats per level
    const lvl = target.level;
    target.type = { ...WEAPON_TYPES[target.key] };
    target.type.damage = Math.floor(target.type.damage * (1 + 0.2 * (lvl - 1)));
    target.type.speed = Math.floor(target.type.speed * (1 + 0.05 * (lvl - 1)));
    target.type.piercing = WEAPON_TYPES[target.key].piercing + Math.floor((lvl - 1) * 0.5);
    if (!WEAPON_TYPES[target.key].aura) {
      target.type.projectileSize = WEAPON_TYPES[target.key].projectileSize + (lvl - 1);
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
      aura: type.aura,
      level: w.level || 1
    };

    const proj = this.projectilePool.get();
    proj.x = px;
    proj.y = py;
    proj.body.reset(px, py);
    // Re-init weapon properties on pooled object
    proj.weaponTypeKey = weaponKey;
    proj.color = type.color;
    proj.damage = stats.damage;
    proj.piercing = stats.piercing;
    proj.range = stats.range;
    proj.aoe = stats.aoe;
    proj.aura = stats.aura;
    proj.melee = stats.melee;
    proj._speed = stats.speed;
    proj._direction = direction;
    proj._projSize = (WEAPON_TYPES[weaponKey].projectileSize || 6) + 3;
    proj.body.setCircle(Math.max(2, proj._projSize), 0, 0);
    proj.setActive(true);
    proj.setVisible(true);
    proj.body.enable = true;
    this._activeProjectiles.push(proj);

    if (this.audioManager) this.audioManager.playWeaponFire(weaponKey);
  }

  _findNearestEnemy(maxRange) {
    if (!this.enemies.length) return null;

    const px = this.player.x;
    const py = this.player.y;
    const nearby = this.spatialGrid.query(px, py, maxRange);

    let nearest = null;
    let minDist = maxRange * maxRange;

    for (const enemy of nearby) {
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
    const nearby = this.spatialGrid.query(data.x, data.y, data.range);
    for (const enemy of nearby) {
      if (!enemy || !enemy.active) continue;
      if (enemy === data.exclude) continue;
      enemy.takeDamage(data.damage);
    }
  }

  _explosionOnKill(x, y) {
    const explosionRange = 80;
    const explosionDamage = 15;

    // Visual: explosion ring
    const g = this.add.graphics();
    g.fillStyle(0xff6600, 0.4);
    g.fillCircle(x, y, explosionRange);
    g.setDepth(20);
    this.tweens.add({
      targets: g,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 300,
      onComplete: () => g.destroy()
    });

    // Damage nearby enemies
    for (const enemy of this.enemies) {
      if (!enemy || !enemy.active) continue;
      const dx = enemy.x - x;
      const dy = enemy.y - y;
      if (dx * dx + dy * dy < explosionRange * explosionRange) {
        enemy.takeDamage(explosionDamage);
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

    // Add screen-edge indicator for bosses
    if (typeKey === 'golem' || typeKey === 'demon') {
      this.screenEdgeIndicators.addIndicator(enemy, 'boss');
    }
  }

  // ── Collision Handlers ──

  _onPlayerHitEnemy(enemy) {
    if (!enemy || !enemy.active) return;
    if (!enemy.canDamagePlayer()) return;
    if (this.upgradeSystem.paused) return; // No damage during level-up

    const damage = enemy.damage;
    const actual = this.player.takeDamage(damage);

    enemy.startDamageCooldown();

    // Thorns: reflect damage back to enemy
    if (this.player.stats.thorns > 0 && enemy.active) {
      const reflectDamage = actual * this.player.stats.thorns;
      enemy.takeDamage(reflectDamage);
    }

    if (this.audioManager) this.audioManager.playPlayerHurt();
    if (this.particleSystem) this.particleSystem.emitHit(this.player.x, this.player.y, 0xff4444);

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

    // Particle + audio feedback
    if (this.particleSystem) this.particleSystem.emitHit(enemy.x, enemy.y, proj.color || 0x88ccff);
    if (this.audioManager) this.audioManager.playHit();

    // Only Weapon class projectiles handle hits
    if (typeof proj.onHitEnemy === 'function') {
      proj.onHitEnemy(enemy);
    }
  }

  _spawnXPOrb(x, y, value) {
    const orb = this.xpOrbPool.get();
    orb.x = x;
    orb.y = y;
    orb.body.reset(x, y);
    orb.value = value;
    orb._radius = value >= 20 ? 8 : value >= 10 ? 6 : 4;
    orb.body.setCircle(orb._radius, 0, 0);
    orb.setActive(true);
    orb.setVisible(true);
    orb.body.enable = true;
    this.xpOrbs.push(orb);
  }

  _onPlayerCollectXP(orb) {
    if (!orb || !orb.active) return;

    orb.collect(this.player);

    if (this.audioManager) this.audioManager.playXPPickup();
    if (this.particleSystem) this.particleSystem.emitXPPickup(orb.x, orb.y);

    // Release orb back to pool
    const idx = this.xpOrbs.indexOf(orb);
    if (idx !== -1) this.xpOrbs.splice(idx, 1);
    this.xpOrbPool.release(orb);

    // Update XP via upgrade system
    this.upgradeSystem.addXP(0); // XP already added in orb.collect()

    if (this.hud) {
      this.hud.updateXP(this.player.xp, this.upgradeSystem.xpToNext, this.player.level);
    }
  }

  _triggerGameOver() {
    if (this.gameOverTriggered) return;
    this.gameOverTriggered = true;

    if (this.audioManager) this.audioManager.playGameOver();

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

    // Record run in meta progression
    const achievementsBefore = [...this.meta.data.achievements];
    const wasHighScore = this.meta.isNewHighScore(stats.score);
    this.meta.recordRun(stats);
    const achievementsAfter = this.meta.data.achievements;
    const newAchievements = achievementsAfter.filter(a => !achievementsBefore.includes(a));
    
    stats.wasHighScore = wasHighScore || stats.score >= this.meta.data.highScore;
    stats.newAchievements = newAchievements;

    this.time.delayedCall(600, () => {
      this.scene.stop('GameScene');
      this.scene.start('GameOverScene', stats);
    });
  }

  // ── Main Update Loop ──

  update(time, delta) {
    if (this.upgradeSystem.paused || this.gameOverTriggered) return;

    this.gameTime += delta;

    // Particle system update
    this.particleSystem.update(delta);

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

    // Rebuild spatial grid each frame
    this.spatialGrid.clear();
    for (const enemy of this.enemies) {
      if (enemy && enemy.active) this.spatialGrid.insert(enemy);
    }
    for (const orb of this.xpOrbs) {
      if (orb && orb.active) this.spatialGrid.insert(orb);
    }

    // Weapons
    this._updateWeapons(time, delta);

    // Update active projectiles — release dead ones to pool
    for (let i = this._activeProjectiles.length - 1; i >= 0; i--) {
      const p = this._activeProjectiles[i];
      if (!p || !p.active) {
        this._activeProjectiles.splice(i, 1);
        if (p) this.projectilePool.release(p);
      } else {
        p.update(time, delta);
      }
    }

    // Update aura weapons — use spatial grid for range check
    for (const aura of this._auraWeapons) {
      if (aura.active) {
        const nearby = this.spatialGrid.query(this.player.x, this.player.y, aura.range);
        for (const enemy of nearby) {
          if (!enemy || !enemy.active) continue;
          if (!enemy._auraTickTime) enemy._auraTickTime = 0;
          enemy._auraTickTime += delta;
          if (enemy._auraTickTime >= 500) {
            enemy._auraTickTime = 0;
            const dmg = aura.damage * this.player.stats.damageMultiplier;
            enemy.takeDamage(dmg);
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
        // Apply timeSlow from player passive items
        if (this.player.stats.timeSlow > 0 && !enemy.isBoss) {
          const timeMultiplier = 1 - this.player.stats.timeSlow;
          enemy.update(time, delta, this.player, timeMultiplier);
        } else {
          enemy.update(time, delta, this.player, 1);
        }
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

    // Update screen-edge indicators
    this.screenEdgeIndicators.update();

    // HUD updates
    if (this.hud) {
      this.hud.updateScore(this.score);
      this.hud.updateKills(this.killCount);
      this.hud.updateEnemyCount(this.enemies.length);
    }

    // Minimap
    if (this.minimap) this.minimap.update();

    // ── Wave/Boss System ──
    this._updateWaveSystem(time, delta);
  }

  _updateWaveSystem(time, delta) {
    const ws = this.waveSystem;
    ws.waveTimer += delta;

    // New wave every 60 seconds
    if (ws.waveTimer - ws.lastWaveTime >= ws.waveInterval) {
      ws.lastWaveTime = ws.waveTimer;
      ws.currentWave++;

      // Show wave announcement
      this._showWaveAnnouncement(ws.currentWave);

      // Extra enemy burst for wave
      const extraSpawns = 3 + ws.currentWave;
      for (let i = 0; i < extraSpawns; i++) {
        this._spawnEnemy();
      }
    }

    // Boss wave every 2 minutes (waves 2, 4, 6, ...)
    if (ws.waveTimer >= ws.bossWaveInterval && !ws.bossActive) {
      if (Math.floor(ws.waveTimer / ws.bossWaveInterval) > Math.floor((ws.waveTimer - delta) / ws.bossWaveInterval)) {
        this._spawnBoss();
      }
    }
  }

  _showWaveAnnouncement(waveNum) {
    const text = this._waveText;
    text.setText(`Wave ${waveNum}`);
    text.setAlpha(1);

    this.tweens.add({
      targets: text,
      alpha: 0,
      duration: 2000,
      delay: 1000,
      ease: 'Power2'
    });
  }

  _spawnBoss() {
    const bossTypes = ['necromancer', 'dragon', 'giant'];
    const bossType = bossTypes[Math.floor(Math.random() * bossTypes.length)];

    const angle = Math.random() * Math.PI * 2;
    const dist = 500;
    const x = this.player.x + Math.cos(angle) * dist;
    const y = this.player.y + Math.sin(angle) * dist;

    const boss = new Boss(this, x, y, bossType);

    // Scale HP with game time
    const hpScale = 1 + this.gameTime / 60000;
    boss.hp = Math.floor(boss.hp * hpScale);
    boss.maxHp = boss.hp;

    this.enemyGroup.add(boss);
    this.enemies.push(boss);
    this.waveSystem.bossActive = true;

    // Show boss warning
    this._bossWarningText.setText(`⚠ BOSS: ${boss.bossName} ⚠`);
    this._bossWarningText.setAlpha(1);
    this.tweens.add({
      targets: this._bossWarningText,
      alpha: 0,
      duration: 3000,
      delay: 1000,
      ease: 'Power2'
    });

    // Listen for boss death to clear flag
    const bossRef = boss;
    this.time.delayedCall(100, () => {
      if (!bossRef || !bossRef.active) {
        this.waveSystem.bossActive = false;
        return;
      }
      const check = this.time.addEvent({
        delay: 500,
        loop: true,
        callback: () => {
          if (!bossRef.active) {
            this.waveSystem.bossActive = false;
            check.destroy();
          }
        }
      });
    });
  }
}
