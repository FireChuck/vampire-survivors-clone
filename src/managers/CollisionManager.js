// CollisionManager.js — Handles all collision logic and game over trigger

class CollisionManager {
  constructor(scene) {
    this.scene = scene;
  }

  setupCollisions() {
    const scene = this.scene;

    scene.physics.add.overlap(scene.player, scene.enemyGroup, (player, enemy) => {
      this.onPlayerHitEnemy(enemy);
    });

    scene.physics.add.overlap(scene.projectileGroup, scene.enemyGroup, (proj, enemy) => {
      this.onProjectileHit(proj, enemy);
    });

    scene.physics.add.overlap(scene.player, scene.xpOrbGroup, (player, orb) => {
      this.onPlayerCollectXP(orb);
    });

    scene.physics.add.overlap(scene.player, scene.chestGroup, (player, chest) => {
      if (chest.active && !chest._opened) {
        chest.open(player);
        // T4.1: Track items collected
        if (!scene._itemsCollected) scene._itemsCollected = 0;
        scene._itemsCollected++;
      }
    });
  }

  setupEventListeners() {
    const scene = this.scene;

    scene.events.on('enemyKilled', (data) => {
      scene.spawnManager.spawnXPOrb(data.x, data.y, data.xpValue);
      scene.score += data.xpValue * 10;
      scene.killCount++;
      scene._updateKillStreak();
      if (scene.audioManager) scene.audioManager.playEnemyDeath();
      if (scene.particleSystem) scene.particleSystem.emitDeath(data.x, data.y, data.color || 0xff4444, undefined, data.enemyType);
      if (scene.damageNumbers) scene.damageNumbers.show(data.x, data.y, data.xpValue, 'xp');
      if (scene.player.stats.explosionOnKill) {
        scene.weaponManager.explosionOnKill(data.x, data.y);
      }
      // Track boss kills for character unlock progression
      if (data.isBoss) {
        scene._bossKillsThisRun = (scene._bossKillsThisRun || 0) + 1;
      }
    });

    // Boss kill → spawn 1-3 content-type chests
    scene.events.on('bossKilled', (data) => {
      scene.spawnManager.spawnBossChests(data.x, data.y);
    });

    // Mini-boss kill → spawn 1 mystery chest
    scene.events.on('miniBossKilled', (data) => {
      scene.spawnManager.spawnMiniBossChest(data.x, data.y);
    });

    scene.events.on('weaponAOE', (data) => {
      scene.weaponManager.applyAOE(data);
    });

    scene.events.on('playerLevelUp', () => {
      scene.upgradeSystem.addXP(0);
      if (scene.hud) {
        scene.hud.updateHP(scene.player.hp, scene.player.maxHp);
        scene.hud.updateWeapons(scene.weaponManager.weapons);
      }
      if (scene.audioManager) scene.audioManager.playLevelUp();
      if (scene.particleSystem) scene.particleSystem.emitLevelUp(scene.player.x, scene.player.y);
      if (scene.screenShake) scene.screenShake.shake('levelUp');
    });

    scene.events.on('upgradeNewWeapon', () => {
      scene.weaponManager.handleNewWeaponUpgrade();
    });
    scene.events.on('upgradeWeaponLevel', () => {
      scene.weaponManager.handleWeaponLevelUpgrade();
    });
  }

  onPlayerHitEnemy(enemy) {
    const scene = this.scene;
    if (!enemy || !enemy.active) return;
    if (!enemy.canDamagePlayer()) return;
    if (scene.upgradeSystem.paused) return;

    const damage = enemy.damage;
    const actual = scene.player.takeDamage(damage);
    enemy.startDamageCooldown();

    if (scene.player.stats.thorns > 0 && enemy.active) {
      const reflectDamage = actual * scene.player.stats.thorns;
      enemy.takeDamage(reflectDamage);
    }

    if (scene.audioManager) scene.audioManager.playPlayerHurt();
    if (scene.particleSystem) scene.particleSystem.emitHit(scene.player.x, scene.player.y, 0xff4444);
    if (scene.screenShake) scene.screenShake.shake('playerHit');
    if (scene.damageNumbers) scene.damageNumbers.show(scene.player.x, scene.player.y - 20, actual, 'damage');

    // QoL: Damage direction indicator
    if (scene.hud && scene.hud.showDamageDirection) {
      scene.hud.showDamageDirection(enemy.x, enemy.y);
    }

    if (scene.hud) {
      scene.hud.updateHP(scene.player.hp, scene.player.maxHp);
    }

    if (scene.player.hp <= 0 && !scene.gameOverTriggered) {
      this.triggerGameOver();
    }
  }

