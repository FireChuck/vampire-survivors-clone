// Chest.js — DLC Chest/Loot System with 4 Rarity Types
// Types: Normal (60%), Rare (25%), Epic (12%), Legendary (3%)
// Each type has different drop tables, visual styles, and particle effects

const CHEST_TYPES = {
  normal: {
    name: 'Chest',
    color: { body: 0xb8860b, lid: 0xdaa520, highlight: 0xffd700, lock: 0x8b6914 },
    glowColor: 0xffd700,
    glowIntensity: 0,
    particleCount: 6,
    particleColor: 0xffd700,
    dropRates: { weaponUpgrade: 0.20, heal: 0.40, magnetPulse: 0.25, damageBoost: 0.15 },
    healScale: 0.15,
    label: ''
  },
  rare: {
    name: 'Rare Chest',
    color: { body: 0x1a5276, lid: 0x2980b9, highlight: 0x5dade2, lock: 0x154360 },
    glowColor: 0x3498db,
    glowIntensity: 0.3,
    particleCount: 10,
    particleColor: 0x5dade2,
    dropRates: { weaponUpgrade: 0.35, heal: 0.25, magnetPulse: 0.20, damageBoost: 0.20 },
    healScale: 0.25,
    label: '✦'
  },
  epic: {
    name: 'Epic Chest',
    color: { body: 0x6c3483, lid: 0x8e44ad, highlight: 0xbb8fce, lock: 0x512e5f },
    glowColor: 0x9b59b6,
    glowIntensity: 0.5,
    particleCount: 16,
    particleColor: 0xbb8fce,
    dropRates: { weaponUpgrade: 0.45, heal: 0.15, magnetPulse: 0.15, damageBoost: 0.25 },
    healScale: 0.35,
    label: '✦✦'
  },
  legendary: {
    name: 'Legendary Chest',
    color: { body: 0xb7950b, lid: 0xf1c40f, highlight: 0xf9e154, lock: 0x7d6608 },
    glowColor: 0xf39c12,
    glowIntensity: 0.7,
    particleCount: 24,
    particleColor: 0xf9e154,
    dropRates: { weaponUpgrade: 0.55, heal: 0.10, magnetPulse: 0.10, damageBoost: 0.25 },
    healScale: 0.50,
    label: '★ LEGENDARY ★'
  }
};

// Weighted spawn rates
const CHEST_SPAWN_WEIGHTS = [
  { type: 'normal', weight: 60 },
  { type: 'rare', weight: 25 },
  { type: 'epic', weight: 12 },
  { type: 'legendary', weight: 3 }
];

class Chest extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, chestType) {
    super(scene, x, y, null);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setSize(28, 24);
    this.body.setOffset(-14, -12);
    this.body.setImmovable(true);

    // Determine chest type (weighted random if not specified)
    if (chestType && CHEST_TYPES[chestType]) {
      this._typeKey = chestType;
    } else {
      this._typeKey = Chest._rollRarity();
    }
    this._type = CHEST_TYPES[this._typeKey];

    this._graphics = scene.add.graphics();
    this._graphics.setDepth(5);
    this._opened = false;
    this._animTimer = 0;
    this._bobOffset = Math.random() * Math.PI * 2;

    // Glow effect for rare+ chests
    this._glowGraphics = scene.add.graphics();
    this._glowGraphics.setDepth(4);

