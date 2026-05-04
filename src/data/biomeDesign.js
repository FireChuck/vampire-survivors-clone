/**
 * biomeDesign.js — World Biome Zones & Decorations
 * Vampire Survivors Clone — Global Script (no ES6 modules)
 */

/**
 * 4 biome quadrants covering the world map.
 * Coordinates match GAME_CONFIG.worldWidth/worldHeight (4000×4000).
 * Player starts at center (2000, 2000) — Graveyard/Forest border.
 */
var BIOME_ZONES = [
  {
    name: 'Graveyard',
    x: 0, y: 0,
    width: 2000, height: 2000,
    bgColor: 0x1a1a2e,
    groundColor: 0x2d2d44,
    groundTile: 'dark_stone',
    ambientLight: 0.6,
  },
  {
    name: 'Dark Forest',
    x: 2000, y: 0,
    width: 2000, height: 2000,
    bgColor: 0x0d1b0e,
    groundColor: 0x1a3a1c,
    groundTile: 'grass_dark',
    ambientLight: 0.5,
  },
  {
    name: 'Blood Moor',
    x: 0, y: 2000,
    width: 2000, height: 2000,
    bgColor: 0x2e1a1a,
    groundColor: 0x442d2d,
    groundTile: 'dirt_blood',
    ambientLight: 0.55,
  },
  {
    name: 'Catacombs',
    x: 2000, y: 2000,
    width: 2000, height: 2000,
    bgColor: 0x1a1a1a,
    groundColor: 0x333333,
    groundTile: 'stone_floor',
    ambientLight: 0.45,
  },
];

/**
 * Decoration types per biome.
 * Each decoration has rendering hints.
 */
var BIOME_DECORATIONS = {
  Graveyard: [
    { type: 'tombstone',   width: 24, height: 32, color: 0x6b7280, density: 0.008 },
    { type: 'dead_tree',   width: 32, height: 48, color: 0x374151, density: 0.005 },
    { type: 'fog_patch',   width: 64, height: 64, color: 0x9ca3af, density: 0.003, alpha: 0.15 },
    { type: 'cross',       width: 16, height: 28, color: 0x78716c, density: 0.004 },
  ],
  DarkForest: [
    { type: 'tree',        width: 40, height: 56, color: 0x15803d, density: 0.012 },
    { type: 'mushroom',    width: 12, height: 16, color: 0xa855f7, density: 0.006 },
    { type: 'rock',        width: 20, height: 18, color: 0x57534e, density: 0.007 },
    { type: 'bush',        width: 28, height: 24, color: 0x166534, density: 0.008 },
  ],
  BloodMoor: [
    { type: 'blood_pool',  width: 48, height: 48, color: 0x991b1b, density: 0.005, alpha: 0.4 },
    { type: 'bone_pile',   width: 24, height: 20, color: 0xd4d4d8, density: 0.006 },
    { type: 'corpse',      width: 28, height: 16, color: 0x7f1d1d, density: 0.003 },
    { type: 'torch',       width: 10, height: 24, color: 0xf59e0b, density: 0.004, emissive: true },
  ],
  Catacombs: [
    { type: 'pillar',      width: 24, height: 48, color: 0x525252, density: 0.006 },
    { type: 'crack',       width: 40, height: 8,  color: 0x292524, density: 0.004 },
    { type: 'skull',       width: 14, height: 16, color: 0xe7e5e4, density: 0.005 },
    { type: 'rubble',      width: 32, height: 24, color: 0x44403c, density: 0.005 },
  ],
};

/**
 * Enemy type affinities per biome.
 * Certain enemies appear more frequently in their home biome.
 */
var BIOME_ENEMY_AFFINITY = {
  Graveyard:  ['skeleton', 'ghost', 'bat'],
  DarkForest: ['spider', 'slime', 'bat'],
  BloodMoor:  ['zombie', 'demon', 'skeleton'],
  Catacombs:  ['golem', 'ghost', 'demon'],
};

/**
 * Get the biome for a given world position.
 * @param {number} x
 * @param {number} y
 * @returns {object|null} Biome zone object or null
 */
function getBiomeAtPosition(x, y) {
  for (var i = 0; i < BIOME_ZONES.length; i++) {
    var zone = BIOME_ZONES[i];
    if (x >= zone.x && x < zone.x + zone.width &&
        y >= zone.y && y < zone.y + zone.height) {
      return zone;
    }
  }
  return null;
}

/**
 * Get decorations for a biome name.
 * @param {string} biomeName
 * @returns {Array} Decoration array
 */
function getDecorationsForBiome(biomeName) {
  return BIOME_DECORATIONS[biomeName] || [];
}

/**
 * Get enemy affinity list for a biome.
 * Enemies in this list get a spawn weight bonus.
 * @param {string} biomeName
 * @returns {Array} Enemy type strings
 */
function getBiomeEnemyAffinity(biomeName) {
  return BIOME_ENEMY_AFFINITY[biomeName] || [];
}
