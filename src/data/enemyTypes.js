// enemyTypes.js — Vampire Survivors Clone
// 8 enemy types with distinct behaviors and progressive unlock times

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
  }
};
