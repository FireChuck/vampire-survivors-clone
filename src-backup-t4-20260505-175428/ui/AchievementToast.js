// AchievementToast.js — Toast notification system for achievements
// Displays animated toast notifications in the top-right corner

class AchievementToast {
  constructor(scene) {
    this.scene = scene;
    this._queue = [];
    this._active = null;
    this._toasts = [];
  }

  /**
   * Show an achievement toast
   * @param {string} icon - Emoji icon
   * @param {string} title - Achievement title
   * @param {string} desc - Achievement description
   */
  show(icon, title, desc) {
    this._queue.push({ icon, title, desc });
    if (!this._active) {
      this._processQueue();
    }
  }

  _processQueue() {
    if (this._queue.length === 0) {
      this._active = false;
      return;
    }

    this._active = true;
    const { icon, title, desc } = this._queue.shift();

    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;

    // Container offset from top-right
    const toastX = sw - 20;
    const toastY = 60;

    // Background bar
    const bg = this.scene.add.rectangle(toastX, toastY, 280, 60, 0x1a1a2e, 0.95)
      .setOrigin(1, 0).setScrollFactor(0).setDepth(2000).setAlpha(0);

    // Gold border
    const border = this.scene.add.rectangle(toastX, toastY, 284, 64, 0x000000, 0)
      .setOrigin(1, 0).setScrollFactor(0).setDepth(1999).setStrokeStyle(2, 0xffd700).setAlpha(0);

    // Icon
    const iconText = this.scene.add.text(toastX - 255, toastY + 18, icon, {
      fontSize: '28px'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2001).setAlpha(0);

    // "ACHIEVEMENT UNLOCKED" label
    const label = this.scene.add.text(toastX - 200, toastY + 8, '🏅 ACHIEVEMENT UNLOCKED', {
      fontSize: '9px', fontFamily: 'Arial, sans-serif', color: '#ffd700',
      fontStyle: 'bold'
    }).setOrigin(0, 0).setScrollFactor(0).setDepth(2001).setAlpha(0);

    // Title
    const titleText = this.scene.add.text(toastX - 200, toastY + 22, title, {
      fontSize: '14px', fontFamily: 'Arial, sans-serif', color: '#ffffff',
      fontStyle: 'bold', stroke: '#000', strokeThickness: 1
    }).setOrigin(0, 0).setScrollFactor(0).setDepth(2001).setAlpha(0);

    // Description
    const descText = this.scene.add.text(toastX - 200, toastY + 40, desc, {
      fontSize: '10px', fontFamily: 'Arial, sans-serif', color: '#aaaaaa',
      stroke: '#000', strokeThickness: 1
    }).setOrigin(0, 0).setScrollFactor(0).setDepth(2001).setAlpha(0);

    const elements = [bg, border, iconText, label, titleText, descText];

    // Slide-in from right
    const slideInX = 30;
    elements.forEach(el => {
      el.x += slideInX;
    });

    this.scene.tweens.add({
      targets: elements,
      x: '-30',
      alpha: 1,
      duration: 400,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Hold for 2.5 seconds
        this.scene.time.delayedCall(2500, () => {
          // Slide out to right
          this.scene.tweens.add({
            targets: elements,
            x: `+=${slideInX + 20}`,
            alpha: 0,
            duration: 300,
            ease: 'Sine.easeIn',
            onComplete: () => {
              elements.forEach(el => el.destroy());
              // Process next in queue
              this.scene.time.delayedCall(200, () => this._processQueue());
            }
          });
        });
      }
    });
  }

  /** Convenience: show toast from achievement data */
  showAchievement(achievementData) {
    this.show(
      achievementData.icon || '🏅',
      achievementData.name || achievementData.id,
      achievementData.desc || ''
    );
  }

  /** Destroy all active toasts */
  destroy() {
    this._queue = [];
    this._active = false;
  }
}
