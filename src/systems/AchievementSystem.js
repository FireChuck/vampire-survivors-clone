// AchievementSystem.js — Real-time in-game achievement tracking with HUD overlay
// 18 achievements across 7 categories, live condition checking, HUD counter + GameOver summary

class AchievementSystem {
  constructor(scene) {
    this.scene = scene;
    this._unlocked = new Set();
    this._hudText = null;
    this._lastBossCount = 0;
    this._lastChestCount = 0;
    this._lastEvolutionCount = 0;

    // Achievement definitions — 18 achievements in 7 categories
    this._definitions = [
      // ── Kill Tracker ──
      { id: 'kill_100', name: 'Centurion', desc: 'Defeat 100 enemies', icon: '⚔️', category: 'kills',
        condition: () => this.scene.killCount >= 100 },
      { id: 'kill_500', name: 'War Machine', desc: 'Defeat 500 enemies', icon: '💀', category: 'kills',
        condition: () => this.scene.killCount >= 500 },
      { id: 'kill_1000', name: 'Genocide', desc: 'Defeat 1,000 enemies', icon: '☠️', category: 'kills',
        condition: () => this.scene.killCount >= 1000 },
      { id: 'kill_5000', name: 'Apocalypse', desc: 'Defeat 5,000 enemies', icon: '🔥', category: 'kills',
        condition: () => this.scene.killCount >= 5000 },

      // ── Survival ──
      { id: 'survive_5', name: 'Survivor', desc: 'Survive for 5 minutes', icon: '⏱️', category: 'survival',
        condition: () => this._getGameTime() >= 300 },
      { id: 'survive_10', name: 'Endurance', desc: 'Survive for 10 minutes', icon: '🛡️', category: 'survival',
        condition: () => this._getGameTime() >= 600 },
      { id: 'survive_15', name: 'Veteran', desc: 'Survive for 15 minutes', icon: '🏆', category: 'survival',
        condition: () => this._getGameTime() >= 900 },
      { id: 'survive_30', name: 'Immortal', desc: 'Survive for 30 minutes', icon: '👑', category: 'survival',
        condition: () => this._getGameTime() >= 1800 },

      // ── Damage ──
      { id: 'damage_1k', name: 'Heavy Hitter', desc: 'Deal 1,000 total damage', icon: '💪', category: 'damage',
        condition: () => (this.scene._totalDamageDealt || 0) >= 1000 },
      { id: 'damage_5k', name: 'Glass Cannon', desc: 'Deal 5,000 total damage', icon: '💥', category: 'damage',
        condition: () => (this.scene._totalDamageDealt || 0) >= 5000 },
      { id: 'damage_10k', name: 'Annihilator', desc: 'Deal 10,000 total damage', icon: '☄️', category: 'damage',
        condition: () => (this.scene._totalDamageDealt || 0) >= 10000 },

      // ── Weapon Master ──
      { id: 'weapons_5', name: 'Arsenal', desc: 'Own 5 weapons simultaneously', icon: '🗡️', category: 'weapons',
        condition: () => (this.scene.player?.weapons?.length || 0) >= 5 },

      // ── Evolution ──
      { id: 'first_evolution', name: 'Evolved!', desc: 'Perform your first weapon evolution', icon: '✨', category: 'evolution',
        condition: () => this._getEvolutionCount() >= 1 },

      // ── Chest Opener ──
      { id: 'chests_10', name: 'Treasure Hunter', desc: 'Open 10 chests', icon: '📦', category: 'chests',
        condition: () => this._getChestCount() >= 10 },
      { id: 'chests_50', name: 'Plunderer', desc: 'Open 50 chests', icon: '💰', category: 'chests',
        condition: () => this._getChestCount() >= 50 },
      { id: 'chests_100', name: 'King of Loot', desc: 'Open 100 chests', icon: '🤑', category: 'chests',
        condition: () => this._getChestCount() >= 100 },

      // ── Boss Slayer ──
      { id: 'boss_10', name: 'Boss Hunter', desc: 'Defeat 10 bosses', icon: '🐉', category: 'boss',
        condition: () => this._getBossKillCount() >= 10 },
      { id: 'boss_50', name: 'Dragon Slayer', desc: 'Defeat 50 bosses', icon: '🦅', category: 'boss',
        condition: () => this._getBossKillCount() >= 50 }
    ];

    this._createHUD();
  }

  /** Initialize and listen for chest/boss events */
  init() {
    // Track chest opens via events
    this.scene.events.on('chestOpened', () => {
      this._lastChestCount++;
    });

    // Track boss kills — boss death triggers enemy death with isBoss flag
    this.scene.events.on('enemyKilled', (enemy) => {
      if (enemy.isBoss || enemy.isMiniBoss) {
        this._lastBossCount++;
      }
    });

    // Track evolutions
    if (this.scene.evolutionSystem) {
      const origEvolve = this.scene.evolutionSystem.evolve.bind(this.scene.evolutionSystem);
      this.scene.evolutionSystem.evolve = (...args) => {
        const result = origEvolve(...args);
        this._lastEvolutionCount++;
        return result;
      };
    }
  }

  /** Called every frame — checks all conditions */
  update(delta) {
    for (const def of this._definitions) {
      if (this._unlocked.has(def.id)) continue;
      try {
        if (def.condition()) {
          this._unlock(def);
        }
      } catch (e) {
        // Silently skip broken conditions
      }
    }
  }

  _unlock(def) {
    this._unlocked.add(def.id);
    // Show toast
    if (this.scene.achievementToast) {
      this.scene.achievementToast.show(def.icon, def.name, def.desc);
    }
    // Update HUD
    this._updateHUD();
  }

  _createHUD() {
    const total = this._definitions.length;
    const sw = this.scene.scale.width;
    this._hudText = this.scene.add.text(12, 42, `🏅 0/${total}`, {
      fontSize: '12px', fontFamily: 'Arial, sans-serif', color: '#ffd700',
      stroke: '#000', strokeThickness: 2
    }).setOrigin(0, 0).setScrollFactor(0).setDepth(100);
  }

  _updateHUD() {
    if (!this._hudText) return;
    const total = this._definitions.length;
    this._hudText.setText(`🏅 ${this._unlocked.size}/${total}`);
  }

  /** Get game time in seconds from HUD timer */
  _getGameTime() {
    return this.scene.hud?._elapsedSeconds || 0;
  }

  /** Get chest open count (tracked via events) */
  _getChestCount() {
    return this._lastChestCount;
  }

  /** Get boss kill count (tracked via events) */
  _getBossKillCount() {
    return this._lastBossCount;
  }

  /** Get evolution count */
  _getEvolutionCount() {
    if (this.scene.evolutionSystem?._evolvedWeapons) {
      return this.scene.evolutionSystem._evolvedWeapons.size;
    }
    return this._lastEvolutionCount;
  }

  /** Check if a specific achievement is unlocked */
  isUnlocked(id) {
    return this._unlocked.has(id);
  }

  /** Get stats object */
  getStats() {
    return {
      total: this._definitions.length,
      unlocked: this._unlocked.size,
      ids: [...this._unlocked]
    };
  }

  /** Build GameOver summary data — returns array of unlocked achievement defs */
  getUnlockedList() {
    return this._definitions.filter(d => this._unlocked.has(d.id));
  }

  /** Cleanup */
  destroy() {
    if (this._hudText) this._hudText.destroy();
    this._hudText = null;
  }
}
