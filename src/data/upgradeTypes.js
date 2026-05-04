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
      // Handled by GameScene — triggers weapon unlock logic
    }
  },
  {
    id: 'weaponUpgrade',
    name: 'Weapon +1',
    description: 'Upgrade random weapon level',
    icon: '⬆️',
    apply: function(player) {
      // Handled by GameScene — triggers weapon upgrade logic
    }
  }
];
