/**
 * gameConfig.js — Central Game Configuration
 * Vampire Survivors Clone — Global Script (no ES6 modules)
 */

const GAME_CONFIG = {
  // ── Spawn System ──
  spawnIntervalStart: 2000,    // ms between spawn waves at game start
  spawnIntervalMin: 300,       // minimum spawn interval (cap)
  spawnIntervalDecrease: 50,   // ms decrease per minute of gameplay
  maxEnemies: 150,             // max concurrent enemies on screen
  spawnRadius: 600,            // spawn distance from player (off-screen edge)

  // ── XP & Leveling ──
  xpBase: 10,                  // XP needed for level 1→2
  xpMultiplier: 1.4,           // XP curve: xp = base * level^multiplier
  xpOrbValue: 1,               // base XP per small orb
  xpOrbMagnetRange: 80,        // pixels — auto-collect range
  xpOrbLifetime: 30000,        // XP orbs despawn after 30s
  levelUpChoices: 3,           // number of upgrade choices per level-up

  // ── Player ──
  playerSpeed: 150,            // pixels per second
  playerHP: 10,                // starting HP
  playerInvincibilityMs: 800,  // invincibility frames after hit
  playerPickupRange: 60,       // item auto-pickup radius

  // ── Weapons (defaults) ──
  weaponBaseDamage: 2,         // base damage for starter weapon
  weaponBaseCooldown: 1200,    // ms between auto-attacks
  weaponBaseProjectileSpeed: 300,

  // ── Camera ──
  cameraLerp: 0.08,            // camera follow smoothing (lower = smoother)
  cameraZoom: 1.0,             // default zoom level

  // ── World / Map ──
  worldWidth: 4000,
  worldHeight: 4000,
  tileSize: 64,

  // ── Game Duration ──
  gameDurationMinutes: 30,     // target game length
  chestSpawnInterval: 60,      // seconds between item chest spawns

  // ── Performance ──
  maxParticles: 200,
  enemyDespawnDistance: 1200,  // remove enemies this far off-screen
  targetFPS: 60,
};
