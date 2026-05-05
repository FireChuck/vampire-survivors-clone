/**
 * biomeDesign.js — World Biome Zones & Decorations
 * Vampire Survivors Clone — Global Script (no ES6 modules)
 */

/**
 * 6 biome zones + 1 dungeon overlay covering the world map.
 * Coordinates match GAME_CONFIG.worldWidth/worldHeight (6000×4000).
 * Player starts at center (2000, 2000) — Catacombs/Forest border.
 *
 * Layout:
 *   Top-left:     Graveyard (0,0 → 2000,2000)
 *   Top-mid:      Dark Forest (2000,0 → 4000,2000)
 *   Top-right:    Volcanic (4000,0 → 6000,2000)
 *   Bot-left-top: Blood Moor (0,2000 → 2000,3000)
 *   Bot-left-bot: Cursed Swamp (0,3000 → 2000,4000)
 *   Bot-mid-right:Catacombs (2000,2000 → 4000,4000)
 *   Bot-right:    Volcanic (4000,2000 → 6000,4000)
 *   Overlay:      Dungeon (2200,2200 → 2600,2600) inside Catacombs
 */
var BIOME_ZONES = [
  // Check dungeon FIRST (smallest, highest priority)
  {
    name: 'Dungeon',
    x: 2200, y: 2200,
    width: 400, height: 400,
    bgColor: 0x0a0a0a,
    groundColor: 0x111111,
    groundTile: 'dungeon_floor',
    ambientLight: 0.3,
    isDungeon: true,
  },
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
    width: 2000, height: 1000,
    bgColor: 0x2e1a1a,
    groundColor: 0x442d2d,
    groundTile: 'dirt_blood',
    ambientLight: 0.55,
  },
  {
    name: 'Cursed Swamp',
    x: 0, y: 3000,
    width: 2000, height: 1000,
    bgColor: 0x0d1f0d,
    groundColor: 0x1a3318,
    groundTile: 'swamp_mud',
    ambientLight: 0.35,
    isSwamp: true,
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
  {
    name: 'Volcanic',
    x: 4000, y: 0,
    width: 2000, height: 4000,
    bgColor: 0x2e0a0a,
    groundColor: 0x1a0808,
    groundTile: 'volcanic_rock',
    ambientLight: 0.7,
    isVolcanic: true,
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
  CursedSwamp: [
    { type: 'poison_pool', width: 56, height: 56, color: 0x445522, density: 0.008, alpha: 0.35 },
    { type: 'dead_tree',   width: 32, height: 56, color: 0x2a3322, density: 0.006 },
    { type: 'swamp_gas',   width: 48, height: 48, color: 0x667744, density: 0.005, alpha: 0.2 },
    { type: 'mushroom',    width: 14, height: 18, color: 0x88aa44, density: 0.007 },
    { type: 'fog_patch',   width: 80, height: 80, color: 0x556633, density: 0.006, alpha: 0.12 },
  ],
  Catacombs: [
    { type: 'pillar',      width: 24, height: 48, color: 0x525252, density: 0.006 },
    { type: 'crack',       width: 40, height: 8,  color: 0x292524, density: 0.004 },
    { type: 'skull',       width: 14, height: 16, color: 0xe7e5e4, density: 0.005 },
    { type: 'rubble',      width: 32, height: 24, color: 0x44403c, density: 0.005 },
  ],
  Dungeon: [
    { type: 'torch',       width: 10, height: 32, color: 0xf59e0b, density: 0.008, flicker: true },
    { type: 'iron_gate',   width: 48, height: 64, color: 0x374151, density: 0.002 },
    { type: 'chains',      width: 20, height: 40, color: 0x6b7280, density: 0.004 },
    { type: 'blood_stain', width: 32, height: 32, color: 0x7f1d1d, density: 0.006, alpha: 0.35 },
    { type: 'skull',       width: 14, height: 16, color: 0xe7e5e4, density: 0.004 },
  ],
  Volcanic: [
    { type: 'lava_crack',  width: 60, height: 8,  color: 0xff4400, density: 0.01, alpha: 0.6, emissive: true },
    { type: 'lava_pool',   width: 48, height: 48, color: 0xff2200, density: 0.005, alpha: 0.45 },
    { type: 'obsidian',    width: 28, height: 24, color: 0x1a1a2e, density: 0.007 },
    { type: 'ember_vent',  width: 16, height: 16, color: 0xff6600, density: 0.004, emissive: true },
    { type: 'ash_pile',    width: 36, height: 20, color: 0x444444, density: 0.006 },
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
  CursedSwamp: ['slime', 'ghost', 'tank'],
  Catacombs:  ['golem', 'ghost', 'demon'],
  Dungeon:    ['golem', 'demon'],
  Volcanic:   ['fire_elemental', 'lava_golem', 'demon'],
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
