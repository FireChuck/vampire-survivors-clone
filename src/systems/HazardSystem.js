// HazardSystem.js — Environmental hazards per biome
// Damage zones that affect both player and enemies

class HazardSystem {
  constructor(scene) {
    this.scene = scene;
    this._hazards = [];
    this._graphics = scene.add.graphics();
    this._graphics.setDepth(2);
    this._spawnTimer = 0;
    this._spawnInterval = 8000; // check for new hazard spawns every 8s
    this._maxHazards = 25;
    this._playerHazardCooldown = {};

    // Per-biome hazard definitions
    this._biomeHazards = {
      Graveyard: {
        type: 'poison_cloud',
        color: 0x448833,
        alpha: 0.25,
        radius: 40,
        damage: 3,
        interval: 1500,
        duration: 10000,
        density: 0.006,
        damageType: 'dot' // damage over time
      },
      DarkForest: {
        type: 'thorn_patch',
        color: 0x554422,
        alpha: 0.35,
        radius: 30,
        damage: 2,
        interval: 2000,
        duration: 12000,
        density: 0.007,
        damageType: 'thorns', // slow + damage
        slowFactor: 0.5
      },
      BloodMoor: {
        type: 'blood_pool',
        color: 0x881111,
        alpha: 0.3,
        radius: 35,
        damage: 4,
        interval: 1200,
        duration: 8000,
        density: 0.005,
        damageType: 'dot'
      },
      CursedSwamp: {
        type: 'swamp_gas',
        color: 0x445522,
        alpha: 0.2,
        radius: 45,
        damage: 3,
        interval: 1800,
        duration: 10000,
        density: 0.008,
        damageType: 'dot',
        slowFactor: 0.7
      },
      Catacombs: {
        type: 'lava_pool',
        color: 0xff4400,
        alpha: 0.4,
        radius: 30,
        damage: 8,
        interval: 800,
        duration: 6000,
        density: 0.004,
        damageType: 'burst' // high instant damage
      },
      Dungeon: {
        type: 'dark_aura',
        color: 0x6b21a8,
        alpha: 0.2,
        radius: 50,
        damage: 5,
        interval: 1000,
        duration: 7000,
        density: 0.005,
        damageType: 'dot'
      },
      Volcanic: {
        type: 'lava_pool',
        color: 0xff2200,
        alpha: 0.45,
        radius: 35,
        damage: 6,
        interval: 1000,
        duration: 12000,
        density: 0.008,
        damageType: 'burst'
      }
    };
  }

  update(time, delta) {
    this._spawnTimer += delta;

    // Spawn new hazards periodically
    if (this._spawnTimer >= this._spawnInterval && this._hazards.length < this._maxHazards) {
      this._spawnTimer = 0;
      this._spawnHazardForCurrentBiome();
    }

    // Update existing hazards
    this._updateHazards(time, delta);

    // Render hazards
    this._renderHazards(time);
  }

