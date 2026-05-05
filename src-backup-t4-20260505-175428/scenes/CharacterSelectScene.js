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
    id: 'berserker',
    name: 'Berserker',
    emoji: '⚔️',
    color: 0xe94560,
    highlightColor: 0xff6688,
    description: 'High damage, slow speed, starts with Axe',
    stats: { maxHp: 130, speed: 160, damage: 15, pickupRange: 50, attackSpeed: 0.8 },
    startWeapon: 'axe',
    locked: true,
    unlockCondition: 'Kill 500 enemies in a single run'
  },
  {
    id: 'swift',
    name: 'Shadow Dancer',
    emoji: '💨',
    color: 0x4ecdc4,
    highlightColor: 0x7eeee7,
    description: 'Fast & agile, starts with Throwing Knife',
    stats: { maxHp: 80, speed: 260, damage: 8, pickupRange: 80, attackSpeed: 1.3 },
    startWeapon: 'knife',
    locked: true,
    unlockCondition: 'Survive 15 minutes'
  },
  {
    id: 'warlock',
    name: 'Warlock',
    emoji: '🔮',
    color: 0x9944ff,
    highlightColor: 0xbb77ff,
    description: 'Magic specialist, starts with Holy Water',
    stats: { maxHp: 90, speed: 180, damage: 12, pickupRange: 70, attackSpeed: 1.0 },
    startWeapon: 'holyWater',
    locked: true,
    unlockCondition: 'Reach Level 20'
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
    const cardHeight = 220;
    const gap = 16;
    const totalWidth = CHARACTERS.length * cardWidth + (CHARACTERS.length - 1) * gap;
    const startX = cx - totalWidth / 2 + cardWidth / 2;

    CHARACTERS.forEach((char, i) => {
      const x = startX + i * (cardWidth + gap);
      const y = cy - 20;
      const isUnlocked = unlockedChars.includes(char.id);

      // Card background
      const cardBg = this.add.rectangle(x, y, cardWidth, cardHeight, 0x1a1a2e)
        .setStrokeStyle(2, isUnlocked ? char.color : 0x333333)
        .setDepth(5);

      // Emoji
      this.add.text(x, y - 70, char.emoji, {
        fontSize: '40px'
      }).setOrigin(0.5).setDepth(10);

      // Name
      this.add.text(x, y - 30, char.name, {
        fontSize: '14px', fontFamily: 'Arial, sans-serif', color: isUnlocked ? '#ffffff' : '#666666',
        fontStyle: 'bold', stroke: '#000', strokeThickness: 2
      }).setOrigin(0.5).setDepth(10);

      // Stats
      const statsText = isUnlocked
        ? `HP:${char.stats.maxHp}  SPD:${char.stats.speed}\nDMG:${char.stats.damage}  RNG:${char.stats.pickupRange}`
        : '🔒 LOCKED';
      this.add.text(x, y + 10, statsText, {
        fontSize: '10px', fontFamily: 'Arial, sans-serif', color: isUnlocked ? '#aaaaaa' : '#555555',
        stroke: '#000', strokeThickness: 1, align: 'center', lineSpacing: 4
      }).setOrigin(0.5).setDepth(10);

      // Description
      this.add.text(x, y + 55, char.description, {
        fontSize: '9px', fontFamily: 'Arial, sans-serif', color: isUnlocked ? '#888888' : '#444444',
        stroke: '#000', strokeThickness: 1, align: 'center'
      }).setOrigin(0.5).setDepth(10).setWordWrapWidth(140);

      // Unlock condition
      if (!isUnlocked) {
        this.add.text(x, y + 80, char.unlockCondition, {
          fontSize: '8px', fontFamily: 'Arial, sans-serif', color: '#e94560',
          stroke: '#000', strokeThickness: 1, align: 'center'
        }).setOrigin(0.5).setDepth(10).setWordWrapWidth(140);
      }

      // Starting weapon
      if (isUnlocked) {
        const weaponName = WEAPON_TYPES[char.startWeapon]?.name || char.startWeapon;
        this.add.text(x, y + 80, `Starts with: ${weaponName}`, {
          fontSize: '9px', fontFamily: 'Arial, sans-serif', color: '#ffd700',
          stroke: '#000', strokeThickness: 1
        }).setOrigin(0.5).setDepth(10);
      }

      // Selection indicator (hidden initially)
      const selectBorder = this.add.rectangle(x, y, cardWidth + 4, cardHeight + 4, 0x000000, 0)
        .setStrokeStyle(3, 0xffd700).setDepth(4).setVisible(false);

      // Make card interactive if unlocked
      if (isUnlocked) {
        cardBg.setInteractive({ useHandCursor: true });

        cardBg.on('pointerover', () => {
          if (isUnlocked) {
            cardBg.setFillStyle(0x2a2a4e);
            this.tweens.add({ targets: cardBg, scaleX: 1.05, scaleY: 1.05, duration: 100 });
          }
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
    this._startBtn = this.add.rectangle(cx, cy + 160, 200, 50, 0x4ecdc4)
      .setInteractive({ useHandCursor: true }).setDepth(10);

    this._startBtnText = this.add.text(cx, cy + 160, '▶ START', {
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
    const backBtn = this.add.rectangle(cx - 130, cy + 160, 100, 50, 0x555555)
      .setInteractive({ useHandCursor: true }).setDepth(10);

    this.add.text(cx - 130, cy + 160, '← Back', {
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
