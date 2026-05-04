// UpgradeSystem.js — Level-up pause, 3 random upgrades, XP curve

class UpgradeSystem {
  constructor(scene, player, hud) {
    this.scene = scene;
    this.player = player;
    this.hud = hud;
    this.paused = false;
    this._uiContainer = null;

    this.xpToNext = this._calcXpRequired(1);
  }

  _calcXpRequired(level) {
    return Math.floor(10 * Math.pow(level, 1.5));
  }

  addXP(amount) {
    if (this.paused) return;

    while (this.player.xp >= this.xpToNext) {
      this.player.xp -= this.xpToNext;
      this.player.level++;
      this.xpToNext = this._calcXpRequired(this.player.level);
      this.player.heal(Math.floor(this.player.maxHp * 0.2));
      this._showUpgradeSelection();
    }

    if (this.hud) {
      this.hud.updateXP(this.player.xp, this.xpToNext, this.player.level);
    }
  }

  _showUpgradeSelection() {
    this.paused = true;

    // Use a Container to hold all UI elements — easy cleanup
    this._uiContainer = this.scene.add.container(0, 0).setDepth(200).setScrollFactor(0);

    // Dark overlay
    const overlay = this.scene.add.rectangle(
      this.scene.scale.width / 2, this.scene.scale.height / 2,
      this.scene.scale.width, this.scene.scale.height,
      0x000000, 0.7
    );
    this._uiContainer.add(overlay);

    // Title
    this._uiContainer.add(this.scene.add.text(this.scene.scale.width / 2, 40, 'LEVEL UP!', {
      fontSize: '32px', fontFamily: 'Arial, sans-serif',
      color: '#ffd700', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5));

    this._uiContainer.add(this.scene.add.text(this.scene.scale.width / 2, 75, 'Choose an upgrade:', {
      fontSize: '16px', fontFamily: 'Arial, sans-serif', color: '#ccc'
    }).setOrigin(0.5));

    // Pick 3 random upgrades
    let pool;
    if (typeof UPGRADE_TYPES !== 'undefined') {
      pool = UPGRADE_TYPES;
    } else {
      pool = this._defaultUpgrades();
    }
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);

    const cardWidth = 200;
    const cardHeight = 120;
    const gap = 30;
    const totalWidth = shuffled.length * cardWidth + (shuffled.length - 1) * gap;
    const startX = (this.scene.scale.width - totalWidth) / 2;

    shuffled.forEach((upgrade, i) => {
      const cx = startX + i * (cardWidth + gap) + cardWidth / 2;
      const cy = this.scene.scale.height / 2;

      const card = this.scene.add.rectangle(cx, cy, cardWidth, cardHeight, 0x2a2a4a)
        .setStrokeStyle(2, 0x555)
        .setInteractive({ useHandCursor: true });

      const name = this.scene.add.text(cx, cy - 30, upgrade.name, {
        fontSize: '18px', fontFamily: 'Arial, sans-serif',
        color: '#e94560', fontStyle: 'bold'
      }).setOrigin(0.5);

      const desc = this.scene.add.text(cx, cy + 5, upgrade.description || '', {
        fontSize: '12px', fontFamily: 'Arial, sans-serif',
        color: '#aaa', wordWrap: { width: cardWidth - 20 }
      }).setOrigin(0.5);

      card.on('pointerover', () => card.setStrokeStyle(2, 0xe94560));
      card.on('pointerout', () => card.setStrokeStyle(2, 0x555));
      card.on('pointerdown', () => {
        this._applyUpgrade(upgrade);
        this._closeUpgradeSelection();
      });

      this._uiContainer.add(card);
      this._uiContainer.add(name);
      this._uiContainer.add(desc);
    });
  }

  _applyUpgrade(upgrade) {
    if (typeof upgrade.apply === 'function') {
      upgrade.apply(this.player);
    } else if (upgrade.stat) {
      const s = this.player.stats;
      switch (upgrade.stat) {
        case 'maxHp':
          s.maxHp += upgrade.value;
          this.player.maxHp = s.maxHp;
          this.player.hp = Math.min(this.player.hp + upgrade.value, this.player.maxHp);
          break;
        case 'speed':
          s.speed += upgrade.value;
          this.player.speed = s.speed;
          break;
        case 'damageMultiplier':
          s.damageMultiplier += upgrade.value;
          break;
        case 'armor':
          s.armor += upgrade.value;
          break;
        case 'hpRegen':
          s.hpRegen += upgrade.value;
          break;
        case 'xpMultiplier':
          s.xpMultiplier += upgrade.value;
          break;
        case 'cooldownReduction':
          s.cooldownReduction = Math.min(0.7, s.cooldownReduction + upgrade.value);
          break;
        case 'pickupRange':
          this.player.pickupRange += upgrade.value;
          break;
      }
    }

    if (this.hud) {
      this.hud.updateHP(this.player.hp, this.player.maxHp);
    }
  }

  _closeUpgradeSelection() {
    if (this._uiContainer) {
      this._uiContainer.destroy();
      this._uiContainer = null;
    }
    this.paused = false;
  }

  _defaultUpgrades() {
    return [
      { name: 'Max HP +20', description: 'Increases maximum health by 20', stat: 'maxHp', value: 20 },
      { name: 'Speed +20', description: 'Move faster', stat: 'speed', value: 20 },
      { name: 'Damage +20%', description: 'Deal more damage', stat: 'damageMultiplier', value: 0.2 },
      { name: 'Armor +2', description: 'Take less damage', stat: 'armor', value: 2 },
      { name: 'HP Regen', description: 'Regenerate health over time', stat: 'hpRegen', value: 0.5 },
      { name: 'XP Boost', description: 'Gain more experience', stat: 'xpMultiplier', value: 0.15 },
      { name: 'Pickup Range', description: 'Collect items from further away', stat: 'pickupRange', value: 15 },
      { name: 'Attack Speed', description: 'Reduce weapon cooldowns', stat: 'cooldownReduction', value: 0.1 }
    ];
  }

  destroy() {
    this._closeUpgradeSelection();
  }
}
