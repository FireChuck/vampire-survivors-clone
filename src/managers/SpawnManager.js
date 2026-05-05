// SpawnManager.js — Handles all entity spawning: enemies, bosses, chests, DLC enemies, XP orbs, and wave system

class SpawnManager {
  constructor(scene) {
    this.scene = scene;
    this.gameTime = 0;
    this._lastSpawnTime = 0;
    this.spawnInterval = GAME_CONFIG.spawnIntervalStart;

    // Wave/Boss system
    this.waveSystem = {
      currentWave: 0,
      waveTimer: 0,
      waveInterval: 60000,
      bossWaveInterval: 120000,
      lastWaveTime: 0,
      bossActive: false
    };

    // DLC systems
    this._chests = [];
    this._lastChestSpawnTime = 0;
    this._chestSpawnInterval = GAME_CONFIG.chestSpawnInterval * 1000;
    this._dlcEnemySpawnTimers = { summoner: 0, exploder: 0 };
  }

  update(time, delta) {
    this.gameTime += delta;
    this._updateEnemySpawning();
    this._updateChestSpawning();
    this._updateDLCEnemySpawning(delta);
    this._updateWaveSystem(time, delta);
  }

  _updateEnemySpawning() {
    const scene = this.scene;

    this.spawnInterval = Math.max(GAME_CONFIG.spawnIntervalMin,
      GAME_CONFIG.spawnIntervalStart - (this.gameTime / 1000 / 60) * GAME_CONFIG.spawnIntervalDecrease);

    if (this.gameTime - this._lastSpawnTime > this.spawnInterval) {
      this._lastSpawnTime = this.gameTime;
      this._spawnEnemy();
      if (this.gameTime > 60000) this._spawnEnemy();
      if (this.gameTime > 120000) this._spawnEnemy();
      if (this.gameTime > 180000) this._spawnEnemy();
    }
  }

  _updateChestSpawning() {
    if (this.gameTime - this._lastChestSpawnTime > this._chestSpawnInterval) {
      this._lastChestSpawnTime = this.gameTime;
      this._chestSpawnInterval = (45 + Math.random() * 15) * 1000;
      this._spawnChest();
    }
  }

  _updateDLCEnemySpawning(delta) {
    this._dlcEnemySpawnTimers.summoner += delta;
    this._dlcEnemySpawnTimers.exploder += delta;

    if (this.gameTime > 60000 && this._dlcEnemySpawnTimers.exploder > 8000) {
      this._dlcEnemySpawnTimers.exploder = 0;
      if (Math.random() < 0.4) this._spawnDLCEnemy('exploder');
    }
    if (this.gameTime > 120000 && this._dlcEnemySpawnTimers.summoner > 15000) {
      this._dlcEnemySpawnTimers.summoner = 0;
      if (Math.random() < 0.3) this._spawnDLCEnemy('summoner');
    }
  }

  _spawnEnemy() {
    const scene = this.scene;
    if (scene.enemies.length >= GAME_CONFIG.maxEnemies) return;

    const typeKeys = Object.keys(ENEMY_TYPES).filter(k =>
      this.gameTime >= (ENEMY_TYPES[k].minTime || 0)
    );
    if (!typeKeys.length) return;

    const typeKey = typeKeys[Math.floor(Math.random() * typeKeys.length)];
    const angle = Math.random() * Math.PI * 2;
    const dist = 500 + Math.random() * 100;
    const x = scene.player.x + Math.cos(angle) * dist;
    const y = scene.player.y + Math.sin(angle) * dist;

    const enemy = new Enemy(scene, x, y, typeKey);
    enemy.applyTimeScaling(this.gameTime / 1000);
    scene.enemyGroup.add(enemy);
    scene.enemies.push(enemy);

    if (typeKey === 'golem' || typeKey === 'demon') {
      scene.screenEdgeIndicators.addIndicator(enemy, 'boss');
    }
  }

  _spawnChest() {
    const scene = this.scene;
    if (!scene.player || !scene.player.active) return;

    const angle = Math.random() * Math.PI * 2;
    const dist = 200 + Math.random() * 300;
    const cx = scene.player.x + Math.cos(angle) * dist;
    const cy = scene.player.y + Math.sin(angle) * dist;

    const chest = new Chest(scene, cx, cy);
    scene.chestGroup.add(chest);
    this._chests.push(chest);
  }