  onProjectileHit(proj, enemy) {
    const scene = this.scene;
    if (!proj || !proj.active) return;
    if (!enemy || !enemy.active) return;

    if (scene.particleSystem) scene.particleSystem.emitHit(enemy.x, enemy.y, proj.color || 0x88ccff);
    if (scene.audioManager) scene.audioManager.playHit();

    // Crit system integration
    let finalDamage = proj.damage || 10;
    let isCrit = false;

    if (scene.critSystem) {
      const critResult = scene.critSystem.rollCrit(finalDamage);
      finalDamage = critResult.damage;
      isCrit = critResult.isCrit;

      if (isCrit) {
        scene.critSystem.applyCritEffects(enemy.x, enemy.y, finalDamage);
      }
    }

    if (scene.damageNumbers) {
      scene.damageNumbers.show(enemy.x, enemy.y - 10, finalDamage, isCrit ? 'crit' : 'damage');
    }

    // T4.1: Record damage for DPS tracking
    if (typeof scene.recordDamage === 'function') {
      scene.recordDamage(proj.damage || 0);
    }

    if (typeof proj.onHitEnemy === 'function') {
      proj.onHitEnemy(enemy);
    }
  }

  onPlayerCollectXP(orb) {
    const scene = this.scene;
    if (!orb || !orb.active) return;

    orb.collect(scene.player);

    if (scene.audioManager) scene.audioManager.playXPPickup();
    if (scene.particleSystem) scene.particleSystem.emitXPPickup(orb.x, orb.y);

    const idx = scene.xpOrbs.indexOf(orb);
    if (idx !== -1) scene.xpOrbs.splice(idx, 1);
    scene.xpOrbPool.release(orb);

    scene.upgradeSystem.addXP(0);

    if (scene.hud) {
      scene.hud.updateXP(scene.player.xp, scene.upgradeSystem.xpToNext, scene.player.level);
    }
  }

  triggerGameOver() {
    const scene = this.scene;
    if (scene.gameOverTriggered) return;
    scene.gameOverTriggered = true;

    if (scene.audioManager) scene.audioManager.playGameOver();

    // T4.1: Slow-mo death effect before game over
    scene._doSlowMoDeath(() => {
      scene.inputManager.destroy();
      scene.upgradeSystem.destroy();
      if (scene.abilitySystem) scene.abilitySystem.destroy();
      if (scene.synergySystem) scene.synergySystem.destroy();
      if (scene.vignetteSystem) scene.vignetteSystem.destroy();
      if (scene.hazardSystem) scene.hazardSystem.destroy();
      scene.hud.destroy();
      if (scene.damageNumbers) scene.damageNumbers.destroy();

      const stats = {
        score: scene.score,
        killCount: scene.killCount,
        level: scene.player.level,
        time: scene.hud ? scene.hud.getElapsedTime() : 0,
        itemsCollected: scene._itemsCollected || 0,
        dps: scene.getDPS ? scene.getDPS() : 0,
        totalDamageDealt: scene._totalDamageDealt || 0,
        bossKills: scene._bossKillsThisRun || 0
      };

      const achievementsBefore = [...scene.meta.data.achievements];
      const wasHighScore = scene.meta.isNewHighScore(stats.score);
      scene.meta.recordRun(stats);
      const achievementsAfter = scene.meta.data.achievements;
      const newAchievements = achievementsAfter.filter(a => !achievementsBefore.includes(a));

      stats.wasHighScore = wasHighScore || stats.score >= scene.meta.data.highScore;
      stats.newAchievements = newAchievements;

      scene.scene.stop('GameScene');
      scene.scene.start('GameOverScene', stats);
    });
  }
}
