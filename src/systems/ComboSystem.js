// ComboSystem.js — Multiplier-based kill chain system
// Tracks consecutive kills within a time window, awards XP bonus
// Integrates with existing kill streak and HUD

class ComboSystem {
  constructor(scene) {
    this.scene = scene;

    // Combo state
    this.multiplier = 1;
    this.comboCount = 0;
    this.lastKillTime = 0;
    this.comboTimeout = 3000; // 3 second window
    this.totalBonusXP = 0;

    // Milestone multipliers: kills needed → multiplier
    this.milestones = [
      { kills: 0, mult: 1 },
      { kills: 5, mult: 2 },
      { kills: 15, mult: 3 },
      { kills: 30, mult: 5 },
      { kills: 60, mult: 10 }
    ];

    // XP bonus per kill = baseXP * (multiplier - 1) * 0.1 (10% of diff)
    this.xpBonusFactor = 0.1;

    // UI overlay
    this._gfx = scene.add.graphics().setScrollFactor(0).setDepth(57);
    this._counterText = scene.add.text(0, 0, '', {
      fontSize: '32px', fontFamily: 'Arial, sans-serif', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 5
    }).setOrigin(0.5).setScrollFactor(0).setDepth(58).setAlpha(0);

    this._multText = scene.add.text(0, 0, '', {
      fontSize: '22px', fontFamily: 'Arial, sans-serif', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(58).setAlpha(0);

    this._fadeTimer = 0;
    this._lastMult = 1;

    // Web Audio context for milestone sounds
    this._audioCtx = null;
    try {
      this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { /* audio not available */ }
  }

  /** Called when an enemy dies */
  onEnemyKill(killData) {
    const now = this.scene.spawnManager ? this.scene.spawnManager.gameTime : Date.now();

    // Check combo window
    if (now - this.lastKillTime < this.comboTimeout) {
      this.comboCount++;
    } else {
      this.comboCount = 1;
    }
    this.lastKillTime = now;

    // Calculate new multiplier from milestones
    let newMult = 1;
    for (let i = this.milestones.length - 1; i >= 0; i--) {
      if (this.comboCount >= this.milestones[i].kills) {
        newMult = this.milestones[i].mult;
        break;
      }
    }

    const oldMult = this.multiplier;
    this.multiplier = newMult;

    // Calculate bonus XP
    if (this.multiplier > 1) {
      const baseXP = killData.xpValue || 1;
      const bonus = Math.floor(baseXP * (this.multiplier - 1) * this.xpBonusFactor);
      if (bonus > 0) {
        this.totalBonusXP += bonus;
        // Grant bonus XP to player
        if (this.scene.player) {
          this.scene.player.xp += bonus;
        }
      }
    }

    // Milestone sound on multiplier change
    if (newMult > oldMult && this._audioCtx) {
      this._playMilestoneSound(newMult);
    }

    this._fadeTimer = this.comboTimeout;

    // Update visuals
    this._updateUI();
  }

  update(delta) {
    if (this.comboCount === 0) return;

    const now = this.scene.spawnManager ? this.scene.spawnManager.gameTime : Date.now();

    // Combo expired
    if (now - this.lastKillTime >= this.comboTimeout && this.comboCount > 0) {
      this.comboCount = 0;
      this.multiplier = 1;
      this._updateUI();
    }

    // Fade timer for visuals
    if (this._fadeTimer > 0) {
      this._fadeTimer -= delta;
      if (this._fadeTimer <= 0) {
        this._counterText.setAlpha(0);
        this._multText.setAlpha(0);
        this._gfx.clear();
      }
    }
  }

  _updateUI() {
    if (this.comboCount < 2) {
      this._counterText.setAlpha(0);
      this._multText.setAlpha(0);
      this._gfx.clear();
      return;
    }

    const sw = this.scene.scale.width;
    const cx = sw / 2;
    const cy = 80;

    // Color based on multiplier
    const colors = { 1: '#aaaaaa', 2: '#88ff88', 3: '#44ff44', 5: '#ffd700', 10: '#ff4444' };
    const color = colors[this.multiplier] || '#ff00ff';

    // Counter text
    this._counterText.setText(`${this.comboCount} COMBO`);
    this._counterText.setStyle({ color, fontSize: this.multiplier >= 5 ? '38px' : '32px' });
    this._counterText.setPosition(cx, cy);
    this._counterText.setAlpha(1);

    // Scale animation
    if (this.multiplier !== this._lastMult) {
      this._lastMult = this.multiplier;
      this.scene.tweens.killTweensOf(this._counterText);
      this.scene.tweens.killTweensOf(this._multText);
      this._counterText.setScale(1.4);
      this.scene.tweens.add({
        targets: this._counterText,
        scaleX: 1, scaleY: 1,
        duration: 300, ease: 'Back.easeOut'
      });
    }

    // Multiplier text
    this._multText.setText(`×${this.multiplier}`);
    this._multText.setStyle({ color });
    this._multText.setPosition(cx, cy + 30);
    this._multText.setAlpha(1);

    // Timer bar
    this._gfx.clear();
    const barW = 140;
    const barH = 4;
    const barX = cx - barW / 2;
    const barY = cy + 48;
    this._gfx.fillStyle(0x222222, 0.6);
    this._gfx.fillRect(barX, barY, barW, barH);

    const now = this.scene.spawnManager ? this.scene.spawnManager.gameTime : Date.now();
    const elapsed = now - this.lastKillTime;
    const ratio = Math.max(0, 1 - elapsed / this.comboTimeout);
    const r = ratio > 0.5 ? 0x44ff44 : ratio > 0.25 ? 0xffaa00 : 0xff4444;
    this._gfx.fillStyle(r, 0.9);
    this._gfx.fillRect(barX, barY, barW * ratio, barH);

    this._fadeTimer = this.comboTimeout;
  }

  _playMilestoneSound(mult) {
    if (!this._audioCtx || this._audioCtx.state === 'suspended') {
      try { this._audioCtx.resume(); } catch (e) { return; }
    }

    const osc = this._audioCtx.createOscillator();
    const gain = this._audioCtx.createGain();
    osc.connect(gain);
    gain.connect(this._audioCtx.destination);

    // Higher pitch for higher multipliers
    const freqs = { 2: 440, 3: 554, 5: 659, 10: 880 };
    osc.frequency.value = freqs[mult] || 660;
    osc.type = mult >= 5 ? 'square' : 'sine';
    gain.gain.setValueAtTime(0.15, this._audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this._audioCtx.currentTime + 0.2);

    osc.start(this._audioCtx.currentTime);
    osc.stop(this._audioCtx.currentTime + 0.2);
  }

  /** Reset on game restart */
  reset() {
    this.comboCount = 0;
    this.multiplier = 1;
    this.lastKillTime = 0;
    this.totalBonusXP = 0;
    this._fadeTimer = 0;
    this._lastMult = 1;
    this._counterText.setAlpha(0);
    this._multText.setAlpha(0);
    this._gfx.clear();
  }
}
