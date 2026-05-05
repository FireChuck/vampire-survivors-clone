// EvolutionSystem.js — Weapon Evolution (merge 2 weapons at max level into evolved form)
// Tracks weapon levels, defines evolution recipes, triggers evolution events with visual FX

class EvolutionSystem {
  constructor(scene) {
    this.scene = scene;
    this._evolutions = {};
    this._evolvedWeapons = new Set(); // keys of evolved weapons (prevents re-evolving)
  }

  // ── Evolution Recipes ──
  // weaponA + weaponB → evolvedKey (both must be level 5)
  static get RECIPES() {
    return {
      staff_knife: {
        evolved: 'holyWand',
        name: 'Holy Wand',
        description: 'Fires fast homing holy bolts with splash damage.',
        color: 0xffddff,
        damage: 35,
        cooldown: 500,
        speed: 350,
        piercing: 2,
        range: 650,
        projectileSize: 7,
        aoe: 40,
        passiveStat: { critChance: 0.1 }
      },
      fireball_axe: {
        evolved: 'infernoAxe',
        name: 'Inferno Axe',
        description: 'Burns enemies and leaves fire trails.',
        color: 0xff2200,
        damage: 45,
        cooldown: 1000,
        speed: 180,
        piercing: 4,
        range: 600,
        projectileSize: 12,
        burn: { damage: 8, duration: 3000 },
        passiveStat: { damageMultiplier: 0.15 }
      },
      lightning_whip: {
        evolved: 'thunderWhip',
        name: 'Thunder Whip',
        description: 'Whip that chains lightning to nearby enemies.',
        color: 0x88ddff,
        damage: 28,
        cooldown: 800,
        speed: 0,
        piercing: 6,
        range: 200,
        melee: true,
        projectileSize: 0,
        chain: { bounces: 3, bounceRange: 150, falloff: 0.6 },
        passiveStat: { cooldownReduction: 0.1 }
      },
      garlic_holyWater: {
        evolved: 'sanctuary',
        name: 'Sanctuary',
        description: 'Expanding holy zone that damages and slows enemies.',
        color: 0xffeedd,
        damage: 12,
        cooldown: 0,
        speed: 0,
        piercing: 999,
        range: 180,
        projectileSize: 0,
        aura: true,
        knockback: 60,
        slow: 0.4,
        passiveStat: { armor: 5 }
      },
      beam_boomerang: {
        evolved: 'deathRay',
        name: 'Death Ray',
        description: 'Rotating beam that sweeps enemies.',
        color: 0xff00ff,
        damage: 12,
        cooldown: 2500,
        speed: 0,
        piercing: 999,
        range: 500,
        projectileSize: 6,
        beam: true,
        beamWidth: 6,
        sweep: true,
        passiveStat: { xpMultiplier: 0.2 }
      },
      lightning_chain_holyAura: {
        evolved: 'divineStorm',
        name: 'Divine Storm',
        description: 'Lightning chains from holy aura hits.',
        color: 0xffffaa,
        damage: 20,
        cooldown: 0,
        speed: 0,
        piercing: 999,
        range: 140,
        projectileSize: 0,
        aura: true,
        knockback: 90,
        chainOnHit: { bounces: 2, bounceRange: 180, falloff: 0.65 },
        passiveStat: { pickupRange: 40 }
      }
    };
  }

  // ── Check if any evolution is possible ──
  checkEvolutions(weaponManager) {
    const weapons = weaponManager.weapons;
    const candidates = [];

    for (const [comboKey, recipe] of Object.entries(EvolutionSystem.RECIPES)) {
      if (this._evolvedWeapons.has(recipe.evolved)) continue;

      const [keyA, keyB] = comboKey.split('_');
      const wA = weapons.find(w => w.key === keyA && (w.level || 1) >= 5);
      const wB = weapons.find(w => w.key === keyB && (w.level || 1) >= 5);

      if (wA && wB) {
        candidates.push({ recipe, weaponA: wA, weaponB: wB, comboKey });
      }
    }

    return candidates;
  }

  // ── Evolve weapons (called when player accepts evolution) ──
  evolve(weaponManager, candidate) {
    const { recipe, weaponA, weaponB } = candidate;
    const scene = this.scene;

    // Remove base weapons from WeaponManager
    const idxA = weaponManager.weapons.indexOf(weaponA);
    if (idxA !== -1) weaponManager.weapons.splice(idxA, 1);
    const idxB = weaponManager.weapons.indexOf(weaponB);
    if (idxB !== -1) weaponManager.weapons.splice(idxB, 1);

    // Remove aura instances if applicable
    if (weaponManager._auraWeapons) {
      weaponManager._auraWeapons = weaponManager._auraWeapons.filter(
        a => a._weaponKey !== weaponA.key && a._weaponKey !== weaponB.key
      );
    }

    // Register evolved weapon type globally
    WEAPON_TYPES[recipe.evolved] = {
      name: recipe.name,
      description: recipe.description,
      color: recipe.color,
      damage: recipe.damage,
      cooldown: recipe.cooldown,
      speed: recipe.speed,
      piercing: recipe.piercing,
      range: recipe.range,
      projectileSize: recipe.projectileSize,
      ...(recipe.aoe ? { aoe: recipe.aoe } : {}),
      ...(recipe.aura ? { aura: recipe.aura, knockback: recipe.knockback } : {}),
      ...(recipe.melee ? { melee: recipe.melee } : {}),
      ...(recipe.beam ? { beam: true, beamWidth: recipe.beamWidth || 4 } : {}),
      ...(recipe.burn ? { burn: recipe.burn } : {}),
      ...(recipe.chain ? { chain: recipe.chain } : {}),
      ...(recipe.chainOnHit ? { chainOnHit: recipe.chainOnHit } : {}),
      ...(recipe.sweep ? { sweep: true } : {}),
      ...(recipe.slow ? { slow: recipe.slow } : {}),
      upgradeNotes: {
        1: 'Evolved weapon — already powerful!'
      }
    };

    // Add evolved weapon
    weaponManager.addWeapon(recipe.evolved);
    this._evolvedWeapons.add(recipe.evolved);

    // Apply passive stat bonus
    if (recipe.passiveStat) {
      this._applyPassiveStat(recipe.passiveStat);
    }

    // Visual FX
    this._showEvolutionFX(recipe);

    // Track evolution
    this._evolutions[recipe.evolved] = {
      from: [weaponA.key, weaponB.key],
      recipe: recipe.name,
      timestamp: Date.now()
    };

    return recipe;
  }

