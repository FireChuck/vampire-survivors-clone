// GameOverScene.js — Game Over screen with stats and replay

class GameOverScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameOverScene' });
    }

    init(data) {
        this.stats = data || { score: 0, killCount: 0, level: 1, time: 0 };
    }

    create() {
        this.cameras.main.setBackgroundColor('#1a1a2e');
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;

        // GAME OVER title
        this.add.text(cx, cy - 120, 'GAME OVER', {
            fontSize: '42px',
            fontFamily: 'Arial, sans-serif',
            color: '#e94560',
            fontStyle: 'bold',
            stroke: '#000',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Stats
        const m = String(Math.floor(this.stats.time / 60)).padStart(2, '0');
        const s = String(this.stats.time % 60).padStart(2, '0');

        const statsLines = [
            `Score: ${this.stats.score}`,
            `Kills: ${this.stats.killCount}`,
            `Level: ${this.stats.level}`,
            `Time: ${m}:${s}`
        ];

        statsLines.forEach((line, i) => {
            this.add.text(cx, cy - 40 + i * 30, line, {
                fontSize: '18px',
                fontFamily: 'Arial, sans-serif',
                color: '#ddd',
                stroke: '#000',
                strokeThickness: 2
            }).setOrigin(0.5);
        });

        // Play Again button
        const btn = this.add.rectangle(cx, cy + 110, 220, 50, 0x4ecdc4)
            .setInteractive({ useHandCursor: true });

        this.add.text(cx, cy + 110, 'Play Again', {
            fontSize: '22px',
            fontFamily: 'Arial, sans-serif',
            color: '#fff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        btn.on('pointerover', () => btn.setFillStyle(0x6ee7de));
        btn.on('pointerout', () => btn.setFillStyle(0x4ecdc4));
        btn.on('pointerdown', () => {
            this.scene.start('GameScene');
        });

        // Back to Menu button
        const menuBtn = this.add.rectangle(cx, cy + 175, 220, 50, 0x555555)
            .setInteractive({ useHandCursor: true });

        this.add.text(cx, cy + 175, 'Main Menu', {
            fontSize: '18px',
            fontFamily: 'Arial, sans-serif',
            color: '#ccc'
        }).setOrigin(0.5);

        menuBtn.on('pointerover', () => menuBtn.setFillStyle(0x777777));
        menuBtn.on('pointerout', () => menuBtn.setFillStyle(0x555555));
        menuBtn.on('pointerdown', () => {
            this.scene.start('MenuScene');
        });
    }
}
