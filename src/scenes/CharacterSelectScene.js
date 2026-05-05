// CharacterSelectScene.js — Character selection screen with lock/unlock via MetaProgression

const CHARACTERS = [
  {
    id: 'default',
    name: 'Apprentice',
    emoji: '🧙',
    color: 0x4488ff,
    highlightColor: 0x88bbff,
    description: 'Balanced starter with Magic Staff',
    stats: { maxHp: 100, speed: 200, damage: 10, pickupRange: 60, attackSpeed: 1.0 },
    startWeapon: 'staff',
    locked: false
  },
  {
    id: 'mage',
    name: 'Mage',
    emoji: '🔮',
    color: 0x9944ff,
    highlightColor: 0xbb77ff,
    description: '+30% Ability Damage, -20% Max HP, starts with Orbit',
    stats: { maxHp: 80, speed: 200, damage: 10, pickupRange: 60, attackSpeed: 1.0, abilityDamageMultiplier: 1.3 },
    startWeapon: 'holyAura',
    locked: true,
    unlockCondition: 'Reach Level 20 with Apprentice'
  },
  {
    id: 'barbarian',
    name: 'Barbarian',
    emoji: '⚔️',
    color: 0xe94560,
    highlightColor: 0xff6688,
    description: '+50% Max HP, +20% Pickup, +10% Speed, starts with Wave',
    stats: { maxHp: 150, speed: 220, damage: 10, pickupRange: 72, attackSpeed: 1.0 },
    startWeapon: 'whip',
    locked: true,
    unlockCondition: 'Defeat 5 Bosses total'
  },
  {
    id: 'rogue',
    name: 'Rogue',
    emoji: '🗡️',
    color: 0x4ecdc4,
    highlightColor: 0x7eeee7,
    description: '+30% Speed, +25% Crit Chance, starts with Dagger',
    stats: { maxHp: 100, speed: 260, damage: 10, pickupRange: 60, attackSpeed: 1.0, critChance: 0.30 },
    startWeapon: 'knife',
    locked: true,
    unlockCondition: 'Survive 15 minutes'
  }
];

class CharacterSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CharacterSelectScene' });
  }

  create() {
    this.cameras.main.setBackgroundColor('#0a0a1a');
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    const meta = new MetaProgression();
    const unlockedChars = meta.getUnlockedCharacters();

    // Title
    this.add.text(cx, 30, 'Choose Your Character', {
      fontSize: '26px', fontFamily: 'Arial, sans-serif', color: '#e94560',
      fontStyle: 'bold', stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(10);

    // Character cards
    this._cards = [];
    this._selectedIndex = 0;

    const cardWidth = 160;
    const cardHeight = 260;
    const gap = 16;
    const totalWidth = CHARACTERS.length * cardWidth + (CHARACTERS.length - 1) * gap;
    const startX = cx - totalWidth / 2 + cardWidth / 2;

    CHARACTERS.forEach((char, i) => {
      const x = startX + i * (cardWidth + gap);
      const y = cy - 30;
      const isUnlocked = unlockedChars.includes(char.id);

      // Card background
      const cardBg = this.add.rectangle(x, y, cardWidth, cardHeight, 0x1a1a2e)
        .setStrokeStyle(2, isUnlocked ? char.color : 0x333333)
        .setDepth(5);

      // Emoji
      this.add.text(x, y - 95, char.emoji, {
        fontSize: '40px'
      }).setOrigin(0.5).setDepth(10);

      // Name
      this.add.text(x, y - 60, char.name, {
        fontSize: '15px', fontFamily: 'Arial, sans-serif', color: isUnlocked ? '#ffffff' : '#666666',
        fontStyle: 'bold', stroke: '#000', strokeThickness: 2
      }).setOrigin(0.5).setDepth(10);

      if (isUnlocked) {
        // Stats block
        const statLines = [
          `❤️ HP: ${char.stats.maxHp}`,
          `👟 Speed: ${char.stats.speed}`,
          `⚔️ DMG: ${char.stats.damage}`,
          `📦 Pickup: ${char.stats.pickupRange}`,
          `⏱️ ATK SPD: ${char.stats.attackSpeed}x`
        ];
        if (char.stats.abilityDamageMultiplier) {
          statLines.push(`✨ Ability DMG: +${Math.round((char.stats.abilityDamageMultiplier - 1) * 100)}%`);
        }
        if (char.stats.critChance) {
          statLines.push(`💥 Crit: ${Math.round(char.stats.critChance * 100)}%`);
        }
        const statsText = statLines.join('\n');
        this.add.text(x, y - 10, statsText, {
          fontSize: '10px', fontFamily: 'Arial, sans-serif', color: '#aaaaaa',
          stroke: '#000', strokeThickness: 1, align: 'left', lineSpacing: 3
        }).setOrigin(0.5).setDepth(10);

        // Description
        this.add.text(x, y + 50, char.description, {
          fontSize: '9px', fontFamily: 'Arial, sans-serif', color: '#888888',
          stroke: '#000', strokeThickness: 1, align: 'center'
        }).setOrigin(0.5).setDepth(10).setWordWrapWidth(140);

        // Starting weapon
        const weaponName = WEAPON_TYPES[char.startWeapon]?.name || char.startWeapon;
        this.add.text(x, y + 85, `🗡️ ${weaponName}`, {
          fontSize: '10px', fontFamily: 'Arial, sans-serif', color: '#ffd700',
          stroke: '#000', strokeThickness: 1
        }).setOrigin(0.5).setDepth(10);
      } else {
        // Locked display
        this.add.text(x, y - 20, '🔒 LOCKED', {
          fontSize: '16px', fontFamily: 'Arial, sans-serif', color: '#555555',
          stroke: '#000', strokeThickness: 1
        }).setOrigin(0.5).setDepth(10);

        // Description (dimmed)
        this.add.text(x, y + 20, char.description, {
          fontSize: '9px', fontFamily: 'Arial, sans-serif', color: '#444444',
          stroke: '#000', strokeThickness: 1, align: 'center'
        }).setOrigin(0.5).setDepth(10).setWordWrapWidth(140);

        // Unlock condition
        this.add.text(x, y + 60, '🔓 ' + char.unlockCondition, {
          fontSize: '9px', fontFamily: 'Arial, sans-serif', color: '#e94560',
          stroke: '#000', strokeThickness: 1, align: 'center'
        }).setOrigin(0.5).setDepth(10).setWordWrapWidth(140);
      }

      // Selection indicator (hidden initially)
      const selectBorder = this.add.rectangle(x, y, cardWidth + 4, cardHeight + 4, 0x000000, 0)
        .setStrokeStyle(3, 0xffd700).setDepth(4).setVisible(false);

      // Make card interactive if unlocked
      if (isUnlocked) {
        cardBg.setInteractive({ useHandCursor: true });

        cardBg.on('pointerover', () => {
          cardBg.setFillStyle(0x2a2a4e);
          this.tweens.add({ targets: cardBg, scaleX: 1.05, scaleY: 1.05, duration: 100 });
        });

        cardBg.on('pointerout', () => {
          cardBg.setFillStyle(0x1a1a2e);
          this.tweens.add({ targets: cardBg, scaleX: 1, scaleY: 1, duration: 100 });
        });

        cardBg.on('pointerdown', () => {
          this._selectCharacter(i);
        });
      }

      this._cards.push({
        char, cardBg, selectBorder, isUnlocked, x, y
      });
    });

    // Auto-select first unlocked
    const firstUnlocked = CHARACTERS.findIndex(c => unlockedChars.includes(c.id));
    this._selectCharacter(firstUnlocked >= 0 ? firstUnlocked : 0);

    // Start button
    this._startBtn = this.add.rectangle(cx, cy + 170, 200, 50, 0x4ecdc4)
      .setInteractive({ useHandCursor: true }).setDepth(10);

    this._startBtnText = this.add.text(cx, cy + 170, '▶ START', {
      fontSize: '22px', fontFamily: 'Arial, sans-serif', color: '#fff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11);

    this._startBtn.on('pointerover', () => {
      this._startBtn.setFillStyle(0x6ee7de);
      this.tweens.add({ targets: this._startBtn, scaleX: 1.05, scaleY: 1.05, duration: 100 });
    });
    this._startBtn.on('pointerout', () => {
      this._startBtn.setFillStyle(0x4ecdc4);
      this.tweens.add({ targets: this._startBtn, scaleX: 1, scaleY: 1, duration: 100 });
    });
    this._startBtn.on('pointerdown', () => {
      this._startGame();
    });

    // Back button
    const backBtn = this.add.rectangle(cx - 130, cy + 170, 100, 50, 0x555555)
      .setInteractive({ useHandCursor: true }).setDepth(10);

    this.add.text(cx - 130, cy + 170, '← Back', {
      fontSize: '16px', fontFamily: 'Arial, sans-serif', color: '#ccc'
    }).setOrigin(0.5).setDepth(11);

    backBtn.on('pointerover', () => backBtn.setFillStyle(0x777777));
    backBtn.on('pointerout', () => backBtn.setFillStyle(0x555555));
    backBtn.on('pointerdown', () => {
      this.scene.start('MenuScene');
    });

    // Keyboard navigation
    this.input.keyboard.on('keydown-LEFT', () => {
      this._navigateSelection(-1);
    });
    this.input.keyboard.on('keydown-RIGHT', () => {
      this._navigateSelection(1);
    });
    this.input.keyboard.on('keydown-ENTER', () => {
      if (this._cards[this._selectedIndex]?.isUnlocked) {
        this._startGame();
      }
    });
    this.input.keyboard.on('keydown-ESC', () => {
      this.scene.start('MenuScene');
    });
  }

  _selectCharacter(index) {
    // Deselect previous
    if (this._cards[this._selectedIndex]) {
      this._cards[this._selectedIndex].selectBorder.setVisible(false);
      this._cards[this._selectedIndex].cardBg.setScale(1);
    }

    this._selectedIndex = index;
    const card = this._cards[index];

    if (card.isUnlocked) {
      card.selectBorder.setVisible(true);
      // Pulse animation on border
      this.tweens.add({
        targets: card.selectBorder,
        alpha: 0.5,
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }

  _navigateSelection(direction) {
    let newIndex = this._selectedIndex + direction;
    // Wrap around, skip locked
    for (let attempts = 0; attempts < CHARACTERS.length; attempts++) {
      if (newIndex < 0) newIndex = CHARACTERS.length - 1;
      if (newIndex >= CHARACTERS.length) newIndex = 0;
      if (this._cards[newIndex].isUnlocked) break;
      newIndex += direction;
    }
    this._selectCharacter(newIndex);
  }

  _startGame() {
    const char = this._cards[this._selectedIndex];
    if (!char || !char.isUnlocked) return;

    // Pass character data to GameScene
    const urlParams = new URLSearchParams(window.location.search);
    const stressTest = urlParams.has('stressTest');
    this.scene.start('GameScene', {
      characterId: char.char.id,
      characterStats: { ...char.char.stats },
      characterColor: char.char.color,
      characterHighlight: char.char.highlightColor,
      startWeapon: char.char.startWeapon,
      stressTest: stressTest
    });
  }
}
