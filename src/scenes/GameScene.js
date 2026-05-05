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

    // ── QoL Systems ──
    this.screenShake = new ScreenShake(this);
    this.damageNumbers = new DamageNumbers(this);

    // ── Ability System ──
    this.abilitySystem = new AbilitySystem(this, this.player);
    this.player.abilitySystem = this.abilitySystem;

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

    // Stress test mode
    this._stressTest = this.scene.settings?.data?.stressTest || false;

    // FPS counter — prominent when stress test
    const fpsFontSize = this._stressTest ? '20px' : '12px';
    const fpsColor = this._stressTest ? '#00ff00' : '#ffff00';
    this._fpsText = this.add.text(8, 8, '', {
      fontSize: fpsFontSize,
      fill: fpsColor,
      fontFamily: 'monospace',
      backgroundColor: '#000000',
      padding: { x: 6, y: 3 }
    });
    this._fpsText.setScrollFactor(0);
    this._fpsText.setDepth(1001);
    this._fpsFrames = 0;
    this._fpsLast = 0;
    this._fpsValue = 0;

    // FPS bar background (stress test mode)
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

    // Spawn intervals (used after countdown)
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
      // Kill streak
      this._updateKillStreak();
      // Audio + particles
      if (this.audioManager) this.audioManager.playEnemyDeath();
      if (this.particleSystem) this.particleSystem.emitDeath(data.x, data.y);
      // Damage number for XP
      if (this.damageNumbers) this.damageNumbers.show(data.x, data.y, data.xpValue, 'xp');
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
        this.hud.updateWeapons(this._weapons);
      }
      if (this.audioManager) this.audioManager.playLevelUp();
      if (this.particleSystem) this.particleSystem.emitLevelUp(this.player.x, this.player.y);
      if (this.screenShake) this.screenShake.shake('levelUp');
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

    // ── Pause System ──
    this.isPaused = false;
    this._pauseContainer = this.add.container(this.scale.width / 2, this.scale.height / 2)
      .setScrollFactor(0).setDepth(200).setVisible(false);

    // Dim overlay
    this._pauseOverlay = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.6).setOrigin(0.5);

    // Panel background
    this._pausePanel = this.add.graphics();
    this._pausePanel.fillStyle(0x1a1a2e, 0.95);
    this._pausePanel.fillRoundedRect(-160, -140, 320, 310, 12);
    this._pausePanel.lineStyle(2, 0x4ecdc4, 0.6);
    this._pausePanel.strokeRoundedRect(-160, -140, 320, 310, 12);

    this._pauseText = this.add.text(0, -110, '⏸ PAUSED', {
      fontSize: '36px', fontFamily: 'Arial, sans-serif', color: '#ffffff',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5);

    // Resume button
    this._pauseResumeBtn = this.add.text(0, -50, '▶  Resume', {
      fontSize: '20px', fontFamily: 'Arial, sans-serif', color: '#4ecdc4',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
      backgroundColor: '#1a3a3a', padding: { x: 24, y: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    // Restart button
    this._pauseRestartBtn = this.add.text(0, 0, '↻  Restart', {
      fontSize: '20px', fontFamily: 'Arial, sans-serif', color: '#ffd700',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
      backgroundColor: '#3a3a1a', padding: { x: 24, y: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    // Quit button
    this._pauseQuitBtn = this.add.text(0, 50, '✕  Quit', {
      fontSize: '20px', fontFamily: 'Arial, sans-serif', color: '#e94560',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
      backgroundColor: '#3a1a1a', padding: { x: 24, y: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    // Volume controls
    this._volumeLabel = this.add.text(-120, 105, 'Master:', {
      fontSize: '14px', fontFamily: 'Arial, sans-serif', color: '#ccc',
      stroke: '#000000', strokeThickness: 2
    }).setOrigin(0, 0.5);
    this._volumeValue = this.add.text(60, 105, '50%', {
      fontSize: '14px', fontFamily: 'Arial, sans-serif', color: '#4ecdc4',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 2
    }).setOrigin(0, 0.5);
    this._volumeDownBtn = this.add.text(-40, 105, ' ◀ ', {
      fontSize: '18px', fontFamily: 'Arial, sans-serif', color: '#fff',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 2
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    this._volumeUpBtn = this.add.text(30, 105, ' ▶ ', {
      fontSize: '18px', fontFamily: 'Arial, sans-serif', color: '#fff',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 2
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

    // Volume bar
    this._volumeBarBg = this.add.rectangle(0, 130, 200, 8, 0x333333).setOrigin(0.5);
    this._volumeBarFill = this.add.rectangle(-100, 130, 100, 8, 0x4ecdc4).setOrigin(0, 0.5);

    this._pauseContainer.add([
      this._pauseOverlay, this._pausePanel, this._pauseText,
      this._pauseResumeBtn, this._pauseRestartBtn, this._pauseQuitBtn,
      this._volumeLabel, this._volumeValue,
      this._volumeDownBtn, this._volumeUpBtn,
      this._volumeBarBg, this._volumeBarFill
    ]);

    // Button hover effects
    const _addPauseHover = (btn, baseColor) => {
      btn.on('pointerover', () => btn.setStyle({ color: '#ffffff' }));
      btn.on('pointerout', () => btn.setStyle({ color: baseColor }));
    };
    _addPauseHover(this._pauseResumeBtn, '#4ecdc4');
    _addPauseHover(this._pauseRestartBtn, '#ffd700');
    _addPauseHover(this._pauseQuitBtn, '#e94560');

    // Button click handlers
    this._pauseResumeBtn.on('pointerdown', () => this._togglePause());
    this._pauseRestartBtn.on('pointerdown', () => this._restartGame());
    this._pauseQuitBtn.on('pointerdown', () => this._quitToMenu());

    // Volume controls
    this._pauseMasterVolume = 0.5;
    this._volumeDownBtn.on('pointerdown', () => this._adjustVolume(-0.1));
    this._volumeUpBtn.on('pointerdown', () => this._adjustVolume(0.1));

    // Pause key binding
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

    // ── Boss HP Bar (top of screen) ──
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

    // ── Start Countdown (3-2-1-GO) ──
    this._startCountdownActive = true;
    this.player.setVelocity(0, 0);
    this._doStartCountdown();

    // ── DLC: Chest System ──
    this._chests = [];
    this._lastChestSpawnTime = 0;
    this._chestSpawnInterval = GAME_CONFIG.chestSpawnInterval * 1000; // 60s base
    this.chestGroup = this.physics.add.group({ runChildUpdate: false });

    // Chest ↔ Player collision
    this.physics.add.overlap(this.player, this.chestGroup, (player, chest) => {
      if (chest.active && !chest._opened) chest.open(player);
    });

    // ── DLC: New Enemy Types (Summoner + Exploder) ──
    this._dlcEnemySpawnTimers = { summoner: 0, exploder: 0 };
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

    const type = ENEMY_TYPES[typeKey];

    const enemy = new Enemy(this, x, y, typeKey);
    enemy.applyTimeScaling(this.gameTime / 1000);

    this.enemyGroup.add(enemy);
    this.enemies.push(enemy);

    // Add screen-edge indicator for bosses
    if (typeKey === 'golem' || typeKey === 'demon') {
      this.screenEdgeIndicators.addIndicator(enemy, 'boss');
    }
  }

  // ── DLC: Chest Spawning ──

  _spawnChest() {
    if (!this.player || !this.player.active) return;

    // Spawn at random position far from player
    const angle = Math.random() * Math.PI * 2;
    const dist = 200 + Math.random() * 300;
    const cx = this.player.x + Math.cos(angle) * dist;
    const cy = this.player.y + Math.sin(angle) * dist;

    const chest = new Chest(this, cx, cy);
    this.chestGroup.add(chest);
    this._chests.push(chest);
  }

  // ── DLC: New Enemy Spawning ──

  _spawnDLCEnemy(type) {
    if (this.enemies.length >= GAME_CONFIG.maxEnemies) return;

    const angle = Math.random() * Math.PI * 2;
    const dist = 500 + Math.random() * 100;
    const x = this.player.x + Math.cos(angle) * dist;
    const y = this.player.y + Math.sin(angle) * dist;

    let enemy;
    if (type === 'summoner') {
      enemy = new SummonerEnemy(this, x, y);
    } else if (type === 'exploder') {
      enemy = new ExploderEnemy(this, x, y);
    }
    if (!enemy) return;

    // Scale HP with game time (same as regular enemies)
    const hpScale = 1 + this.gameTime / 60000;
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

    // Thorns: reflect damage back to enemy
    if (this.player.stats.thorns > 0 && enemy.active) {
      const reflectDamage = actual * this.player.stats.thorns;
      enemy.takeDamage(reflectDamage);
    }

    if (this.audioManager) this.audioManager.playPlayerHurt();
    if (this.particleSystem) this.particleSystem.emitHit(this.player.x, this.player.y, 0xff4444);
    if (this.screenShake) this.screenShake.shake('playerHit');
    if (this.damageNumbers) this.damageNumbers.show(this.player.x, this.player.y - 20, actual, 'damage');

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

    // Damage number
    if (this.damageNumbers) {
      const isCrit = proj.damage && proj.damage >= (enemy.maxHp * 0.25);
      this.damageNumbers.show(enemy.x, enemy.y - 10, proj.damage || 10, isCrit ? 'crit' : 'damage');
    }

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
    if (this.abilitySystem) this.abilitySystem.destroy();
    this.hud.destroy();
    if (this.damageNumbers) this.damageNumbers.destroy();

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

  // ── Stress Test Mode ──

  _doStressTestBurst() {
    // Override maxEnemies temporarily
    const savedMax = GAME_CONFIG.maxEnemies;
    GAME_CONFIG.maxEnemies = 300;

    // Spawn 160 enemies in a ring around the player
    const count = 160;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const dist = 200 + Math.random() * 400;

      const x = this.player.x + Math.cos(angle) * dist;
      const y = this.player.y + Math.sin(angle) * dist;

      // Pick random enemy type
      const typeKeys = Object.keys(ENEMY_TYPES);
      const typeKey = typeKeys[Math.floor(Math.random() * typeKeys.length)];

      const enemy = new Enemy(this, x, y, typeKey);
      // Scale HP slightly so they don't die too fast
      enemy.hp = Math.max(enemy.hp, 50);
      enemy.maxHp = enemy.hp;
      this.enemyGroup.add(enemy);
      this.enemies.push(enemy);
    }

    // Restore maxEnemies (let normal spawning continue)
    GAME_CONFIG.maxEnemies = savedMax;

    // Give player extra HP so they don't die instantly
    this.player.hp = 999;
    this.player.maxHp = 999;
    if (this.hud) this.hud.updateHP(this.player.hp, this.player.maxHp);

    // Give all weapons max level for more visual load
    for (const w of this._weapons) {
      w.level = 5;
      w.type = { ...WEAPON_TYPES[w.key] };
      w.type.damage = Math.floor(w.type.damage * 2.5);
      w.type.cooldown = 200; // fast fire
    }

    // Show stress test banner
    const banner = this.add.text(this.scale.width / 2, this.scale.height - 40, '🔥 STRESS TEST MODE — 160 Enemies', {
      fontSize: '20px', fontFamily: 'Arial, sans-serif', color: '#ff8800',
      fontStyle: 'bold', stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
    this.time.delayedCall(5000, () => banner.destroy());
  }

  // ── QoL: Pause System ──

  _togglePause() {
    if (this.gameOverTriggered) return;
    this.isPaused = !this.isPaused;
    this._pauseContainer.setVisible(this.isPaused);

    if (this.isPaused) {
      this.physics.world.pause();
      this.time.pause();
    } else {
      this.physics.world.resume();
      this.time.resume();
    }
  }

  _adjustVolume(delta) {
    this._pauseMasterVolume = Math.max(0, Math.min(1, this._pauseMasterVolume + delta));
    if (this.audioManager) this.audioManager.setVolume(this._pauseMasterVolume);
    this._volumeValue.setText(`${Math.round(this._pauseMasterVolume * 100)}%`);
    this._volumeBarFill.width = 200 * this._pauseMasterVolume;
  }

  _restartGame() {
    this.isPaused = false;
    this.physics.world.resume();
    this.time.resume();
    this.scene.stop('GameScene');
    this.scene.start('GameScene');
  }

  _quitToMenu() {
    this.isPaused = false;
    this.physics.world.resume();
    this.time.resume();
    if (this.audioManager) this.audioManager.destroy();
    this.scene.stop('GameScene');
    this.scene.start('MenuScene');
  }

  // ── QoL: Start Countdown (3-2-1-GO) ──

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
        this.spawnTimer = this.time.now;

        // ── Stress Test: spawn 150+ enemies immediately ──
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

  // ── QoL: Kill Streak Combo ──

  _updateKillStreak() {
    const now = this.gameTime;
    if (now - this._killStreak.lastKillTime < this._killStreak.comboTimeout) {
      this._killStreak.count++;
    } else {
      this._killStreak.count = 1;
    }
    this._killStreak.lastKillTime = now;

    const count = this._killStreak.count;
    if (count < 5) return; // Only show at 5+

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

    // Show streak text
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

  // ── QoL: Boss HP Bar (screen top) ──

  _showBossHPBar(boss) {
    this._activeBossRef = boss;
    this._bossBarContainer.setVisible(true);
    this._bossBarName.setText(`⚔ ${boss.bossName}`);
    this._bossBarContainer.setScale(0.8);
    this._bossBarContainer.setAlpha(0);

    // Slide-in animation
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

    // Color gradient
    if (ratio > 0.5) this._bossBarFill.setFillStyle(0xe94560);
    else if (ratio > 0.25) this._bossBarFill.setFillStyle(0xff8800);
    else this._bossBarFill.setFillStyle(0xff2222);
  }

  // ── QoL: Auto-Pickup Radius scales with level ──

  _updatePickupRadius() {
    const bonus = Math.floor(this.player.level * 5);
    this.player.pickupRange = 60 + bonus;
  }

  // ── QoL: Enhanced Wave Announcement ──

  _showWaveAnnouncement(waveNum) {
    const text = this._waveText;
    const isBossWave = waveNum % 2 === 0;

    if (isBossWave) {
      text.setText(`⚔ BOSS WAVE ${waveNum} ⚔`);
      text.setStyle({ color: '#ff4444', fontSize: '28px' });
      if (this.screenShake) this.screenShake.shake('bossSpawn');
    } else {
      text.setText(`Wave ${waveNum}`);
      text.setStyle({ color: '#ffd700', fontSize: '24px' });
    }
    text.setAlpha(1);
    text.setScale(1.3);

    this.tweens.killTweensOf(text);
    this.tweens.add({
      targets: text,
      alpha: 0,
      scaleX: 1,
      scaleY: 1,
      duration: 2000,
      delay: 800,
      ease: 'Power2'
    });
  }

  // ── Main Update Loop ──

  update(time, delta) {
    if (this.isPaused || this._startCountdownActive || this.upgradeSystem.paused || this.gameOverTriggered) return;

    this.gameTime += delta;

    // Particle system update
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

    // Ability system update
    if (this.abilitySystem) {
      this.abilitySystem.update(time, delta);
    }

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

    // ── DLC: Chest Spawning ──
    if (this.gameTime - this._lastChestSpawnTime > this._chestSpawnInterval) {
      this._lastChestSpawnTime = this.gameTime;
      // Random interval between 45-60s for next spawn
      this._chestSpawnInterval = (45 + Math.random() * 15) * 1000;
      this._spawnChest();
    }

    // ── DLC: New Enemy Spawning (Summoner + Exploder) ──
    this._dlcEnemySpawnTimers.summoner += delta;
    this._dlcEnemySpawnTimers.exploder += delta;
    // Exploder: every 8s after 60s
    if (this.gameTime > 60000 && this._dlcEnemySpawnTimers.exploder > 8000) {
      this._dlcEnemySpawnTimers.exploder = 0;
      if (Math.random() < 0.4) this._spawnDLCEnemy('exploder');
    }
    // Summoner: every 15s after 120s
    if (this.gameTime > 120000 && this._dlcEnemySpawnTimers.summoner > 15000) {
      this._dlcEnemySpawnTimers.summoner = 0;
      if (Math.random() < 0.3) this._spawnDLCEnemy('summoner');
    }

    // Update enemies
    const timeFreezeActive = this.abilitySystem && this.abilitySystem.isTimeFreezeActive();
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy || !enemy.active) {
        this.enemies.splice(i, 1);
      } else {
        // Time freeze: enemies don't move
        if (timeFreezeActive) {
          enemy.update(time, delta, this.player, 0); // 0 speed multiplier = frozen
          continue;
        }
        // Apply timeSlow from player passive items
        if (this.player.stats.timeSlow > 0 && !enemy.isBoss) {
          const timeMultiplier = 1 - this.player.stats.timeSlow;
          enemy.update(time, delta, this.player, timeMultiplier);
        } else {
          enemy.update(time, delta, this.player, 1);
        }
      }
    }

    // Camera-culling: deactivate enemies far off-screen for perf
    const cam = this.cameras.main;
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

    // Update XP orbs — attraction to player
    for (let i = this.xpOrbs.length - 1; i >= 0; i--) {
      const orb = this.xpOrbs[i];
      if (!orb || !orb.active) {
        this.xpOrbs.splice(i, 1);
      } else {
        orb.attractTo(this.player);
      }
    }

    // Update chests
    for (let i = this._chests.length - 1; i >= 0; i--) {
      const chest = this._chests[i];
      if (!chest || !chest.active) {
        this._chests.splice(i, 1);
      } else {
        chest.update(time, delta);
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
    // FPS counter update
    this._fpsFrames++;
    if (time - this._fpsLast >= 1000) {
      this._fpsValue = this._fpsFrames;
      this._fpsFrames = 0;
      this._fpsLast = time;
    }
    if (this._fpsText && this._fpsText.active) {
      this._fpsText.setText(`FPS: ${this._fpsValue} | Entities: ${this.enemies.length + this.xpOrbs.length + this._activeProjectiles.length}`);
    }

    if (this.minimap) this.minimap.update();

    // ── QoL Updates ──
    this._updateBossHPBar();
    this._updatePickupRadius();

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

  _spawnBoss() {
    const bossTypes = ['necromancer', 'dragon', 'giant'];
    const bossType = bossTypes[Math.floor(Math.random() * bossTypes.length)];

    const angle = Math.random() * Math.PI * 2;
    const dist = 500;
    const x = this.player.x + Math.cos(angle) * dist;
    const y = this.player.y + Math.sin(angle) * dist;

    const boss = new Boss(this, x, y, bossType);
    boss.applyTimeScaling(this.gameTime / 1000);

    this.enemyGroup.add(boss);
    this.enemies.push(boss);
    this.waveSystem.bossActive = true;

    // Show boss HP bar (top of screen)
    this._showBossHPBar(boss);
    if (this.screenShake) this.screenShake.shake('bossSpawn');

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
        this._hideBossHPBar();
        return;
      }
      const check = this.time.addEvent({
        delay: 500,
        loop: true,
        callback: () => {
          if (!bossRef.active) {
            this.waveSystem.bossActive = false;
            this._hideBossHPBar();
            if (this.screenShake) this.screenShake.shake('bossDeath');
            check.destroy();
          }
        }
      });
    });
  }
}
