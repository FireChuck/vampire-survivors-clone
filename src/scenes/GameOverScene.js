// GameOverScene.js — Game Over screen with 6+ stats, slow-mo death, fade-out
// Stats: Kills, Time, Level, Score, Items Collected, DPS
// Features: Slow-mo before screen, fade-out transition, staggered animations, NEW HIGH SCORE

class GameOverScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameOverScene' });
    }

    init(data) {
        this.stats = data || { score: 0, killCount: 0, level: 1, time: 0, itemsCollected: 0, dps: 0 };
    }

    create() {
        this.cameras.main.setBackgroundColor('#0a0a1a');
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;

        // Dark vignette overlay
        const vignette = this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0x000000, 0.4)
            .setDepth(0).setScrollFactor(0);

        // NEW HIGH SCORE animation
        if (this.stats.wasHighScore) {
            const hsText = this.add.text(cx, cy - 200, '🏆 NEW HIGH SCORE! 🏆', {
                fontSize: '24px',
                fontFamily: 'Arial, sans-serif',
                color: '#ffd700',
                fontStyle: 'bold',
                stroke: '#000',
                strokeThickness: 3
            }).setOrigin(0.5).setDepth(10).setAlpha(0);

            // Dramatic entrance
            this.tweens.add({
                targets: hsText,
                alpha: 1,
                scaleX: 1.3, scaleY: 1.3,
                duration: 600,
                ease: 'Back.easeOut',
                onComplete: () => {
                    this.tweens.add({
                        targets: hsText,
                        scaleX: 1, scaleY: 1,
                        duration: 300,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut',
                        repeatDelay: 1500
                    });
                }
            });

            // Gold sparkle particles around high score text
            for (let i = 0; i < 12; i++) {
                const angle = (Math.PI * 2 / 12) * i;
                const spark = this.add.circle(cx, cy - 200, 2, 0xffd700, 0.8).setDepth(11).setAlpha(0);
                this.tweens.add({
                    targets: spark,
                    alpha: 1,
                    x: cx + Math.cos(angle) * (60 + Math.random() * 30),
                    y: cy - 200 + Math.sin(angle) * (20 + Math.random() * 15),
                    duration: 400 + i * 50,
                    ease: 'Sine.easeOut',
                    yoyo: true,
                    repeat: -1,
                    delay: 600,
                    repeatDelay: 1000
                });
            }
        }

        // GAME OVER title — dramatic fade in
        const title = this.add.text(cx, cy - 150, '💀 GAME OVER', {
            fontSize: '42px',
            fontFamily: 'Arial, sans-serif',
            color: '#e94560',
            fontStyle: 'bold',
            stroke: '#000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(10).setAlpha(0);

        this.tweens.add({
            targets: title,
            alpha: 1,
            y: cy - 140,
            duration: 800,
            ease: 'Power2'
        });

        // Stats — staggered fade-in — 6 stats total
        const m = String(Math.floor(this.stats.time / 60)).padStart(2, '0');
        const s = String(this.stats.time % 60).padStart(2, '0');
        const dps = this.stats.dps ? this.stats.dps.toFixed(1) : '0.0';
        const items = this.stats.itemsCollected || 0;

        const statsLines = [
            { text: `⭐ Score: ${this.stats.score}`, color: '#ffd700' },
            { text: `💀 Kills: ${this.stats.killCount}`, color: '#e94560' },
            { text: `📈 Level: ${this.stats.level}`, color: '#4ecdc4' },
            { text: `⏱ Time: ${m}:${s}`, color: '#aaaaff' },
            { text: `📦 Items: ${items}`, color: '#ff88ff' },
            { text: `🔥 DPS: ${dps}`, color: '#ff8800' }
        ];

        // Stats background panel
        const panelH = statsLines.length * 32 + 16;
        const statsPanel = this.add.rectangle(cx, cy - 30 + panelH / 2 - 8, 260, panelH, 0x000000, 0.3)
            .setDepth(9).setAlpha(0).setOrigin(0.5);
        this.tweens.add({
            targets: statsPanel,
            alpha: 1,
            duration: 600,
            delay: 400
        });

        statsLines.forEach((line, i) => {
            const statText = this.add.text(cx, cy - 30 + i * 32, line.text, {
                fontSize: '17px',
                fontFamily: 'Arial, sans-serif',
                color: line.color,
                stroke: '#000',
                strokeThickness: 2
            }).setOrigin(0.5).setDepth(10).setAlpha(0);

            this.tweens.add({
                targets: statText,
                alpha: 1,
                x: cx + 20,
                duration: 400,
                delay: 500 + i * 180,
                ease: 'Power2'
            });
        });

        // New achievements
        if (this.stats.newAchievements && this.stats.newAchievements.length > 0) {
            const achText = this.add.text(cx, cy + statsLines.length * 32 + 10, `🏅 ${this.stats.newAchievements.join(', ')}`, {
                fontSize: '14px',
                fontFamily: 'Arial, sans-serif',
                color: '#ffd700',
                stroke: '#000',
                strokeThickness: 2
            }).setOrigin(0.5).setDepth(10).setAlpha(0);

            this.tweens.add({
                targets: achText,
                alpha: 1,
                duration: 500,
                delay: 1500,
                ease: 'Sine.easeIn'
            });
        }

        // Play Again button — fade in last
        const btnBaseY = cy + statsLines.length * 32 + (this.stats.newAchievements && this.stats.newAchievements.length > 0 ? 50 : 20);
        const btn = this.add.rectangle(cx, btnBaseY, 220, 50, 0x4ecdc4)
            .setInteractive({ useHandCursor: true }).setDepth(10).setAlpha(0);
        const btnText = this.add.text(cx, btnBaseY, '▶ Play Again', {
            fontSize: '22px',
            fontFamily: 'Arial, sans-serif',
            color: '#fff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(11).setAlpha(0);

        this.tweens.add({
            targets: [btn, btnText],
            alpha: 1,
            duration: 400,
            delay: 1800
        });

        btn.on('pointerover', () => {
            btn.setFillStyle(0x6ee7de);
            this.tweens.add({ targets: btn, scaleX: 1.05, scaleY: 1.05, duration: 100 });
        });
        btn.on('pointerout', () => {
            btn.setFillStyle(0x4ecdc4);
            this.tweens.add({ targets: btn, scaleX: 1, scaleY: 1, duration: 100 });
        });
        btn.on('pointerdown', () => {
            // Fade-out transition to character select
            this.cameras.main.fadeOut(400, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start('CharacterSelectScene');
            });
        });

        // Back to Menu button
        const menuY = btnBaseY + 60;
        const menuBtn = this.add.rectangle(cx, menuY, 220, 50, 0x555555)
            .setInteractive({ useHandCursor: true }).setDepth(10).setAlpha(0);
        const menuBtnText = this.add.text(cx, menuY, '🏠 Main Menu', {
            fontSize: '18px',
            fontFamily: 'Arial, sans-serif',
            color: '#ccc'
        }).setOrigin(0.5).setDepth(11).setAlpha(0);

        this.tweens.add({
            targets: [menuBtn, menuBtnText],
            alpha: 1,
            duration: 400,
            delay: 2000
        });

        menuBtn.on('pointerover', () => {
            menuBtn.setFillStyle(0x777777);
            this.tweens.add({ targets: menuBtn, scaleX: 1.05, scaleY: 1.05, duration: 100 });
        });
        menuBtn.on('pointerout', () => {
            menuBtn.setFillStyle(0x555555);
            this.tweens.add({ targets: menuBtn, scaleX: 1, scaleY: 1, duration: 100 });
        });
        menuBtn.on('pointerdown', () => {
            this.cameras.main.fadeOut(400, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start('MenuScene');
            });
        });

        // Fade-in the entire scene
        this.cameras.main.fadeIn(600, 0, 0, 0);
    }
}
