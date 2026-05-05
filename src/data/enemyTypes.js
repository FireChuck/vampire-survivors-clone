// enemyTypes.js — Vampire Survivors Clone
// 9 enemy types with distinct behaviors and progressive unlock times

const ENEMY_TYPES = {
  bat: {
    name: 'Bat',
    color: 0x8844aa,
    hp: 15,
    speed: 120,
    damage: 8,
    xpValue: 5,
    size: [16, 16],
    minTime: 0
  },
  skeleton: {
    name: 'Skeleton',
    color: 0xccccaa,
    hp: 30,
    speed: 80,
    damage: 12,
    xpValue: 10,
    size: [20, 24],
    minTime: 0
  },
  zombie: {
    name: 'Zombie',
    color: 0x448844,
    hp: 50,
    speed: 50,
    damage: 15,
    xpValue: 15,
    size: [22, 22],
    minTime: 0
  },
  slime: {
    name: 'Slime',
    color: 0x44cc44,
    hp: 25,
    speed: 60,
    damage: 5,
    xpValue: 8,
    size: [20, 20],
    minTime: 30000
  },
  spider: {
    name: 'Spider',
    color: 0x332233,
    hp: 10,
    speed: 150,
    damage: 6,
    xpValue: 4,
    size: [14, 14],
    minTime: 60000
  },
  ghost: {
    name: 'Ghost',
    color: 0xaaddff,
    hp: 20,
    speed: 100,
    damage: 10,
    xpValue: 12,
    size: [18, 18],
    minTime: 120000
  },
  demon: {
    name: 'Demon',
    color: 0xcc2222,
    hp: 80,
    speed: 90,
    damage: 20,
    xpValue: 25,
    size: [26, 26],
    minTime: 180000
  },
  golem: {
    name: 'Golem',
    color: 0x887766,
    hp: 120,
    speed: 30,
    damage: 25,
    xpValue: 30,
    size: [32, 32],
    minTime: 300000
  },
  teleporter: {
    name: 'Teleporter',
    color: 0x8844ff,
    hp: 40,
    speed: 70,
    damage: 15,
    xpValue: 18,
    size: [18, 18],
    minTime: 120000
  },
  tank: {
    name: 'Tank',
    color: 0x2266aa,
    hp: 480,
    speed: 15,
    damage: 38,
    xpValue: 90,
    size: [38, 38],
    minTime: 300000
  },
  necromancer: {
    name: 'Necromancer',
    color: 0x7700bb,
    hp: 100,
    speed: 45,
    damage: 8,
    xpValue: 25,
    size: [28, 28],
    minTime: 0 // Handled by wave/DLC spawn, not minTime
  },
  fire_elemental: {
    name: 'Fire Elemental',
    color: 0xff6600,
    hp: 60,
    speed: 130,
    damage: 18,
    xpValue: 22,
    size: [20, 20],
    minTime: 180000,
    special: 'fire_trail',
    specialDesc: 'Leaves fire trail, explodes on death'
  },
  lava_golem: {
    name: 'Lava Golem',
    color: 0xaa3300,
    hp: 200,
    speed: 30,
    damage: 28,
    xpValue: 45,
    size: [34, 34],
    minTime: 240000,
    special: 'lava_projectile',
    specialDesc: 'Throws lava projectiles at player'
  }
};
