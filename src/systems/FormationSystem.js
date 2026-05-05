// FormationSystem.js — Enemy formation spawning patterns
// Integrated with SpawnManager; 20% chance per wave spawn, configurable
// 5 Formations: V-Form, Circle, Line Charge, Pincer, Swarm Burst
// HUD toast shows formation name on trigger (3s fade)

class FormationSystem {
  constructor(scene) {
    this.scene = scene;
    this.chance = 0.20;          // 20% chance per spawn attempt
    this.lastFormationName = '';
    this.lastFormationTime = 0;
  }

  /**
   * Try to spawn a formation. Returns true if a formation was spawned.
   * Called from SpawnManager._spawnWaveEnemy()
   * @param {number} playerX
   * @param {number} playerY
   * @param {number} gameTime — ms
   */
  tryFormation(playerX, playerY, gameTime) {
    // Skip boss/mini-boss waves
    var ws = this.scene.spawnManager.waveSystem;
    if (ws.bossActive || ws.currentWave % 5 === 0) return false;

    // Cooldown: don't spawn within 15s of last formation
    if (gameTime - this.lastFormationTime < 15000) return false;

    // Random chance check
    if (Math.random() > this.chance) return false;

    // Pick random formation
    var formations = ['v-form', 'circle', 'line-charge', 'pincer', 'swarm-burst'];
    var pick = formations[Math.floor(Math.random() * formations.length)];

    switch (pick) {
      case 'v-form':       return this._spawnVForm(playerX, playerY);
      case 'circle':       return this._spawnCircle(playerX, playerY);
      case 'line-charge':  return this._spawnLineCharge(playerX, playerY);
      case 'pincer':       return this._spawnPincer(playerX, playerY);
      case 'swarm-burst':  return this._spawnSwarmBurst(playerX, playerY);
    }
    return false;
  }

  // ── V-Form: 5 enemies in a V pattern ──
  _spawnVForm(playerX, playerY) {
    var angle = Math.random() * Math.PI * 2;
    var dist = 450;
    var cx = playerX + Math.cos(angle) * dist;
    var cy = playerY + Math.sin(angle) * dist;
    var dir = angle + Math.PI; // point toward player

    var offsets = [
      { x: 0, y: 0 },
      { x: -50, y: 40 },
      { x: -100, y: 80 },
      { x: 50, y: 40 },
      { x: 100, y: 80 }
    ];

    var spawned = 0;
    for (var i = 0; i < offsets.length; i++) {
      var ox = offsets[i].x * Math.cos(dir) - offsets[i].y * Math.sin(dir);
      var oy = offsets[i].x * Math.sin(dir) + offsets[i].y * Math.cos(dir);
      if (this._spawnOne(cx + ox, cy + oy)) spawned++;
    }

    this._showToast('V-FORMATION');
    return spawned > 0;
  }

  // ── Circle: 8 enemies surrounding a point ──
  _spawnCircle(playerX, playerY) {
    var angle = Math.random() * Math.PI * 2;
    var dist = 400;
    var cx = playerX + Math.cos(angle) * dist;
    var cy = playerY + Math.sin(angle) * dist;
    var radius = 80;
    var count = 8;

    var spawned = 0;
    for (var i = 0; i < count; i++) {
      var a = (Math.PI * 2 / count) * i;
      var ex = cx + Math.cos(a) * radius;
      var ey = cy + Math.sin(a) * radius;
      if (this._spawnOne(ex, ey)) spawned++;
    }

    this._showToast('CIRCLE FORMATION');
    return spawned > 0;
  }

  // ── Line Charge: 6 enemies in a horizontal line with speed boost ──
  _spawnLineCharge(playerX, playerY) {
    var angle = Math.random() * Math.PI * 2;
    var dist = 500;
    var cx = playerX + Math.cos(angle) * dist;
    var cy = playerY + Math.sin(angle) * dist;
    var dir = angle + Math.PI; // toward player
    var count = 6;
    var spacing = 40;

    var spawned = 0;
    for (var i = 0; i < count; i++) {
      var ox = Math.cos(dir + Math.PI / 2) * (i - count / 2) * spacing;
      var oy = Math.sin(dir + Math.PI / 2) * (i - count / 2) * spacing;
      var ex = cx + ox;
      var ey = cy + oy;
      if (this._spawnOne(ex, ey, 1.5)) spawned++; // 50% speed boost
    }

    this._showToast('LINE CHARGE!');
    return spawned > 0;
  }

