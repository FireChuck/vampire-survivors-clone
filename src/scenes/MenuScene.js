// MenuScene.js — Title screen with Start button

class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;

        // Title
        this.add.text(cx, cy - 80, 'Vampire Survivors Clone', {
            fontSize: '36px',
            fontFamily: 'Arial, sans-serif',
            color: '#e94560',
            fontStyle: 'bold',
            stroke: '#000',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Subtitle
        this.add.text(cx, cy - 30, 'Survive the hordes!', {
            fontSize: '18px',
            fontFamily: 'Arial, sans-serif',
            color: '#aaa',
            stroke: '#000',
            strokeThickness: 2
        }).setOrigin(0.5);

        // Start Button
        const btn = this.add.rectangle(cx, cy + 50, 220, 50, 0xe94560)
            .setInteractive({ useHandCursor: true });

        this.add.text(cx, cy + 50, 'Start Game', {
            fontSize: '22px',
            fontFamily: 'Arial, sans-serif',
            color: '#fff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        btn.on('pointerover', () => btn.setFillStyle(0xff6b6b));
        btn.on('pointerout', () => btn.setFillStyle(0xe94560));
        btn.on('pointerdown', () => {
            this.scene.start('GameScene');
        });
    }
}
