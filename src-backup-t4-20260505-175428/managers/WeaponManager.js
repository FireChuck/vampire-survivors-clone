// WeaponManager.js — Manages weapon inventory, firing, AOE, and weapon upgrades

class WeaponManager {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this._weapons = [];
    this._weaponTimers = {};
    this._activeProjectiles = [];
    this._auraWeapons = [];
  }

  addWeapon(weaponKey) {
    const type = WEAPON_TYPES[weaponKey];
    if (!type) return;

    if (type.aura) {
      const aura = new Weapon(this.scene, this.player.x, this.player.y, weaponKey, { x: 0, y: 0 }, type);
      this._auraWeapons.push(aura);
      this._weapons.push({ key: weaponKey, type: type, timer: 0, level: 1 });
    } else {
      this._weapons.push({ key: weaponKey, type: type, timer: 0, level: 1 });
    }
  }

  handleNewWeaponUpgrade() {
    const allKeys = Object.keys(WEAPON_TYPES);
    const ownedKeys = this._weapons.map(w => w.key);
    const available = allKeys.filter(k => !ownedKeys.includes(k));

    if (available.length === 0) return;

    const pick = available[Math.floor(Math.random() * available.length)];
    this.addWeapon(pick);

    // QoL: Weapon swap indicator
    if (this.scene.hud && this.scene.hud.showWeaponSwap) {
      const name = pick.charAt(0).toUpperCase() + pick.slice(1).replace(/_/g, ' ');
      this.scene.hud.showWeaponSwap(name);
    }
  }

  handleWeaponLevelUpgrade() {
    if (this._weapons.length === 0) return;

    const target = this._weapons[Math.floor(Math.random() * this._weapons.length)];
    target.level = (target.level || 1) + 1;

    const lvl = target.level;
    target.type = { ...WEAPON_TYPES[target.key] };
    target.type.damage = Math.floor(target.type.damage * (1 + 0.2 * (lvl - 1)));
    target.type.speed = Math.floor(target.type.speed * (1 + 0.05 * (lvl - 1)));
    target.type.piercing = WEAPON_TYPES[target.key].piercing + Math.floor((lvl - 1) * 0.5);
    if (!WEAPON_TYPES[target.key].aura) {
      target.type.projectileSize = WEAPON_TYPES[target.key].projectileSize + (lvl - 1);
    }
  }

  update(time, delta) {
    this._updateWeapons(time, delta);
    this._updateActiveProjectiles(time, delta);
    this._updateAuraWeapons(time, delta);
  }

  _updateWeapons(time, delta) {
    for (const w of this._weapons) {
      w.timer += delta;

      const cooldown = w.type.cooldown * (1 - this.player.stats.cooldownReduction);
      if (cooldown <= 0) continue;

      if (w.timer >= cooldown) {
        w.timer = 0;
        this._fireWeapon(w.key, w.type, w.level || 1);
      }
    }
  }

  _fireWeapon(weaponKey, type, level) {
    const scene = this.scene;
    const px = this.player.x;
    const py = this.player.y;

    // Beam: special handling — fires toward mouse, manages own lifecycle
    if (type.beam) {
      // Only fire if no active beam exists
      if (this._activeBeam && this._activeBeam.active) return;
      const pointer = scene.inputManager ? scene.inputManager.getPointer() : null;
      let direction;
      if (pointer) {
        const dx = pointer.worldX - px;
        const dy = pointer.worldY - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        direction = dist > 1 ? { x: dx / dist, y: dy / dist } : { x: 1, y: 0 };
      } else {
        direction = { x: 1, y: 0 };
      }
      const stats = {
        damage: type.damage,
        range: type.range,
        level: level || 1
      };
      const beam = new BeamProjectile(scene, px, py, direction, stats);
      scene.projectileGroup.add(beam);
      this._activeProjectiles.push(beam);
      this._activeBeam = beam;
      if (scene.audioManager) scene.audioManager.playWeaponFire(weaponKey);
      return;
    }

    // Dedicated boomerang: uses BoomerangProjectile class
    if (weaponKey === 'boomerang_dedicated') {
      const target = this.findNearestEnemy(type.range * 1.5);
      let direction;
      if (target) {
        const dx = target.x - px;
        const dy = target.y - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        direction = { x: dx / dist, y: dy / dist };
      } else {
        direction = { x: 1, y: 0 };
      }
      const stats = {
        damage: type.damage,
        level: level || 1
      };
      const boom = new BoomerangProjectile(scene, px, py, direction, stats);
      scene.projectileGroup.add(boom);
      this._activeProjectiles.push(boom);
      if (scene.audioManager) scene.audioManager.playWeaponFire(weaponKey);
      return;
    }

    // Lightning Chain: uses LightningChainProjectile class
    if (weaponKey === 'lightning_chain') {
      const target = this.findNearestEnemy(type.range * 1.5);
      let direction;
      if (target) {
        const dx = target.x - px;
        const dy = target.y - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        direction = { x: dx / dist, y: dy / dist };
      } else {
        direction = { x: 1, y: 0 };
      }
      const bounces = type.bounces + Math.floor((level - 1) / 2); // +1 bounce every 2 levels
      const stats = {
        damage: type.damage * this.player.stats.damageMultiplier,
        speed: type.speed,
        range: type.range,
        bounces: Math.min(bounces, 6), // cap at 6 bounces
        bounceRange: type.bounceRange + (level - 1) * 20,
        damageFalloff: type.damageFalloff,
        level: level || 1
      };
      const bolt = new LightningChainProjectile(scene, px, py, direction, stats);
      scene.projectileGroup.add(bolt);
      this._activeProjectiles.push(bolt);
      if (scene.audioManager) scene.audioManager.playWeaponFire(weaponKey);
      return;
    }

    const target = this.findNearestEnemy(type.range * 1.5);
    if (!target && !type.aura) return;

    if (type.aura) return;

    let direction;
    if (target) {
      const dx = target.x - px;
      const dy = target.y - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      direction = { x: dx / dist, y: dy / dist };
    } else {
      direction = { x: 1, y: 0 };
    }

    const stats = {
      damage: type.damage * this.player.stats.damageMultiplier,
      speed: type.speed,
      piercing: type.piercing,
      range: type.range,
      aoe: type.aoe,
      melee: type.melee,
      aura: type.aura,
      level: level || 1
    };

    const proj = scene.projectilePool.get();
    proj.x = px;
    proj.y = py;
    if (proj.body) proj.body.reset(px, py);
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
    if (proj.body) proj.body.setCircle(Math.max(2, proj._projSize), 0, 0);
    proj.setActive(true);
    proj.setVisible(true);
    proj.body.enable = true;
    this._activeProjectiles.push(proj);

    if (scene.audioManager) scene.audioManager.playWeaponFire(weaponKey);
  }

  _updateActiveProjectiles(time, delta) {
    const scene = this.scene;
    for (let i = this._activeProjectiles.length - 1; i >= 0; i--) {
      const p = this._activeProjectiles[i];
      if (!p || !p.active) {
        // Clean up beam reference
        if (p === this._activeBeam) this._activeBeam = null;
        this._activeProjectiles.splice(i, 1);
        // Only return to pool if it's a pooled projectile (not beam/boomerang_dedicated)
        if (p && p.weaponTypeKey !== 'beam' && p.weaponTypeKey !== 'boomerang_dedicated' && p.weaponTypeKey !== 'lightning_chain') {
          scene.projectilePool.release(p);
        }
      } else {
        p.update(time, delta);
      }
    }
  }

  _updateAuraWeapons(time, delta) {
    const scene = this.scene;
    for (const aura of this._auraWeapons) {
      if (aura.active) {
        const nearby = scene.spatialGrid.query(this.player.x, this.player.y, aura.range);
        for (const enemy of nearby) {
          if (!enemy || !enemy.active) continue;
          if (!enemy._auraTickTime) enemy._auraTickTime = 0;
          enemy._auraTickTime += delta;
          if (enemy._auraTickTime >= 500) {
            enemy._auraTickTime = 0;
            const dmg = aura.damage * this.player.stats.damageMultiplier;
            enemy.takeDamage(dmg);

            // Knockback: push enemy away from player
            if (aura.knockback > 0 && enemy.body) {
              const dx = enemy.x - this.player.x;
              const dy = enemy.y - this.player.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const kbForce = aura.knockback * (1 + (aura._weaponLevel - 1) * 0.15);
              enemy.body.setVelocity(
                (dx / dist) * kbForce,
                (dy / dist) * kbForce
              );
              // Reset velocity after short duration
              scene.time.delayedCall(150, () => {
                if (enemy.active && enemy.body) {
                  enemy.body.setVelocity(0, 0);
                }
              });
            }
          }
        }
        aura.update(time, delta);
      }
    }
  }

  findNearestEnemy(maxRange) {
    const scene = this.scene;
    if (!scene.enemies.length) return null;

    const px = this.player.x;
    const py = this.player.y;
    const nearby = scene.spatialGrid.query(px, py, maxRange);

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

  applyAOE(data) {
    const scene = this.scene;
    const nearby = scene.spatialGrid.query(data.x, data.y, data.range);
    for (const enemy of nearby) {
      if (!enemy || !enemy.active) continue;
      if (enemy === data.exclude) continue;
      enemy.takeDamage(data.damage);
    }
  }

  explosionOnKill(x, y) {
    const scene = this.scene;
    const explosionRange = 80;
    const explosionDamage = 15;

    const g = scene.add.graphics();
    g.fillStyle(0xff6600, 0.4);
    g.fillCircle(x, y, explosionRange);
    g.setDepth(20);
    scene.tweens.add({
      targets: g,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 300,
      onComplete: () => g.destroy()
    });

    for (const enemy of scene.enemies) {
      if (!enemy || !enemy.active) continue;
      const dx = enemy.x - x;
      const dy = enemy.y - y;
      if (dx * dx + dy * dy < explosionRange * explosionRange) {
        enemy.takeDamage(explosionDamage);
      }
    }
  }

  get weapons() { return this._weapons; }
  get activeProjectiles() { return this._activeProjectiles; }
}
