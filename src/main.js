// main.js — Phaser Game Config & Scene Registration
// Loaded last (after all scenes/systems/entities/data)

// Mobile detection — use Canvas2D on mobile for performance
const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent) || ('ontouchstart' in window && window.innerWidth < 1024);

const GameConfig = {
    type: isMobile ? Phaser.CANVAS : Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#1a1a2e',
    parent: document.body,
    fps: {
        target: isMobile ? 30 : 60,
        forceSetTimeOut: isMobile
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false,
            timeStep: isMobile ? (1000 / 30) : (1000 / 60)
        }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [BootScene, MenuScene, CharacterSelectScene, GameScene, GameOverScene]
};

const game = new Phaser.Game(GameConfig);
window.game = game; // Expose for testing/benchmarking
