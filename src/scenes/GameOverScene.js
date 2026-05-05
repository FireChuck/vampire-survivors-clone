// GameOverScene.js — Game Over screen with stats, staggered animations, NEW HIGH SCORE

class GameOverScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameOverScene' });
    }

    init(data) {
        this.stats = data || { score: 0, killCount: 0, level: 1, time: 0 };
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
            const hsText = this.add.text(cx, cy - 170, '🏆 NEW HIGH SCORE! 🏆', {
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
                const spark = this.add.circle(cx, cy - 170, 2, 0xffd700, 0.8).setDepth(11).setAlpha(0);
                this.tweens.add({
                    targets: spark,
                    alpha: 1,
                    x: cx + Math.cos(angle) * (60 + Math.random() * 30),
                    y: cy - 170 + Math.sin(angle) * (20 + Math.random() * 15),
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
        const title = this.add.text(cx, cy - 120, '💀 GAME OVER', {
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
            y: cy - 110,
            duration: 800,
            ease: 'Power2'
        });

        // Stats — staggered fade-in
        const m = String(Math.floor(this.stats.time / 60)).padStart(2, '0');
        const s = String(this.stats.time % 60).padStart(2, '0');

        const statsLines = [
            { text: `⭐ Score: ${this.stats.score}`, color: '#ffd700' },
            { text: `💀 Kills: ${this.stats.killCount}`, color: '#e94560' },
            { text: `📈 Level: ${this.stats.level}`, color: '#4ecdc4' },
            { text: `⏱ Time: ${m}:${s}`, color: '#aaaaff' }
        ];

        statsLines.forEach((line, i) => {
            const statText = this.add.text(cx, cy - 30 + i * 35, line.text, {
                fontSize: '18px',
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
                delay: 500 + i * 200,
                ease: 'Power2'
            });
        });

        // New achievements
        if (this.stats.newAchievements && this.stats.newAchievements.length > 0) {
            const achText = this.add.text(cx, cy + 120, `🏅 ${this.stats.newAchievements.join(', ')}`, {
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
        const btnY = this.stats.newAchievements && this.stats.newAchievements.length > 0 ? cy + 160 : cy + 130;
        const btn = this.add.rectangle(cx, btnY, 220, 50, 0x4ecdc4)
            .setInteractive({ useHandCursor: true }).setDepth(10).setAlpha(0);

        this.add.text(cx, btnY, '▶ Play Again', {
            fontSize: '22px',
            fontFamily: 'Arial, sans-serif',
            color: '#fff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(11).setAlpha(0);

        this.tweens.add({
            targets: [btn, btn.list ? btn : []],
            alpha: 1,
            duration: 400,
            delay: 1800
        });
        // Fade in button text separately
        if (btn.list && btn.list.length) {
            // Phaser containers handle this
        }
        // Simple approach: just set alpha on all children
        this.tweens.add({
            targets: this.children.list.filter(c => c.y === btnY && c.depth === 11),
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
            this.scene.start('CharacterSelectScene');
        });

        // Back to Menu button
        const menuY = btnY + 60;
        const menuBtn = this.add.rectangle(cx, menuY, 220, 50, 0x555555)
            .setInteractive({ useHandCursor: true }).setDepth(10).setAlpha(0);

        this.add.text(cx, menuY, '🏠 Main Menu', {
            fontSize: '18px',
            fontFamily: 'Arial, sans-serif',
            color: '#ccc'
        }).setOrigin(0.5).setDepth(11).setAlpha(0);

        this.tweens.add({
            targets: [menuBtn],
            alpha: 1,
            duration: 400,
            delay: 2000
        });
        this.tweens.add({
            targets: this.children.list.filter(c => c.y === menuY && c.depth === 11),
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
            this.scene.start('MenuScene');
        });
    }
}
