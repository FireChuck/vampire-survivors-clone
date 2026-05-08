// GameScene.js — Main gameplay scene (Orchestrator)
// Delegates to managers: BiomeManager, WeaponManager, SpawnManager, CollisionManager

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  init(data) {
    this._incomingData = data || {};
  }

  create() {
    // Physics groups
    this.enemyGroup = this.physics.add.group({ runChildUpdate: false });
    this.projectileGroup = this.physics.add.group({ runChildUpdate: false });
    this.xpOrbGroup = this.physics.add.group({ runChildUpdate: false });
    this.chestGroup = this.physics.add.group({ runChildUpdate: false });
    this.speedBuffGroup = this.physics.add.group({ runChildUpdate: false });
    this.speedBuffs = [];

    // Speed buff spawning timer (every 30s)
    this._speedBuffTimer = 0;
    this._speedBuffInterval = 30000;

    // Input
    this.inputManager = new InputManager(this);

    // Player
    this.player = new Player(this, 400, 300);

    // Apply character selection data
    if (this._incomingData.characterStats) {
      const cs = this._incomingData.characterStats;
      this.player.maxHp = cs.maxHp;
      this.player.hp = cs.maxHp;
      this.player.speed = cs.speed;
      this.player.damage = cs.damage;
      this.player.pickupRange = cs.pickupRange;
      this.player.attackSpeed = cs.attackSpeed;
      this.player.stats.speed = cs.speed;
      this.player.stats.maxHp = cs.maxHp;
      // Character-specific stats
      if (cs.abilityDamageMultiplier) {
        this.player.abilityDamageMultiplier = cs.abilityDamageMultiplier;
      }
      if (cs.critChance !== undefined) {
        this.player.critChance = cs.critChance;
      }
      // Store character color for visual
      this.player._charColor = this._incomingData.characterColor || 0x4488ff;
      this.player._charHighlight = this._incomingData.characterHighlight || 0x88bbff;
      this._characterId = this._incomingData.characterId || 'default';
    } else {
      this._characterId = 'default';
    }

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

    // QoL Systems
    this.screenShake = new ScreenShake(this);
    this.damageNumbers = new DamageNumbers(this);

    // Ability System
    this.abilitySystem = new AbilitySystem(this, this.player);
    this.player.abilitySystem = this.abilitySystem;

    // Crit System
    this.critSystem = new CritSystem(this);
    // Apply character crit chance
    this.critSystem.applyStats({ critChance: this.player.critChance });

    // Performance Systems — larger cell size on mobile for less overhead
    this.spatialGrid = new SpatialGrid(window.IS_MOBILE ? 256 : 128, GAME_CONFIG.worldWidth, GAME_CONFIG.worldHeight);

    // Object pools
    this.projectilePool = new ObjectPool(
      () => {
        const p = new Weapon(this, -9999, -9999, 'staff', { x: 0, y: 0 }, WEAPON_TYPES.staff);
        this.projectileGroup.add(p);
        return p;
      },
      (obj) => {
        if (obj.body) obj.body.reset(-9999, -9999);
        obj._hitCount = 0;
        obj._piercedEnemies = [];
        // Hide ghost graphics when returning to pool
        if (obj._graphics) {
          obj._graphics.clear();
          obj._graphics.setPosition(-9999, -9999);
          obj._graphics.setVisible(false);
        }
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

    // Minimap — skip on mobile to save GPU cycles
    this.minimap = window.IS_MOBILE ? null : new Minimap(this);

    // Stress test mode
    this._stressTest = this._incomingData?.stressTest || false;

    // FPS counter — prominent when stress test
    const fpsFontSize = this._stressTest ? '20px' : '12px';
    const fpsColor = this._stressTest ? '#00ff00' : '#ffff00';
    this._fpsText = this.add.text(8, 8, '', {
      fontSize: fpsFontSize, fill: fpsColor, fontFamily: 'monospace',
      backgroundColor: '#000000', padding: { x: 6, y: 3 }
    });
    this._fpsText.setScrollFactor(0);
    this._fpsText.setDepth(1001);
    this._fpsFrames = 0;
    this._fpsLast = 0;
    this._fpsValue = 0;

    // FPS bar (stress test mode — centered at top)
    if (this._stressTest) {
      this._fpsBarBg = this.add.rectangle(this.scale.width / 2, 16, 200, 24, 0x333333, 0.8)
        .setScrollFactor(0).setDepth(1002);
      this._fpsBarFill = this.add.rectangle(
        this.scale.width / 2 - 100 + 2, 16, 196, 20, 0x00ff00, 0.9
      ).setScrollFactor(0).setDepth(1003).setOrigin(0, 0.5);
      this._fpsBarText = this.add.text(this.scale.width / 2, 16, '', {
        fontSize: '16px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(1004);
    }

    // ── Managers ──
    this.weaponManager = new WeaponManager(this, this.player);
    const startWeapon = this._incomingData.startWeapon || 'staff';
    this.weaponManager.addWeapon(startWeapon);

    this.spawnManager = new SpawnManager(this);

    // Synergy System (needs abilitySystem + weaponManager)
    this.synergySystem = new SynergySystem(this, this.abilitySystem, this.weaponManager);

    // Evolution System (weapon merging at max level)
    this.evolutionSystem = new EvolutionSystem(this);

    this.biomeManager = new BiomeManager(this);

    // Environmental Hazards System
    this.hazardSystem = new HazardSystem(this);

    // Bestiary System (enemy codex tracking)
    this.bestiarySystem = new BestiarySystem(this);

    // Combo System (multiplier-based kill chain)
    this.comboSystem = new ComboSystem(this);

    // Pet System (orbiting companions)
    this.petSystem = new PetSystem(this);
    this.magnetSystem = new MagnetSystem(this);

    // AutoPlay System (bot control via ?autoplay=true)
    this.autoPlay = new AutoPlaySystem(this);

    this.collisionManager = new CollisionManager(this);
    this.collisionManager.setupCollisions();
    this.collisionManager.setupEventListeners();

    // Screen-Edge Indicators
    this.screenEdgeIndicators = new ScreenEdgeIndicators(this);

    // Audio
    this.audioManager = new AudioManager(this);

    // Achievement Toast System
    this.achievementToast = new AchievementToast(this);

    // Achievement System — real-time tracking
    this.achievementSystem = new AchievementSystem(this);
    this.achievementSystem.init();

    // Performance Overlay (FPS Benchmark)
    this.performanceOverlay = new PerformanceOverlay(this);

    // ── Special Events System ──
    this._specialEvent = {
      active: false,
      type: null,
      timer: 0,
      nextEventIn: 120000, // First event after 2 minutes
      duration: 30000,     // Events last 30 seconds
      announcementAlpha: 0
    };
    this._eventOverlay = this.add.rectangle(
      this.scale.width / 2, this.scale.height / 2,
      this.scale.width, this.scale.height, 0x000000, 0
    ).setScrollFactor(0).setDepth(49);
    this._eventAnnouncement = this.add.text(this.scale.width / 2, 80, '', {
      fontSize: '22px', fontFamily: 'Arial, sans-serif', color: '#ffffff',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51).setAlpha(0);

    // Particle System
    this.particleSystem = new ParticleSystem(this);
    // Force low particle quality on mobile (belt-and-suspenders with constructor)
    if (window.IS_MOBILE) {
      this.particleSystem.setQuality('low');
    }

    // Vignette System (low HP warning)
    this.vignetteSystem = new VignetteSystem(this);

    // State
    this.score = 0;
    this.killCount = 0;
    this.enemies = [];
    this.xpOrbs = [];
    this.gameOverTriggered = false;

    // Pickup range indicator
    this._pickupRangeGfx = this.add.graphics().setDepth(3);
    this._pickupRangeVisible = false;

    // Batch rendering for enemies — single Graphics object instead of per-enemy
    this._enemyBatchGraphics = this.add.graphics().setDepth(5);
    Enemy.setBatchGraphics(this._enemyBatchGraphics);

    // T4.1: DPS tracking
    this._totalDamageDealt = 0;
    this._dpsSamples = []; // { time, damage } pairs for rolling DPS calc
    this._lastDpsCalc = 0;

    // T4.1: Items collected tracking
    this._itemsCollected = 0;

    // QoL T4: Extended stat tracking
    this._totalDamageTaken = 0;
    this._abilitiesUsedCount = 0;

    // HUD init
    this.hud.updateHP(this.player.hp, this.player.maxHp);
    this.hud.startTimer();

    // ── Pause System ──
    this.isPaused = false;
    this._pauseOverlay = this.add.rectangle(
      this.scale.width / 2, this.scale.height / 2,
      this.scale.width, this.scale.height, 0x000000, 0.6
    ).setScrollFactor(0).setDepth(200).setVisible(false);
    this._pauseContainer = null; // Will hold pause menu UI

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-P', () => this._togglePause());
      this.input.keyboard.on('keydown-ESC', () => this._togglePause());
      this.input.keyboard.on('keydown-R', () => {
        if (this.isPaused && !this.gameOverTriggered) {
          this.isPaused = false;
          this.physics.world.resume();
          this.time.resume();
          this._closePauseMenu();
          this.scene.stop('GameScene');
          this.scene.start('GameScene', this._incomingData);
        }
      });
      this.input.keyboard.on('keydown-T', () => {
        this._pickupRangeVisible = !this._pickupRangeVisible;
      });
      this.input.keyboard.on('keydown-N', () => {
        if (this.damageNumbers) this.damageNumbers.enabled = !this.damageNumbers.enabled;
      });
      this.input.keyboard.on('keydown-G', () => {
        if (this.screenShake) this.screenShake.enabled = !this.screenShake.enabled;
      });
      this.input.keyboard.on('keydown-N', () => {
        if (this.performanceOverlay) this.performanceOverlay.startBenchmark();
      });
      this.input.keyboard.on('keydown-SHIFT', () => {
        this._autoAimEnabled = !this._autoAimEnabled;
      });
    }

    // ── QoL: Enemy Spawn Warning System ──
    this._spawnWarnings = []; // { x, y, type, timer }
    this._spawnWarningGraphics = this.add.graphics().setDepth(44).setScrollFactor(0);

    // ── QoL: Performance Auto-Adjust ──
    this._perfAutoAdjust = {
      enabled: true,
      particleReduction: 1.0,    // 1.0 = normal, lower = fewer particles
      lowFPSThreshold: 30,
      checkInterval: 3000,
      lastCheck: 0,
      lowFPSDuration: 0,         // accumulated time below threshold
      highFPSDuration: 0,        // accumulated time above threshold
      lowFSTriggerSec: 5,        // 5s below threshold → reduce
      highFSTriggerSec: 10,      // 10s above threshold → restore
      lastToastTime: 0
    };

    // ── QoL: Touch Sensitivity Setting ──
    this._touchSensitivity = 1.0; // 0.5 to 2.0

    // ── Kill Streak System ──
    this._killStreak = { count: 0, lastKillTime: 0, comboTimeout: 2000, scoreBonus: 0 };
    this._streakText = this.add.text(this.scale.width / 2, this.scale.height * 0.25, '', {
      fontSize: '36px', fontFamily: 'Arial, sans-serif', color: '#ffd700',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(55).setAlpha(0);

    // QoL T4: Combo Counter Reset Timer (visual bar under streak text)
    this._comboTimerGfx = this.add.graphics().setScrollFactor(0).setDepth(54);

    // ── QoL: Damage Edge Flash (red vignette on damage) ──
    this._damageFlashAlpha = 0;
    this._damageFlashGfx = this.add.graphics().setScrollFactor(0).setDepth(49);

    // ── QoL: Level-Up Stat Toast ──
    this._statToastText = this.add.text(this.scale.width - 15, 85, '', {
      fontSize: '14px', fontFamily: 'Arial, sans-serif', color: '#44ff44',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
      align: 'right'
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(2001).setAlpha(0);
    this._statToastQueue = [];
    this._statToastActive = false;

    // ── QoL: Auto-Aim Line ──
    this._autoAimEnabled = false;
    this._autoAimGfx = this.add.graphics().setDepth(4);

    // ── QoL: Auto Performance Toast ──
    this._perfToastText = this.add.text(this.scale.width / 2, this.scale.height - 60, '', {
      fontSize: '13px', fontFamily: 'Arial, sans-serif', color: '#ffaa00',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2000).setAlpha(0);

    // ── Boss HP Bar ──
    this._bossBarContainer = this.add.container(this.scale.width / 2, 50).setScrollFactor(0).setDepth(60).setVisible(false);
    this._bossBarNameBg = this.add.rectangle(0, -18, 300, 22, 0x000000, 0.7).setOrigin(0.5);
    this._bossBarName = this.add.text(0, -18, '', {
      fontSize: '14px', fontFamily: 'Arial, sans-serif', color: '#ffd700',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5);
    this._bossBarBg = this.add.rectangle(0, 4, 300, 16, 0x333333, 0.9).setOrigin(0.5);
    this._bossBarFill = this.add.rectangle(0, 4, 300, 16, 0xe94560, 1).setOrigin(0, 0.5);
    this._bossBarFill.setPosition(-150, 4);
    this._bossBarText = this.add.text(0, 4, '', {
      fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);
    this._bossBarContainer.add([this._bossBarNameBg, this._bossBarName, this._bossBarBg, this._bossBarFill, this._bossBarText]);
    this._bossBarContainer.setScale(0.8);
    this._activeBossRef = null;

    // Wave display text
    this._waveText = this.add.text(this.scale.width / 2, 100, '', {
      fontSize: '24px', fontFamily: 'Arial, sans-serif', color: '#ffd700',
      fontStyle: 'bold', stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setScrollFactor(0).setDepth(50).setAlpha(0);

    // Boss warning text
    this._bossWarningText = this.add.text(this.scale.width / 2, 140, '', {
      fontSize: '18px', fontFamily: 'Arial, sans-serif', color: '#ff4444',
      fontStyle: 'bold', stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setScrollFactor(0).setDepth(50).setAlpha(0);

    // ── Start Countdown ──
    this._startCountdownActive = true;
    this.player.setVelocity(0, 0);
    this._doStartCountdown();

    // ── QoL T4: Auto-Pause on Tab Hidden ──
    this._tabPauseOverlay = this.add.text(this.scale.width / 2, this.scale.height / 2, '⏸ PAUSED', {
      fontSize: '48px', fontFamily: 'Arial, sans-serif', color: '#ffffff',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 6
    }).setOrigin(0.5).setScrollFactor(0).setDepth(300).setAlpha(0).setVisible(false);

    this._onVisibilityChange = () => {
      if (window.GAME_CONFIG?.autoPlay) return;
      if (document.hidden && !this.isPaused && !this.gameOverTriggered && !this._startCountdownActive) {
        this._togglePause();
        this._tabPauseOverlay.setVisible(true);
        this._tabPauseOverlay.setAlpha(1);
      } else if (!document.hidden && this._tabPauseOverlay.visible) {
        this._tabPauseOverlay.setVisible(false);
        this._tabPauseOverlay.setAlpha(0);
      }
    };
    document.addEventListener('visibilitychange', this._onVisibilityChange);
  }

  // ── Main Update Loop ──

  update(time, delta) {
    // AutoPlay bot — runs before pause checks so it can handle upgrades
    if (this.autoPlay) this.autoPlay.update(time, delta);

    if (this.isPaused || this._startCountdownActive || this.upgradeSystem.paused || this.gameOverTriggered || this._slowMoActive) return;

    // Particle system
    this.particleSystem.update(delta);

    // Achievement system (real-time checks)
    if (this.achievementSystem) this.achievementSystem.update(delta);

    // Vignette system (low HP warning)
    if (this.vignetteSystem) this.vignetteSystem.update(delta);

    // Player movement
    const move = this.inputManager.getMovementVector();
    this.player.move(move.x, move.y);

    // Ability keyboard input (Q/W/E)
    if (this.abilitySystem) {
      this.abilitySystem.handleKeyboardInput();
    }

    // HP regen HUD update
    if (this.player.stats.hpRegen > 0 && this.hud) {
      this.hud.updateHP(this.player.hp, this.player.maxHp);
    }

    // XP bar
    if (this.hud) {
      this.hud.updateXP(this.player.xp, this.upgradeSystem.xpToNext, this.player.level);
    }

    // Rebuild spatial grid — enemies move every frame, so always rebuild
    // but use optimized clear that skips allocation
    this.spatialGrid.clear();
    for (const enemy of this.enemies) {
      if (enemy && enemy.active) this.spatialGrid.insert(enemy);
    }
    for (const orb of this.xpOrbs) {
      if (orb && orb.active) this.spatialGrid.insert(orb);
    }

    // Weapons
    this.weaponManager.update(time, delta);

    // Ability system
    if (this.abilitySystem) {
      this.abilitySystem.update(time, delta);
    }

    // Synergy system
    if (this.synergySystem) {
      this.synergySystem.update(time, delta);
    }

    // Spawning
    this.spawnManager.update(time, delta);

    // Environmental hazards
    this.hazardSystem.update(time, delta);

    // Combo System update
    if (this.comboSystem) this.comboSystem.update(delta);

    // Pet System update
    if (this.petSystem) this.petSystem.update(time, delta);

    // Update enemies
    const timeFreezeActive = this.abilitySystem && this.abilitySystem.isTimeFreezeActive();
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy || !enemy.active) {
        this.enemies.splice(i, 1);
      } else {
        if (timeFreezeActive) {
          enemy.update(time, delta, this.player, 0);
          continue;
        }
        if (this.player.stats.timeSlow > 0 && !enemy.isBoss) {
          enemy.update(time, delta, this.player, 1 - this.player.stats.timeSlow);
        } else {
          enemy.update(time, delta, this.player, 1);
        }
      }
    }

    // Camera-culling
    const cullDist = GAME_CONFIG.enemyDespawnDistance;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e && e.active) {
        const dx = e.x - this.player.x;
        const dy = e.y - this.player.y;
        if (dx * dx + dy * dy > cullDist * cullDist) {
          e.destroy();
          this.enemies.splice(i, 1);
        }
      }
    }

    // MagnetSystem: pull XP gems toward player
    if (this.magnetSystem) this.magnetSystem.update();

    // Update XP orbs
    for (let i = this.xpOrbs.length - 1; i >= 0; i--) {
      const orb = this.xpOrbs[i];
      if (!orb || !orb.active) {
        this.xpOrbs.splice(i, 1);
      } else {
        orb.attractTo(this.player);
      }
    }

    // Update chests
    this.spawnManager.updateChests(time, delta);

    // Screen-edge indicators
    this.screenEdgeIndicators.update();

    // HUD updates
    if (this.hud) {
      this.hud.updateScore(this.score);
      this.hud.updateKills(this.killCount);
      this.hud.updateEnemyCount(this.enemies.length);
    }

    // Special Events System
    this._updateSpecialEvents(time, delta);

    // ── Kill Streak QoL ──

    // Batch render all enemies into single Graphics object
    this._renderEnemyBatch(delta);

    // Pickup range indicator (toggle with T)
    if (this._pickupRangeVisible && this.player && this.player.active) {
      this._pickupRangeGfx.clear();
      this._pickupRangeGfx.lineStyle(1, 0x44aaff, 0.4);
      this._pickupRangeGfx.strokeCircle(this.player.x, this.player.y, this.player.pickupRange);
      this._pickupRangeGfx.fillStyle(0x44aaff, 0.06);
      this._pickupRangeGfx.fillCircle(this.player.x, this.player.y, this.player.pickupRange);
    } else if (!this._pickupRangeVisible) {
      this._pickupRangeGfx.clear();
    }

    // FPS counter
    this._fpsFrames++;
    if (time - this._fpsLast >= 1000) {
      this._fpsValue = this._fpsFrames;
      this._fpsFrames = 0;
      this._fpsLast = time;
    }
    const entityCount = this.enemies.length + this.xpOrbs.length + this.weaponManager.activeProjectiles.length;
    if (this._fpsText && this._fpsText.active) {
      this._fpsText.setText(`FPS: ${this._fpsValue} | Entities: ${entityCount}`);
    }
    if (this._stressTest && this._fpsBarFill) {
      const fpsRatio = Math.min(1, this._fpsValue / 60);
      this._fpsBarFill.width = Math.max(0, 196 * fpsRatio);
      if (this._fpsValue >= 30) this._fpsBarFill.setFillStyle(0x00ff00);
      else if (this._fpsValue >= 20) this._fpsBarFill.setFillStyle(0xffaa00);
      else this._fpsBarFill.setFillStyle(0xff0000);
      this._fpsBarText.setText(`${this._fpsValue} FPS | ${entityCount} entities`);
    }

    if (this.minimap) this.minimap.update();

    // Performance overlay tick (lightweight — just frame counter)
    if (this.performanceOverlay) this.performanceOverlay.tick(time);

    // T4.2: Auto-save every 30 seconds with toast
    if (!this._lastAutoSave) this._lastAutoSave = 0;
    if (time - this._lastAutoSave > 30000) {
      this._lastAutoSave = time;
      if (this.meta && this.hud) {
        this.meta.saveWithFeedback({ toastCallback: (success, msg) => {
          this.hud.showSaveIndicator(success);
        }});
      }
    }

    // QoL updates
    this._updateBossHPBar();
    this._updatePickupRadius();
    this._updatePickupRadiusIndicator();
    this._updateComboResetTimer();
    this._updateSpawnWarnings(delta);
    this._updatePerformanceAutoAdjust(time);
    this._updateDamageFlash(delta);
    this._updateAutoAimLine();
    this._processStatToastQueue();

    // QoL: Clear damage direction indicators each frame
    if (this.hud) this.hud.clearDamageDirections();

    // QoL: XP level preview
    if (this.hud) {
      this.hud.updateXPPreview(this.player.xp, this.upgradeSystem.xpToNext, this.player.level);
    }
  }

  /** Called by Enemy.js on death — grants XP and triggers level-up */
  recordKill(enemy) {
    const xp = (enemy && enemy.xpValue) || 1;
    this.upgradeSystem.addXP(xp);
  }

  // ── T4.1: DPS Tracking ──

  recordDamage(amount) {
    this._totalDamageDealt += amount;
    this._dpsSamples.push({ time: this.hud ? this.hud.getElapsedTime() : 0, damage: amount });
  }

  getDPS() {
    const now = this.hud ? this.hud.getElapsedTime() : 0;
    const windowSec = 10; // rolling 10-second window
    // Remove old samples
    this._dpsSamples = this._dpsSamples.filter(s => now - s.time < windowSec);
    const totalInWindow = this._dpsSamples.reduce((sum, s) => sum + s.damage, 0);
    // Effective window (might be less than 10s at start)
    const effectiveTime = Math.min(now, windowSec);
    return effectiveTime > 0 ? totalInWindow / effectiveTime : 0;
  }

  // ── T4.1: Slow-Mo Death Effect ──

  _doSlowMoDeath(callback) {
    // Slow down game to 20% speed for visual effect, but keep timers at real speed
    this._slowMoActive = true;
    this.physics.world.timeScale = 0.2;

    // Red vignette
    const vignette = this.add.rectangle(
      this.scale.width / 2, this.scale.height / 2,
      this.scale.width, this.scale.height, 0xff0000, 0
    ).setScrollFactor(0).setDepth(300);

    this.tweens.add({
      targets: vignette,
      alpha: 0.3,
      duration: 300
    });

    // Use raw setTimeout instead of this.time.delayedCall because
    // gameOverTriggered=true causes update() to return early, which
    // can prevent Phaser's clock from advancing and firing delayed calls.
    const self = this;
    setTimeout(() => {
      try {
        self.physics.world.timeScale = 1;
        self._slowMoActive = false;

        let callbackFired = false;
        const doCallback = () => {
          if (callbackFired) return;
          callbackFired = true;
          try { vignette.destroy(); } catch(e) {}
          if (callback) callback();
        };

        self.cameras.main.fadeOut(600, 0, 0, 0);
        self.cameras.main.once('camerafadeoutcomplete', doCallback);
        setTimeout(doCallback, 1200);
      } catch(e) {
        console.warn('_doSlowMoDeath callback error:', e);
        // Last resort: just do the callback
        try { vignette.destroy(); } catch(e2) {}
        if (callback) callback();
      }
    }, 1500);
  }

  // ── QoL: Auto-Pickup Radius (scales with level + pickup upgrades) ──

  _updatePickupRadius() {
    // Base 60 + level scaling (diminishing returns per level)
    const levelBonus = Math.floor(this.player.level * 5);
    // Additional scaling: every 10 levels gives a big boost
    const milestoneBonus = Math.floor(this.player.level / 10) * 15;
    this.player.pickupRange = 60 + levelBonus + milestoneBonus;
  }

  // ── QoL T4: Pickup Radius Visual Indicator ──

  _updatePickupRadiusIndicator() {
    if (!this._pickupRadiusGfx) {
      this._pickupRadiusGfx = this.add.graphics().setDepth(3);
    }
    const g = this._pickupRadiusGfx;
    g.clear();
    const px = this.player.x;
    const py = this.player.y;
    const r = this.player.pickupRange;
    const alpha = 0.15 + 0.05 * Math.sin(Date.now() / 800);
    g.lineStyle(1.5, 0x00ffff, alpha);
    g.strokeCircle(px, py, r);
  }

  // ── Stress Test Mode ──

  _doStressTestBurst() {
    const savedMax = GAME_CONFIG.maxEnemies;
    GAME_CONFIG.maxEnemies = 500;

    const count = 160;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const dist = 150 + Math.random() * 450;
      const x = this.player.x + Math.cos(angle) * dist;
      const y = this.player.y + Math.sin(angle) * dist;

      const typeKeys = Object.keys(ENEMY_TYPES);
      const typeKey = typeKeys[Math.floor(Math.random() * typeKeys.length)];

      const enemy = new Enemy(this, x, y, typeKey);
      enemy.hp = Math.max(enemy.hp, 50);
      enemy.maxHp = enemy.hp;
      this.enemyGroup.add(enemy);
      this.enemies.push(enemy);
    }

    GAME_CONFIG.maxEnemies = savedMax;

    // Keep player alive
    this.player.hp = 999;
    this.player.maxHp = 999;
    if (this.hud) this.hud.updateHP(this.player.hp, this.player.maxHp);

    // Boost weapons for more visual load
    for (const w of this.weaponManager._weapons) {
      w.level = 5;
      w.type = { ...WEAPON_TYPES[w.key] };
      w.type.damage = Math.floor(w.type.damage * 2.5);
      w.type.cooldown = 200;
    }

    // Banner
    const banner = this.add.text(this.scale.width / 2, this.scale.height - 40,
      '🔥 STRESS TEST — 160 Enemies', {
        fontSize: '20px', fontFamily: 'Arial, sans-serif', color: '#ff8800',
        fontStyle: 'bold', stroke: '#000', strokeThickness: 4
      }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
    this.time.delayedCall(5000, () => banner.destroy());
  }

  // ── QoL: Pause System with Menu ──

  _togglePause() {
    if (this.gameOverTriggered) return;
    this.isPaused = !this.isPaused;
    this._pauseOverlay.setVisible(this.isPaused);

    if (this.isPaused) {
      this.physics.world.pause();
      this.time.pause();
      this._showPauseMenu();
    } else {
      this.physics.world.resume();
      this.time.resume();
      this._closePauseMenu();
    }
  }

  _showPauseMenu() {
    if (this._pauseContainer) this._pauseContainer.destroy();

    const scene = this;
    const sw = this.scale.width;
    const sh = this.scale.height;
    this._pauseContainer = this.add.container(0, 0).setDepth(201).setScrollFactor(0);

    // Title
    const title = this.add.text(sw / 2, sh * 0.2, '⏸ PAUSED', {
      fontSize: '42px', fontFamily: 'Arial, sans-serif', color: '#ffffff',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 6
    }).setOrigin(0.5);
    this._pauseContainer.add(title);

    // Menu buttons
    const btnW = 220;
    const btnH = 48;
    const btnGap = 16;
    const startY = sh * 0.35;
    const buttons = [
      { label: '▶ Resume', color: 0x44ff44, action: () => this._togglePause() },
      { label: '📖 Bestiary', color: 0xcc88ff, action: () => { if (this.bestiarySystem) this.bestiarySystem.togglePanel(); } },
      { label: '🔊 Audio Controls', color: 0x4488ff, action: () => this._showAudioControls() },
      { label: '✨ Particle Quality', color: 0x44ffaa, action: () => this._showParticleQualityMenu() },
      { label: '📊 Benchmark', color: 0xffaa00, action: () => {
        if (this.performanceOverlay) this.performanceOverlay.startBenchmark();
        this._togglePause();
      }},
      { label: '🔄 Quick Restart (R)', color: 0xff8844, action: () => {
        this.isPaused = false;
        this.physics.world.resume();
        this.time.resume();
        this._closePauseMenu();
        this.scene.stop('GameScene');
        this.scene.start('GameScene', this._incomingData);
      }},
      { label: '🏠 Quit to Menu', color: 0xff4444, action: () => {
        this.isPaused = false;
        this.physics.world.resume();
        this.time.resume();
        this._closePauseMenu();
        this.scene.stop('GameScene');
        this.scene.start('MenuScene');
      }}
    ];

    buttons.forEach((btn, i) => {
      const y = startY + i * (btnH + btnGap);
      const bg = this.add.rectangle(sw / 2, y, btnW, btnH, 0x2a2a4a, 0.95)
        .setStrokeStyle(2, btn.color)
        .setInteractive({ useHandCursor: true });
      const text = this.add.text(sw / 2, y, btn.label, {
        fontSize: '16px', fontFamily: 'Arial, sans-serif', color: '#ffffff',
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 2
      }).setOrigin(0.5);

      bg.on('pointerover', () => {
        bg.setFillStyle(0x3a3a6a);
        this.tweens.add({ targets: bg, scaleX: 1.05, scaleY: 1.05, duration: 100 });
      });
      bg.on('pointerout', () => {
        bg.setFillStyle(0x2a2a4a);
        this.tweens.add({ targets: bg, scaleX: 1, scaleY: 1, duration: 100 });
      });
      bg.on('pointerdown', btn.action);

      this._pauseContainer.add([bg, text]);
    });

    // Hint
    const hint = this.add.text(sw / 2, sh * 0.85, 'Press P or ESC to resume', {
      fontSize: '14px', fontFamily: 'Arial, sans-serif', color: '#888888',
      stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5);
    this._pauseContainer.add(hint);
  }

  _closePauseMenu() {
    if (this._pauseContainer) {
      this._pauseContainer.destroy();
      this._pauseContainer = null;
    }
  }

  // ── QoL T4: Particle Quality Menu ──

  _showParticleQualityMenu() {
    if (this._pauseContainer) this._pauseContainer.destroy();

    const sw = this.scale.width;
    const sh = this.scale.height;
    this._pauseContainer = this.add.container(0, 0).setDepth(201).setScrollFactor(0);

    const backBtn = this.add.text(20, 20, '← Back', {
      fontSize: '16px', fontFamily: 'Arial, sans-serif', color: '#4488ff',
      fontStyle: 'bold', stroke: '#000', strokeThickness: 2
    }).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this._showPauseMenu());
    backBtn.on('pointerover', () => backBtn.setStyle({ color: '#66aaff' }));
    backBtn.on('pointerout', () => backBtn.setStyle({ color: '#4488ff' }));
    this._pauseContainer.add(backBtn);

    const title = this.add.text(sw / 2, sh * 0.15, '✨ Particle Quality', {
      fontSize: '28px', fontFamily: 'Arial, sans-serif', color: '#ffffff',
      fontStyle: 'bold', stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5);
    this._pauseContainer.add(title);

    const currentQuality = this.particleSystem ? this.particleSystem.getQuality() : 'high';
    const levels = [
      { key: 'low', label: 'Low', desc: 'Fewer particles, better performance', color: 0x44ff44 },
      { key: 'medium', label: 'Medium', desc: 'Balanced visuals and performance', color: 0xffaa00 },
      { key: 'high', label: 'High', desc: 'Maximum visual effects', color: 0xff4444 }
    ];

    levels.forEach((lvl, i) => {
      const y = sh * 0.3 + i * 70;
      const cx = sw / 2;
      const isActive = currentQuality === lvl.key;

      const bg = this.add.rectangle(cx, y, 280, 50, isActive ? 0x3a3a6a : 0x2a2a4a, 0.95)
        .setStrokeStyle(2, isActive ? lvl.color : 0x555555)
        .setInteractive({ useHandCursor: true });
      const name = this.add.text(cx - 100, y - 8, lvl.label, {
        fontSize: '18px', fontFamily: 'Arial, sans-serif', color: isActive ? '#ffffff' : '#aaaaaa',
        fontStyle: 'bold'
      }).setOrigin(0, 0.5);
      const desc = this.add.text(cx - 100, y + 12, lvl.desc, {
        fontSize: '10px', fontFamily: 'Arial, sans-serif', color: '#666666'
      }).setOrigin(0, 0.5);
      const indicator = this.add.text(cx + 120, y, isActive ? '✓' : '', {
        fontSize: '20px', color: lvl.color, fontStyle: 'bold'
      }).setOrigin(0.5);

      bg.on('pointerdown', () => {
        if (this.particleSystem) this.particleSystem.setQuality(lvl.key);
        this._showParticleQualityMenu(); // refresh
      });
      bg.on('pointerover', () => bg.setFillStyle(0x3a3a6a));
      bg.on('pointerout', () => bg.setFillStyle(isActive ? 0x3a3a6a : 0x2a2a4a));

      this._pauseContainer.add([bg, name, desc, indicator]);
    });
  }

  _showAudioControls() {
    if (this._pauseContainer) this._pauseContainer.destroy();

    const sw = this.scale.width;
    const sh = this.scale.height;
    this._pauseContainer = this.add.container(0, 0).setDepth(201).setScrollFactor(0);

    // Back button
    const backBtn = this.add.text(20, 20, '← Back', {
      fontSize: '16px', fontFamily: 'Arial, sans-serif', color: '#4488ff',
      fontStyle: 'bold', stroke: '#000', strokeThickness: 2
    }).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this._showPauseMenu());
    backBtn.on('pointerover', () => backBtn.setStyle({ color: '#66aaff' }));
    backBtn.on('pointerout', () => backBtn.setStyle({ color: '#4488ff' }));
    this._pauseContainer.add(backBtn);

    // Title
    const title = this.add.text(sw / 2, sh * 0.15, '🔊 Audio Controls', {
      fontSize: '28px', fontFamily: 'Arial, sans-serif', color: '#ffffff',
      fontStyle: 'bold', stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5);
    this._pauseContainer.add(title);

    // Sliders
    const self = this;
    const sliders = [
      { label: 'Master Volume', key: 'master', get: () => self.audioManager._volume, set: (v) => self.audioManager.setVolume(v) },
      { label: 'SFX Volume', key: 'sfx', get: () => self.audioManager._sfxVolume, set: (v) => self.audioManager.setSFXVolume(v) },
      { label: 'Music Volume', key: 'music', get: () => self.audioManager._musicVolume, set: (v) => self.audioManager.setMusicVolume(v) }
    ];

    const sliderW = 250;
    const sliderH = 16;
    const sliderGap = 60;
    const sliderStartY = sh * 0.3;

    sliders.forEach((slider, i) => {
      const y = sliderStartY + i * sliderGap;
      const cx = sw / 2;

      // Label
      const lbl = this.add.text(cx, y - 20, slider.label, {
        fontSize: '14px', fontFamily: 'Arial, sans-serif', color: '#cccccc'
      }).setOrigin(0.5);
      this._pauseContainer.add(lbl);

      // Background track
      const track = this.add.rectangle(cx, y + 10, sliderW, sliderH, 0x333333)
        .setStrokeStyle(1, 0x555555);
      this._pauseContainer.add(track);

      // Fill bar
      const val = slider.get();
      const fill = this.add.rectangle(cx - sliderW / 2, y + 10, sliderW * val, sliderH, 0x4488ff)
        .setOrigin(0, 0.5);
      this._pauseContainer.add(fill);

      // Value text
      const valText = this.add.text(cx + sliderW / 2 + 15, y + 10, Math.round(val * 100) + '%', {
        fontSize: '12px', fontFamily: 'monospace', color: '#aaa'
      }).setOrigin(0, 0.5);
      this._pauseContainer.add(valText);

      // Make track interactive
      track.setInteractive({ useHandCursor: true });
      track.on('pointerdown', (pointer) => {
        const localX = pointer.x - (cx - sliderW / 2);
        const ratio = Math.max(0, Math.min(1, localX / sliderW));
        slider.set(ratio);
        fill.width = sliderW * ratio;
        valText.setText(Math.round(ratio * 100) + '%');
      });
      track.on('pointermove', (pointer) => {
        if (!pointer.isDown) return;
        const localX = pointer.x - (cx - sliderW / 2);
        const ratio = Math.max(0, Math.min(1, localX / sliderW));
        slider.set(ratio);
        fill.width = sliderW * ratio;
        valText.setText(Math.round(ratio * 100) + '%');
      });

      // Mute toggle
      const muteText = this.add.text(cx + sliderW / 2 + 55, y + 10, '🔇', {
        fontSize: '18px'
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
      muteText.on('pointerdown', () => {
        const muted = self.audioManager.toggleMute();
        muteText.setText(muted ? '🔇' : '🔊');
      });
      this._pauseContainer.add(muteText);
    });
  }

  // ── QoL: Start Countdown ──

  _doStartCountdown() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const countText = this.add.text(cx, cy, '', {
      fontSize: '72px', fontFamily: 'Arial, sans-serif', color: '#ffffff',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 6
    }).setOrigin(0.5).setScrollFactor(0).setDepth(300);

    const steps = ['3', '2', '1', 'GO!'];
    let idx = 0;

    const showNext = () => {
      if (idx >= steps.length) {
        countText.destroy();
        this._startCountdownActive = false;

        // Stress test: spawn 160 enemies immediately
        if (this._stressTest) {
          this._doStressTestBurst();
        }
        return;
      }
      const step = steps[idx];
      countText.setText(step);
      countText.setAlpha(0);
      countText.setScale(2);

      const color = idx < 3 ? '#ffffff' : '#44ff44';
      countText.setStyle({ color });

      this.tweens.add({
        targets: countText,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 300,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.time.delayedCall(500, showNext);
        }
      });
      idx++;
    };

    showNext();
  }

  // ── QoL: Kill Streak ──

  // ── QoL: Kill Milestone Notifications ──

  _checkKillMilestone(count) {
    var milestones = [100, 500, 1000, 2500, 5000, 10000];
    var prefix = '_killMilestone_';
    for (var i = 0; i < milestones.length; i++) {
      var m = milestones[i];
      if (count === m && !this[prefix + m]) {
        this[prefix + m] = true;
        if (this.achievementToast) {
          this.achievementToast.show('💀 Kill Milestone: ' + m + ' enemies!', 4000);
        }
      }
    }
  }

  _updateKillStreak() {
    const now = this.spawnManager.gameTime;
    if (now - this._killStreak.lastKillTime < this._killStreak.comboTimeout) {
      this._killStreak.count++;
    } else {
      this._killStreak.count = 1;
    }
    this._killStreak.lastKillTime = now;

    const count = this._killStreak.count;
    if (count < 5) return;

    let label = '';
    let color = '#ffffff';
    let bonus = 0;

    if (count >= 25) {
      label = `x${count} GODLIKE!`;
      color = '#ff44ff';
      bonus = 500;
    } else if (count >= 15) {
      label = `x${count} MASSACRE!`;
      color = '#ff4444';
      bonus = 200;
    } else if (count >= 10) {
      label = `x${count} UNSTOPPABLE!`;
      color = '#ff8800';
      bonus = 100;
    } else if (count >= 5) {
      label = `x${count} KILL!`;
      color = '#ffd700';
      bonus = 50;
    }

    if (bonus > 0) {
      this.score += bonus;
      this._killStreak.scoreBonus += bonus;
      // QoL T4: Kill streak sound variations
      if (this.audioManager) {
        this.audioManager.playKillStreak(count);
      }
    }

    this._streakText.setText(label);
    this._streakText.setStyle({ color });
    this._streakText.setAlpha(1);
    this._streakText.setScale(1.2);

    this.tweens.killTweensOf(this._streakText);
    this.tweens.add({
      targets: this._streakText,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 1200,
      delay: 200,
      ease: 'Power2'
    });
  }

  // ── QoL T4: Combo Counter Reset Timer ──

  _updateComboResetTimer() {
    const g = this._comboTimerGfx;
    g.clear();

    const streak = this._killStreak;
    if (streak.count < 5 || this._streakText.alpha <= 0.05) return;

    const now = this.spawnManager.gameTime;
    const elapsed = now - streak.lastKillTime;
    const remaining = Math.max(0, streak.comboTimeout - elapsed);
    const ratio = remaining / streak.comboTimeout;

    // Draw timer bar under streak text
    const barW = 120;
    const barH = 4;
    const barX = this.scale.width / 2 - barW / 2;
    const barY = this.scale.height * 0.25 + 24;

    // Background
    g.fillStyle(0x222222, 0.7);
    g.fillRect(barX, barY, barW, barH);

    // Fill — color changes from green to red as time runs out
    const r = ratio > 0.5 ? 0x44ff44 : ratio > 0.25 ? 0xffaa00 : 0xff4444;
    g.fillStyle(r, 0.9);
    g.fillRect(barX, barY, barW * ratio, barH);
  }

  // ── QoL: Boss HP Bar ──

  _showBossHPBar(boss) {
    this._activeBossRef = boss;
    this._bossBarContainer.setVisible(true);
    this._bossBarName.setText(`⚔ ${boss.bossName}`);
    this._bossBarContainer.setScale(0.8);
    this._bossBarContainer.setAlpha(0);

    this.tweens.add({
      targets: this._bossBarContainer,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 400,
      ease: 'Back.easeOut'
    });
  }

  _hideBossHPBar() {
    this._activeBossRef = null;
    this.tweens.add({
      targets: this._bossBarContainer,
      scaleX: 0.8,
      scaleY: 0.8,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        this._bossBarContainer.setVisible(false);
      }
    });
  }

  _updateBossHPBar() {
    const boss = this._activeBossRef;
    if (!boss || !boss.active) {
      if (this._bossBarContainer.visible) this._hideBossHPBar();
      return;
    }
    const ratio = Math.max(0, boss.hp / boss.maxHp);
    const barWidth = 300 * ratio;
    this._bossBarFill.width = Math.max(0, barWidth);
    this._bossBarText.setText(`${Math.ceil(boss.hp)} / ${boss.maxHp}`);

    if (ratio > 0.5) this._bossBarFill.setFillStyle(0xe94560);
    else if (ratio > 0.25) this._bossBarFill.setFillStyle(0xff8800);
    else this._bossBarFill.setFillStyle(0xff2222);
  }

  // ── Special Events System ──

  _updateSpecialEvents(time, delta) {
    const evt = this._specialEvent;

    if (evt.active) {
      evt.timer -= delta;

      // Check for Blood Moon effects
      if (evt.type === 'blood_moon') {
        for (const enemy of this.enemies) {
          if (enemy && enemy.active) {
            enemy.speedMultiplier = 1.4;
            enemy.damageMultiplier = 1.5;
          }
        }
      }

      // Check for Golden Hour effects
      if (evt.type === 'golden_hour') {
        this.player.stats.xpMultiplier = 2.0;
      }

      // Flash announcement near end
      if (evt.timer < 3000 && evt.announcementAlpha > 0) {
        this.tweens.add({
          targets: this._eventAnnouncement,
          alpha: 0,
          duration: 500
        });
        evt.announcementAlpha = 0;
      }

      if (evt.timer <= 0) {
        this._endSpecialEvent();
      }
      return;
    }

    // Count down to next event
    evt.nextEventIn -= delta;
    if (evt.nextEventIn <= 0) {
      this._triggerSpecialEvent();
    }
  }

  _triggerSpecialEvent() {
    const evt = this._specialEvent;
    const eventTypes = ['blood_moon', 'golden_hour'];
    evt.type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    evt.active = true;
    evt.timer = evt.duration;
    evt.nextEventIn = 120000 + Math.random() * 60000; // 2-3 minutes between events

    if (evt.type === 'blood_moon') {
      this._eventOverlay.setFillStyle(0xff0000, 0.12);
      this._eventAnnouncement.setText('🩸 BLOOD MOON — Enemies grow stronger!');
      this._eventAnnouncement.setStyle({ color: '#ff4444' });

      // Screen tint
      this.tweens.add({
        targets: this._eventOverlay,
        alpha: 1,
        duration: 1000,
        yoyo: true,
        hold: 500,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    } else if (evt.type === 'golden_hour') {
      this._eventOverlay.setFillStyle(0xffd700, 0.08);
      this._eventAnnouncement.setText('✨ GOLDEN HOUR — Double XP!');
      this._eventAnnouncement.setStyle({ color: '#ffd700' });

      this.tweens.add({
        targets: this._eventOverlay,
        alpha: 1,
        duration: 1500,
        yoyo: true,
        hold: 300,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }

    // Show announcement
    this._eventAnnouncement.setAlpha(0);
    this._eventAnnouncement.setScale(1.3);
    evt.announcementAlpha = 1;

    this.tweens.add({
      targets: this._eventAnnouncement,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 500,
      ease: 'Back.easeOut'
    });

    // Screen shake for dramatic effect
    this.cameras.main.shake(300, 0.015);
  }

  _endSpecialEvent() {
    const evt = this._specialEvent;
    evt.active = false;
    evt.type = null;

    // Reset modifiers
    for (const enemy of this.enemies) {
      if (enemy && enemy.active) {
        enemy.speedMultiplier = 1;
        enemy.damageMultiplier = 1;
      }
    }
    this.player.stats.xpMultiplier = 1;

    // Clear overlay
    this.tweens.killTweensOf(this._eventOverlay);
    this.tweens.killTweensOf(this._eventAnnouncement);

    this.tweens.add({
      targets: [this._eventOverlay, this._eventAnnouncement],
      alpha: 0,
      duration: 500,
      onComplete: () => {
        this._eventOverlay.setAlpha(0);
      }
    });
  }

  // ── Achievement Toast Integration ──

  _checkAndShowAchievements(statsBefore) {
    const statsAfter = [...this.meta.data.achievements];
    const newOnes = statsAfter.filter(a => !statsBefore.includes(a));

    if (newOnes.length === 0) return;

    const allInfo = this.meta.getAchievementInfo();
    for (const id of newOnes) {
      const info = allInfo.find(a => a.id === id);
      if (info) {
        this.achievementToast.show('🏅', info.name, info.desc);
      }
    }
  }

  /** Batch-render all enemies into a single Graphics object (1 draw call vs N) */
  _renderEnemyBatch(delta) {
    const gfx = this._enemyBatchGraphics;
    if (!gfx) return;
    gfx.clear();

    // Viewport culling bounds (with margin)
    const cam = this.cameras.main;
    const margin = 100;
    const viewLeft = cam.scrollX - margin;
    const viewRight = cam.scrollX + cam.width + margin;
    const viewTop = cam.scrollY - margin;
    const viewBottom = cam.scrollY + cam.height + margin;

    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e || !e.active) continue;

      // Viewport culling — skip enemies far off-screen
      if (e.x < viewLeft || e.x > viewRight || e.y < viewTop || e.y > viewBottom) continue;

      // Flash timer countdown
      if (e._flashTimer > 0) {
        e._flashTimer -= delta;
        if (e._flashTimer > 0) {
          // Draw white flash rectangle
          gfx.fillStyle(0xffffff, 0.9);
          gfx.fillRect(e.x - e.size[0] / 2, e.y - e.size[1] / 2, e.size[0], e.size[1]);
          continue;
        }
      }

      e._drawVisual(gfx);
    }
  }

  // ── QoL: Enemy Spawn Warning ──

  addSpawnWarning(x, y, type) {
    if (this._spawnWarnings.length >= 10) return;
    this._spawnWarnings.push({ x, y, type, timer: 1500 });
  }

  _updateSpawnWarnings(delta) {
    const g = this._spawnWarningGraphics;
    g.clear();

    for (let i = this._spawnWarnings.length - 1; i >= 0; i--) {
      const w = this._spawnWarnings[i];
      w.timer -= delta;
      if (w.timer <= 0) {
        this._spawnWarnings.splice(i, 1);
        continue;
      }

      // Convert world pos to screen pos
      const cam = this.cameras.main;
      const screenX = w.x - cam.scrollX;
      const screenY = w.y - cam.scrollY;
      const sw = this.scale.width;
      const sh = this.scale.height;

      // Only show if near screen edge (not on-screen)
      const margin = 80;
      if (screenX > margin && screenX < sw - margin && screenY > margin && screenY < sh - margin) {
        continue;
      }

      // Clamp to screen edge
      const clampX = Math.max(30, Math.min(sw - 30, screenX));
      const clampY = Math.max(30, Math.min(sh - 30, screenY));

      // Pulsing warning indicator
      const alpha = 0.4 + 0.3 * Math.sin(Date.now() * 0.008);
      const color = w.type === 'boss' ? 0xff2222 : w.type === 'elite' ? 0xff8800 : 0xff4444;
      const size = w.type === 'boss' ? 10 : 6;

      // Draw warning exclamation
      g.fillStyle(color, alpha);
      g.fillCircle(clampX, clampY, size);
      g.fillStyle(0xffffff, alpha);
      g.fillRect(clampX - 1, clampY - size * 0.5, 2, size * 0.4);

      // Flash effect: expanding ring
      const ringProgress = 1 - (w.timer / 1500);
      const ringAlpha = Math.max(0, 0.5 * (1 - ringProgress));
      g.lineStyle(2, color, ringAlpha);
      g.strokeCircle(clampX, clampY, size + ringProgress * 20);
    }
  }

  // ── QoL: Performance Auto-Adjust ──

  _updatePerformanceAutoAdjust(time) {
    if (!this._perfAutoAdjust.enabled) return;
    if (time - this._perfAutoAdjust.lastCheck < this._perfAutoAdjust.checkInterval) return;
    this._perfAutoAdjust.lastCheck = time;

    const adj = this._perfAutoAdjust;

    if (this._fpsValue < adj.lowFPSThreshold) {
      adj.lowFPSDuration += adj.checkInterval / 1000;
      adj.highFPSDuration = 0; // reset recovery counter

      if (adj.lowFPSDuration >= adj.lowFSTriggerSec) {
        adj.particleReduction = Math.max(0.2, adj.particleReduction - 0.2);
        if (this.particleSystem) {
          this.particleSystem._maxActive = Math.max(100, Math.floor(500 * adj.particleReduction));
        }
        adj.lowFPSDuration = 0;
        this._showPerfToast('⚠️ Performance: Particles reduced', '#ffaa00');
      }
    } else if (this._fpsValue >= 50 && adj.particleReduction < 1.0) {
      adj.highFPSDuration += adj.checkInterval / 1000;

      if (adj.highFPSDuration >= adj.highFSTriggerSec) {
        adj.particleReduction = Math.min(1.0, adj.particleReduction + 0.1);
        if (this.particleSystem) {
          this.particleSystem._maxActive = Math.floor(500 * adj.particleReduction);
        }
        adj.highFPSDuration = 0;
        this._showPerfToast('✅ Performance: Particles restored', '#44ff44');
      }
    } else {
      adj.lowFPSDuration = 0;
      adj.highFPSDuration = 0;
    }
  }

  // ── QoL: Touch Sensitivity ──
  setTouchSensitivity(value) {
    this._touchSensitivity = Math.max(0.5, Math.min(2.0, value));
    if (this.inputManager) {
      this.inputManager._sensitivityMultiplier = this._touchSensitivity;
    }
  }

  // ── QoL: Damage Edge Flash (red vignette on damage) ──

  triggerDamageFlash() {
    this._damageFlashAlpha = 0.6; // strong initial flash
  }

  _updateDamageFlash(delta) {
    const g = this._damageFlashGfx;
    g.clear();

    if (this._damageFlashAlpha <= 0.005) return;

    // Fade out over 200ms
    this._damageFlashAlpha = Math.max(0, this._damageFlashAlpha - delta * 0.003);

    const sw = this.scale.width;
    const sh = this.scale.height;
    const layers = 6;

    for (let i = 0; i < layers; i++) {
      const t = i / layers;
      const inset = t * Math.min(sw, sh) * 0.3;
      const alpha = this._damageFlashAlpha * (1 - t) * (1 - t);
      g.fillStyle(0xff0000, alpha);
      g.fillRect(inset, inset, sw - inset * 2, sh - inset * 2);
    }
  }

  // ── QoL: Level-Up Stat Toast ──

  showStatToast(text) {
    this._statToastQueue.push(text);
    if (!this._statToastActive) {
      this._processStatToastQueue();
    }
  }

  _processStatToastQueue() {
    if (this._statToastQueue.length === 0) {
      this._statToastActive = false;
      return;
    }

    this._statToastActive = true;
    const text = this._statToastQueue.shift();

    this._statToastText.setText(text);
    this._statToastText.setAlpha(0);
    this._statToastText.setY(this._statToastText.y - 5);

    this.tweens.add({
      targets: this._statToastText,
      alpha: 1,
      y: this._statToastText.y + 5,
      duration: 250,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(2500, () => {
          this.tweens.add({
            targets: this._statToastText,
            alpha: 0,
            y: this._statToastText.y - 10,
            duration: 300,
            ease: 'Sine.easeIn',
            onComplete: () => {
              this._processStatToastQueue();
            }
          });
        });
      }
    });
  }

  // ── QoL: Auto-Aim Line ──

  _updateAutoAimLine() {
    const g = this._autoAimGfx;
    g.clear();

    if (!this._autoAimEnabled || !this.player || !this.weaponManager) return;

    // Find the weapon's nearest target
    const weapons = this.weaponManager._weapons;
    if (weapons.length === 0) return;

    const w = weapons[0];
    const range = w.type.range * 1.5;
    const target = this.weaponManager.findNearestEnemy(range);

    if (!target) return;

    g.lineStyle(1, 0xffffff, 0.15);
    g.beginPath();
    g.moveTo(this.player.x, this.player.y);
    g.lineTo(target.x, target.y);
    g.strokePath();
  }

  // ── QoL: Auto Performance Toast ──

  _showPerfToast(text, color) {
    const now = Date.now();
    if (now - this._perfAutoAdjust.lastToastTime < 10000) return; // max 1 toast per 10s
    this._perfAutoAdjust.lastToastTime = now;

    this._perfToastText.setText(text);
    this._perfToastText.setStyle({ color });
    this._perfToastText.setAlpha(0);

    this.tweens.killTweensOf(this._perfToastText);
    this.tweens.add({
      targets: this._perfToastText,
      alpha: 1,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(2000, () => {
          this.tweens.add({
            targets: this._perfToastText,
            alpha: 0,
            duration: 400,
            ease: 'Sine.easeIn'
          });
        });
      }
    });
  }
}
