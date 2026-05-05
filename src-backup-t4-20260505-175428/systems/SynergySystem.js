// SynergySystem.js — Ability Synergy System for Vampire Survivors Clone
// Detects equipped ability pairs and applies synergy effects
// 5 synergies: Meteor+Orbit, Shield+Orbit, Dash+Weapon, TimeFreeze+Any, Holy+Necromancer

class SynergySystem {
  constructor(scene, abilitySystem, weaponManager) {
    this.scene = scene;
    this.abilitySystem = abilitySystem;
    this.weaponManager = weaponManager;

    // Active synergies — Map<synergyId, { timer, data }>
    this._activeSynergies = new Map();

    // Visual: synergy HUD indicators
    this._synergyIcons = [];
    this._synergyContainer = null;

    // Dash Strike tracking
    this._dashStrikeActive = false;
    this._dashStrikeDir = { x: 0, y: 0 };
    this._dashStrikeDamage = 0;

    // Frozen Orbs tracking
    this._frozenOrbs = [];

    // Divine Army tracking
    this._divineArmyActive = false;
    this._divineArmyTimer = 0;

    // Steam Explosion timer
    this._steamExplosionTimer = 0;
    this._steamExplosionInterval = 8000;

    // Orbiting Shields tracking
    this._orbitShields = [];
    this._orbitShieldAngle = 0;

    // Build synergy HUD
    this._buildHUD();
  }

  // ── Synergy Definitions ──

  static SYNERGY_DEFS = {
    steamExplosion: {
      id: 'steamExplosion',
      name: 'Steam Explosion',
      icon: '💥',
      requires: ['meteor', 'timeFreeze'], // meteor + timeFreeze → Steam Explosion
      description: 'Periodic AoE burst around player',
      color: 0xff8844
    },
    orbitingShields: {
      id: 'orbitingShields',
      name: 'Orbiting Shields',
      icon: '🔄',
      requires: ['shield', 'timeFreeze'], // shield + timeFreeze → Orbiting Shields
      description: 'Shield orbs orbit and reflect damage',
      color: 0x44ff88
    },
    dashStrike: {
      id: 'dashStrike',
      name: 'Dash Strike',
      icon: '⚡',
      requires: ['dash'], // dash + any weapon equipped
      needsWeapon: true,
      description: 'Deal weapon damage to enemies in dash path',
      color: 0x44ddff
    },
    frozenOrbs: {
      id: 'frozenOrbs',
      name: 'Frozen Orbs',
      icon: '🔮',
      requires: ['timeFreeze'], // timeFreeze + any other ability
      needsOtherAbility: true,
      description: 'Slow aura dealing 5 DPS to nearby enemies',
      color: 0xaaeeff
    },
    divineArmy: {
      id: 'divineArmy',
      name: 'Divine Army',
      icon: '✨',
      requires: ['holy', 'necromancer'], // Note: uses ability names
      description: 'Summon damage +30%',
      color: 0xffffcc
    }
  };

  // ── Synergy Detection ──

  /** Check equipped abilities and activate/deactivate synergies */
  checkSynergies() {
    const owned = this.abilitySystem.ownedIds;
    const hasWeapon = this.weaponManager && this.weaponManager.weapons.length > 0;
    const otherAbilityCount = owned.size - 1; // minus timeFreeze itself

    // Meteor + TimeFreeze → Steam Explosion
    this._setSynergyActive('steamExplosion', owned.has('meteor') && owned.has('timeFreeze'));

    // Shield + TimeFreeze → Orbiting Shields (using timeFreeze as second ability)
    this._setSynergyActive('orbitingShields', owned.has('shield') && owned.has('timeFreeze'));

    // Dash + Any Weapon → Dash Strike
    this._setSynergyActive('dashStrike', owned.has('dash') && hasWeapon);

    // TimeFreeze + Any other ability → Frozen Orbs
    this._setSynergyActive('frozenOrbs', owned.has('timeFreeze') && otherAbilityCount > 0);

    // Holy + Necromancer → Divine Army
    // Note: holy and necromancer may not be separate abilities in current system
    // We'll check for them as ability IDs if they exist
    this._setSynergyActive('divineArmy', owned.has('holy') && owned.has('necromancer'));

    return this.getActiveSynergies();
  }

