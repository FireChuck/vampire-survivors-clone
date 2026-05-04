/**
 * levelProgression.js — Enemy Spawning & Difficulty Curve
 * Vampire Survivors Clone — Global Script (no ES6 modules)
 */

/**
 * Enemy roster that unlocks over time.
 * `time` = seconds since game start.
 * Enemies from earlier tiers continue spawning.
 */
const LEVEL_PROGRESSION = [
  { time: 0,   enemies: ['bat', 'slime'],                    maxPerWave: 4,  description: 'Easy — slow, low HP' },
  { time: 30,  enemies: ['bat', 'slime', 'skeleton'],        maxPerWave: 6,  description: 'Warming up' },
  { time: 60,  enemies: ['bat', 'slime', 'skeleton', 'zombie'], maxPerWave: 8, description: 'First real threat' },
  { time: 120, enemies: ['skeleton', 'zombie', 'ghost', 'spider'], maxPerWave: 10, description: 'Mid-game pressure' },
  { time: 180, enemies: ['zombie', 'ghost', 'demon', 'spider'],  maxPerWave: 12, description: 'Hard — tanky enemies' },
  { time: 300, enemies: ['ghost', 'demon', 'golem'],              maxPerWave: 14, description: 'Endgame — relentless' },
];

/**
 * Time-based difficulty multipliers.
 * Applied every second: currentMultiplier = base * (1 + rate * minutesElapsed)
 */
const DIFFICULTY_SCALER = {
  hpMultiplier:       { base: 1.0, ratePerMinute: 0.08 },   // +8% HP per minute
  speedMultiplier:    { base: 1.0, ratePerMinute: 0.04 },   // +4% speed per minute
  spawnRateMultiplier:{ base: 1.0, ratePerMinute: 0.12 },   // +12% spawn rate per minute
};

/**
 * Enemy stat templates.
 * Base stats before DIFFICULTY_SCALER is applied.
 */
const ENEMY_STATS = {
  bat:      { hp: 3,  speed: 100, damage: 1, xpValue: 1, size: 16, color: 0x8b5cf6 },
  slime:    { hp: 5,  speed: 50,  damage: 1, xpValue: 2, size: 20, color: 0x22c55e },
  skeleton: { hp: 8,  speed: 70,  damage: 2, xpValue: 3, size: 22, color: 0xd4d4d8 },
  zombie:   { hp: 15, speed: 40,  damage: 3, xpValue: 4, size: 24, color: 0x65a30d },
  ghost:    { hp: 6,  speed: 90,  damage: 2, xpValue: 3, size: 18, color: 0xa5b4fc },
  spider:   { hp: 10, speed: 120, damage: 2, xpValue: 3, size: 16, color: 0x1e1e1e },
  demon:    { hp: 30, speed: 60,  damage: 5, xpValue: 8, size: 30, color: 0xdc2626 },
  golem:    { hp: 60, speed: 25,  damage: 8, xpValue: 15, size: 40, color: 0x78716c },
};

/**
 * XP required to reach a given player level.
 * @param {number} level - Target level (1-indexed)
 * @returns {number} Total XP needed to reach this level
 */
function getXpForLevel(level) {
  if (level <= 1) return 0;
  // Cumulative XP: sum of base * i^multiplier for i=1..level-1
  let total = 0;
  var base = GAME_CONFIG ? GAME_CONFIG.xpBase : 10;
  var mult = GAME_CONFIG ? GAME_CONFIG.xpMultiplier : 1.4;
  for (var i = 1; i < level; i++) {
    total += Math.floor(base * Math.pow(i, mult));
  }
  return total;
}

/**
 * Get the active enemy pool for a given game time.
 * @param {number} elapsedSeconds
 * @returns {object} Current progression tier
 */
function getActiveTier(elapsedSeconds) {
  var active = LEVEL_PROGRESSION[0];
  for (var i = 0; i < LEVEL_PROGRESSION.length; i++) {
    if (elapsedSeconds >= LEVEL_PROGRESSION[i].time) {
      active = LEVEL_PROGRESSION[i];
    }
  }
  return active;
}

/**
 * Calculate scaled enemy stats at a given game time.
 * @param {string} enemyType - Key from ENEMY_STATS
 * @param {number} elapsedSeconds - Seconds since game start
 * @returns {object} Scaled stats
 */
function getScaledEnemyStats(enemyType, elapsedSeconds) {
  var base = ENEMY_STATS[enemyType];
  if (!base) return null;

  var minutes = elapsedSeconds / 60;
  var hpScale     = DIFFICULTY_SCALER.hpMultiplier.base + DIFFICULTY_SCALER.hpMultiplier.ratePerMinute * minutes;
  var speedScale  = DIFFICULTY_SCALER.speedMultiplier.base + DIFFICULTY_SCALER.speedMultiplier.ratePerMinute * minutes;

  return {
    hp:     Math.floor(base.hp * hpScale),
    speed:  base.speed * speedScale,
    damage: base.damage,
    xpValue: base.xpValue,
    size:   base.size,
    color:  base.color,
  };
}
