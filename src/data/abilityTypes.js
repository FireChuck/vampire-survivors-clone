// abilityTypes.js — Vampire Survivors Clone
// Selectable ability definitions for the Ability System

const ABILITY_TYPES = {
  dash: {
    id: 'dash',
    name: 'Dash',
    description: 'Short sprint in movement direction. Grants immunity during dash.',
    icon: '💨',
    color: 0x44ddff,
    cooldown: 3000,      // 3s base cooldown
    duration: 500,        // 0.5s dash duration
    speedMultiplier: 3.5, // 3.5x speed during dash
    grantsImmunity: true,
    key: 'Q',
    sortOrder: 0
  },
  shield: {
    id: 'shield',
    name: 'Shield Bubble',
    description: '360° shield absorbing 50 damage. Lasts 3 seconds.',
    icon: '🛡️',
    color: 0x44ff88,
    cooldown: 8000,       // 8s base cooldown
    duration: 3000,       // 3s shield duration
    absorbDamage: 50,
    radius: 45,
    key: 'W',
    sortOrder: 1
  },
  meteor: {
    id: 'meteor',
    name: 'Meteor Strike',
    description: '5 meteors rain near player dealing area damage.',
    icon: '☄️',
    color: 0xff6622,
    cooldown: 10000,      // 10s base cooldown
    meteorCount: 5,
    meteorDamage: 40,
    meteorRadius: 60,
    spreadRadius: 200,    // meteors fall within this radius of player
    staggerDelay: 150,    // ms between each meteor
    key: 'E',
    sortOrder: 2
  },
  timeFreeze: {
    id: 'timeFreeze',
    name: 'Time Freeze',
    description: 'Freezes all enemies for 2 seconds.',
    icon: '❄️',
    color: 0xaaeeff,
    cooldown: 15000,      // 15s base cooldown
    duration: 2000,       // 2s freeze duration
    key: '1',             // 4th ability slot uses 1/2/3
    sortOrder: 3
  }
};

// Get all ability types as array for iteration
function getAllAbilities() {
  return Object.values(ABILITY_TYPES);
}

// Get ability by id
function getAbilityById(id) {
  return ABILITY_TYPES[id] || null;
}