  _setSynergyActive(synergyId, active) {
    const wasActive = this._activeSynergies.has(synergyId);
    if (active && !wasActive) {
      this._activeSynergies.set(synergyId, { timer: 0, data: {} });
      this._onSynergyActivated(synergyId);
    } else if (!active && wasActive) {
      this._activeSynergies.delete(synergyId);
      this._onSynergyDeactivated(synergyId);
    }
    this._updateHUD();
  }

  _onSynergyActivated(synergyId) {
    const player = this.scene.player;
    switch (synergyId) {
      case 'orbitingShields':
        // Create 3 orbiting shield orbs
        this._orbitShields = [];
        for (let i = 0; i < 3; i++) {
          const orb = this.scene.add.graphics();
          orb.fillStyle(0x44ff88, 0.6);
          orb.fillCircle(0, 0, 8);
          orb.lineStyle(2, 0x88ffaa, 0.8);
          orb.strokeCircle(0, 0, 8);
          orb.setDepth(14);
          this._orbitShields.push(orb);
        }
        break;

      case 'frozenOrbs':
        // Create frozen orb visual
        this._frozenOrbs = [];
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2;
          const orb = this.scene.add.graphics();
          orb.fillStyle(0xaaeeff, 0.4);
          orb.fillCircle(0, 0, 12);
          orb.lineStyle(2, 0x88ccff, 0.6);
          orb.strokeCircle(0, 0, 12);
          orb.setDepth(14);
          this._frozenOrbs.push({ graphics: orb, baseAngle: angle });
        }
        break;

      case 'divineArmy':
        this._divineArmyActive = true;
        this._divineArmyTimer = 0;
        break;
    }
  }

  _onSynergyDeactivated(synergyId) {
    switch (synergyId) {
      case 'orbitingShields':
        for (const orb of this._orbitShields) orb.destroy();
        this._orbitShields = [];
        break;
      case 'frozenOrbs':
        for (const orb of this._frozenOrbs) orb.graphics.destroy();
        this._frozenOrbs = [];
        break;
      case 'divineArmy':
        this._divineArmyActive = false;
        break;
    }
  }

  // ── Hook: Dash Strike ──

  /** Called when dash activates — sets up dash strike */
  onDashActivated() {
    if (!this._activeSynergies.has('dashStrike')) return;

    const player = this.scene.player;
    this._dashStrikeActive = true;

    // Calculate dash direction from player velocity
    const vx = player.body.velocity.x;
    const vy = player.body.velocity.y;
    const len = Math.sqrt(vx * vx + vy * vy) || 1;
    this._dashStrikeDir = { x: vx / len, y: vy / len };

    // Use average weapon damage
    const totalDmg = this.weaponManager.weapons.reduce((sum, w) => {
      return sum + (w.damage || 10);
    }, 0);
    this._dashStrikeDamage = totalDmg * player.stats.damageMultiplier;

    // Deal damage to enemies in path
    this._applyDashStrike();
  }

  _applyDashStrike() {
    const player = this.scene.player;
    const dir = this._dashStrikeDir;
    const range = 120; // dash strike range in front of player
    const width = 40; // hitbox width

    for (const enemy of this.scene.enemies) {
      if (!enemy || !enemy.active) continue;

      // Vector from player to enemy
      const ex = enemy.x - player.x;
      const ey = enemy.y - player.y;

      // Project onto dash direction
      const dot = ex * dir.x + ey * dir.y;
      if (dot < 0 || dot > range) continue; // behind or too far

      // Perpendicular distance
      const perpDist = Math.abs(ex * dir.y - ey * dir.x);
      if (perpDist > width) continue;

      // Hit!
      enemy.takeDamage(this._dashStrikeDamage);
      if (this.scene.particleSystem) {
        this.scene.particleSystem.emitHit(enemy.x, enemy.y, 0x44ddff);
      }
      if (this.scene.damageNumbers) {
        this.scene.damageNumbers.show(enemy.x, enemy.y - 10, this._dashStrikeDamage, 'damage');
      }
    }

    // End dash strike after brief delay
    this.scene.time.delayedCall(300, () => {
      this._dashStrikeActive = false;
    });
  }

  // ── Hook: Divine Army — Modify summon damage ──

  /** Get damage multiplier for summons (necromancer minions, etc.) */
  getSummonDamageMultiplier() {
    return this._divineArmyActive ? 1.3 : 1.0;
  }

  // ── Update Loop ──

  update(time, delta) {
    const player = this.scene.player;

    // Steam Explosion — periodic AoE burst
    if (this._activeSynergies.has('steamExplosion')) {
      this._steamExplosionTimer += delta;
      if (this._steamExplosionTimer >= this._steamExplosionInterval) {
        this._steamExplosionTimer = 0;
        this._triggerSteamExplosion(player.x, player.y);
      }
    }

    // Orbiting Shields — rotate and check collisions
    if (this._activeSynergies.has('orbitingShields')) {
      this._updateOrbitShields(delta);
    }

    // Frozen Orbs — orbit and apply slow aura + DPS
    if (this._activeSynergies.has('frozenOrbs')) {
      this._updateFrozenOrbs(delta, player);
    }
  }

  _triggerSteamExplosion(px, py) {
    const radius = 120;
    const damage = 20 * this.scene.player.stats.damageMultiplier;

    // Visual: expanding steam ring
    const ring = this.scene.add.graphics();
    ring.lineStyle(3, 0xff8844, 0.8);
    ring.strokeCircle(px, py, 10);
    ring.setDepth(20);

    this.scene.tweens.add({
      targets: ring,
      alpha: 0,
      duration: 500,
      onUpdate: (tw, target) => {
        const progress = tw.progress;
        ring.clear();
        ring.lineStyle(3, 0xff8844, 0.8 * (1 - progress));
        ring.strokeCircle(px, py, 10 + progress * radius);
        ring.fillStyle(0xff8844, 0.1 * (1 - progress));
        ring.fillCircle(px, py, 10 + progress * radius);
      },
      onComplete: () => ring.destroy()
    });

    // Damage enemies in radius
    for (const enemy of this.scene.enemies) {
      if (!enemy || !enemy.active) continue;
      const dx = enemy.x - px;
      const dy = enemy.y - py;
      if (dx * dx + dy * dy < radius * radius) {
        enemy.takeDamage(damage);
        if (this.scene.particleSystem) {
          this.scene.particleSystem.emitHit(enemy.x, enemy.y, 0xff8844);
        }
      }
    }

    if (this.scene.screenShake) this.scene.screenShake.shake('explosion');
  }

  _updateOrbitShields(delta) {
    const player = this.scene.player;
    if (!player.active) return;

    this._orbitShieldAngle += delta * 0.002; // rotation speed

    for (let i = 0; i < this._orbitShields.length; i++) {
      const angle = this._orbitShieldAngle + (i / this._orbitShields.length) * Math.PI * 2;
      const orbitRadius = 55;
      const sx = player.x + Math.cos(angle) * orbitRadius;
      const sy = player.y + Math.sin(angle) * orbitRadius;
      this._orbitShields[i].setPosition(sx, sy);

      // Check collision with enemies — reflect 10 damage
      for (const enemy of this.scene.enemies) {
        if (!enemy || !enemy.active) continue;
        const dx = enemy.x - sx;
        const dy = enemy.y - sy;
        if (dx * dx + dy * dy < 20 * 20) {
          enemy.takeDamage(10);
          // Push enemy back slightly
          const pushDist = 30;
          const pushAngle = Math.atan2(dy, dx);
          enemy.x += Math.cos(pushAngle) * pushDist;
          enemy.y += Math.sin(pushAngle) * pushDist;

          if (this.scene.particleSystem) {
            this.scene.particleSystem.emitHit(enemy.x, enemy.y, 0x44ff88);
          }
        }
      }
    }
  }

  _updateFrozenOrbs(delta, player) {
    if (!player.active) return;

    const frozenAngleSpeed = delta * 0.001;

    for (const orb of this._frozenOrbs) {
      orb.baseAngle += frozenAngleSpeed;
      const orbRadius = 80;
      const ox = player.x + Math.cos(orb.baseAngle) * orbRadius;
      const oy = player.y + Math.sin(orb.baseAngle) * orbRadius;
      orb.graphics.setPosition(ox, oy);

      // Slow aura: deal 5 DPS to nearby enemies (tick every 200ms)
      const slowRadius = 50;
      for (const enemy of this.scene.enemies) {
        if (!enemy || !enemy.active) continue;
        const dx = enemy.x - ox;
        const dy = enemy.y - oy;
        if (dx * dx + dy * dy < slowRadius * slowRadius) {
          // Apply slow + damage
          const dps = 5;
          const tickDamage = dps * (delta / 1000);
          enemy.takeDamage(tickDamage);
          // Slow effect: reduce enemy speed temporarily
          if (enemy._slowTimer === undefined) enemy._slowTimer = 0;
          enemy._slowTimer = 300; // 300ms slow
        }
      }
    }
  }

  // ── HUD ──

  _buildHUD() {
    this._synergyContainer = this.scene.add.container(0, 0)
      .setScrollFactor(0).setDepth(100);
  }

  _updateHUD() {
    // Clear old icons
    for (const icon of this._synergyIcons) icon.destroy();
    this._synergyIcons = [];

    const activeList = this.getActiveSynergies();
    if (activeList.length === 0) return;

    const sw = this.scene.scale.width;
    const startX = sw / 2 - (activeList.length * 36) / 2;
    const y = 130;

    activeList.forEach((def, i) => {
      const bg = this.scene.add.graphics();
      bg.fillStyle(0x000000, 0.5);
      bg.fillRoundedRect(0, 0, 32, 32, 6);
      bg.lineStyle(1, def.color, 0.6);
      bg.strokeRoundedRect(0, 0, 32, 32, 6);
      bg.setPosition(startX + i * 36, y);

      const icon = this.scene.add.text(startX + i * 36 + 16, y + 16, def.icon, {
        fontSize: '18px'
      }).setOrigin(0.5);

      const name = this.scene.add.text(startX + i * 36 + 16, y + 36, def.name, {
        fontSize: '8px', fontFamily: 'Arial, sans-serif', color: '#aaa'
      }).setOrigin(0.5, 0);

      this._synergyContainer.add(bg);
      this._synergyContainer.add(icon);
      this._synergyContainer.add(name);
      this._synergyIcons.push(bg, icon, name);
    });
  }

  // ── Utility ──

  getActiveSynergies() {
    const result = [];
    for (const [id] of this._activeSynergies) {
      const def = SynergySystem.SYNERGY_DEFS[id];
      if (def) result.push(def);
    }
    return result;
  }

  isSynergyActive(synergyId) {
    return this._activeSynergies.has(synergyId);
  }

  /** Force re-check (call after ability equip/unequip) */
  refresh() {
    this.checkSynergies();
  }

  destroy() {
    // Deactivate all
    for (const [id] of this._activeSynergies) {
      this._onSynergyDeactivated(id);
    }
    this._activeSynergies.clear();

    for (const icon of this._synergyIcons) icon.destroy();
    this._synergyIcons = [];

    if (this._synergyContainer) this._synergyContainer.destroy();
  }
}
