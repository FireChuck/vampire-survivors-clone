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
    sortOrder: 0,
    // Level scaling
    levelScaling: {
      cooldownReduction: 150,   // -150ms per level (min 1.5s)
      durationBonus: 30,        // +30ms per level
      speedBonus: 0.1           // +0.1x speed per level
    }
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
    sortOrder: 1,
    levelScaling: {
      cooldownReduction: 300,   // -300ms per level (min 4s)
      absorbBonus: 15,          // +15 absorb per level
      durationBonus: 200,       // +200ms per level
      radiusBonus: 3            // +3px radius per level
    }
  },
  meteor: {
    id: 'meteor',
    name: 'Meteor Strike',
    description: '5 meteors rain near player dealing area damage.',
    icon: '☄️',
    color: 0xff6622,
    cooldown: 12000,      // 12s base cooldown (was 10s — too strong early)
    meteorCount: 5,
    meteorDamage: 25,     // Reduced from 40 — too dominant early game
    meteorRadius: 60,
    spreadRadius: 200,    // meteors fall within this radius of player
    staggerDelay: 150,    // ms between each meteor
    key: 'E',
    sortOrder: 2,
    levelScaling: {
      cooldownReduction: 400,   // -400ms per level (min 6s)
      damageBonus: 8,           // +8 damage per level
      countBonus: 1,            // +1 meteor every 2 levels
      radiusBonus: 5            // +5px meteor radius per level
    }
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
    sortOrder: 3,
    levelScaling: {
      cooldownReduction: 500,   // -500ms per level (min 8s)
      durationBonus: 150,       // +150ms per level
    }
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

// Get level-scaled stats for an ability
function getScaledAbility(abilityId, level) {
  const base = ABILITY_TYPES[abilityId];
  if (!base || !base.levelScaling || level <= 1) return { ...base };

  const s = base.levelScaling;
  const scaled = { ...base };
  const lvl = level - 1; // level 1 = no scaling

  if (s.cooldownReduction) {
    const minCd = s.cooldownReduction > 300 ? 4000 : 1500;
    scaled.cooldown = Math.max(minCd, base.cooldown - s.cooldownReduction * lvl);
  }
  if (s.durationBonus) scaled.duration = base.duration + s.durationBonus * lvl;
  if (s.absorbBonus) scaled.absorbDamage = base.absorbDamage + s.absorbBonus * lvl;
  if (s.damageBonus) scaled.meteorDamage = base.meteorDamage + s.damageBonus * lvl;
  if (s.countBonus) scaled.meteorCount = base.meteorCount + Math.floor(s.countBonus * lvl / 2);
  if (s.radiusBonus) {
    scaled.radius = (base.radius || 0) + s.radiusBonus * lvl;
    scaled.meteorRadius = (base.meteorRadius || 0) + s.radiusBonus * lvl;
  }
  if (s.speedBonus) scaled.speedMultiplier = base.speedMultiplier + s.speedBonus * lvl;

  return scaled;
}