    this._drawClosed();
  }

  /** Weighted random rarity roll */
  static _rollRarity() {
    const totalWeight = CHEST_SPAWN_WEIGHTS.reduce((sum, w) => sum + w.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const entry of CHEST_SPAWN_WEIGHTS) {
      roll -= entry.weight;
      if (roll <= 0) return entry.type;
    }
    return 'normal';
  }

  _drawClosed() {
    const g = this._graphics;
    const c = this._type.color;
    g.clear();

    // Shadow
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(0, 12, 30, 8);

    // Chest body
    g.fillStyle(c.body, 1);
    g.fillRect(-14, -6, 28, 18);

    // Chest lid
    g.fillStyle(c.lid, 1);
    g.fillRect(-14, -12, 28, 8);

    // Lid top arc
    g.fillStyle(c.highlight, 0.7);
    g.fillEllipse(0, -12, 28, 6);

    // Lock
    g.fillStyle(c.lock, 1);
    g.fillRect(-3, -4, 6, 6);
    g.fillStyle(c.highlight, 1);
    g.fillRect(-2, -3, 4, 4);

    // Bands
    g.lineStyle(1, c.lock, 0.6);
    g.lineBetween(-14, -4, 14, -4);
    g.lineBetween(-14, 4, 14, 4);

    // Rarity label
    if (this._type.label) {
      g.lineStyle(0);
    }
  }

  _drawGlow(time) {
    const glow = this._glowGraphics;
    const intensity = this._type.glowIntensity;

    if (intensity <= 0 || this._opened) {
      glow.clear();
      return;
    }

    glow.clear();
    const pulse = 0.5 + 0.5 * Math.sin(time / 300 + this._bobOffset);
    const alpha = intensity * (0.4 + 0.3 * pulse);
    const radius = 24 + pulse * 6;

    glow.fillStyle(this._type.glowColor, alpha);
    glow.fillCircle(0, 0, radius);

    // Outer ring
    glow.lineStyle(2, this._type.glowColor, alpha * 0.6);
    glow.strokeCircle(0, 0, radius + 4);
  }

  _drawOpening() {
    const g = this._graphics;
    const c = this._type.color;
    g.clear();

    // Shadow
    g.fillStyle(0x000000, 0.15);
    g.fillEllipse(0, 12, 30, 8);

    // Chest body (open)
    g.fillStyle(c.body, 1);
    g.fillRect(-14, -4, 28, 16);

    // Inner glow
    g.fillStyle(c.highlight, 0.5);
    g.fillRect(-10, -2, 20, 12);

    // Open lid (tilted back)
    g.fillStyle(c.lid, 1);
    g.fillTriangle(-14, -4, 14, -4, 0, -20);
    g.fillStyle(c.highlight, 0.6);
    g.fillTriangle(-10, -4, 10, -4, 0, -16);

    // Lock open
    g.fillStyle(c.lock, 1);
    g.fillRect(-3, -2, 6, 4);

    // Opening burst glow
    g.fillStyle(c.highlight, 0.3);
    g.fillCircle(0, 0, 35);
  }

  open(player) {
    if (this._opened) return;
    this._opened = true;

    this._drawOpening();
    this._glowGraphics.clear();

    // Determine drop based on chest type's drop rates
    const rates = this._type.dropRates;
    const roll = Math.random();
    const gameTimeSec = this.scene.gameTime / 1000;
    let dropType, message;

    // Adjust for game time (early game more heals, late game more weapon upgrades)
    const healBoost = gameTimeSec < 120 ? 0.15 : 0;
    const weaponBoost = gameTimeSec > 300 ? 0.10 : 0;

    const effectiveRates = {
      weaponUpgrade: rates.weaponUpgrade + weaponBoost,
      heal: rates.heal + healBoost,
      magnetPulse: rates.magnetPulse,
      damageBoost: rates.damageBoost
    };

    if (roll < effectiveRates.weaponUpgrade) {
      dropType = 'weaponUpgrade';
      message = this._handleWeaponUpgrade(player);
    } else if (roll < effectiveRates.weaponUpgrade + effectiveRates.heal) {
      dropType = 'heal';
      message = this._handleHeal(player);
    } else if (roll < effectiveRates.weaponUpgrade + effectiveRates.heal + effectiveRates.magnetPulse) {
      dropType = 'magnetPulse';
      message = this._handleMagnetPulse(player);
    } else {
      dropType = 'damageBoost';
      message = this._handleDamageBoost(player);
    }

    // Particles — scaled by rarity
    if (this.scene.particleSystem) {
      this.scene.particleSystem.emitDeath(this.x, this.y, this._type.particleColor, this._type.particleCount);
    }

    // Opening glow burst
    this._spawnOpeningGlow();

    // Toast text with chest type prefix
    const prefix = this._typeKey !== 'normal' ? `[${this._type.name}] ` : '';
    this._showToast(`${prefix}${message}`, this._type.glowColor);

    // Emit event for audio
    this.scene.events.emit('chestOpened', {
      x: this.x, y: this.y, dropType, rarity: this._typeKey
    });

    // Destroy after animation
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 600,
      delay: 400,
      onComplete: () => this.destroy()
    });
  }

  _spawnOpeningGlow() {
    if (this._type.glowIntensity <= 0) return;

    const g = this.scene.add.graphics();
    g.setDepth(6);
    const color = this._type.glowColor;
    const maxRadius = 40 + this._type.glowIntensity * 30;

    // Expanding ring
    const ring = this.scene.add.graphics();
    ring.setDepth(6);

    let frame = 0;
    const timer = this.scene.time.addEvent({
      delay: 16,
      repeat: 30,
      callback: () => {
        frame++;
        const progress = frame / 31;
        const radius = maxRadius * progress;
        const alpha = 0.5 * (1 - progress);

        g.clear();
        g.fillStyle(color, alpha * 0.3);
        g.fillCircle(this.x, this.y, radius);

        ring.clear();
        ring.lineStyle(3, color, alpha);
        ring.strokeCircle(this.x, this.y, radius);
      }
    });

    this.scene.time.delayedCall(600, () => {
      g.destroy();
      ring.destroy();
    });
  }

  _handleWeaponUpgrade(player) {
    const scene = this.scene;
    if (!scene._weapons || scene._weapons.length === 0) {
      const bonus = this._typeKey === 'legendary' ? 40 : 20;
      return `+${bonus} HP (no weapon)`;
    }

    // Pick random weapon to upgrade
    const w = scene._weapons[Math.floor(Math.random() * scene._weapons.length)];
    const oldLevel = w.level;
    const levelBonus = this._typeKey === 'legendary' ? 2 : 1;
    w.level += levelBonus;

    const baseType = WEAPON_TYPES[w.key];
    if (baseType) {
      w.type = { ...baseType };
      w.type.piercing = (baseType.piercing || 0) + Math.floor((w.level - 1) * 0.5);
      if (!baseType.aura) {
        w.type.projectileSize = (baseType.projectileSize || 6) + (w.level - 1);
      }
      w.type.damage = (baseType.damage || 5) + (w.level - 1) * 2;
    }
    const bonus = levelBonus > 1 ? `+${levelBonus} ` : '+1 ';
    return `${bonus}${baseType ? baseType.name : w.key} (Lv${oldLevel}→${w.level})!`;
  }

  _handleHeal(player) {
    const scale = this._type.healScale;
    const healAmount = Math.max(15, Math.floor(player.maxHp * scale));
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
    const magnetRange = this._typeKey === 'legendary' ? 400 : 250;
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
    const isLeg = this._typeKey === 'legendary' || this._typeKey === 'epic';
    const boostMultiplier = isLeg ? 2.0 : 1.5;
    const duration = isLeg ? 25000 : 15000;
    player.stats.damageMultiplier = (player.stats.damageMultiplier || 1) * boostMultiplier;

    // Visual indicator: colored glow
    const g = this.scene.add.graphics();
    g.setDepth(4);
    const glowColor = this._type.glowColor;
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
        g.fillStyle(glowColor, 0.15 + Math.sin(Date.now() / 150) * 0.1);
        g.fillCircle(player.x, player.y, 30);
      }
    });

    this.scene.time.delayedCall(duration, () => {
      if (player.active) {
        player.stats.damageMultiplier = (player.stats.damageMultiplier || 1) / boostMultiplier;
      }
      if (g && g.active) g.destroy();
    });
    return `+${Math.round((boostMultiplier - 1) * 100)}% Damage (${Math.round(duration / 1000)}s)!`;
  }

  _showToast(message, color) {
    const text = this.scene.add.text(this.x, this.y - 30, message, {
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      color: '#' + (color || 0xffd700).toString(16).padStart(6, '0'),
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

    this._animTimer += delta;
    const bob = Math.sin(this._animTimer / 400 + this._bobOffset) * 2;
    this._graphics.setPosition(this.x, this.y + bob);

    // Glow animation
    if (this._type.glowIntensity > 0) {
      this._glowGraphics.setPosition(this.x, this.y + bob);
      this._drawGlow(this._animTimer);
    }
  }

  destroy() {
    if (this._graphics) this._graphics.destroy();
    if (this._glowGraphics) this._glowGraphics.destroy();
    super.destroy();
  }
}
