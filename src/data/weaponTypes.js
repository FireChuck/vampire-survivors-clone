// weaponTypes.js — Vampire Survivors Clone
// Global weapon type definitions

const WEAPON_TYPES = {
  staff: {
    name: 'Magic Staff',
    description: 'Fires a bolt of arcane energy.',
    color: 0xffff00,
    damage: 15,
    cooldown: 800,
    speed: 300,
    piercing: 1,
    range: 600,
    projectileSize: 6,
    upgradeNotes: {
      2: '+1 projectile, +10% damage',
      3: '+1 projectile, +15% damage, larger bolts',
      4: '+1 projectile, +20% damage',
      5: '+2 projectiles, piercing, +25% damage'
    }
  },
  knife: {
    name: 'Throwing Knife',
    description: 'Throws fast knives at the nearest enemy.',
    color: 0xcccccc,
    damage: 8,
    cooldown: 400,
    speed: 400,
    piercing: 1,
    range: 600,
    projectileSize: 4,
    upgradeNotes: {
      2: '+2 knives, +10% damage',
      3: '+2 knives, +15% damage, faster throw',
      4: '+2 knives, piercing',
      5: '+3 knives, +25% damage, critical chance'
    }
  },
  axe: {
    name: 'Axe',
    description: 'Hurls a heavy spinning axe that pierces enemies.',
    color: 0xff8844,
    damage: 25,
    cooldown: 1500,
    speed: 200,
    piercing: 2,
    range: 600,
    projectileSize: 10,
    upgradeNotes: {
      2: '+1 axe, +12% damage',
      3: '+1 axe, +3 pierce',
      4: '+1 axe, +20% damage, larger hitbox',
      5: '+2 axes, +30% damage, knockback'
    }
  },
  holyWater: {
    name: 'Holy Water',
    description: 'Throws a flask that explodes in an area of effect.',
    color: 0x4444ff,
    damage: 20,
    cooldown: 2000,
    speed: 150,
    piercing: 0,
    range: 600,
    projectileSize: 8,
    aoe: true,
    upgradeNotes: {
      2: '+1 flask, +15% explosion radius',
      3: '+1 flask, +20% damage',
      4: '+1 flask, slow enemies in area',
      5: '+2 flasks, massive explosion, +30% damage'
    }
  },
  fireball: {
    name: 'Fireball',
    description: 'Launches an explosive fireball that pierces multiple enemies.',
    color: 0xff4400,
    damage: 30,
    cooldown: 1200,
    speed: 250,
    piercing: 3,
    range: 600,
    projectileSize: 8,
    upgradeNotes: {
      2: '+1 fireball, +15% damage',
      3: '+1 fireball, larger explosion',
      4: '+1 fireball, +2 pierce, burn DoT',
      5: '+2 fireballs, +30% damage, chain explosions'
    }
  },
  lightning: {
    name: 'Lightning',
    description: 'Strikes a random nearby enemy with a bolt of lightning.',
    color: 0xffff88,
    damage: 18,
    cooldown: 600,
    speed: 500,
    piercing: 1,
    range: 600,
    projectileSize: 3,
    upgradeNotes: {
      2: 'Strikes 2 enemies, +12% damage',
      3: 'Strikes 3 enemies, stun chance',
      4: 'Strikes 4 enemies, +25% damage',
      5: 'Strikes 5 enemies, chain lightning, +30% damage'
    }
  },
  garlic: {
    name: 'Garlic Aura',
    description: 'Passive aura that damages all nearby enemies.',
    color: 0xffffff,
    damage: 5,
    cooldown: 0,
    speed: 0,
    piercing: 999,
    range: 120,
    projectileSize: 0,
    aura: true,
    upgradeNotes: {
      2: '+20% range, +10% damage',
      3: '+20% range, knockback',
      4: '+20% range, +25% damage, slow aura',
      5: 'Massive range, fear effect, +35% damage'
    }
  },
  whip: {
    name: 'Whip',
    description: 'Attacks enemies in a wide arc in front of you.',
    color: 0x886644,
    damage: 12,
    cooldown: 1000,
    speed: 0,
    piercing: 3,
    range: 150,
    projectileSize: 0,
    melee: true,
    upgradeNotes: {
      2: '+1 hit, +15% range',
      3: '+1 hit, +20% damage',
      4: '+1 hit, 360° coverage',
      5: '+2 hits, +30% damage, knockback'
    }
  },
  boomerang: {
    name: 'Boomerang',
    description: 'Throws a boomerang that returns to you, hitting enemies twice.',
    color: 0xff8800,
    damage: 20,
    cooldown: 1800,
    speed: 250,
    piercing: 5,
    range: 400,
    projectileSize: 8,
    boomerang: true,
    upgradeNotes: {
      2: '+1 boomerang, +12% damage',
      3: '+1 boomerang, +20% range',
      4: '+1 boomerang, +25% damage',
      5: '+2 boomerangs, +30% damage, stun on return'
    }
  },
  beam: {
    name: 'Beam Laser',
    description: 'Fires a sustained laser beam that damages all enemies in its path.',
    color: 0x00ffff,
    damage: 8,
    cooldown: 3000,
    speed: 0,
    piercing: 999,
    range: 400,
    projectileSize: 4,
    beamWidth: 4,
    beam: true,
    upgradeNotes: {
      2: '+2 beam duration, +15% damage',
      3: '+2 beam duration, wider beam',
      4: '+2 beam duration, +30% damage, slow beam',
      5: 'Continuous beam, +40% damage, 360° sweep'
    }
  },
  lightning_chain: {
    name: 'Lightning Chain',
    description: 'Launches a bolt that chains between nearby enemies.',
    color: 0xaaddff,
    damage: 22,
    cooldown: 1400,
    speed: 450,
    piercing: 1,
    range: 500,
    projectileSize: 8,
    bounces: 3,
    bounceRange: 200,
    damageFalloff: 0.7,
    upgradeNotes: {
      2: '+1 bounce, +15% damage',
      3: '+1 bounce, wider bounce range',
      4: '+2 bounces, +25% damage, stun chance',
      5: '+2 bounces, chain to 10 enemies, +35% damage'
    }
  },
  boomerang_dedicated: {
    name: 'Boomerang',
    description: 'Throws a boomerang that returns to you.',
    color: 0xff8800,
    damage: 12,
    cooldown: 1200,
    speed: 250,
    piercing: 999,
    range: 300,
    projectileSize: 8,
    upgradeNotes: {
      2: '+15% damage, wider path',
      3: '+20% damage, +2 boomerangs',
      4: '+25% damage, knockback',
      5: '+30% damage, pierce all on return'
    }
  },
  holyAura: {
    name: 'Holy Aura',
    description: 'Sacred aura that damages and repels nearby enemies.',
    color: 0xffd700,
    damage: 10,
    cooldown: 0,
    speed: 0,
    piercing: 999,
    range: 100,
    projectileSize: 0,
    aura: true,
    knockback: 80,
    upgradeNotes: {
      2: '+15% range, +12% damage',
      3: '+15% range, stronger knockback',
      4: '+20% range, +25% damage, shield buff',
      5: 'Massive range, fear aura, +35% damage'
    }
  }
};
