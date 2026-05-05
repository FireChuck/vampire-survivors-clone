// main.js — Phaser Game Config & Scene Registration
// Loaded last (after all scenes/systems/entities/data)

const GameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#1a1a2e',
    parent: document.body,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [BootScene, MenuScene, CharacterSelectScene, GameScene, GameOverScene]
};

const game = new Phaser.Game(GameConfig);
