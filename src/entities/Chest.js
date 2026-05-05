// Chest.js — DLC Chest/Loot System
// Golden chest that spawns periodically, drops items on player collision

class Chest extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, null);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setSize(28, 24);
    this.body.setOffset(-14, -12);
    this.body.setImmovable(true);

    this._graphics = scene.add.graphics();
    this._graphics.setDepth(5);
    this._opened = false;
    this._animTimer = 0;
    this._bobOffset = Math.random() * Math.PI * 2;

    this._drawClosed();
  }

  _drawClosed() {
    const g = this._graphics;
    g.clear();
    // Shadow
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(0, 12, 30, 8);
    // Chest body
    g.fillStyle(0xb8860b, 1);
    g.fillRect(-14, -6, 28, 18);
    // Chest lid
    g.fillStyle(0xdaa520, 1);
    g.fillRect(-14, -12, 28, 8);
    // Lid top arc
    g.fillStyle(0xffd700, 0.7);
    g.fillEllipse(0, -12, 28, 6);
    // Lock
    g.fillStyle(0x8b6914, 1);
    g.fillRect(-3, -4, 6, 6);
    g.fillStyle(0xffd700, 1);
    g.fillRect(-2, -3, 4, 4);
    // Bands
    g.lineStyle(1, 0x8b6914, 0.6);
    g.lineBetween(-14, -4, 14, -4);
    g.lineBetween(-14, 4, 14, 4);
  }

  _drawOpening() {
    const g = this._graphics;
    g.clear();
    // Shadow
    g.fillStyle(0x000000, 0.15);
    g.fillEllipse(0, 12, 30, 8);
    // Chest body (open)
    g.fillStyle(0xb8860b, 1);
    g.fillRect(-14, -4, 28, 16);
    // Inner glow
    g.fillStyle(0xffd700, 0.4);
    g.fillRect(-10, -2, 20, 12);
    // Open lid (tilted back)
    g.fillStyle(0xdaa520, 1);
    g.fillTriangle(-14, -4, 14, -4, 0, -20);
    g.fillStyle(0xffd700, 0.5);
    g.fillTriangle(-10, -4, 10, -4, 0, -16);
    // Lock open
    g.fillStyle(0x8b6914, 1);
    g.fillRect(-3, -2, 6, 4);
  }

  open(player) {
    if (this._opened) return;
    this._opened = true;

    this._drawOpening();

    // Determine drop — balanced probabilities
    const roll = Math.random();
    const gameTimeSec = this.scene.gameTime / 1000;
    let dropType, message;

    // Adjust probabilities based on game time:
    // Early game: more heals, Late game: more weapon upgrades
    const healBoost = gameTimeSec < 120 ? 0.15 : 0; // +15% heal chance early
    const weaponBoost = gameTimeSec > 300 ? 0.10 : 0; // +10% weapon chance late

    if (roll < 0.25 + weaponBoost) {
      dropType = 'weaponUpgrade';
      message = this._handleWeaponUpgrade(player);
    } else if (roll < 0.50 + healBoost) {
      dropType = 'heal';
      message = this._handleHeal(player);
    } else if (roll < 0.75) {
      dropType = 'magnetPulse';
      message = this._handleMagnetPulse(player);
    } else {
      dropType = 'damageBoost';
      message = this._handleDamageBoost(player);
    }

    // Golden particles
    if (this.scene.particleSystem) {
      this.scene.particleSystem.emitDeath(this.x, this.y, 0xffd700, 12);
    }

    // Toast text
    this._showToast(message);

    // Emit event for audio
    this.scene.events.emit('chestOpened', { x: this.x, y: this.y, dropType });

    // Destroy after animation
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 600,
      delay: 400,
      onComplete: () => this.destroy()
    });
  }

  _handleWeaponUpgrade(player) {
    const scene = this.scene;
    if (!scene._weapons || scene._weapons.length === 0) return '+20 HP (no weapon)';

    // Pick random weapon to upgrade
    const w = scene._weapons[Math.floor(Math.random() * scene._weapons.length)];
    const oldLevel = w.level;
    w.level++;
    // Apply level scaling from WEAPON_TYPES
    const baseType = WEAPON_TYPES[w.key];
    if (baseType) {
      w.type = { ...baseType };
      w.type.piercing = (baseType.piercing || 0) + Math.floor((w.level - 1) * 0.5);
      if (!baseType.aura) {
        w.type.projectileSize = (baseType.projectileSize || 6) + (w.level - 1);
      }
      w.type.damage = (baseType.damage || 5) + (w.level - 1) * 2;
    }
    return `+1 ${baseType ? baseType.name : w.key} (Lv${oldLevel}→${w.level})!`;
  }

  _handleHeal(player) {
    // Heal scales with max HP (20% of max, min 15)
    const healAmount = Math.max(15, Math.floor(player.maxHp * 0.2));
    player.hp = Math.min(player.hp + healAmount, player.maxHp);
    if (this.scene.hud) {
      this.scene.hud.updateHP(player.hp, player.maxHp);
    }
    if (this.scene.damageNumbers) {
      this.scene.damageNumbers.show(player.x, player.y - 20, healAmount, 'heal');
    }
    return `+${healAmount} HP!`;
  }

  _handleMagnetPulse(player) {
    const magnetRange = 250;
    // Collect all XP orbs in range
    let collected = 0;
    for (const orb of this.scene.xpOrbs) {
      if (!orb || !orb.active) continue;
      const dx = orb.x - player.x;
      const dy = orb.y - player.y;
      if (dx * dx + dy * dy < magnetRange * magnetRange) {
        orb.x = player.x;
        orb.y = player.y;
        collected++;
      }
    }
    // Visual pulse ring
    const g = this.scene.add.graphics();
    g.lineStyle(2, 0x88ff88, 0.6);
    g.strokeCircle(this.x, this.y, magnetRange);
    g.setDepth(20);
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 500,
      onComplete: () => g.destroy()
    });
    return `Magnet Pulse! (${collected} orbs)`;
  }

  _handleDamageBoost(player) {
    const boostMultiplier = 1.5;
    const duration = 15000;
    player.stats.damageMultiplier = (player.stats.damageMultiplier || 1) * boostMultiplier;

    // Visual indicator: red glow
    const g = this.scene.add.graphics();
    g.setDepth(4);
    const glowTimer = this.scene.time.addEvent({
      delay: 200,
      repeat: Math.floor(duration / 200),
      callback: () => {
        if (!player.active) {
          glowTimer.remove();
          g.destroy();
          return;
        }
        g.clear();
        g.fillStyle(0xff4400, 0.15 + Math.sin(Date.now() / 150) * 0.1);
        g.fillCircle(player.x, player.y, 30);
      }
    });

    // Revert after duration
    this.scene.time.delayedCall(duration, () => {
      if (player.active) {
        player.stats.damageMultiplier = (player.stats.damageMultiplier || 1) / boostMultiplier;
      }
      if (g && g.active) g.destroy();
    });
    return '+50% Damage (15s)!';
  }

  _showToast(message) {
    const text = this.scene.add.text(this.x, this.y - 30, message, {
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffd700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(50);

    this.scene.tweens.add({
      targets: text,
      y: text.y - 50,
      alpha: 0,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => text.destroy()
    });
  }

  update(time, delta) {
    if (this._opened) return;

    // Gentle bob animation
    this._animTimer += delta;
    const bob = Math.sin(this._animTimer / 400 + this._bobOffset) * 2;
    this._graphics.setPosition(this.x, this.y + bob);
  }

  destroy() {
    if (this._graphics) this._graphics.destroy();
    super.destroy();
  }
}
