// MetaProgression.js — Vampire Survivors Clone
// Persistent progression via localStorage with corrupt-save detection

class MetaProgression {
  constructor() {
    this._storageKey = 'vsClone_meta';
    this._loadResult = null; // tracks load status for validation
    this.data = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(this._storageKey);
      if (!raw) {
        this._loadResult = { status: 'empty', message: 'No save found — starting fresh' };
        return this._defaultData();
      }

      const parsed = JSON.parse(raw);
      const validation = this._validate(parsed);

      if (!validation.valid) {
        console.warn('MetaProgression: Corrupt save detected!', validation.errors);
        this._loadResult = { status: 'corrupt', message: 'Corrupt save detected — reset to defaults', errors: validation.errors };
        return this._defaultData();
      }

      this._loadResult = { status: 'ok', message: 'Save loaded successfully' };
      return parsed;
    } catch (e) {
      console.warn('MetaProgression: Failed to load, starting fresh.', e);
      this._loadResult = { status: 'error', message: 'Load error: ' + e.message };
      return this._defaultData();
    }
  }

  /**
   * Validate save data structure for corruption
   * @returns {{ valid: boolean, errors: string[] }}
   */
  _validate(data) {
    const errors = [];
    if (!data || typeof data !== 'object') {
      errors.push('Data is not an object');
      return { valid: false, errors };
    }

    // Required top-level fields with type checks
    const required = {
      totalRuns: 'number',
      highScore: 'number',
      totalKills: 'number',
      totalPlayTime: 'number',
      bestLevel: 'number',
      bestTime: 'number',
      unlockedCharacters: 'object',
      unlockedWeapons: 'object',
      permanentUpgrades: 'object',
      achievements: 'object',
      totalDamageDealt: 'number',
      totalBossKills: 'number'
    };

    for (const [key, type] of Object.entries(required)) {
      if (!(key in data)) {
        // Auto-migrate missing fields with defaults (backward compat)
        if (key === 'totalBossKills') {
          data.totalBossKills = 0;
          continue;
        }
        errors.push(`Missing field: ${key}`);
      } else if (typeof data[key] !== type) {
        errors.push(`Wrong type for ${key}: expected ${type}, got ${typeof data[key]}`);
      }
    }

    // Value sanity checks
    if (data.totalRuns < 0) errors.push('totalRuns is negative');
    if (data.highScore < 0) errors.push('highScore is negative');
    if (data.totalKills < 0) errors.push('totalKills is negative');
    if (data.bestLevel < 0) errors.push('bestLevel is negative');
    if (data.bestTime < 0) errors.push('bestTime is negative');
    if (data.totalDamageDealt < 0) errors.push('totalDamageDealt is negative');

    // Sanity: highScore shouldn't be astronomically large
    if (data.highScore > 1e12) errors.push('highScore exceeds sanity limit');

    // Arrays must be actual arrays
    if (!Array.isArray(data.unlockedCharacters)) errors.push('unlockedCharacters is not an array');
    if (!Array.isArray(data.unlockedWeapons)) errors.push('unlockedWeapons is not an array');
    if (!Array.isArray(data.achievements)) errors.push('achievements is not an array');

    // Permanent upgrades structure
    if (data.permanentUpgrades) {
      const upKeys = ['maxHpBonus', 'damageBonus', 'speedBonus'];
      for (const k of upKeys) {
        if (!(k in data.permanentUpgrades)) {
          errors.push(`Missing permanentUpgrade: ${k}`);
        } else if (typeof data.permanentUpgrades[k] !== 'number') {
          errors.push(`permanentUpgrade ${k} is not a number`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /** Get load result for UI feedback */
  getLoadResult() {
    return this._loadResult;
  }

  _defaultData() {
    return {
      totalRuns: 0,
      highScore: 0,
      totalKills: 0,
      totalPlayTime: 0,
      bestLevel: 0,
      bestTime: 0,
      unlockedCharacters: ['default'],
      unlockedWeapons: [],
      permanentUpgrades: {
        maxHpBonus: 0,
        damageBonus: 0,
        speedBonus: 0
      },
      achievements: [],
      totalDamageDealt: 0,
      totalBossKills: 0
    };
  }

  _save() {
    try {
      // Validate before saving
      const validation = this._validate(this.data);
      if (!validation.valid) {
        console.error('MetaProgression: Refusing to save corrupt data!', validation.errors);
        return false;
      }
      localStorage.setItem(this._storageKey, JSON.stringify(this.data));
      return true;
    } catch (e) {
      console.warn('MetaProgression: Failed to save.', e);
      return false;
    }
  }

  /**
   * Save with optional toast callback for UI feedback
   * @param {object} [options] - { toastCallback: function(success, message) }
   */
  saveWithFeedback(options) {
    const success = this._save();
    if (options && options.toastCallback) {
      options.toastCallback(success, success ? '💾 Saved!' : '⚠️ Save failed!');
    }
    return success;
  }

  // Called on game over with run stats
  recordRun(stats) {
    this.data.totalRuns++;
    this.data.totalKills += stats.kills || 0;
    this.data.totalPlayTime += stats.time || 0;
    if (stats.totalDamageDealt) {
      this.data.totalDamageDealt += stats.totalDamageDealt;
    }
    // Track boss kills
    if (stats.bossKills) {
      this.recordBossKill(stats.bossKills);
    }

    if (stats.score > this.data.highScore) {
      this.data.highScore = stats.score;
    }
    if ((stats.level || 0) > this.data.bestLevel) {
      this.data.bestLevel = stats.level;
    }
    if ((stats.time || 0) > this.data.bestTime) {
      this.data.bestTime = stats.time;
    }

    // Check achievements
    const achievementsBefore = [...this.data.achievements];
    this._checkAchievements(stats);
    const newAchievements = this.data.achievements.filter(a => !achievementsBefore.includes(a));

    // Check character unlocks
    const charUnlocks = this.checkCharacterUnlocks();

    this._save();

    return {
      wasHighScore: stats.score >= this.data.highScore && stats.score > 0,
      newAchievements: newAchievements,
      newCharacterUnlocks: charUnlocks.unlocked
    };
  }

  // Apply permanent upgrades to player at game start
  applyPermanentUpgrades(player) {
    const up = this.data.permanentUpgrades;
    if (up.maxHpBonus > 0) {
      player.maxHp += up.maxHpBonus;
      player.hp = player.maxHp;
    }
    if (up.damageBonus > 0) {
      player.stats.damageMultiplier += up.damageBonus;
    }
    if (up.speedBonus > 0) {
      player.stats.speed += up.speedBonus;
      player.speed += up.speedBonus;
    }
  }

  // Permanent upgrade purchase
  purchaseUpgrade(upgradeId, cost) {
    if (!this.data.permanentUpgrades.hasOwnProperty(upgradeId)) return false;
    this.data.permanentUpgrades[upgradeId] += 1;
    this._save();
    return true;
  }

  unlockWeapon(weaponId) {
    if (!this.data.unlockedWeapons.includes(weaponId)) {
      this.data.unlockedWeapons.push(weaponId);
      this._save();
      return true;
    }
    return false;
  }

  unlockCharacter(charId) {
    if (!this.data.unlockedCharacters.includes(charId)) {
      this.data.unlockedCharacters.push(charId);
      this._save();
      return true;
    }
    return false;
  }

  getUnlockedWeapons() {
    return this.data.unlockedWeapons;
  }

  getUnlockedCharacters() {
    return this.data.unlockedCharacters;
  }

  hasAchievement(id) {
    return this.data.achievements.includes(id);
  }

  unlockAchievement(id) {
    if (!this.data.achievements.includes(id)) {
      this.data.achievements.push(id);
      this._save();
      return true;
    }
    return false;
  }

  isNewHighScore(score) {
    return score > this.data.highScore;
  }

  getStats() {
    const m = String(Math.floor(this.data.bestTime / 60)).padStart(2, '0');
    const s = String(this.data.bestTime % 60).padStart(2, '0');
    return {
      totalRuns: this.data.totalRuns,
      highScore: this.data.highScore,
      totalKills: this.data.totalKills,
      totalPlayTime: this.data.totalPlayTime,
      bestLevel: this.data.bestLevel,
      bestTime: `${m}:${s}`,
      unlockedWeapons: this.data.unlockedWeapons.length,
      unlockedCharacters: this.data.unlockedCharacters.length,
      achievements: this.data.achievements.length,
      permanentUpgrades: { ...this.data.permanentUpgrades },
      loadResult: this._loadResult
    };
  }

  // Record a boss kill for unlock progression
  recordBossKill(count = 1) {
    if (!this.data.totalBossKills) this.data.totalBossKills = 0;
    this.data.totalBossKills += count;
    this._save();
  }

  getTotalBossKills() {
    return this.data.totalBossKills || 0;
  }

  /**
   * Check and unlock characters based on meta-progression stats.
   * Call this after recordRun() to auto-unlock characters.
   * @returns {{ unlocked: string[], alreadyUnlocked: string[] }}
   */
  checkCharacterUnlocks() {
    const unlocked = [];
    const alreadyUnlocked = [];

    // Mage: Reach Level 20 with any character
    if (this.data.bestLevel >= 20) {
      if (!this.data.unlockedCharacters.includes('mage')) {
        this.unlockCharacter('mage');
        unlocked.push('mage');
      } else {
        alreadyUnlocked.push('mage');
      }
    }

    // Barbarian: Defeat 5 bosses total
    if ((this.data.totalBossKills || 0) >= 5) {
      if (!this.data.unlockedCharacters.includes('barbarian')) {
        this.unlockCharacter('barbarian');
        unlocked.push('barbarian');
      } else {
        alreadyUnlocked.push('barbarian');
      }
    }

    // Rogue: Survive 15 minutes (900 seconds)
    if (this.data.bestTime >= 900) {
      if (!this.data.unlockedCharacters.includes('rogue')) {
        this.unlockCharacter('rogue');
        unlocked.push('rogue');
      } else {
        alreadyUnlocked.push('rogue');
      }
    }

    return { unlocked, alreadyUnlocked };
  }

  // Reset all progress
  resetAll() {
    this.data = this._defaultData();
    this._save();
  }

  _checkAchievements(stats) {
    // First Blood: Kill 10 enemies in a single run
    if (stats.kills >= 10) this.unlockAchievement('first_blood');
    // Survivor: Survive 5 minutes
    if (stats.time >= 300) this.unlockAchievement('survivor_5min');
    // Veteran: Survive 15 minutes
    if (stats.time >= 900) this.unlockAchievement('veteran_15min');
    // Massacre: Kill 100 enemies in a single run
    if (stats.kills >= 100) this.unlockAchievement('massacre_100');
    // Genocide: Kill 500 enemies in a single run
    if (stats.kills >= 500) this.unlockAchievement('genocide_500');
    // Level 10
    if (stats.level >= 10) this.unlockAchievement('level_10');
    // Level 20
    if (stats.level >= 20) this.unlockAchievement('level_20');
    // Dedicated: Play 5 runs
    if (this.data.totalRuns >= 5) this.unlockAchievement('dedicated_5');
    // Hoarder: Total 1000 kills
    if (this.data.totalKills >= 1000) this.unlockAchievement('hoarder_1k');
    // Glass Cannon: Deal 10000 damage in a run
    if (stats.totalDamageDealt >= 10000) this.unlockAchievement('glass_cannon_10k');
    // Speed Demon: Reach 10 DPS
    if (stats.dps >= 10) this.unlockAchievement('speed_demon');
  }

  // Get list of all achievements with info
  getAchievementInfo() {
    const all = [
      { id: 'first_blood', name: 'First Blood', desc: 'Kill 10 enemies in a run', icon: '🩸' },
      { id: 'survivor_5min', name: 'Survivor', desc: 'Survive 5 minutes', icon: '⏱' },
      { id: 'veteran_15min', name: 'Veteran', desc: 'Survive 15 minutes', icon: '🛡' },
      { id: 'massacre_100', name: 'Massacre', desc: 'Kill 100 enemies in a run', icon: '💀' },
      { id: 'genocide_500', name: 'Genocide', desc: 'Kill 500 enemies in a run', icon: '☠️' },
      { id: 'level_10', name: 'Rising Star', desc: 'Reach Level 10', icon: '⭐' },
      { id: 'level_20', name: 'Powerhouse', desc: 'Reach Level 20', icon: '🌟' },
      { id: 'dedicated_5', name: 'Dedicated', desc: 'Complete 5 runs', icon: '🎮' },
      { id: 'hoarder_1k', name: 'Hoarder', desc: 'Total 1000 kills across runs', icon: '🏆' },
      { id: 'glass_cannon_10k', name: 'Glass Cannon', desc: 'Deal 10,000 damage in a run', icon: '💥' },
      { id: 'speed_demon', name: 'Speed Demon', desc: 'Reach 10 DPS', icon: '⚡' }
    ];
    return all;
  }
}
