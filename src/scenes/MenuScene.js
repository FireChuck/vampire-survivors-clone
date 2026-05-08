// MenuScene.js — Title screen with Start button, Meta Stats, Background particles

class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;

        // Background floating particles
        this._bgParticles = [];
        for (let i = 0; i < 20; i++) {
            const x = Math.random() * this.scale.width;
            const y = Math.random() * this.scale.height;
            const size = 2 + Math.random() * 4;
            const alpha = 0.05 + Math.random() * 0.15;
            const color = Math.random() > 0.5 ? 0xe94560 : 0x553366;
            const p = this.add.circle(x, y, size, color, alpha).setDepth(0);
            this._bgParticles.push(p);

            // Slow drift animation
            this.tweens.add({
                targets: p,
                x: x + (Math.random() - 0.5) * 200,
                y: y - 100 - Math.random() * 150,
                alpha: 0,
                duration: 5000 + Math.random() * 4000,
                ease: 'Sine.easeInOut',
                repeat: -1,
                delay: Math.random() * 3000,
                onRepeat: () => {
                    p.x = Math.random() * this.scale.width;
                    p.y = this.scale.height + 20;
                    p.alpha = alpha;
                }
            });
        }

        // Load meta stats
        const meta = new MetaProgression();
        const stats = meta.getStats();

        // Title with pulsing glow
        const title = this.add.text(cx, cy - 130, '🧛 Vampire Survivors Clone', {
            fontSize: '34px',
            fontFamily: 'Arial, sans-serif',
            color: '#e94560',
            fontStyle: 'bold',
            stroke: '#000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(10);

        // Title pulse
        this.tweens.add({
            targets: title,
            scaleX: 1.04, scaleY: 1.04,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Subtitle
        this.add.text(cx, cy - 90, 'Survive the hordes!', {
            fontSize: '18px',
            fontFamily: 'Arial, sans-serif',
            color: '#aaa',
            stroke: '#000',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(10);

        // Meta stats (only show if player has played before)
        if (stats.totalRuns > 0) {
            const metaLines = [
                `🏆 Best: ${stats.highScore}  |  🎮 Runs: ${stats.totalRuns}`,
                `💀 Total Kills: ${stats.totalKills}  |  ⭐ Best Level: ${stats.bestLevel}`,
                `🏅 Achievements: ${stats.achievements}/9`
            ];
            metaLines.forEach((line, i) => {
                this.add.text(cx, cy - 55 + i * 20, line, {
                    fontSize: '13px',
                    fontFamily: 'Arial, sans-serif',
                    color: '#888',
                    stroke: '#000',
                    strokeThickness: 1
                }).setOrigin(0.5).setDepth(10);
            });
        }

        // Start Button
        const btn = this.add.rectangle(cx, cy + 40, 220, 50, 0xe94560)
            .setInteractive({ useHandCursor: true }).setDepth(10);

        this.add.text(cx, cy + 40, '▶ Start Game', {
            fontSize: '22px',
            fontFamily: 'Arial, sans-serif',
            color: '#fff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(11);

        btn.on('pointerover', () => {
            btn.setFillStyle(0xff6b6b);
            this.tweens.add({ targets: btn, scaleX: 1.05, scaleY: 1.05, duration: 100 });
        });
        btn.on('pointerout', () => {
            btn.setFillStyle(0xe94560);
            this.tweens.add({ targets: btn, scaleX: 1, scaleY: 1, duration: 100 });
        });
        btn.on('pointerdown', () => {
            this.scene.start('CharacterSelectScene');
        });

        // Stress Test Button
        const stressBtn = this.add.rectangle(cx, cy + 110, 260, 50, 0xff8800)
            .setInteractive({ useHandCursor: true }).setDepth(10);

        this.add.text(cx, cy + 110, '🔥 Stress Test (150+ Enemies)', {
            fontSize: '18px',
            fontFamily: 'Arial, sans-serif',
            color: '#fff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(11);

        stressBtn.on('pointerover', () => {
            stressBtn.setFillStyle(0xffaa33);
            this.tweens.add({ targets: stressBtn, scaleX: 1.05, scaleY: 1.05, duration: 100 });
        });
        stressBtn.on('pointerout', () => {
            stressBtn.setFillStyle(0xff8800);
            this.tweens.add({ targets: stressBtn, scaleX: 1, scaleY: 1, duration: 100 });
        });
        stressBtn.on('pointerdown', () => {
            this.scene.start('GameScene', { stressTest: true });
        });

        // Autoplay: skip menu and go straight to character select
        if (window.GAME_CONFIG?.autoPlay) {
            this.time.delayedCall(500, () => {
                this.scene.start('CharacterSelectScene');
            });
        }

        // Reset button (small, bottom)
        if (stats.totalRuns > 0) {
            const resetBtn = this.add.text(cx, cy + 170, '🗑 Reset Progress', {
                fontSize: '12px',
                fontFamily: 'Arial, sans-serif',
                color: '#555'
            }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(10);

            resetBtn.on('pointerover', () => resetBtn.setColor('#e94560'));
            resetBtn.on('pointerout', () => resetBtn.setColor('#555'));
            resetBtn.on('pointerdown', () => {
                meta.resetAll();
                this.scene.restart();
            });
        }
    }
}
