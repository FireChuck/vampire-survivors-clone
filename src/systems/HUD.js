// HUD.js — Timer, Score, Level + XP bar, HP bar, top-left
// Fixed to screen (scrollFactor 0) for camera-following world

class HUD {
  constructor(scene) {
    this.scene = scene;
    this.elapsedSeconds = 0;

    const sw = scene.scale.width;

    // HP Bar
    this.hpBg = scene.add.rectangle(16, 16, 200, 16, 0x333333).setScrollFactor(0).setDepth(50);
    this.hpFill = scene.add.rectangle(16, 16, 200, 16, 0xe94560).setScrollFactor(0).setDepth(50).setOrigin(0, 0);
    this.hpText = scene.add.text(16, 18, '100 / 100', {
      fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#fff'
    }).setScrollFactor(0).setDepth(51);

    // XP Bar
    this.xpBg = scene.add.rectangle(16, 36, 200, 10, 0x333333).setScrollFactor(0).setDepth(50);
    this.xpFill = scene.add.rectangle(16, 36, 200, 10, 0x4ecdc4).setScrollFactor(0).setDepth(50).setOrigin(0, 0);
    this.levelText = scene.add.text(16, 50, 'Lv. 1', {
      fontSize: '12px', fontFamily: 'Arial, sans-serif', color: '#ffd700', fontStyle: 'bold'
    }).setScrollFactor(0).setDepth(51);

    // Kill counter
    this.killText = scene.add.text(16, 68, 'Kills: 0', {
      fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#aaa'
    }).setScrollFactor(0).setDepth(51);

    // Timer (top-right)
    this.timerText = scene.add.text(sw - 16, 16, '00:00', {
      fontSize: '14px', fontFamily: 'monospace', color: '#fff', fontStyle: 'bold'
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(50);

    // Score (top-right)
    this.scoreText = scene.add.text(sw - 16, 36, 'Score: 0', {
      fontSize: '12px', fontFamily: 'Arial, sans-serif', color: '#ccc'
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(50);

    // Enemy count
    this.enemyText = scene.add.text(sw - 16, 54, 'Enemies: 0', {
      fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#888'
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(50);

    this._timerEvent = null;
  }

  startTimer() {
    this.elapsedSeconds = 0;
    this._timerEvent = this.scene.time.addEvent({
      delay: 1000, loop: true,
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
    // Color changes: green > yellow > red
    if (ratio > 0.5) this.hpFill.setFillStyle(0x4ecdc4);
    else if (ratio > 0.25) this.hpFill.setFillStyle(0xf39c12);
    else this.hpFill.setFillStyle(0xe94560);
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

  updateKills(kills) {
    this.killText.setText(`Kills: ${kills}`);
  }

  updateEnemyCount(count) {
    this.enemyText.setText(`Enemies: ${count}`);
  }

  getElapsedTime() {
    return this.elapsedSeconds;
  }

  destroy() {
    if (this._timerEvent) this._timerEvent.destroy();
  }
}
