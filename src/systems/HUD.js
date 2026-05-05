// HUD.js — Timer, Score, Level + XP bar, HP bar, Weapon Levels, top-left
// Fixed to screen (scrollFactor 0) for camera-following world
// QoL: Gradient HP/XP bars, rounded corners, weapon level display, save indicator

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

    // HP Bar — gradient background (dark)
    this.hpBg = scene.add.rectangle(pad + 4, pad + 8, 196, 14, 0x333333)
      .setScrollFactor(0).setDepth(50);
    // HP Bar fill — uses graphics for gradient
    this._hpGraphics = scene.add.graphics();
    this._hpGraphics.setScrollFactor(0).setDepth(50);
    this._hpBarWidth = 196;
    this._hpBarX = pad + 4;
    this._hpBarY = pad + 1;

    this.hpText = scene.add.text(pad + 8, pad + 9, '100 / 100', {
      fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#fff'
    }).setScrollFactor(0).setDepth(51);

    // XP Bar — gradient background
    this.xpBg = scene.add.rectangle(pad + 4, pad + 26, 196, 8, 0x333333)
      .setScrollFactor(0).setDepth(50);
    // XP Bar fill — uses graphics for gradient
    this._xpGraphics = scene.add.graphics();
    this._xpGraphics.setScrollFactor(0).setDepth(50);
    this._xpBarWidth = 196;
    this._xpBarX = pad + 4;
    this._xpBarY = pad + 22;

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

    // ── Save Indicator Toast ──
    this._saveToastText = scene.add.text(sw / 2, sw > 500 ? pad + 90 : 80, '', {
      fontSize: '14px', fontFamily: 'Arial, sans-serif', color: '#44ff44',
      fontStyle: 'bold', stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2000).setAlpha(0);

    this._timerEvent = null;
  }

  /**
   * Draw a gradient-filled bar
   * @param {Phaser.GameObjects.Graphics} g - graphics object
   * @param {number} x - bar x position
   * @param {number} y - bar y position
   * @param {number} width - bar fill width
   * @param {number} height - bar height
   * @param {number} topColor - gradient top color (int)
   * @param {number} bottomColor - gradient bottom color (int)
   * @param {number} cornerRadius - rounded corners
   */
  _drawGradientBar(g, x, y, width, height, topColor, bottomColor, cornerRadius) {
    if (width <= 0) return;
    const cr = Math.min(cornerRadius || 3, height / 2, width / 2);

    // Build gradient via vertical strips
    const strips = Math.max(1, Math.ceil(height / 2));
    const stripH = height / strips;
    const r1 = (topColor >> 16) & 0xff, g1 = (topColor >> 8) & 0xff, b1 = topColor & 0xff;
    const r2 = (bottomColor >> 16) & 0xff, g2 = (bottomColor >> 8) & 0xff, b2 = bottomColor & 0xff;

    for (let i = 0; i < strips; i++) {
      const t = i / (strips - 1 || 1);
      const r = Math.round(r1 + (r2 - r1) * t);
      const gg = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      const color = (r << 16) | (gg << 8) | b;
      g.fillStyle(color, 1);
      g.fillRect(x, y + i * stripH, width, stripH + 1);
    }

    // Rounded mask: clear corners
    if (cr > 0) {
      g.fillStyle(0x000000, 0);
      // This is a simplified approach — we draw the fill rect with rounded shape
      // by using fillRoundedRect instead for a cleaner look
    }
  }

  updateWeapons(weapons) {
    if (!weapons || !weapons.length) return;

    const px = this._weaponPanelX;
    const py = 56;
    const lineH = 16;

    for (const t of this._weaponTexts) {
      if (t && t.active) t.destroy();
    }
    this._weaponTexts = [];
    this._weaponPanel.clear();

    const panelH = weapons.length * lineH + 8;
    this._weaponPanel.fillStyle(0x000000, 0.4);
    this._weaponPanel.fillRoundedRect(px - 4, py - 4, this._weaponPanelWidth, panelH, 6);

    for (let i = 0; i < weapons.length; i++) {
      const w = weapons[i];
      const name = w.key ? w.key.charAt(0).toUpperCase() + w.key.slice(1) : '?';
      const lvl = w.level || 1;

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
        const barX = px + 4;
        const barY = py + i * lineH + 12;
        const barW = this._weaponPanelWidth - 12;

        this._cooldownGraphics.fillStyle(0x333333, 0.5);
        this._cooldownGraphics.fillRect(barX, barY, barW, 2);
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
    const fillWidth = Math.max(0, this._hpBarWidth * ratio);

    // Gradient colors based on HP ratio
    let topColor, bottomColor;
    if (ratio > 0.6) {
      topColor = 0x66ffaa; bottomColor = 0x22aa66; // green gradient
    } else if (ratio > 0.3) {
      topColor = 0xffcc44; bottomColor = 0xcc8800; // yellow gradient
    } else {
      topColor = 0xff6666; bottomColor = 0xcc2222; // red gradient
    }

    this._hpGraphics.clear();
    if (fillWidth > 0) {
      this._hpGraphics.fillStyle(0x000000, 0);
      // Draw rounded rect fill
      this._hpGraphics.fillRoundedRect(this._hpBarX, this._hpBarY, fillWidth, 14, 3);
      // Apply gradient over it
      this._drawGradientBar(this._hpGraphics, this._hpBarX, this._hpBarY, fillWidth, 14, topColor, bottomColor, 3);
    }

    // HP flash on low health (pulse effect)
    if (ratio <= 0.25 && ratio > 0) {
      const pulse = 0.3 + 0.3 * Math.sin(Date.now() / 200);
      this._hpGraphics.fillStyle(0xff0000, pulse);
      this._hpGraphics.fillRoundedRect(this._hpBarX, this._hpBarY, fillWidth, 14, 3);
    }

    this.hpText.setText(`${Math.ceil(current)} / ${max}`);
  }

  updateXP(current, needed, level) {
    const ratio = Math.max(0, current / needed);
    const targetWidth = Math.max(0, this._xpBarWidth * ratio);

    // Smooth fill animation via tween
    this._xpTargetWidth = targetWidth;
    if (this._xpCurrentWidth === undefined) this._xpCurrentWidth = 0;
    if (Math.abs(this._xpCurrentWidth - targetWidth) > 1) {
      this.scene.tweens.add({
        targets: this,
        _xpCurrentWidth: targetWidth,
        duration: 300,
        ease: 'Power2',
        onUpdate: () => {
          this._redrawXPBar(this._xpCurrentWidth);
        }
      });
    } else {
      this._xpCurrentWidth = targetWidth;
      this._redrawXPBar(targetWidth);
    }

    this.levelText.setText(`Lv. ${level}`);
  }

  _redrawXPBar(width) {
    this._xpGraphics.clear();
    if (width > 0) {
      // XP gradient: bright cyan top → deeper teal bottom
      this._xpGraphics.fillRoundedRect(this._xpBarX, this._xpBarY, width, 8, 2);
      this._drawGradientBar(this._xpGraphics, this._xpBarX, this._xpBarY, width, 8, 0x88ffee, 0x227766, 2);
    }
  }

  updateScore(score) {
    this.scoreText.setText(`Score: ${score}`);
  }

  updateKills(kills) {
    if (this.elapsedSeconds < 10) {
      this.killText.setText(`\u{1F480} Kills: ${kills}`);
    } else {
      const kpm = (kills / (this.elapsedSeconds / 60)).toFixed(1);
      this.killText.setText(`\u{1F480} Kills: ${kills} | ${kpm}/min`);
    }
  }

  updateEnemyCount(count) {
    this.enemyText.setText(`Enemies: ${count}`);
  }

  /**
   * Show save indicator toast ("💾 Saved!" or "⚠️ Save failed!")
   * @param {boolean} success
   */
  showSaveIndicator(success) {
    const text = success ? '💾 Saved!' : '⚠️ Save failed!';
    const color = success ? '#44ff44' : '#ff4444';
    this._saveToastText.setText(text);
    this._saveToastText.setStyle({ color });

    this.scene.tweens.killTweensOf(this._saveToastText);
    this._saveToastText.setAlpha(0);
    this._saveToastText.setY(this._saveToastText.y - 10);

    this.scene.tweens.add({
      targets: this._saveToastText,
      alpha: 1,
      y: this._saveToastText.y + 10,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.time.delayedCall(1500, () => {
          this.scene.tweens.add({
            targets: this._saveToastText,
            alpha: 0,
            y: this._saveToastText.y - 15,
            duration: 400,
            ease: 'Sine.easeIn'
          });
        });
      }
    });
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
    if (this._hpGraphics) this._hpGraphics.destroy();
    if (this._xpGraphics) this._xpGraphics.destroy();
  }
}
