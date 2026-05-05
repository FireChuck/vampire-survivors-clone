// upgradeTypes.js — Vampire Survivors Clone
// Global upgrade type definitions

const UPGRADE_TYPES = [
  {
    id: 'maxHp',
    name: 'Max HP +20',
    description: '+20 Max HP',
    icon: '❤️',
    apply: function(player) {
      player.maxHp += 20;
      player.hp += 20;
    }
  },
  {
    id: 'speed',
    name: 'Speed +15%',
    description: '+15% Movement Speed',
    icon: '👟',
    apply: function(player) {
      player.speed *= 1.15;
    }
  },
  {
    id: 'damage',
    name: 'Damage +20%',
    description: '+20% Damage',
    icon: '⚔️',
    apply: function(player) {
      player.damage *= 1.2;
    }
  },
  {
    id: 'attackSpeed',
    name: 'Attack Speed +15%',
    description: '+15% Attack Speed',
    icon: '⚡',
    apply: function(player) {
      player.attackSpeed *= 1.15;
    }
  },
  {
    id: 'pickupRange',
    name: 'Pickup Range +25%',
    description: '+25% Pickup Range',
    icon: '🧲',
    apply: function(player) {
      player.pickupRange *= 1.25;
    }
  },
  {
    id: 'heal',
    name: 'Heal 30 HP',
    description: 'Restore 30 HP',
    icon: '💚',
    apply: function(player) {
      player.hp = Math.min(player.hp + 30, player.maxHp);
    }
  },
  {
    id: 'newWeapon',
    name: 'New Weapon',
    description: 'Unlock a random weapon',
    icon: '🔫',
    apply: function(player) {
      if (player.scene) {
        player.scene.events.emit('upgradeNewWeapon');
      }
    }
  },
  {
    id: 'weaponUpgrade',
    name: 'Weapon +1',
    description: 'Upgrade random weapon level',
    icon: '⬆️',
    apply: function(player) {
      if (player.scene) {
        player.scene.events.emit('upgradeWeaponLevel');
      }
    }
  },
  {
    id: 'magnet2',
    name: 'Magnet',
    description: '+50% Pickup Range',
    icon: '🧲',
    apply: function(player) {
      player.pickupRange *= 1.5;
    }
  },
  {
    id: 'timeSlow',
    name: 'Time Warp',
    description: 'Enemies move 10% slower',
    icon: '⏳',
    apply: function(player) {
      player.stats.timeSlow += 0.1;
    }
  },
  {
    id: 'explosion',
    name: 'Explosive Kill',
    description: 'Enemies explode on death (AOE)',
    icon: '💥',
    apply: function(player) {
      player.stats.explosionOnKill = true;
    }
  },
  {
    id: 'thorns',
    name: 'Thorns',
    description: 'Reflect 20% damage to attackers',
    icon: '🦔',
    apply: function(player) {
      player.stats.thorns += 0.2;
    }
  },
  {
    id: 'vampirism',
    name: 'Vampirism',
    description: 'Heal 5% of damage dealt',
    icon: '🧛',
    apply: function(player) {
      player.stats.lifeSteal += 0.05;
    }
  },
  {
    id: 'armor',
    name: 'Armor',
    description: '-15% incoming damage',
    icon: '🛡️',
    apply: function(player) {
      player.stats.armor += 0.15;
    }
  },
  {
    id: 'critChance',
    name: 'Critical Strike',
    description: '+10% chance for 2× damage',
    icon: '🎯',
    apply: function(player) {
      player.stats.critChance += 0.10;
    }
  },
  {
    id: 'xpBoost',
    name: 'Wisdom',
    description: '+20% XP from all sources',
    icon: '📚',
    apply: function(player) {
      player.stats.xpMultiplier = (player.stats.xpMultiplier || 1) * 1.2;
    }
  },
  {
    id: 'vampireTouch',
    name: 'Vampire Touch',
    description: 'Heal 8% of damage dealt + red particles on hit',
    icon: '🩸',
    apply: function(player) {
      player.stats.lifeSteal += 0.08;
      player.stats.vampireTouchActive = true;
    }
  }
];
