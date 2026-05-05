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
      // Store character color for visual
      this.player._charColor = this._incomingData.characterColor || 0x4488ff;
      this.player._charHighlight = this._incomingData.characterHighlight || 0x88bbff;
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

    // Performance Systems
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

    this.biomeManager = new BiomeManager(this);

    this.collisionManager = new CollisionManager(this);
    this.collisionManager.setupCollisions();
    this.collisionManager.setupEventListeners();

    // Screen-Edge Indicators
    this.screenEdgeIndicators = new ScreenEdgeIndicators(this);

    // Audio
    this.audioManager = new AudioManager(this);

    // Achievement Toast System
    this.achievementToast = new AchievementToast(this);

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

    // State
    this.score = 0;
    this.killCount = 0;
    this.enemies = [];
    this.xpOrbs = [];
    this.gameOverTriggered = false;

    // T4.1: DPS tracking
    this._totalDamageDealt = 0;
    this._dpsSamples = []; // { time, damage } pairs for rolling DPS calc
    this._lastDpsCalc = 0;

    // T4.1: Items collected tracking
    this._itemsCollected = 0;

    // HUD init
    this.hud.updateHP(this.player.hp, this.player.maxHp);
    this.hud.startTimer();

    // ── Pause System ──
    this.isPaused = false;
    this._pauseOverlay = this.add.rectangle(
      this.scale.width / 2, this.scale.height / 2,
      this.scale.width, this.scale.height, 0x000000, 0.5
    ).setScrollFactor(0).setDepth(200).setVisible(false);
    this._pauseText = this.add.text(this.scale.width / 2, this.scale.height / 2, '⏸ PAUSED', {
      fontSize: '48px', fontFamily: 'Arial, sans-serif', color: '#ffffff',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 6
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setVisible(false);
    this._pauseHint = this.add.text(this.scale.width / 2, this.scale.height / 2 + 50, 'Press P or ESC to resume', {
      fontSize: '16px', fontFamily: 'Arial, sans-serif', color: '#aaaaaa',
      stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setVisible(false);

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-P', () => this._togglePause());
      this.input.keyboard.on('keydown-ESC', () => this._togglePause());
    }

    // ── Kill Streak System ──
    this._killStreak = { count: 0, lastKillTime: 0, comboTimeout: 2000, scoreBonus: 0 };
    this._streakText = this.add.text(this.scale.width / 2, this.scale.height * 0.25, '', {
      fontSize: '36px', fontFamily: 'Arial, sans-serif', color: '#ffd700',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(55).setAlpha(0);

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
  }

  // ── Main Update Loop ──

  update(time, delta) {
    if (this.isPaused || this._startCountdownActive || this.upgradeSystem.paused || this.gameOverTriggered || this._slowMoActive) return;

    // Particle system
    this.particleSystem.update(delta);

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

    // Rebuild spatial grid
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

    // Spawning
    this.spawnManager.update(time, delta);

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
    // Slow down game to 20% speed for 1.5 seconds, then trigger game over
    this._slowMoActive = true;
    this.time.timeScale = 0.2;
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

    this.time.delayedCall(1500, () => {
      // Restore speed
      this.time.timeScale = 1;
      this.physics.world.timeScale = 1;
      this._slowMoActive = false;

      // Fade out to black
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        vignette.destroy();
        if (callback) callback();
      });
    });
  }

  // ── QoL: Auto-Pickup Radius ──

  _updatePickupRadius() {
    const bonus = Math.floor(this.player.level * 5);
    this.player.pickupRange = 60 + bonus;
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

  // ── QoL: Pause System ──

  _togglePause() {
    if (this.gameOverTriggered) return;
    this.isPaused = !this.isPaused;
    this._pauseOverlay.setVisible(this.isPaused);
    this._pauseText.setVisible(this.isPaused);
    this._pauseHint.setVisible(this.isPaused);

    if (this.isPaused) {
      this.physics.world.pause();
      this.time.pause();
    } else {
      this.physics.world.resume();
      this.time.resume();
    }
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
}
