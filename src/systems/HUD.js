// HUD.js — Timer, Score, Level + XP bar, HP bar, Weapon Levels, top-left
// Fixed to screen (scrollFactor 0) for camera-following world
// QoL: Rounded corners on all HUD boxes, weapon level display

class HUD {
  constructor(scene) {
    this.scene = scene;
    this.elapsedSeconds = 0;

    const sw = scene.scale.width;
    const pad = 12;
    const boxW = 210;
    const boxH = 72;

    // ── Background panel (rounded) ──
    this._panel = scene.add.graphics();
    this._panel.fillStyle(0x000000, 0.5);
    this._panel.fillRoundedRect(pad - 4, pad - 4, boxW, boxH, 8);
    this._panel.setScrollFactor(0).setDepth(49);

    // HP Bar
    this.hpBg = scene.add.rectangle(pad + 4, pad + 8, 196, 14, 0x333333)
      .setScrollFactor(0).setDepth(50);
    this.hpFill = scene.add.rectangle(pad + 4, pad + 8, 196, 14, 0xe94560)
      .setScrollFactor(0).setDepth(50).setOrigin(0, 0);
    this.hpText = scene.add.text(pad + 8, pad + 9, '100 / 100', {
      fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#fff'
    }).setScrollFactor(0).setDepth(51);

    // XP Bar
    this.xpBg = scene.add.rectangle(pad + 4, pad + 26, 196, 8, 0x333333)
      .setScrollFactor(0).setDepth(50);
    this.xpFill = scene.add.rectangle(pad + 4, pad + 26, 196, 8, 0x4ecdc4)
      .setScrollFactor(0).setDepth(50).setOrigin(0, 0);
    this.levelText = scene.add.text(pad + 8, pad + 36, 'Lv. 1', {
      fontSize: '12px', fontFamily: 'Arial, sans-serif', color: '#ffd700', fontStyle: 'bold'
    }).setScrollFactor(0).setDepth(51);

    // Kill counter
    this.killText = scene.add.text(pad + 8, pad + 52, 'Kills: 0', {
      fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#aaa'
    }).setScrollFactor(0).setDepth(51);

    // ── Weapon Level Display (right side panel) ──
    this._weaponPanel = scene.add.graphics();
    this._weaponPanel.setScrollFactor(0).setDepth(49);
    this._weaponTexts = [];
    this._weaponPanelWidth = 140;
    this._weaponPanelX = sw - pad - this._weaponPanelWidth;

    // Timer (top-right, above weapon panel)
    this.timerText = scene.add.text(sw - pad, pad, '00:00', {
      fontSize: '14px', fontFamily: 'monospace', color: '#fff', fontStyle: 'bold'
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(50);

    // Score (top-right)
    this.scoreText = scene.add.text(sw - pad, pad + 18, 'Score: 0', {
      fontSize: '12px', fontFamily: 'Arial, sans-serif', color: '#ccc'
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(50);

    // Enemy count
    this.enemyText = scene.add.text(sw - pad, pad + 34, 'Enemies: 0', {
      fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#888'
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(50);

    this._timerEvent = null;
  }

  updateWeapons(weapons) {
    if (!weapons || !weapons.length) return;

    const px = this._weaponPanelX;
    const py = 56;
    const lineH = 16;

    // Clear old
    for (const t of this._weaponTexts) {
      if (t && t.active) t.destroy();
    }
    this._weaponTexts = [];
    this._weaponPanel.clear();

    // Draw panel background
    const panelH = weapons.length * lineH + 8;
    this._weaponPanel.fillStyle(0x000000, 0.4);
    this._weaponPanel.fillRoundedRect(px - 4, py - 4, this._weaponPanelWidth, panelH, 6);

    // Draw weapon entries
    for (let i = 0; i < weapons.length; i++) {
      const w = weapons[i];
      const name = w.key ? w.key.charAt(0).toUpperCase() + w.key.slice(1) : '?';
      const lvl = w.level || 1;

      // Level pips (visual)
      let pips = '';
      const maxPips = 5;
      const filled = Math.min(lvl, maxPips);
      for (let p = 0; p < maxPips; p++) {
        pips += p < filled ? '◆' : '◇';
      }

      const txt = this.scene.add.text(px + 4, py + i * lineH, `${name} Lv.${lvl} ${pips}`, {
        fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#ccc'
      }).setScrollFactor(0).setDepth(51);

      this._weaponTexts.push(txt);
    }
  }

  // ── Weapon Cooldown Indicators ──
  updateWeaponCooldowns(weapons) {
    if (!weapons || !weapons.length) return;
    if (!this._cooldownGraphics) {
      this._cooldownGraphics = this.scene.add.graphics();
      this._cooldownGraphics.setScrollFactor(0).setDepth(52);
    }

    const px = this._weaponPanelX;
    const py = 56;
    const lineH = 16;

    this._cooldownGraphics.clear();

    for (let i = 0; i < weapons.length; i++) {
      const w = weapons[i];
      const cooldown = w.type.cooldown * (1 - (this.scene.player?.stats?.cooldownReduction || 0));
      const ratio = cooldown > 0 ? Math.min(1, w.timer / cooldown) : 1;

      if (ratio < 1) {
        // Show cooldown progress bar under weapon entry
        const barX = px + 4;
        const barY = py + i * lineH + 12;
        const barW = this._weaponPanelWidth - 12;

        // Background
        this._cooldownGraphics.fillStyle(0x333333, 0.5);
        this._cooldownGraphics.fillRect(barX, barY, barW, 2);
        // Fill
        this._cooldownGraphics.fillStyle(0x4ecdc4, 0.8);
        this._cooldownGraphics.fillRect(barX, barY, barW * ratio, 2);
      }
    }
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
    this.hpFill.width = Math.max(0, 196 * ratio);
    // Color changes: green > yellow > red
    if (ratio > 0.5) this.hpFill.setFillStyle(0x4ecdc4);
    else if (ratio > 0.25) this.hpFill.setFillStyle(0xf39c12);
    else this.hpFill.setFillStyle(0xe94560);
    this.hpText.setText(`${Math.ceil(current)} / ${max}`);
  }

  updateXP(current, needed, level) {
    const ratio = Math.max(0, current / needed);
    const targetWidth = Math.max(0, 196 * ratio);
    // Smooth fill animation
    if (this.xpFill.width !== targetWidth) {
      this.scene.tweens.add({
        targets: this.xpFill,
        width: targetWidth,
        duration: 300,
        ease: 'Power2'
      });
    }
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
    for (const t of this._weaponTexts) {
      if (t && t.active) t.destroy();
    }
    this._weaponTexts = [];
  }
}
