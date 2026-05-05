// SpawnManager.js — Handles all entity spawning: enemies, bosses, chests, DLC enemies, XP orbs, and wave system

class SpawnManager {
  constructor(scene) {
    this.scene = scene;
    this.gameTime = 0;

    // Formation system
    this.formationSystem = new FormationSystem(scene);

    // ── Wave System (replaces continuous spawning) ──
    this.waveSystem = {
      currentWave: 0,
      state: 'idle',           // idle | spawning | clearing | pause
      spawnQueue: 0,           // enemies left to spawn this wave
      spawnTimer: 0,
      spawnInterval: 400,      // ms between individual spawns within a wave
      pauseTimer: 0,
      pauseDuration: 3000,     // 3s pause between waves
      bossActive: false,
      bossWarningShown: false,
      bossWarningTimer: 0,
      bossRotationIndex: 0,    // cycles through boss types
      waveKillCount: 0,        // kills during current wave
      waveKillTarget: 0        // kills needed to clear wave
    };

    // DLC systems
    this._chests = [];
    this._lastChestSpawnTime = 0;
    this._chestSpawnInterval = (60 + Math.random() * 30) * 1000; // 60-90s periodic
    this._dlcEnemySpawnTimers = { summoner: 0, exploder: 0, tank: 0, necromancer: 0 };

    // Elite system
    this._miniBossActive = false; // only one at a time
  }

  update(time, delta) {
    this.gameTime += delta;
    this._updateWaveSystem(delta);
    this._updateChestSpawning();
    this._updateDLCEnemySpawning(delta);
  }

  // ── Wave System ──

  _updateWaveSystem(delta) {
    var ws = this.waveSystem;

    switch (ws.state) {
      case 'idle':
        this._waveIdle(delta);
        break;
      case 'warning':
        this._waveBossWarning(delta);
        break;
      case 'spawning':
        this._waveSpawning(delta);
        break;
      case 'clearing':
        this._waveClearing(delta);
        break;
      case 'pause':
        this._wavePause(delta);
        break;
    }
  }

  _waveIdle(delta) {
    var ws = this.waveSystem;
    ws.pauseTimer += delta;

    if (ws.pauseTimer >= ws.pauseDuration) {
      var isBossWave = (ws.currentWave + 1) % 5 === 0;

      if (isBossWave) {
        ws.state = 'warning';
        ws.bossWarningShown = false;
        ws.bossWarningTimer = 0;
      } else {
        this._startWave();
      }
    }
  }

