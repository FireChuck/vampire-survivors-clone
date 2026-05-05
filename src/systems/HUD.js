// HUD.js — Timer, Score, Level + XP bar, HP bar, Weapon Levels, top-left
// Fixed to screen (scrollFactor 0) for camera-following world
// QoL: Gradient HP/XP bars, rounded corners, weapon level display, save indicator
// QoL T3: XP level preview, audio HUD controls, weapon swap indicator, damage direction

class HUD {
  constructor(scene) {
    this.scene = scene;
    this.elapsedSeconds = 0;

    const sw = scene.scale.width;
    const pad = 10;
    const boxW = 195;
    const boxH = 64;

    // ── Background panel (rounded, semi-transparent) ──
    this._panel = scene.add.graphics();
    this._panel.fillStyle(0x000000, 0.45);
    this._panel.fillRoundedRect(pad - 4, pad - 4, boxW, boxH, 6);
    this._panel.setScrollFactor(0).setDepth(49);

    // HP Bar — slim, gradient
    this.hpBg = scene.add.rectangle(pad + 4, pad + 6, 183, 12, 0x222222)
      .setScrollFactor(0).setDepth(50);
    this._hpGraphics = scene.add.graphics();
    this._hpGraphics.setScrollFactor(0).setDepth(50);
    this._hpBarWidth = 183;
    this._hpBarX = pad + 4;
    this._hpBarY = pad;

    this.hpText = scene.add.text(pad + 8, pad + 6, '100 / 100', {
      fontSize: '10px', fontFamily: 'Arial, sans-serif', color: '#eee'
    }).setScrollFactor(0).setDepth(51);

    // XP Bar — thin gradient strip
    this.xpBg = scene.add.rectangle(pad + 4, pad + 22, 183, 6, 0x222222)
      .setScrollFactor(0).setDepth(50);
    this._xpGraphics = scene.add.graphics();
    this._xpGraphics.setScrollFactor(0).setDepth(50);
    this._xpBarWidth = 183;
    this._xpBarX = pad + 4;
    this._xpBarY = pad + 19;

    this.levelText = scene.add.text(pad + 8, pad + 30, 'Lv. 1', {
      fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#ffd700', fontStyle: 'bold'
    }).setScrollFactor(0).setDepth(51);

    // Kill counter — compact
    this.killText = scene.add.text(pad + 8, pad + 44, 'Kills: 0', {
      fontSize: '10px', fontFamily: 'Arial, sans-serif', color: '#999'
    }).setScrollFactor(0).setDepth(51);

    // ── QoL: XP Level Preview (shows next level abilities) ──
    this._xpPreviewText = scene.add.text(pad + 4, pad + 56, '', {
      fontSize: '9px', fontFamily: 'Arial, sans-serif', color: '#666',
      wordWrap: { width: 183 }
    }).setScrollFactor(0).setDepth(51);

    // ── QoL: Audio Volume Mini-Controls ──
    this._audioBtnVisible = false;
    this._audioMiniPanel = scene.add.graphics().setScrollFactor(0).setDepth(52).setVisible(false);
    this._audioMiniTexts = [];
    this._audioMiniOpen = false;

    // ── Weapon Level Display (right side panel) ──
    this._weaponPanel = scene.add.graphics();
    this._weaponPanel.setScrollFactor(0).setDepth(49);
    this._weaponTexts = [];
    this._weaponPanelWidth = 130;
    this._weaponPanelX = sw - pad - this._weaponPanelWidth;

    // Timer (top-right, clean monospace)
    this.timerText = scene.add.text(sw - pad, pad, '00:00', {
      fontSize: '13px', fontFamily: 'monospace', color: '#fff', fontStyle: 'bold'
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(50);

    // Score (compact, below timer)
    this.scoreText = scene.add.text(sw - pad, pad + 17, 'Score: 0', {
      fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#bbb'
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(50);

    // Enemy count — subtle, dimmer
    this.enemyText = scene.add.text(sw - pad, pad + 31, 'Enemies: 0', {
      fontSize: '10px', fontFamily: 'Arial, sans-serif', color: '#666'
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(50);

    // ── QoL: Weapon Swap Indicator ──
    this._swapIndicator = scene.add.text(sw / 2, 70, '', {
      fontSize: '18px', fontFamily: 'Arial, sans-serif', color: '#ffd700',
      fontStyle: 'bold', stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setScrollFactor(0).setDepth(55).setAlpha(0);
    this._swapIndicatorTimer = null;

    // ── QoL: Damage Direction Indicator ──
    this._damageDirGraphics = scene.add.graphics().setScrollFactor(0).setDepth(48);

    // ── Save Indicator Toast ──
    this._saveToastText = scene.add.text(sw / 2, sw > 500 ? pad + 80 : 75, '', {
      fontSize: '13px', fontFamily: 'Arial, sans-serif', color: '#44ff44',
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
    const py = 48;
    const lineH = 14;

    for (const t of this._weaponTexts) {
      if (t && t.active) t.destroy();
    }
    this._weaponTexts = [];
    this._weaponPanel.clear();

    const panelH = weapons.length * lineH + 6;
    this._weaponPanel.fillStyle(0x000000, 0.35);
    this._weaponPanel.fillRoundedRect(px - 3, py - 3, this._weaponPanelWidth, panelH, 5);

    for (let i = 0; i < weapons.length; i++) {
      const w = weapons[i];
      const name = w.key ? w.key.charAt(0).toUpperCase() + w.key.slice(1) : '?';
      const lvl = w.level || 1;

      // Compact pip display: filled dots
      let pips = '';
      const maxPips = 5;
      const filled = Math.min(lvl, maxPips);
      for (let p = 0; p < maxPips; p++) {
        pips += p < filled ? '●' : '○';
      }

      const txt = this.scene.add.text(px + 4, py + i * lineH, `${name} ${pips}`, {
        fontSize: '10px', fontFamily: 'Arial, sans-serif', color: '#bbb'
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
    const py = 48;
    const lineH = 14;

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
      this._hpGraphics.fillRoundedRect(this._hpBarX, this._hpBarY, fillWidth, 12, 3);
      this._drawGradientBar(this._hpGraphics, this._hpBarX, this._hpBarY, fillWidth, 12, topColor, bottomColor, 3);
    }

    // HP flash on low health (pulse effect)
    if (ratio <= 0.25 && ratio > 0) {
      const pulse = 0.3 + 0.3 * Math.sin(Date.now() / 200);
      this._hpGraphics.fillStyle(0xff0000, pulse);
      this._hpGraphics.fillRoundedRect(this._hpBarX, this._hpBarY, fillWidth, 12, 3);
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
      this._xpGraphics.fillRoundedRect(this._xpBarX, this._xpBarY, width, 6, 2);
      this._drawGradientBar(this._xpGraphics, this._xpBarX, this._xpBarY, width, 6, 0x88ffee, 0x227766, 2);
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

  // ── QoL: XP Level Preview ──
  updateXPPreview(current, needed, level) {
    if (!this.scene.upgradeSystem || !this.scene.player) return;
    const ratio = current / needed;
    // Only show preview when close to leveling up (>80%)
    if (ratio < 0.8) {
      this._xpPreviewText.setText('');
      return;
    }
    // Show a hint about upcoming level
    const nextLevel = level + 1;
    const pct = Math.round(ratio * 100);
    this._xpPreviewText.setText(`⬆ Lv.${nextLevel} (${pct}%)`);
    this._xpPreviewText.setStyle({ color: ratio > 0.95 ? '#ffd700' : '#888' });
  }

  // ── QoL: Weapon Swap Indicator ──
  showWeaponSwap(weaponName) {
    this._swapIndicator.setText(`🔫 Switched: ${weaponName}`);
    this._swapIndicator.setAlpha(1);
    this._swapIndicator.setScale(0.8);
    this.scene.tweens.killTweensOf(this._swapIndicator);
    this.scene.tweens.add({
      targets: this._swapIndicator,
      scaleX: 1, scaleY: 1,
      alpha: 0,
      y: this._swapIndicator.y - 30,
      duration: 1500,
      delay: 500,
      ease: 'Power2'
    });
  }

  // ── QoL: Damage Direction Indicator ──
  showDamageDirection(fromWorldX, fromWorldY) {
    if (!this.scene.player) return;
    const player = this.scene.player;
    const dx = fromWorldX - player.x;
    const dy = fromWorldY - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 50) return; // Too close to show direction

    const angle = Math.atan2(dy, dx);
    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;
    const cx = sw / 2;
    const cy = sh / 2;
    const indicatorDist = 80;

    const ix = cx + Math.cos(angle) * indicatorDist;
    const iy = cy + Math.sin(angle) * indicatorDist;

    // Draw arrow at screen edge direction
    const g = this._damageDirGraphics;
    const arrowSize = 12;
    g.fillStyle(0xff4444, 0.7);
    g.fillTriangle(
      ix + Math.cos(angle) * arrowSize,
      iy + Math.sin(angle) * arrowSize,
      ix + Math.cos(angle + 2.5) * arrowSize * 0.6,
      iy + Math.sin(angle + 2.5) * arrowSize * 0.6,
      ix + Math.cos(angle - 2.5) * arrowSize * 0.6,
      iy + Math.sin(angle - 2.5) * arrowSize * 0.6
    );

    // Fade out after 500ms
    this.scene.time.delayedCall(500, () => {
      // The graphics will be cleared on next frame or we clear the arrow
    });
  }

  /** Clear damage direction indicators each frame */
  clearDamageDirections() {
    this._damageDirGraphics.clear();
  }

  // ── QoL: Audio Mini-Controls in HUD ──
  toggleAudioMiniPanel() {
    this._audioMiniOpen = !this._audioMiniOpen;
    this._audioMiniPanel.setVisible(this._audioMiniOpen);
    if (this._audioMiniOpen) {
      this._drawAudioMiniPanel();
    }
    // Toggle audio button texts visibility
    for (const t of this._audioMiniTexts) {
      if (t && t.active) t.setVisible(this._audioMiniOpen);
    }
  }

  _drawAudioMiniPanel() {
    const g = this._audioMiniPanel;
    g.clear();
    // Clean old texts
    for (const t of this._audioMiniTexts) {
      if (t && t.active) t.destroy();
    }
    this._audioMiniTexts = [];

    const pad = 10;
    const x = pad;
    const y = 72;
    const w = 120;
    const h = 50;

    g.fillStyle(0x000000, 0.6);
    g.fillRoundedRect(x, y, w, h, 5);
    g.lineStyle(1, 0x4488ff, 0.5);
    g.strokeRoundedRect(x, y, w, h, 5);

    const vol = this.scene.audioManager ? Math.round(this.scene.audioManager._volume * 100) : 50;
    const muted = this.scene.audioManager ? this.scene.audioManager._muted : false;

    const label = this.scene.add.text(x + 5, y + 5, muted ? '🔇 Muted' : `🔊 ${vol}%`, {
      fontSize: '10px', fontFamily: 'Arial, sans-serif', color: muted ? '#ff4444' : '#aaa'
    }).setScrollFactor(0).setDepth(53).setInteractive({ useHandCursor: true });

    label.on('pointerdown', () => {
      if (this.scene.audioManager) {
        const nowMuted = this.scene.audioManager.toggleMute();
        this._drawAudioMiniPanel();
      }
    });

    const hint = this.scene.add.text(x + 5, y + 22, 'Tap to toggle', {
      fontSize: '9px', fontFamily: 'Arial, sans-serif', color: '#666'
    }).setScrollFactor(0).setDepth(53);

    // +/- buttons
    const plusBtn = this.scene.add.text(x + w - 25, y + 5, '+', {
      fontSize: '14px', fontFamily: 'Arial, sans-serif', color: '#4488ff',
      fontStyle: 'bold'
    }).setScrollFactor(0).setDepth(53).setInteractive({ useHandCursor: true });
    plusBtn.on('pointerdown', () => {
      if (this.scene.audioManager) {
        this.scene.audioManager.setVolume(Math.min(1, this.scene.audioManager._volume + 0.1));
        this._drawAudioMiniPanel();
      }
    });

    const minusBtn = this.scene.add.text(x + w - 25, y + 25, '-', {
      fontSize: '14px', fontFamily: 'Arial, sans-serif', color: '#ff8844',
      fontStyle: 'bold'
    }).setScrollFactor(0).setDepth(53).setInteractive({ useHandCursor: true });
    minusBtn.on('pointerdown', () => {
      if (this.scene.audioManager) {
        this.scene.audioManager.setVolume(Math.max(0, this.scene.audioManager._volume - 0.1));
        this._drawAudioMiniPanel();
      }
    });

    this._audioMiniTexts = [label, hint, plusBtn, minusBtn];
  }

  destroy() {
    if (this._timerEvent) this._timerEvent.destroy();
    for (const t of this._weaponTexts) {
      if (t && t.active) t.destroy();
    }
    this._weaponTexts = [];
    if (this._hpGraphics) this._hpGraphics.destroy();
    if (this._xpGraphics) this._xpGraphics.destroy();
    if (this._swapIndicator) this._swapIndicator.destroy();
    if (this._damageDirGraphics) this._damageDirGraphics.destroy();
    if (this._audioMiniPanel) this._audioMiniPanel.destroy();
    for (const t of this._audioMiniTexts) {
      if (t && t.active) t.destroy();
    }
  }
}