  // ── Pincer: Two groups of 4 approaching from flanks ──
  _spawnPincer(playerX, playerY) {
    var angle = Math.random() * Math.PI * 2;
    var dist = 480;
    var perpAngle = angle + Math.PI / 2;

    var spawned = 0;
    for (var group = 0; group < 2; group++) {
      var gAngle = angle + (group === 0 ? 0.5 : -0.5); // flank offset
      var gcx = playerX + Math.cos(gAngle) * dist;
      var gcy = playerY + Math.sin(gAngle) * dist;

      for (var i = 0; i < 4; i++) {
        var ox = Math.cos(perpAngle) * (i - 1.5) * 35;
        var oy = Math.sin(perpAngle) * (i - 1.5) * 35;
        if (this._spawnOne(gcx + ox, gcy + oy)) spawned++;
      }
    }

    this._showToast('PINCER MANEUVER');
    return spawned > 0;
  }

  // ── Swarm Burst: 12 enemies in a tight cluster ──
  _spawnSwarmBurst(playerX, playerY) {
    var angle = Math.random() * Math.PI * 2;
    var dist = 350;
    var cx = playerX + Math.cos(angle) * dist;
    var cy = playerY + Math.sin(angle) * dist;
    var count = 12;

    var spawned = 0;
    for (var i = 0; i < count; i++) {
      var a = (Math.PI * 2 / count) * i;
      var r = 20 + Math.random() * 30;
      var ex = cx + Math.cos(a) * r;
      var ey = cy + Math.sin(a) * r;
      if (this._spawnOne(ex, ey)) spawned++;
    }

    this._showToast('SWARM BURST');
    return spawned > 0;
  }

  // ── Helper: spawn a single enemy with optional speed multiplier ──
  _spawnOne(x, y, speedMult) {
    var scene = this.scene;
    if (scene.enemies.length >= GAME_CONFIG.maxEnemies) return false;

    var typeKeys = Object.keys(ENEMY_TYPES).filter(function(k) {
      return scene.spawnManager.gameTime >= (ENEMY_TYPES[k].minTime || 0);
    });
    if (!typeKeys.length) return false;

    var typeKey = typeKeys[Math.floor(Math.random() * typeKeys.length)];
    var enemy;

    if (typeKey === 'teleporter') {
      enemy = new TeleporterEnemy(scene, x, y);
    } else if (typeKey === 'tank') {
      enemy = new TankEnemy(scene, x, y);
    } else if (typeKey === 'necromancer') {
      enemy = new NecromancerEnemy(scene, x, y);
    } else {
      enemy = new Enemy(scene, x, y, typeKey);
    }

    // Apply wave scaling
    var wave = scene.spawnManager.waveSystem.currentWave;
    var hpMult = wave <= 10 ? 1 + wave * 0.08 : 1.8 + (wave - 10) * 0.04;
    var spdMult = wave <= 15 ? 1 + wave * 0.03 : 1.45 + (wave - 15) * 0.01;

    enemy.hp = Math.floor(enemy.hp * hpMult);
    enemy.maxHp = enemy.hp;
    enemy.speed = enemy.speed * spdMult * (speedMult || 1);

    scene.enemyGroup.add(enemy);
    scene.enemies.push(enemy);
    return true;
  }

  // ── HUD Toast: formation name (top-right, 3s fade) ──
  _showToast(text) {
    this.lastFormationName = text;
    this.lastFormationTime = this.scene.spawnManager.gameTime;

    var sw = this.scene.scale.width;
    var toast = this.scene.add.text(sw - 16, 16, text, {
      fontSize: '16px',
      fontFamily: 'Arial, sans-serif',
      color: '#ff6644',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    this.scene.tweens.add({
      targets: toast,
      alpha: 0,
      duration: 2500,
      delay: 500,
      onComplete: function() { toast.destroy(); }
    });
  }
}
