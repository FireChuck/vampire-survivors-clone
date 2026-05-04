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
    range: 200,
    projectileSize: 6
  },
  knife: {
    name: 'Throwing Knife',
    color: 0xcccccc,
    damage: 8,
    cooldown: 400,
    speed: 400,
    piercing: 1,
    range: 150,
    projectileSize: 4
  },
  axe: {
    name: 'Axe',
    color: 0xff8844,
    damage: 25,
    cooldown: 1500,
    speed: 200,
    piercing: 2,
    range: 120,
    projectileSize: 10
  },
  holyWater: {
    name: 'Holy Water',
    color: 0x4444ff,
    damage: 20,
    cooldown: 2000,
    speed: 150,
    piercing: 0,
    range: 100,
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
    range: 250,
    projectileSize: 8
  },
  lightning: {
    name: 'Lightning',
    color: 0xffff88,
    damage: 18,
    cooldown: 600,
    speed: 500,
    piercing: 1,
    range: 300,
    projectileSize: 3
  },
  garlic: {
    name: 'Garlic Aura',
    color: 0xffffff,
    damage: 5,
    cooldown: 0,
    speed: 0,
    piercing: 999,
    range: 60,
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
    range: 80,
    projectileSize: 0,
    melee: true
  }
};
