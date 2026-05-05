// MetaProgression.js — Vampire Survivors Clone
// Persistent progression via localStorage

class MetaProgression {
  constructor() {
    this._storageKey = 'vsClone_meta';
    this.data = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(this._storageKey);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('MetaProgression: Failed to load, starting fresh.', e);
    }
    return this._defaultData();
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
      totalDamageDealt: 0
    };
  }

  _save() {
    try {
      localStorage.setItem(this._storageKey, JSON.stringify(this.data));
    } catch (e) {
      console.warn('MetaProgression: Failed to save.', e);
    }
  }

  // Called on game over with run stats
  recordRun(stats) {
    this.data.totalRuns++;
    this.data.totalKills += stats.kills || 0;
    this.data.totalPlayTime += stats.time || 0;

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
    this._checkAchievements(stats);

    this._save();
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
    // Cost check would go here if currency system exists
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
      permanentUpgrades: { ...this.data.permanentUpgrades }
    };
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
  }

  // Get list of new achievements from last run
  getAchievementInfo() {
    const all = [
      { id: 'first_blood', name: 'First Blood', desc: 'Kill 10 enemies in a run' },
      { id: 'survivor_5min', name: 'Survivor', desc: 'Survive 5 minutes' },
      { id: 'veteran_15min', name: 'Veteran', desc: 'Survive 15 minutes' },
      { id: 'massacre_100', name: 'Massacre', desc: 'Kill 100 enemies in a run' },
      { id: 'genocide_500', name: 'Genocide', desc: 'Kill 500 enemies in a run' },
      { id: 'level_10', name: 'Rising Star', desc: 'Reach Level 10' },
      { id: 'level_20', name: 'Powerhouse', desc: 'Reach Level 20' },
      { id: 'dedicated_5', name: 'Dedicated', desc: 'Complete 5 runs' },
      { id: 'hoarder_1k', name: 'Hoarder', desc: 'Total 1000 kills across runs' }
    ];
    return all;
  }
}
