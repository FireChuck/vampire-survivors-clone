// CritSystem.js — Critical hit system (5% chance, 2x damage, gold damage numbers, screen flash)

class CritSystem {
  constructor(scene) {
    this.scene = scene;

    // Configurable
    this.critChance = 0.05;       // 5% base crit chance
    this.critMultiplier = 2.0;    // 2x damage on crit
    this.flashDuration = 100;     // 100ms screen flash
  }

  /**
   * Check if an attack is a critical hit.
   * @returns {{ isCrit: boolean, damage: number }}
   */
  rollCrit(baseDamage) {
    const isCrit = Math.random() < this.critChance;
    if (isCrit) {
      return {
        isCrit: true,
        damage: Math.floor(baseDamage * this.critMultiplier)
      };
    }
    return {
      isCrit: false,
      damage: baseDamage
    };
  }

  /**
   * Apply crit visual effects (screen flash, damage numbers, screen shake).
   * Call this when a crit is confirmed.
   */
  applyCritEffects(x, y, damage) {
    // Screen flash — white flash
    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;
    const flash = this.scene.add.rectangle(sw / 2, sh / 2, sw, sh, 0xffffff, 0)
      .setDepth(998).setScrollFactor(0);

    this.scene.tweens.add({
      targets: flash,
      alpha: 0.5,
      duration: 50,
      yoyo: true,
      onComplete: () => flash.destroy()
    });

    // Gold damage number
    if (this.scene.damageNumbers) {
      this.scene.damageNumbers.show(x, y - 15, damage, 'crit', 'holy', true);
    }

    // Screen shake on crit
    if (this.scene.screenShake) {
      this.scene.screenShake.shake('crit');
    }
  }

  /**
   * Apply player crit stats (chance, multiplier).
   */
  applyStats(stats) {
    if (stats.critChance !== undefined) {
      this.critChance = Math.max(0, Math.min(1, stats.critChance));
    }
    if (stats.critMultiplier !== undefined) {
      this.critMultiplier = Math.max(1, stats.critMultiplier);
    }
  }
}
