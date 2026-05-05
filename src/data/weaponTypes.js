// weaponTypes.js — Vampire Survivors Clone
// Global weapon type definitions

const WEAPON_TYPES = {
  staff: {
    name: 'Magic Staff',
    color: 0xffff00,
    damage: 15,
    cooldown: 800,
    speed: 300,
    piercing: 1,
    range: 600,
    projectileSize: 6
  },
  knife: {
    name: 'Throwing Knife',
    color: 0xcccccc,
    damage: 8,
    cooldown: 400,
    speed: 400,
    piercing: 1,
    range: 600,
    projectileSize: 4
  },
  axe: {
    name: 'Axe',
    color: 0xff8844,
    damage: 25,
    cooldown: 1500,
    speed: 200,
    piercing: 2,
    range: 600,
    projectileSize: 10
  },
  holyWater: {
    name: 'Holy Water',
    color: 0x4444ff,
    damage: 20,
    cooldown: 2000,
    speed: 150,
    piercing: 0,
    range: 600,
    projectileSize: 8,
    aoe: true
  },
  fireball: {
    name: 'Fireball',
    color: 0xff4400,
    damage: 30,
    cooldown: 1200,
    speed: 250,
    piercing: 3,
    range: 600,
    projectileSize: 8
  },
  lightning: {
    name: 'Lightning',
    color: 0xffff88,
    damage: 18,
    cooldown: 600,
    speed: 500,
    piercing: 1,
    range: 600,
    projectileSize: 3
  },
  garlic: {
    name: 'Garlic Aura',
    color: 0xffffff,
    damage: 5,
    cooldown: 0,
    speed: 0,
    piercing: 999,
    range: 120,
    projectileSize: 0,
    aura: true
  },
  whip: {
    name: 'Whip',
    color: 0x886644,
    damage: 12,
    cooldown: 1000,
    speed: 0,
    piercing: 3,
    range: 150,
    projectileSize: 0,
    melee: true
  },
  boomerang: {
    name: 'Boomerang',
    color: 0xff8800,
    damage: 20,
    cooldown: 1800,
    speed: 250,
    piercing: 5,
    range: 400,
    projectileSize: 8,
    boomerang: true
  },
  beam: {
    name: 'Beam Laser',
    color: 0x00ffff,
    damage: 8,
    cooldown: 3000, // 2s active + 1s cooldown = 3s total cycle
    speed: 0,
    piercing: 999,
    range: 400,
    projectileSize: 4,
    beamWidth: 4,
    beam: true
  },
  lightning_chain: {
    name: 'Lightning Chain',
    color: 0xaaddff,
    damage: 22,
    cooldown: 1400,
    speed: 450,
    piercing: 1,
    range: 500,
    projectileSize: 8,
    bounces: 3,
    bounceRange: 200,
    damageFalloff: 0.7
  },
  boomerang_dedicated: {
    name: 'Boomerang',
    color: 0xff8800,
    damage: 12,
    cooldown: 1200,
    speed: 250,
    piercing: 999,
    range: 300,
    projectileSize: 8
  },
  holyAura: {
    name: 'Holy Aura',
    color: 0xffd700,
    damage: 10,
    cooldown: 0,
    speed: 0,
    piercing: 999,
    range: 100,
    projectileSize: 0,
    aura: true,
    knockback: 80
  }
};