  // ── Apply passive stat from evolution ──
  _applyPassiveStat(stats) {
    const player = this.scene.player;
    if (!player || !player.stats) return;

    if (stats.critChance) {
      player.critChance = (player.critChance || 0) + stats.critChance;
      if (this.scene.critSystem) {
        this.scene.critSystem.applyStats({ critChance: stats.critChance });
      }
    }
    if (stats.damageMultiplier) {
      player.stats.damageMultiplier = (player.stats.damageMultiplier || 1) + stats.damageMultiplier;
    }
    if (stats.cooldownReduction) {
      player.stats.cooldownReduction = (player.stats.cooldownReduction || 0) + stats.cooldownReduction;
    }
    if (stats.armor) {
      player.stats.armor = (player.stats.armor || 0) + stats.armor;
    }
    if (stats.xpMultiplier) {
      player.stats.xpMultiplier = (player.stats.xpMultiplier || 1) + stats.xpMultiplier;
    }
    if (stats.pickupRange) {
      player.stats.pickupRange = (player.stats.pickupRange || 0) + stats.pickupRange;
    }
  }

  // ── Evolution visual effects ──
  _showEvolutionFX(recipe) {
    const scene = this.scene;
    const px = scene.player.x;
    const py = scene.player.y;

    // Flash circle
    const flash = scene.add.circle(px, py, 10, recipe.color, 0.8).setDepth(30);
    scene.tweens.add({
      targets: flash,
      radius: 120,
      alpha: 0,
      duration: 800,
      onComplete: () => flash.destroy()
    });

    // Rising particles
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 / 12) * i;
      const particle = scene.add.circle(
        px + Math.cos(angle) * 30,
        py + Math.sin(angle) * 30,
        3, recipe.color, 0.9
      ).setDepth(31);
      scene.tweens.add({
        targets: particle,
        x: px + Math.cos(angle) * 100,
        y: py - 60,
        alpha: 0,
        scale: 0.2,
        duration: 600 + Math.random() * 400,
        onComplete: () => particle.destroy()
      });
    }

    // Screen shake
    if (scene.screenShake) {
      scene.screenShake.shake(4, 300);
    }

    // Toast notification
    const toastText = `⚡ EVOLVED: ${recipe.name} — ${recipe.description}`;
    if (scene.achievementToast) {
      scene.achievementToast.show(toastText, recipe.color);
    }
  }

  // ── Hook into level-up: auto-check after upgrade ──
  onWeaponLevelUp(weaponManager) {
    const candidates = this.checkEvolutions(weaponManager);
    if (candidates.length === 0) return null;

    // Return first available evolution for UI prompt
    const best = candidates[0];
    return {
      weaponA: best.weaponA,
      weaponB: best.weaponB,
      recipe: best.recipe,
      prompt: `Evolve ${WEAPON_TYPES[best.weaponA.key]?.name || best.weaponA.key} + ${WEAPON_TYPES[best.weaponB.key]?.name || best.weaponB.key} → ${best.recipe.name}?`
    };
  }

  // ── Get evolution info for UI display ──
  getEvolutionProgress(weaponManager) {
    const weapons = weaponManager.weapons;
    const progress = [];

    for (const [comboKey, recipe] of Object.entries(EvolutionSystem.RECIPES)) {
      if (this._evolvedWeapons.has(recipe.evolved)) continue;

      const [keyA, keyB] = comboKey.split('_');
      const wA = weapons.find(w => w.key === keyA);
      const wB = weapons.find(w => w.key === keyB);

      if (wA || wB) {
        progress.push({
          comboKey,
          recipe: recipe.name,
          weaponA: wA ? { key: keyA, name: WEAPON_TYPES[keyA]?.name || keyA, level: wA.level || 1 } : null,
          weaponB: wB ? { key: keyB, name: WEAPON_TYPES[keyB]?.name || keyB, level: wB.level || 1 } : null,
          ready: wA && wB && (wA.level || 1) >= 5 && (wB.level || 1) >= 5
        });
      }
    }

    return progress;
  }

  // ── Serialization ──
  serialize() {
    return {
      evolvedWeapons: Array.from(this._evolvedWeapons),
      evolutions: this._evolutions
    };
  }

  deserialize(data) {
    if (!data) return;
    if (data.evolvedWeapons) {
      this._evolvedWeapons = new Set(data.evolvedWeapons);
    }
    if (data.evolutions) {
      this._evolutions = data.evolutions;
    }
  }
}