  _spawnHazardForCurrentBiome() {
    var scene = this.scene;
    var player = scene.player;
    if (!player || !player.active) return;

    var biomeName = scene.biomeManager ? scene.biomeManager.getCurrentBiomeName() : null;
    if (!biomeName) return;

    var hazardDef = this._biomeHazards[biomeName];
    if (!hazardDef) return;

    // Spawn 1-3 hazards around player position
    var count = 1 + Math.floor(Math.random() * 2);
    for (var i = 0; i < count; i++) {
      if (this._hazards.length >= this._maxHazards) break;

      var angle = Math.random() * Math.PI * 2;
      var dist = 100 + Math.random() * 300;
      var hx = player.x + Math.cos(angle) * dist;
      var hy = player.y + Math.sin(angle) * dist;

      // Don't spawn too close to player
      var dx = hx - player.x;
      var dy = hy - player.y;
      if (Math.sqrt(dx * dx + dy * dy) < 60) continue;

      // Check no existing hazard nearby
      var tooClose = false;
      for (var j = 0; j < this._hazards.length; j++) {
        var hdx = hx - this._hazards[j].x;
        var hdy = hy - this._hazards[j].y;
        if (hdx * hdx + hdy * hdy < 40 * 40) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      var radius = hazardDef.radius + Math.random() * 15;
      var duration = hazardDef.duration + Math.random() * 3000;

      this._hazards.push({
        x: hx,
        y: hy,
        radius: radius,
        color: hazardDef.color,
        alpha: hazardDef.alpha,
        damage: hazardDef.damage,
        interval: hazardDef.interval,
        damageType: hazardDef.damageType,
        slowFactor: hazardDef.slowFactor || 1,
        type: hazardDef.type,
        biome: biomeName,
        active: true,
        spawnTime: time,
        lifetime: duration,
        _lastDamageTime: {},
        _pulseOffset: Math.random() * Math.PI * 2
      });
    }
  }

  _updateHazards(time, delta) {
    var scene = this.scene;
    var player = scene.player;
    if (!player || !player.active) return;

    for (var i = this._hazards.length - 1; i >= 0; i--) {
      var h = this._hazards[i];
      if (!h.active) {
        this._hazards.splice(i, 1);
        continue;
      }

      // Lifetime check
      if (time - h.spawnTime > h.lifetime) {
        h.active = false;
        this._hazards.splice(i, 1);
        continue;
      }

      // Distance culling: remove hazards far from player
      var cdx = h.x - player.x;
      var cdy = h.y - player.y;
      if (cdx * cdx + cdy * cdy > 600 * 600) {
        h.active = false;
        this._hazards.splice(i, 1);
        continue;
      }

      // Check player in hazard
      var pdx = player.x - h.x;
      var pdy = player.y - h.y;
      var playerDist = Math.sqrt(pdx * pdx + pdy * pdy);
      var playerInHazard = playerDist < h.radius;

      if (playerInHazard) {
        // Apply damage with cooldown per hazard
        var lastPlayerDamage = h._lastDamageTime['player'] || 0;
        if (time - lastPlayerDamage > h.interval) {
          h._lastDamageTime['player'] = time;
          player.takeDamage(h.damage);

          // Apply slow
          if (h.slowFactor < 1 && player.body) {
            var origSpeed = player.stats.speed;
            player.body.setVelocity(
              player.body.velocity.x * h.slowFactor,
              player.body.velocity.y * h.slowFactor
            );
          }

          // HUD update
          if (scene.hud) scene.hud.updateHP(player.hp, player.maxHp);

          // Visual feedback
          this._showDamageFeedback(player.x, player.y, h.color);
        }
      }

      // Check enemies in hazard
      var enemies = scene.enemies || [];
      for (var ei = 0; ei < enemies.length; ei++) {
        var enemy = enemies[ei];
        if (!enemy || !enemy.active) continue;

        var edx = enemy.x - h.x;
        var edy = enemy.y - h.y;
        var enemyDist = Math.sqrt(edx * edx + edy * edy);

        if (enemyDist < h.radius) {
          var enemyId = ei;
          var lastEnemyDamage = h._lastDamageTime['e' + enemyId] || 0;
          if (time - lastEnemyDamage > h.interval) {
            h._lastDamageTime['e' + enemyId] = time;
            enemy.takeDamage(h.damage);

            // Slow enemies
            if (h.slowFactor < 1 && enemy.body) {
              enemy.body.setVelocity(
                enemy.body.velocity.x * h.slowFactor,
                enemy.body.velocity.y * h.slowFactor
              );
            }
          }
        }
      }
    }
  }

  _showDamageFeedback(x, y, color) {
    var scene = this.scene;
    var flash = scene.add.graphics();
    flash.fillStyle(color, 0.3);
    flash.fillCircle(x, y, 20);
    flash.setDepth(25);
    scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 400,
      onComplete: function() { flash.destroy(); }
    });
  }

  _renderHazards(time) {
    var gfx = this._graphics;
    gfx.clear();

    var cam = this.scene.cameras.main;
    var margin = 100;
    var viewLeft = cam.scrollX - margin;
    var viewRight = cam.scrollX + cam.width + margin;
    var viewTop = cam.scrollY - margin;
    var viewBottom = cam.scrollY + cam.height + margin;

    for (var i = 0; i < this._hazards.length; i++) {
      var h = this._hazards[i];
      if (!h.active) continue;

      // Viewport culling
      if (h.x < viewLeft - h.radius || h.x > viewRight + h.radius ||
          h.y < viewTop - h.radius || h.y > viewBottom + h.radius) continue;

      // Fade in/out based on lifetime
      var age = time - h.spawnTime;
      var lifeRatio = age / h.lifetime;
      var alpha = h.alpha;
      if (lifeRatio < 0.1) {
        alpha *= lifeRatio / 0.1; // fade in
      } else if (lifeRatio > 0.8) {
        alpha *= (1 - lifeRatio) / 0.2; // fade out
      }

      // Subtle pulse
      var pulse = Math.sin(time * 0.003 + h._pulseOffset) * 0.08;
      alpha = Math.max(0, Math.min(1, alpha + pulse));

      var r = h.radius + Math.sin(time * 0.002 + h._pulseOffset) * 3;

      // Draw hazard zone
      switch (h.type) {
        case 'poison_cloud':
          gfx.fillStyle(h.color, alpha);
          gfx.fillCircle(h.x, h.y, r);
          gfx.fillStyle(0x66aa44, alpha * 0.3);
          gfx.fillCircle(h.x, h.y, r * 0.6);
          // Bubbles
          gfx.fillStyle(0x88cc55, alpha * 0.4);
          for (var b = 0; b < 3; b++) {
            var bAngle = time * 0.001 + b * 2.1;
            gfx.fillCircle(
              h.x + Math.cos(bAngle) * r * 0.3,
              h.y + Math.sin(bAngle) * r * 0.3,
              2
            );
          }
          break;

        case 'thorn_patch':
          gfx.fillStyle(h.color, alpha);
          gfx.fillCircle(h.x, h.y, r);
          // Thorn spikes
          gfx.lineStyle(1, 0x665533, alpha);
          for (var t = 0; t < 6; t++) {
            var tAngle = (t / 6) * Math.PI * 2;
            gfx.beginPath();
            gfx.moveTo(h.x + Math.cos(tAngle) * r * 0.4, h.y + Math.sin(tAngle) * r * 0.4);
            gfx.lineTo(h.x + Math.cos(tAngle) * r * 0.9, h.y + Math.sin(tAngle) * r * 0.9);
            gfx.strokePath();
          }
          break;

        case 'blood_pool':
          gfx.fillStyle(h.color, alpha);
          gfx.fillEllipse(h.x, h.y, r * 2, r * 1.4);
          gfx.fillStyle(0xaa2222, alpha * 0.3);
          gfx.fillEllipse(h.x, h.y - 2, r * 1.2, r * 0.8);
          break;

        case 'swamp_gas':
          gfx.fillStyle(h.color, alpha * 0.8);
          gfx.fillCircle(h.x, h.y, r);
          gfx.fillStyle(0x556633, alpha * 0.4);
          gfx.fillCircle(h.x + 5, h.y - 3, r * 0.7);
          gfx.fillCircle(h.x - 8, h.y + 4, r * 0.5);
          break;

        case 'lava_pool':
          // Glowing lava
          gfx.fillStyle(0xff2200, alpha * 0.5);
          gfx.fillCircle(h.x, h.y, r);
          gfx.fillStyle(0xff6600, alpha);
          gfx.fillCircle(h.x, h.y, r * 0.7);
          gfx.fillStyle(0xffaa00, alpha * 0.6);
          gfx.fillCircle(h.x, h.y, r * 0.4);
          // Glow ring
          gfx.lineStyle(2, 0xff4400, alpha * 0.5);
          gfx.strokeCircle(h.x, h.y, r);
          break;

        case 'dark_aura':
          gfx.fillStyle(h.color, alpha);
          gfx.fillCircle(h.x, h.y, r);
          gfx.fillStyle(0x8844cc, alpha * 0.3);
          gfx.fillCircle(h.x, h.y, r * 0.5);
          gfx.lineStyle(1, 0xaa66dd, alpha * 0.3);
          gfx.strokeCircle(h.x, h.y, r);
          break;

        default:
          gfx.fillStyle(h.color, alpha);
          gfx.fillCircle(h.x, h.y, r);
      }

      // Hazard type indicator (small icon)
      gfx.fillStyle(0xffffff, alpha * 0.15);
      gfx.fillCircle(h.x, h.y - r - 5, 2);
    }
  }

  getCurrentBiomeHazardCount() {
    var scene = this.scene;
    var biomeName = scene.biomeManager ? scene.biomeManager.getCurrentBiomeName() : null;
    if (!biomeName) return 0;
    var count = 0;
    for (var i = 0; i < this._hazards.length; i++) {
      if (this._hazards[i].biome === biomeName && this._hazards[i].active) count++;
    }
    return count;
  }

  destroy() {
    if (this._graphics && this._graphics.active) this._graphics.destroy();
    this._hazards = [];
  }
}
