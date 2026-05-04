// HUD.js — Timer, Score, Level + XP bar, HP bar, top-left

class HUD {
    constructor(scene) {
        this.scene = scene;
        this.elapsedSeconds = 0;

        // HP Bar background
        this.hpBg = this.scene.add.rectangle(16, 16, 200, 16, 0x333333).setScrollFactor(0).setDepth(50);
        // HP Bar fill
        this.hpFill = this.scene.add.rectangle(16, 16, 200, 16, 0xe94560).setScrollFactor(0).setDepth(50);
        this.hpFill.setOrigin(0, 0);

        // HP text
        this.hpText = this.scene.add.text(16, 18, '100 / 100', {
            fontSize: '11px',
            fontFamily: 'Arial, sans-serif',
            color: '#fff'
        }).setScrollFactor(0).setDepth(51);

        // XP Bar background
        this.xpBg = this.scene.add.rectangle(16, 36, 200, 10, 0x333333).setScrollFactor(0).setDepth(50);
        // XP Bar fill
        this.xpFill = this.scene.add.rectangle(16, 36, 200, 10, 0x4ecdc4).setScrollFactor(0).setDepth(50);
        this.xpFill.setOrigin(0, 0);

        // Level text
        this.levelText = this.scene.add.text(16, 50, 'Lv. 1', {
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            color: '#ffd700',
            fontStyle: 'bold'
        }).setScrollFactor(0).setDepth(51);

        // Timer
        this.timerText = this.scene.add.text(this.scene.scale.width - 16, 16, '00:00', {
            fontSize: '14px',
            fontFamily: 'monospace',
            color: '#fff',
            fontStyle: 'bold'
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(50);

        // Score
        this.scoreText = this.scene.add.text(this.scene.scale.width - 16, 36, 'Score: 0', {
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            color: '#ccc'
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(50);

        // Internal timer
        this._timerEvent = null;
    }

    startTimer() {
        this.elapsedSeconds = 0;
        this._timerEvent = this.scene.time.addEvent({
            delay: 1000,
            loop: true,
            callback: () => {
                this.elapsedSeconds++;
                const m = String(Math.floor(this.elapsedSeconds / 60)).padStart(2, '0');
                const s = String(this.elapsedSeconds % 60).padStart(2, '0');
                this.timerText.setText(`${m}:${s}`);
            }
        });
    }

    updateHP(current, max) {
        const ratio = Math.max(0, current / max);
        this.hpFill.width = Math.max(0, 200 * ratio);
        this.hpText.setText(`${Math.ceil(current)} / ${max}`);
    }

    updateXP(current, needed, level) {
        const ratio = Math.max(0, current / needed);
        this.xpFill.width = Math.max(0, 200 * ratio);
        this.levelText.setText(`Lv. ${level}`);
    }

    updateScore(score) {
        this.scoreText.setText(`Score: ${score}`);
    }

    getElapsedTime() {
        return this.elapsedSeconds;
    }

    destroy() {
        if (this._timerEvent) this._timerEvent.destroy();
    }
}