  _waveBossWarning(delta) {
    var ws = this.waveSystem;
    var scene = this.scene;
    var WARNING_DURATION = 5000; // 5s boss warning

    ws.bossWarningTimer += delta;

    // Pulsing warning text + sound
    if (!ws.bossWarningShown) {
      ws.bossWarningShown = true;

      // Determine boss name for warning
      var bossTypes = ['Necromancer', 'Dragon', 'Giant'];
      var nextBossName = bossTypes[ws.bossRotationIndex % bossTypes.length];
      scene._bossWarningText.setText('⚠ ' + nextBossName.toUpperCase() + ' INCOMING ⚠');
      scene._bossWarningText.setAlpha(1);
      scene._bossWarningText.setScale(1);

      // Play boss warning sound
      if (scene.audioManager) scene.audioManager.playBossWarning();

      // Pulsing animation (repeating)
      scene.tweens.killTweensOf(scene._bossWarningText);
      scene.tweens.add({
        targets: scene._bossWarningText,
        scaleX: 1.2,
        scaleY: 1.2,
        alpha: 0.4,
        duration: 400,
        yoyo: true,
        repeat: Math.floor(WARNING_DURATION / 800),
        ease: 'Sine.easeInOut'
      });

      // Red screen flash on first warning
      var flash = scene.add.rectangle(
        scene.scale.width / 2, scene.scale.height / 2,
        scene.scale.width, scene.scale.height, 0xff0000, 0.15
      ).setScrollFactor(0).setDepth(100);
      scene.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 1500,
        onComplete: function() { flash.destroy(); }
      });
    }

    if (ws.bossWarningTimer >= WARNING_DURATION) {
      scene.tweens.killTweensOf(scene._bossWarningText);
      scene._bossWarningText.setAlpha(0);
      this._startWave();
    }
  }

  _startWave() {
    var ws = this.waveSystem;
    ws.currentWave++;
    ws.state = 'spawning';
    ws.spawnTimer = 0;
    ws.waveKillCount = 0;

    var isBossWave = ws.currentWave % 5 === 0;

    // Calculate spawn count: smoother curve with early-game ramp
    var wave = ws.currentWave;
    var targetCount;
    if (wave <= 3) {
      // Early waves: gentle ramp (3, 5, 8)
      targetCount = wave * 2 + 1;
    } else if (wave <= 10) {
      // Mid game: steady growth (10 → 25)
      targetCount = 7 + (wave - 3) * 3;
    } else {
      // Late game: slower growth, capped (28 → 45)
      targetCount = 28 + Math.floor((wave - 10) * 1.5);
    }
    if (isBossWave) {
      targetCount = Math.max(2, Math.floor(targetCount * 0.35)); // fewer normals on boss wave
    }
    ws.spawnQueue = Math.min(targetCount, GAME_CONFIG.maxEnemies - this.scene.enemies.length);
    ws.waveKillTarget = ws.spawnQueue + (isBossWave ? 1 : 0);

    // Show wave announcement
    this._showWaveAnnouncement(ws.currentWave, isBossWave);

    // Wave start sound
    if (this.scene.audioManager) this.scene.audioManager.playWaveStart(ws.currentWave);
  }

  _waveSpawning(delta) {
    var ws = this.waveSystem;
    var scene = this.scene;

    ws.spawnTimer += delta;

    if (ws.spawnTimer >= ws.spawnInterval && ws.spawnQueue > 0) {
      ws.spawnTimer = 0;
      ws.spawnQueue--;

      var isBossWave = ws.currentWave % 5 === 0;

      if (isBossWave && ws.spawnQueue === 0) {
        // Spawn boss last
        this._spawnWaveBoss();
      } else {
        this._spawnWaveEnemy();
      }
    }

    // Transition to clearing once all queued enemies are spawned
    if (ws.spawnQueue <= 0) {
      ws.state = 'clearing';
    }
  }

  _waveClearing(delta) {
    var ws = this.waveSystem;
    var scene = this.scene;

    // Count living enemies (non-DLC, non-boss regular enemies)
    // Wave clears when enemies are reduced enough or a timeout passes
    var aliveCount = scene.enemies.length;

    // If all enemies dead or very few remain, move to pause
    if (aliveCount <= 2) {
      this._endWave();
    }
  }

  _endWave() {
    var ws = this.waveSystem;
    ws.state = 'pause';
    ws.pauseTimer = 0;
    ws.bossActive = false;

    // Mini-Boss spawn: every 3 waves (wave 3, 6, 9, 12, ...), only one at a time
    if (ws.currentWave % 3 === 0 && !this._miniBossActive) {
      this._spawnMiniBoss(ws.currentWave);
    }
  }

  _spawnMiniBoss(wave) {
    var scene = this.scene;
    if (!scene.player || !scene.player.active) return;

    var types = ['swarm_queen', 'golem', 'shadow_mage'];
    var type = types[Math.floor(Math.random() * types.length)];

    var angle = Math.random() * Math.PI * 2;
    var dist = 450 + Math.random() * 100;
    var x = scene.player.x + Math.cos(angle) * dist;
    var y = scene.player.y + Math.sin(angle) * dist;

    var miniBoss = new MiniBoss(scene, x, y, type, wave);

    scene.enemyGroup.add(miniBoss);
    scene.enemies.push(miniBoss);
    this._miniBossActive = true;

    // Screen edge indicator
    scene.screenEdgeIndicators.addIndicator(miniBoss, 'boss');

    // Announcement
    scene._waveText.setText('MINI-BOSS: ' + miniBoss.miniBossName.toUpperCase());
    scene._waveText.setStyle({ color: '#ff8844', fontSize: '22px' });
    scene._waveText.setAlpha(1);
    scene._waveText.setScale(1.2);
    scene.tweens.killTweensOf(scene._waveText);
    scene.tweens.add({
      targets: scene._waveText,
      alpha: 0,
      scaleX: 1,
      scaleY: 1,
      duration: 2500,
      delay: 1000,
      ease: 'Power2'
    });

    // Watch for mini-boss death
    var mbRef = miniBoss;
    var self = this;
    scene.time.delayedCall(100, function() {
      if (!mbRef || !mbRef.active) {
        self._miniBossActive = false;
        return;
      }
      var check = scene.time.addEvent({
        delay: 500,
        loop: true,
        callback: function() {
          if (!mbRef.active) {
            self._miniBossActive = false;
            check.destroy();
          }
        }
      });
    });
  }

  _wavePause(delta) {
    // Handled by _waveIdle
    this._waveIdle(delta);
  }

  // ── Wave-based enemy spawning with scaling ──

  _spawnWaveEnemy() {
    var scene = this.scene;
    if (scene.enemies.length >= GAME_CONFIG.maxEnemies) return;

    // Get available enemy types based on game time
    var typeKeys = Object.keys(ENEMY_TYPES).filter(function(k) {
      return this.gameTime >= (ENEMY_TYPES[k].minTime || 0);
    }.bind(this));
    if (!typeKeys.length) return;

    // Biome affinity: boost spawn weight for biome-matching enemies
    var biomeManager = this.scene.biomeManager;
    if (biomeManager && biomeManager.getCurrentBiomeName) {
      var weighted = [];
      for (var ti = 0; ti < typeKeys.length; ti++) {
        var tk = typeKeys[ti];
        var weight = biomeManager.getEnemyAffinityBonus(tk);
        for (var w = 0; w < Math.ceil(weight); w++) {
          weighted.push(tk);
        }
      }
      if (weighted.length > 0) typeKeys = weighted;
    }

    var typeKey = typeKeys[Math.floor(Math.random() * typeKeys.length)];
    var angle = Math.random() * Math.PI * 2;
    var dist = 500 + Math.random() * 100;
    var x = scene.player.x + Math.cos(angle) * dist;
    var y = scene.player.y + Math.sin(angle) * dist;

    // QoL: Enemy spawn warning at screen edge
    if (scene.addSpawnWarning) {
      scene.addSpawnWarning(x, y, 'normal');
    }

    var enemy;

    // Elite spawn: 5% chance, from minute 3 onward
    if (this.gameTime > 180000 && Math.random() < 0.05) {
      var eliteVariants = ['chaser', 'shooter', 'boss'];
      var eliteVariant = eliteVariants[Math.floor(Math.random() * eliteVariants.length)];
      enemy = new EliteEnemy(scene, x, y, typeKey, eliteVariant);
      // QoL: Add edge indicator for elites (yellow arrow)
      if (scene.screenEdgeIndicators) scene.screenEdgeIndicators.addIndicator(enemy, 'elite');
    } else if (typeKey === 'teleporter') {
      enemy = new TeleporterEnemy(scene, x, y);
    } else if (typeKey === 'tank') {
      enemy = new TankEnemy(scene, x, y);
    } else if (typeKey === 'necromancer') {
      enemy = new NecromancerEnemy(scene, x, y);
    } else if (typeKey === 'fire_elemental') {
      enemy = new FireElementalEnemy(scene, x, y);
    } else if (typeKey === 'lava_golem') {
      enemy = new LavaGolemEnemy(scene, x, y);
    } else {
      enemy = new Enemy(scene, x, y, typeKey);
    }

    // Wave-based scaling: gradual ramp with diminishing returns
    // HP: +8%/wave for first 10, then +4%/wave after (caps ~3x at wave 25)
    // Speed: +3%/wave for first 15, then +1%/wave after (caps ~1.7x at wave 25)
    var ws = this.waveSystem;
    var wave = ws.currentWave;
    var hpMultiplier = wave <= 10
      ? 1 + wave * 0.08
      : 1.8 + (wave - 10) * 0.04;
    var speedMultiplier = wave <= 15
      ? 1 + wave * 0.03
      : 1.45 + (wave - 15) * 0.01;

    enemy.hp = Math.floor(enemy.hp * hpMultiplier);
    enemy.maxHp = enemy.hp;
    enemy.speed = enemy.speed * speedMultiplier;

    scene.enemyGroup.add(enemy);
    scene.enemies.push(enemy);

    // Formation system check
    if (scene.player && scene.player.active) {
      this.formationSystem.tryFormation(scene.player.x, scene.player.y, this.gameTime);
    }

    if (typeKey === 'golem' || typeKey === 'demon') {
      scene.screenEdgeIndicators.addIndicator(enemy, 'boss');
    }
  }

  _spawnWaveBoss() {
    var scene = this.scene;
    var ws = this.waveSystem;

    // Rotate boss types: Necromancer, Dragon, Giant
    var bossTypes = ['necromancer', 'dragon', 'giant'];
    var bossType = bossTypes[ws.bossRotationIndex % bossTypes.length];
    ws.bossRotationIndex++;

    var angle = Math.random() * Math.PI * 2;
    var dist = 500;
    var x = scene.player.x + Math.cos(angle) * dist;
    var y = scene.player.y + Math.sin(angle) * dist;

    var boss = new Boss(scene, x, y, bossType);

    // Boss HP scaling: gradual ramp (was too aggressive)
    // Wave 5: ~2.6x, Wave 10: ~3.5x, Wave 20: ~5.3x, Wave 30: ~7x
    var bossHpMultiplier = 1 + (ws.currentWave * 0.2);
    boss.hp = Math.floor(boss.hp * (bossHpMultiplier / 10)); // Boss already has 10x in constructor
    boss.maxHp = boss.hp;

    scene.enemyGroup.add(boss);
    scene.enemies.push(boss);
    ws.bossActive = true;

    if (scene.screenShake) scene.screenShake.shake('bossSpawn');

    // Boss spawn sound
    if (scene.audioManager) scene.audioManager.playBossSpawn();

    scene._showBossHPBar(boss);

    // Boss entrance announcement
    scene._bossWarningText.setText('⚠ ' + boss.bossName.toUpperCase() + ' ⚠');
    scene._bossWarningText.setAlpha(1);
    scene.tweens.killTweensOf(scene._bossWarningText);
    scene.tweens.add({
      targets: scene._bossWarningText,
      alpha: 0,
      duration: 3000,
      delay: 1500,
      ease: 'Power2'
    });

    // Watch for boss death
    var bossRef = boss;
    var self = this;
    scene.time.delayedCall(100, function() {
      if (!bossRef || !bossRef.active) {
        self.waveSystem.bossActive = false;
        scene._hideBossHPBar();
        return;
      }
      var check = scene.time.addEvent({
        delay: 500,
        loop: true,
        callback: function() {
          if (!bossRef.active) {
            self.waveSystem.bossActive = false;
            scene._hideBossHPBar();
            if (scene.screenShake) scene.screenShake.shake('bossDeath');
            check.destroy();
          }
        }
      });
    });
  }

  _showWaveAnnouncement(waveNum, isBossWave) {
    var scene = this.scene;
    var text = scene._waveText;

    // QoL T4: Wave Announcer with Countdown (3... 2... 1... GO!)
    var countSteps = ['3', '2', '1', isBossWave ? '⚔ FIGHT! ⚔' : 'GO!'];
    var idx = 0;

    var showNext = () => {
      if (idx >= countSteps.length) {
        // Show final wave text
        if (isBossWave) {
          text.setText('\u2694 BOSS WAVE ' + waveNum + ' \u2694');
          text.setStyle({ color: '#ff4444', fontSize: '28px' });
          if (scene.screenShake) scene.screenShake.shake('bossSpawn');
        } else {
          text.setText('WAVE ' + waveNum);
          text.setStyle({ color: '#ffd700', fontSize: '24px' });
        }
        text.setAlpha(1);
        text.setScale(1.3);

        scene.tweens.killTweensOf(text);
        scene.tweens.add({
          targets: text,
          alpha: 0,
          scaleX: 1,
          scaleY: 1,
          duration: 1500,
          delay: 500,
          ease: 'Power2'
        });
        return;
      }

      var step = countSteps[idx];
      text.setText(step);
      text.setAlpha(0);
      text.setScale(2);

      var color = idx < 3 ? '#ffffff' : (isBossWave ? '#ff4444' : '#44ff44');
      text.setStyle({ color: color, fontSize: '36px' });

      scene.tweens.killTweensOf(text);
      scene.tweens.add({
        targets: text,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 300,
        ease: 'Back.easeOut',
        onComplete: () => {
          scene.time.delayedCall(400, showNext);
        }
      });
      idx++;
    };

    showNext();
  }

  // ── Chest Spawning ──

  _updateChestSpawning() {
    if (this.gameTime - this._lastChestSpawnTime > this._chestSpawnInterval) {
      this._lastChestSpawnTime = this.gameTime;
      this._chestSpawnInterval = (60 + Math.random() * 30) * 1000; // 60-90 seconds
      this._spawnChest();
    }
  }

  _spawnChest() {
    var scene = this.scene;
    if (!scene.player || !scene.player.active) return;

    var angle = Math.random() * Math.PI * 2;
    var dist = 200 + Math.random() * 300;
    var cx = scene.player.x + Math.cos(angle) * dist;
    var cy = scene.player.y + Math.sin(angle) * dist;

    var chest = new Chest(scene, cx, cy);
    scene.chestGroup.add(chest);
    this._chests.push(chest);
  }

  // ── Boss Kill Chest Spawning ──

  /** Spawn 1-3 chests after a boss kill (random content types) */
  spawnBossChests(x, y) {
    const count = 1 + Math.floor(Math.random() * 3); // 1-3
    const contentPool = ['gold', 'weapon', 'passive'];

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.8;
      const dist = 30 + Math.random() * 40;
      const cx = x + Math.cos(angle) * dist;
      const cy = y + Math.sin(angle) * dist;
      const content = contentPool[Math.floor(Math.random() * contentPool.length)];

      var chest = new Chest(this.scene, cx, cy, { content: content });
      this.scene.chestGroup.add(chest);
      this._chests.push(chest);
    }
  }

  /** Spawn 1 Mystery Chest on mini-boss kill */
  spawnMiniBossChest(x, y) {
    var chest = new Chest(this.scene, x, y, { content: 'mystery' });
    this.scene.chestGroup.add(chest);
    this._chests.push(chest);
  }

  // ── DLC Enemy Spawning (independent of waves) ──

  _updateDLCEnemySpawning(delta) {
    this._dlcEnemySpawnTimers.summoner += delta;
    this._dlcEnemySpawnTimers.exploder += delta;
    this._dlcEnemySpawnTimers.tank += delta;
    this._dlcEnemySpawnTimers.necromancer += delta;

    if (this.gameTime > 60000 && this._dlcEnemySpawnTimers.exploder > 8000) {
      this._dlcEnemySpawnTimers.exploder = 0;
      if (Math.random() < 0.4) this._spawnDLCEnemy('exploder');
    }
    if (this.gameTime > 120000 && this._dlcEnemySpawnTimers.summoner > 15000) {
      this._dlcEnemySpawnTimers.summoner = 0;
      if (Math.random() < 0.3) this._spawnDLCEnemy('summoner');
    }
    // Tank: rare spawn after 5 minutes
    if (this.gameTime > 300000 && this._dlcEnemySpawnTimers.tank > 25000) {
      this._dlcEnemySpawnTimers.tank = 0;
      if (Math.random() < 0.2) this._spawnDLCEnemy('tank');
    }
    // Necromancer: after wave 10 (approx 5+ min)
    if (this.waveSystem.currentWave >= 10 && this._dlcEnemySpawnTimers.necromancer > 18000) {
      this._dlcEnemySpawnTimers.necromancer = 0;
      if (Math.random() < 0.25) this._spawnDLCEnemy('necromancer');
    }
  }

  _spawnDLCEnemy(type) {
    var scene = this.scene;
    if (scene.enemies.length >= GAME_CONFIG.maxEnemies) return;

    var angle = Math.random() * Math.PI * 2;
    var dist = 500 + Math.random() * 100;
    var x = scene.player.x + Math.cos(angle) * dist;
    var y = scene.player.y + Math.sin(angle) * dist;

    var enemy;
    if (type === 'summoner') {
      enemy = new SummonerEnemy(scene, x, y);
    } else if (type === 'exploder') {
      enemy = new ExploderEnemy(scene, x, y);
    } else if (type === 'tank') {
      enemy = new TankEnemy(scene, x, y);
    } else if (type === 'necromancer') {
      enemy = new NecromancerEnemy(scene, x, y);
    }
    if (!enemy) return;

    var hpScale = 1 + this.gameTime / 60000;
    enemy.hp = Math.floor(enemy.hp * hpScale);
    enemy.maxHp = enemy.hp;

    scene.enemyGroup.add(enemy);
    scene.enemies.push(enemy);

    // Tank gets screen-edge indicator
    if (type === 'tank') {
      scene.screenEdgeIndicators.addIndicator(enemy, 'boss');
    }
  }

  // ── XP Orb Spawning ──

  spawnXPOrb(x, y, value) {
    var scene = this.scene;
    var orb = scene.xpOrbPool.get();
    orb.x = x;
    orb.y = y;
    orb.body.reset(x, y);
    orb.value = value;
    orb._radius = value >= 20 ? 8 : value >= 10 ? 6 : 4;
    orb.body.setCircle(orb._radius, 0, 0);
    orb.setActive(true);
    orb.setVisible(true);
    orb.body.enable = true;
    scene.xpOrbs.push(orb);
  }

  // ── Chest Update ──

  updateChests(time, delta) {
    for (var i = this._chests.length - 1; i >= 0; i--) {
      var chest = this._chests[i];
      if (!chest || !chest.active) {
        this._chests.splice(i, 1);
      } else {
        chest.update(time, delta);
      }
    }
  }

  get chests() { return this._chests; }
}
