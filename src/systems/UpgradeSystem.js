// UpgradeSystem.js — Level-up pause, 3 random upgrades, XP curve

class UpgradeSystem {
    constructor(scene, player, hud) {
        this.scene = scene;
        this.player = player;
        this.hud = hud;
        this.paused = false;
        this.upgradeCards = [];
        this.overlay = null;

        // XP curve: 10 * level^1.5
        this.xpToNext = this._calcXpRequired(1);
    }

    _calcXpRequired(level) {
        return Math.floor(10 * Math.pow(level, 1.5));
    }

    addXP(amount) {
        if (this.paused) return;

        this.player.xp += amount;

        while (this.player.xp >= this.xpToNext) {
            this.player.xp -= this.xpToNext;
            this.player.level++;
            this.xpToNext = this._calcXpRequired(this.player.level);
            this._showUpgradeSelection();
        }

        if (this.hud) {
            this.hud.updateXP(this.player.xp, this.xpToNext, this.player.level);
        }
    }

    _showUpgradeSelection() {
        this.paused = true;
        this.scene.physics.pause();

        // Dark overlay
        this.overlay = this.scene.add.rectangle(
            this.scale.width / 2, this.scale.height / 2,
            this.scale.width, this.scale.height,
            0x000000, 0.7
        ).setDepth(100);

        // Title
        this.scene.add.text(this.scale.width / 2, 40, 'LEVEL UP!', {
            fontSize: '32px',
            fontFamily: 'Arial, sans-serif',
            color: '#ffd700',
            fontStyle: 'bold',
            stroke: '#000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(101);

        this.scene.add.text(this.scale.width / 2, 75, 'Choose an upgrade:', {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            color: '#ccc'
        }).setOrigin(0.5).setDepth(101);

        // Pick 3 random upgrades
        // Use Clawd 2's UPGRADE_TYPES or fallback defaults
        let pool;
        if (typeof UPGRADE_TYPES !== 'undefined') {
            pool = UPGRADE_TYPES;
        } else {
            pool = this._defaultUpgrades();
        }
        const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, 3);

        const cardWidth = 200;
        const cardHeight = 120;
        const gap = 30;
        const totalWidth = shuffled.length * cardWidth + (shuffled.length - 1) * gap;
        const startX = (this.scale.width - totalWidth) / 2;

        shuffled.forEach((upgrade, i) => {
            const cx = startX + i * (cardWidth + gap) + cardWidth / 2;
            const cy = this.scale.height / 2;

            const card = this.scene.add.rectangle(cx, cy, cardWidth, cardHeight, 0x2a2a4a)
                .setStrokeStyle(2, 0x555)
                .setInteractive({ useHandCursor: true })
                .setDepth(101);

            const name = this.scene.add.text(cx, cy - 30, upgrade.name, {
                fontSize: '18px',
                fontFamily: 'Arial, sans-serif',
                color: '#e94560',
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(102);

            const desc = this.scene.add.text(cx, cy + 5, upgrade.description || '', {
                fontSize: '12px',
                fontFamily: 'Arial, sans-serif',
                color: '#aaa',
                wordWrap: { width: cardWidth - 20 }
            }).setOrigin(0.5).setDepth(102);

            card.on('pointerover', () => card.setStrokeStyle(2, 0xe94560));
            card.on('pointerout', () => card.setStrokeStyle(2, 0x555));
            card.on('pointerdown', () => {
                this._applyUpgrade(upgrade);
                this._closeUpgradeSelection();
            });

            this.upgradeCards.push(card);
        });
    }

    _applyUpgrade(upgrade) {
        // Clawd 2's UPGRADE_TYPES have an apply() function
        if (typeof upgrade.apply === 'function') {
            upgrade.apply(this.player);
        } else if (upgrade.stat) {
            // Fallback for simple stat/value upgrades
            if (upgrade.stat === 'maxHp') {
                this.player.stats.maxHp += upgrade.value;
                this.player.hp = Math.min(this.player.hp + upgrade.value, this.player.stats.maxHp);
            } else if (upgrade.stat === 'speed') {
                this.player.stats.speed += upgrade.value;
            } else if (upgrade.stat === 'damageMultiplier') {
                this.player.stats.damageMultiplier += upgrade.value;
            } else if (upgrade.stat === 'armor') {
                this.player.stats.armor += upgrade.value;
            } else if (upgrade.stat === 'hpRegen') {
                this.player.stats.hpRegen += upgrade.value;
            } else if (upgrade.stat === 'xpMultiplier') {
                this.player.stats.xpMultiplier += upgrade.value;
            } else if (upgrade.stat === 'cooldownReduction') {
                this.player.stats.cooldownReduction += upgrade.value;
            }
        }

        if (this.hud) {
            this.hud.updateHP(this.player.hp, this.player.stats.maxHp);
        }
    }

    _closeUpgradeSelection() {
        if (this.overlay) this.overlay.destroy();
        for (const card of this.upgradeCards) card.destroy();
        this.upgradeCards = [];

        // Also destroy the text children at depth 101/102
        this.scene.children.each(child => {
            if (child.depth === 101 || child.depth === 102) child.destroy();
        });

        this.paused = false;
        this.scene.physics.resume();
    }

    _defaultUpgrades() {
        return [
            { name: 'Max HP +20', description: 'Increases maximum health by 20', stat: 'maxHp', value: 20 },
            { name: 'Speed +20', description: 'Move faster', stat: 'speed', value: 20 },
            { name: 'Damage +20%', description: 'Deal more damage', stat: 'damageMultiplier', value: 0.2 },
            { name: 'Armor +2', description: 'Take less damage', stat: 'armor', value: 2 },
            { name: 'HP Regen', description: 'Regenerate health over time', stat: 'hpRegen', value: 0.5 },
            { name: 'XP Boost', description: 'Gain more experience', stat: 'xpMultiplier', value: 0.15 }
        ];
    }

    destroy() {
        this._closeUpgradeSelection();
    }
}
