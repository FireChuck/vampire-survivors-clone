// AbilitySystem.js — Vampire Survivors Clone
// Cooldown management, activation, UI ability bar, touch buttons

class AbilitySystem {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;

    // Equipped abilities (max 3 slots)
    this.slots = [null, null, null];
    this.maxSlots = 3;

    // Cooldown state per slot
    this.cooldowns = [0, 0, 0];   // remaining cooldown ms
    this.actives = [0, 0, 0];     // remaining active duration ms

    // Visual elements
    this._abilityBarContainer = null;
    this._slotGraphics = [];
    this._cooldownOverlays = [];
    this._cooldownTexts = [];
    this._keyTexts = [];
    this._iconTexts = [];
    this._touchZones = [];

    // Active effect visuals
    this._shieldGraphics = null;
    this._shieldAbsorbLeft = 0;
    this._dashTrailGraphics = null;

    // Meteor effect tracking
    this._activeMeteors = [];

    // Time freeze state
    this._timeFreezeActive = false;
    this._timeFreezeTimer = 0;

    // All unlocked ability ids (for upgrade system)
    this.unlockedIds = new Set();
    this.ownedIds = new Set();

    // Build UI
    this._buildAbilityBar();
  }

  // ── Ability Management ──

  /** Equip an ability into the first empty slot */
  equipAbility(abilityId) {
    if (this.ownedIds.has(abilityId)) return false;

    const type = ABILITY_TYPES[abilityId];
    if (!type) return false;

    // Find first empty slot
    const slotIdx = this.slots.indexOf(null);
    if (slotIdx === -1) return false; // all full

    this.slots[slotIdx] = abilityId;
    this.cooldowns[slotIdx] = 0;
    this.actives[slotIdx] = 0;
    this.ownedIds.add(abilityId);

    // Update UI
    this._updateSlotVisual(slotIdx);

    // Notify synergy system to re-check
    if (this.scene.synergySystem) {
      this.scene.synergySystem.refresh();
    }

    return true;
  }

  /** Get list of unowned ability ids (for upgrade system) */
  getUnownedAbilities() {
    return getAllAbilities().filter(a => !this.ownedIds.has(a.id));
  }

  /** Check if an ability id is owned */
  isOwned(abilityId) {
    return this.ownedIds.has(abilityId);
  }

  // ── Activation ──

  /** Activate ability by slot index (0, 1, 2) */
  activateSlot(slotIdx) {
    if (slotIdx < 0 || slotIdx >= this.maxSlots) return false;
    const abilityId = this.slots[slotIdx];
    if (!abilityId) return false;
    if (this.cooldowns[slotIdx] > 0) return false;

    const type = ABILITY_TYPES[abilityId];
    if (!type) return false;

    // Apply cooldown reduction from player stats
    const cdr = this.player.stats.cooldownReduction || 0;
    const effectiveCooldown = type.cooldown * (1 - cdr);

    this.cooldowns[slotIdx] = effectiveCooldown;

    // QoL T4: Track abilities used
    if (this.scene && this.scene._abilitiesUsedCount !== undefined) {
      this.scene._abilitiesUsedCount++;
    }

    // Execute ability effect
    switch (abilityId) {
      case 'dash': this._activateDash(type, slotIdx); break;
      case 'shield': this._activateShield(type, slotIdx); break;
      case 'meteor': this._activateMeteor(type, slotIdx); break;
      case 'timeFreeze': this._activateTimeFreeze(type, slotIdx); break;
    }

    return true;
  }

  // ── Individual Abilities ──

  _activateDash(type, slotIdx) {
    const dur = type.duration;
    this.actives[slotIdx] = dur;

    // Grant immunity
    this.player._invincible = true;

    // Speed boost
    const origSpeed = this.player.stats.speed;
    this.player.stats.speed *= type.speedMultiplier;

    // Visual trail
    if (this._dashTrailGraphics) this._dashTrailGraphics.destroy();
    this._dashTrailGraphics = this.scene.add.graphics();
    this._dashTrailGraphics.setDepth(9);

    // Synergy hook: Dash Strike
    if (this.scene.synergySystem) {
      this.scene.synergySystem.onDashActivated();
    }

    // End dash after duration
    this.scene.time.delayedCall(dur, () => {
      this.player.stats.speed = origSpeed;
      this.player._invincible = false;
      this.actives[slotIdx] = 0;
      if (this._dashTrailGraphics) {
        this._dashTrailGraphics.destroy();
        this._dashTrailGraphics = null;
      }
    });
  }

  _activateShield(type, slotIdx) {
    const dur = type.duration;
    this.actives[slotIdx] = dur;
    this._shieldAbsorbLeft = type.absorbDamage;

    // Create shield visual
    if (this._shieldGraphics) this._shieldGraphics.destroy();
    this._shieldGraphics = this.scene.add.graphics();
    this._shieldGraphics.setDepth(15);

    // Override player takeDamage to absorb
    const origTakeDamage = this.player.takeDamage.bind(this.player);
    this.player.takeDamage = (amount) => {
      if (this._shieldAbsorbLeft > 0) {
        const absorbed = Math.min(amount, this._shieldAbsorbLeft);
        this._shieldAbsorbLeft -= absorbed;
        const remaining = amount - absorbed;

        // Visual feedback
        this._flashShield();

        if (remaining > 0) {
          // Restore original before calling
          this.player.takeDamage = origTakeDamage;
          const result = this.player.takeDamage(remaining);
          this.player.takeDamage = (a) => {
            if (this._shieldAbsorbLeft > 0) {
              const ab2 = Math.min(a, this._shieldAbsorbLeft);
              this._shieldAbsorbLeft -= ab2;
              const rem2 = a - ab2;
              this._flashShield();
              if (rem2 > 0) {
                this.player.takeDamage = origTakeDamage;
                const r = this.player.takeDamage(rem2);
                this.player.takeDamage = (a2) => { /* already restored */ };
                return r;
              }
              return 0;
            }
            this.player.takeDamage = origTakeDamage;
            const r = this.player.takeDamage(a);
            this.player.takeDamage = (a2) => { /* already restored */ };
            return r;
          };
          return 0;
        }
        return 0;
      }
      // Shield depleted — restore original
      this.player.takeDamage = origTakeDamage;
      const result = this.player.takeDamage(amount);
      this.player.takeDamage = (a) => {
        if (this._shieldAbsorbLeft > 0) {
          const ab2 = Math.min(a, this._shieldAbsorbLeft);
          this._shieldAbsorbLeft -= ab2;
          this._flashShield();
          if (a - ab2 > 0) {
            this.player.takeDamage = origTakeDamage;
            const r = this.player.takeDamage(a - ab2);
            this.player.takeDamage = (a2) => { /* already restored */ };
            return r;
          }
          return 0;
        }
        this.player.takeDamage = origTakeDamage;
        const r = this.player.takeDamage(a);
        this.player.takeDamage = (a2) => { /* already restored */ };
        return r;
      };
      return result;
    };

    // End shield after duration
    this.scene.time.delayedCall(dur, () => {
      this.actives[slotIdx] = 0;
      this.player.takeDamage = origTakeDamage;
      if (this._shieldGraphics) {
        this._shieldGraphics.destroy();
        this._shieldGraphics = null;
      }
    });
  }

  _flashShield() {
    if (!this._shieldGraphics) return;
    this.scene.tweens.add({
      targets: this._shieldGraphics,
      alpha: 0.3,
      duration: 80,
      yoyo: true
    });
  }

  _activateMeteor(type, slotIdx) {
    const px = this.player.x;
    const py = this.player.y;

    for (let i = 0; i < type.meteorCount; i++) {
      this.scene.time.delayedCall(i * type.staggerDelay, () => {
        // Random position near player
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * type.spreadRadius;
        const mx = px + Math.cos(angle) * dist;
        const my = py + Math.sin(angle) * dist;

        this._spawnMeteor(mx, my, type);
      });
    }
  }

  _spawnMeteor(x, y, type) {
    // Warning circle
    const warning = this.scene.add.graphics();
    warning.fillStyle(0xff4400, 0.2);
    warning.fillCircle(x, y, type.meteorRadius);
    warning.lineStyle(2, 0xff4400, 0.5);
    warning.strokeCircle(x, y, type.meteorRadius);
    warning.setDepth(20);

    // Impact after brief delay
    this.scene.time.delayedCall(300, () => {
      warning.destroy();

      // Impact visual
      const impact = this.scene.add.graphics();
      impact.fillStyle(0xff6600, 0.6);
      impact.fillCircle(x, y, type.meteorRadius * 0.8);
      impact.fillStyle(0xffaa00, 0.8);
      impact.fillCircle(x, y, type.meteorRadius * 0.4);
      impact.setDepth(25);

      this.scene.tweens.add({
        targets: impact,
        alpha: 0,
        duration: 400,
        onComplete: () => impact.destroy()
      });

      // Deal damage to enemies in radius
      const damage = type.meteorDamage * this.player.stats.damageMultiplier * (this.player.abilityDamageMultiplier || 1);
      for (const enemy of this.scene.enemies) {
        if (!enemy || !enemy.active) continue;
        const dx = enemy.x - x;
        const dy = enemy.y - y;
        if (dx * dx + dy * dy < type.meteorRadius * type.meteorRadius) {
          enemy.takeDamage(damage);
        }
      }
    });
  }

  _activateTimeFreeze(type, slotIdx) {
    const dur = type.duration;
    this.actives[slotIdx] = dur;
    this._timeFreezeActive = true;
    this._timeFreezeTimer = dur;

    // Visual: blue tint overlay
    const overlay = this.scene.add.rectangle(
      this.scene.scale.width / 2, this.scene.scale.height / 2,
      this.scene.scale.width, this.scene.scale.height,
      0x4488ff, 0.15
    ).setScrollFactor(0).setDepth(45);

    // Freeze text
    const freezeText = this.scene.add.text(
      this.scene.scale.width / 2, this.scene.scale.height / 2 - 60,
      '❄️ TIME FREEZE ❄️', {
        fontSize: '24px', fontFamily: 'Arial, sans-serif',
        color: '#aaeeff', fontStyle: 'bold',
        stroke: '#000', strokeThickness: 3
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(46).setAlpha(0);

    this.scene.tweens.add({
      targets: freezeText,
      alpha: 1, duration: 200,
      yoyo: true, hold: dur - 400
    });

    // End after duration
    this.scene.time.delayedCall(dur, () => {
      this.actives[slotIdx] = 0;
      this._timeFreezeActive = false;
      this._timeFreezeTimer = 0;
      overlay.destroy();
      freezeText.destroy();
    });
  }

  /** Check if time freeze is active (for enemy update) */
  isTimeFreezeActive() {
    return this._timeFreezeActive;
  }

  // ── Update Loop ──

  update(time, delta) {
    // Update cooldowns
    for (let i = 0; i < this.maxSlots; i++) {
      if (this.cooldowns[i] > 0) {
        this.cooldowns[i] = Math.max(0, this.cooldowns[i] - delta);
      }
    }

    // Update shield visual
    if (this._shieldGraphics && this.player.active) {
      this._shieldGraphics.clear();
      const type = ABILITY_TYPES.shield;
      const px = this.player.x;
      const py = this.player.y;
      const absorbRatio = this._shieldAbsorbLeft / type.absorbDamage;

      this._shieldGraphics.lineStyle(3, type.color, 0.4 + absorbRatio * 0.4);
      this._shieldGraphics.strokeCircle(px, py, type.radius);
      this._shieldGraphics.fillStyle(type.color, 0.08 + absorbRatio * 0.12);
      this._shieldGraphics.fillCircle(px, py, type.radius);
    }

    // Update dash trail
    if (this._dashTrailGraphics && this.player.active) {
      this._dashTrailGraphics.clear();
      this._dashTrailGraphics.fillStyle(0x44ddff, 0.2);
      this._dashTrailGraphics.fillCircle(this.player.x, this.player.y, 18);
    }

    // Update UI cooldown overlays
    this._updateCooldownUI();
  }

  // ── UI — Ability Bar ──

  _buildAbilityBar() {
    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;
    const slotSize = 48;
    const gap = 8;
    const totalWidth = this.maxSlots * slotSize + (this.maxSlots - 1) * gap;
    const startX = (sw - totalWidth) / 2;
    const barY = sh - 90;

    this._abilityBarContainer = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(100);

    for (let i = 0; i < this.maxSlots; i++) {
      const cx = startX + i * (slotSize + gap) + slotSize / 2;
      const cy = barY;

      // Slot background
      const bg = this.scene.add.graphics();
      bg.fillStyle(0x1a1a2e, 0.85);
      bg.fillRoundedRect(cx - slotSize / 2, cy - slotSize / 2, slotSize, slotSize, 6);
      bg.lineStyle(2, 0x444466, 0.8);
      bg.strokeRoundedRect(cx - slotSize / 2, cy - slotSize / 2, slotSize, slotSize, 6);
      this._abilityBarContainer.add(bg);
      this._slotGraphics.push(bg);

      // Cooldown overlay (sweep effect)
      const cdOverlay = this.scene.add.graphics();
      cdOverlay.setAlpha(0);
      this._abilityBarContainer.add(cdOverlay);
      this._cooldownOverlays.push(cdOverlay);

      // Cooldown text
      const cdText = this.scene.add.text(cx, cy, '', {
        fontSize: '14px', fontFamily: 'Arial, sans-serif',
        color: '#ffffff', fontStyle: 'bold'
      }).setOrigin(0.5).setAlpha(0);
      this._abilityBarContainer.add(cdText);
      this._cooldownTexts.push(cdText);

      // Icon placeholder
      const iconText = this.scene.add.text(cx, cy - 4, '', {
        fontSize: '20px'
      }).setOrigin(0.5);
      this._abilityBarContainer.add(iconText);
      this._iconTexts.push(iconText);

      // Key label
      const keyLabels = ['Q', 'W', 'E'];
      const keyText = this.scene.add.text(cx, cy + slotSize / 2 - 6, keyLabels[i], {
        fontSize: '11px', fontFamily: 'Arial, sans-serif',
        color: '#888888'
      }).setOrigin(0.5);
      this._abilityBarContainer.add(keyText);
      this._keyTexts.push(keyText);

      // Touch zone (larger hit area for mobile)
      const touchZone = this.scene.add.rectangle(cx, cy, slotSize + 12, slotSize + 12, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      touchZone.on('pointerdown', () => {
        this.activateSlot(i);
      });
      this._abilityBarContainer.add(touchZone);
      this._touchZones.push(touchZone);
    }
  }

  _updateSlotVisual(slotIdx) {
    const abilityId = this.slots[slotIdx];
    const type = abilityId ? ABILITY_TYPES[abilityId] : null;

    if (type) {
      this._iconTexts[slotIdx].setText(type.icon);
      this._keyTexts[slotIdx].setText(type.key);

      // Color the slot border
      this._slotGraphics[slotIdx].clear();
      const slotSize = 48;
      const sw = this.scene.scale.width;
      const sh = this.scene.scale.height;
      const gap = 8;
      const totalWidth = this.maxSlots * slotSize + (this.maxSlots - 1) * gap;
      const startX = (sw - totalWidth) / 2;
      const barY = sh - 90;
      const cx = startX + slotIdx * (slotSize + gap) + slotSize / 2;
      const cy = barY;

      this._slotGraphics[slotIdx].fillStyle(0x1a1a2e, 0.85);
      this._slotGraphics[slotIdx].fillRoundedRect(cx - slotSize / 2, cy - slotSize / 2, slotSize, slotSize, 6);
      this._slotGraphics[slotIdx].lineStyle(2, type.color, 0.8);
      this._slotGraphics[slotIdx].strokeRoundedRect(cx - slotSize / 2, cy - slotSize / 2, slotSize, slotSize, 6);
    } else {
      this._iconTexts[slotIdx].setText('');
      this._keyTexts[slotIdx].setText(['Q', 'W', 'E'][slotIdx]);
    }
  }

  _updateCooldownUI() {
    for (let i = 0; i < this.maxSlots; i++) {
      const abilityId = this.slots[i];
      if (!abilityId) continue;

      const type = ABILITY_TYPES[abilityId];
      const remaining = this.cooldowns[i];
      const total = type.cooldown * (1 - (this.player.stats.cooldownReduction || 0));

      const overlay = this._cooldownOverlays[i];
      const text = this._cooldownTexts[i];

      if (remaining > 0) {
        const ratio = remaining / total;

        // Dark overlay covering ratio of the slot
        overlay.clear();
        const slotSize = 48;
        const sw = this.scene.scale.width;
        const sh = this.scene.scale.height;
        const gap = 8;
        const totalWidth = this.maxSlots * slotSize + (this.maxSlots - 1) * gap;
        const startX = (sw - totalWidth) / 2;
        const barY = sh - 90;
        const cx = startX + i * (slotSize + gap) + slotSize / 2;
        const cy = barY;

        // Sweep from bottom
        const coverHeight = slotSize * ratio;
        overlay.fillStyle(0x000000, 0.6);
        overlay.fillRect(cx - slotSize / 2, cy + slotSize / 2 - coverHeight, slotSize, coverHeight);

        overlay.setAlpha(1);

        // Cooldown text
        const secs = Math.ceil(remaining / 1000);
        text.setText(secs.toString());
        text.setAlpha(1);
      } else {
        overlay.setAlpha(0);
        text.setAlpha(0);
      }
    }
  }

  // ── Keyboard Input ──

  /** Call from GameScene update() — checks Q, W, E keys */
  handleKeyboardInput() {
    if (this.scene.upgradeSystem && this.scene.upgradeSystem.paused) return;

    if (Phaser.Input.Keyboard.JustDown(this.scene.input.keyboard.addKey('Q'))) {
      this.activateSlot(0);
    }
    if (Phaser.Input.Keyboard.JustDown(this.scene.input.keyboard.addKey('W'))) {
      this.activateSlot(1);
    }
    if (Phaser.Input.Keyboard.JustDown(this.scene.input.keyboard.addKey('E'))) {
      this.activateSlot(2);
    }
  }

  // ── Cleanup ──

  destroy() {
    if (this._abilityBarContainer) this._abilityBarContainer.destroy();
    if (this._shieldGraphics) this._shieldGraphics.destroy();
    if (this._dashTrailGraphics) this._dashTrailGraphics.destroy();
  }
}
