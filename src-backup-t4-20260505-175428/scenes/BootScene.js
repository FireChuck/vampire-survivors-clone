// BootScene.js — Empty boot, auto-transition to MenuScene

class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    create() {
        this.scene.start('MenuScene');
    }
}