  _spawnDLCEnemy(type) {
    const scene = this.scene;
    if (scene.enemies.length >= GAME_CONFIG.maxEnemies) return;

    const angle = Math.random() * Math.PI * 2;
    const dist = 500 + Math.random() * 100;
    const x = scene.player.x + Math.cos(angle) * dist;
    const y = scene.player.y + Math.sin(angle) * dist;

    let enemy;
    if (type === 'summoner') {
      enemy = new SummonerEnemy(scene, x, y);
    } else if (type === 'exploder') {
      enemy = new ExploderEnemy(scene, x, y);
    }
    if (!enemy) return;

    const hpScale = 1 + this.gameTime / 60000;
    enemy.hp = Math.floor(enemy.hp * hpScale);
    enemy.maxHp = enemy.hp;

    scene.enemyGroup.add(enemy);
    scene.enemies.push(enemy);
  }

  spawnXPOrb(x, y, value) {
    const scene = this.scene;
    const orb = scene.xpOrbPool.get();
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

  updateChests(time, delta) {
    for (let i = this._chests.length - 1; i >= 0; i--) {
      const chest = this._chests[i];
      if (!chest || !chest.active) {
        this._chests.splice(i, 1);
      } else {
        chest.update(time, delta);
      }
    }
  }

  _updateWaveSystem(time, delta) {
    const scene = this.scene;
    const ws = this.waveSystem;
    ws.waveTimer += delta;

    if (ws.waveTimer - ws.lastWaveTime >= ws.waveInterval) {
      ws.lastWaveTime = ws.waveTimer;
      ws.currentWave++;

      this._showWaveAnnouncement(ws.currentWave);

      const extraSpawns = 3 + ws.currentWave;
      for (let i = 0; i < extraSpawns; i++) {
        this._spawnEnemy();
      }
    }

    if (ws.waveTimer >= ws.bossWaveInterval && !ws.bossActive) {
      if (Math.floor(ws.waveTimer / ws.bossWaveInterval) > Math.floor((ws.waveTimer - delta) / ws.bossWaveInterval)) {
        this._spawnBoss();
      }
    }
  }

  _spawnBoss() {
    const scene = this.scene;
    const bossTypes = ['necromancer', 'dragon', 'giant'];
    const bossType = bossTypes[Math.floor(Math.random() * bossTypes.length)];

    const angle = Math.random() * Math.PI * 2;
    const dist = 500;
    const x = scene.player.x + Math.cos(angle) * dist;
    const y = scene.player.y + Math.sin(angle) * dist;

    const boss = new Boss(scene, x, y, bossType);
    boss.applyTimeScaling(this.gameTime / 1000);

    scene.enemyGroup.add(boss);
    scene.enemies.push(boss);
    this.waveSystem.bossActive = true;

    if (scene.screenShake) scene.screenShake.shake('bossSpawn');

    scene._showBossHPBar(boss);

    scene._bossWarningText.setText(`⚠ BOSS: ${boss.bossName} ⚠`);
    scene._bossWarningText.setAlpha(1);
    scene.tweens.add({
      targets: scene._bossWarningText,
      alpha: 0,
      duration: 3000,
      delay: 1000,
      ease: 'Power2'
    });

    const bossRef = boss;
    scene.time.delayedCall(100, () => {
      if (!bossRef || !bossRef.active) {
        this.waveSystem.bossActive = false;
        scene._hideBossHPBar();
        return;
      }
      const check = scene.time.addEvent({
        delay: 500,
        loop: true,
        callback: () => {
          if (!bossRef.active) {
            this.waveSystem.bossActive = false;
            scene._hideBossHPBar();
            if (scene.screenShake) scene.screenShake.shake('bossDeath');
            check.destroy();
          }
        }
      });
    });
  }

  _showWaveAnnouncement(waveNum) {
    const scene = this.scene;
    const text = scene._waveText;
    const isBossWave = waveNum % 2 === 0;

    if (isBossWave) {
      text.setText(`⚔ BOSS WAVE ${waveNum} ⚔`);
      text.setStyle({ color: '#ff4444', fontSize: '28px' });
      if (scene.screenShake) scene.screenShake.shake('bossSpawn');
    } else {
      text.setText(`Wave ${waveNum}`);
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
      duration: 2000,
      delay: 800,
      ease: 'Power2'
    });
  }

  get chests() { return this._chests; }
}
