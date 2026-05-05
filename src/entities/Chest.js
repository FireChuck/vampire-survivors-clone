// Chest.js — DLC Chest/Loot System with 4 Rarity Types + 4 Content Types
// Rarity: Normal (60%), Rare (25%), Epic (12%), Legendary (3%)
// Content: gold (XP burst), weapon (new weapon), passive (passive upgrade), mystery (random + HP)
// Content types have distinct visuals and rewards; rarity controls visual flair

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

// Content type definitions — distinct chest types with unique rewards
const CHEST_CONTENT_TYPES = {
  gold: {
    name: 'Gold Chest',
    icon: '💰',
    color: { body: 0xcc9900, lid: 0xffcc00, highlight: 0xffee55, lock: 0x996600 },
    glowColor: 0xffdd00,
    glowIntensity: 0.5,
    particleColor: 0xffee00,
    particleCount: 14
  },
  weapon: {
    name: 'Weapon Chest',
    icon: '⚔️',
    color: { body: 0x882222, lid: 0xcc3333, highlight: 0xff6655, lock: 0x661111 },
    glowColor: 0xff4444,
    glowIntensity: 0.4,
    particleColor: 0xff6644,
    particleCount: 12
  },
  passive: {
    name: 'Passive Chest',
    icon: '🛡️',
    color: { body: 0x116644, lid: 0x22aa66, highlight: 0x55dd99, lock: 0x0d4433 },
    glowColor: 0x33cc77,
    glowIntensity: 0.4,
    particleColor: 0x44ee88,
    particleCount: 12
  },
  mystery: {
    name: 'Mystery Chest',
    icon: '❓',
    color: { body: 0x4444aa, lid: 0x6666dd, highlight: 0x9999ff, lock: 0x333388 },
    glowColor: 0x7777ff,
    glowIntensity: 0.6,
    particleColor: 0xaaaa44,
    particleCount: 18
  }
};

// Weighted spawn rates for rarity
const CHEST_SPAWN_WEIGHTS = [
  { type: 'normal', weight: 60 },
  { type: 'rare', weight: 25 },
  { type: 'epic', weight: 12 },
  { type: 'legendary', weight: 3 }
];

class Chest extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, options) {
    super(scene, x, y, null);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setSize(28, 24);
    this.body.setOffset(-14, -12);
    this.body.setImmovable(true);

    // Parse options: can be string (legacy rarity) or object { rarity, content }
    let rarityKey, contentKey;
    if (typeof options === 'string') {
      rarityKey = options;
      contentKey = null;
    } else if (options && typeof options === 'object') {
      rarityKey = options.rarity || null;
      contentKey = options.content || null;
    } else {
      rarityKey = null;
      contentKey = null;
    }

    // Determine rarity (weighted random if not specified)
    if (rarityKey && CHEST_TYPES[rarityKey]) {
      this._typeKey = rarityKey;
    } else {
      this._typeKey = Chest._rollRarity();
    }
    this._type = CHEST_TYPES[this._typeKey];

    // Determine content type
    this._contentKey = contentKey || null;
    this._contentType = contentKey ? CHEST_CONTENT_TYPES[contentKey] : null;

    // Use content type colors if set, otherwise rarity colors
    this._displayColor = this._contentType ? this._contentType.color : this._type.color;
    this._displayGlowColor = this._contentType ? this._contentType.glowColor : this._type.glowColor;
    this._displayGlowIntensity = this._contentType
      ? this._contentType.glowIntensity
      : this._type.glowIntensity;
    this._displayParticleColor = this._contentType
      ? this._contentType.particleColor
      : this._type.particleColor;
    this._displayParticleCount = this._contentType
      ? this._contentType.particleCount
      : this._type.particleCount;

    this._graphics = scene.add.graphics();
    this._graphics.setDepth(5);
    this._opened = false;
    this._animTimer = 0;
    this._bobOffset = Math.random() * Math.PI * 2;

    // Glow effect for rare+ or content-type chests
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

  /** Build display label for content-type chests */
  _getLabel() {
    if (this._contentType) {
      return this._contentType.icon + ' ' + this._contentType.name;
    }
    return this._type.label;
  }

  _drawClosed() {
    const g = this._graphics;
    const c = this._displayColor;
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

    // Content-type icon label above chest
    if (this._contentType) {
      // Draw a small icon indicator circle
      g.fillStyle(this._displayGlowColor, 0.6);
      g.fillCircle(0, -20, 8);
      g.lineStyle(1, c.highlight, 0.8);
      g.strokeCircle(0, -20, 8);
    }
  }

  _drawGlow(time) {
    const glow = this._glowGraphics;
    const intensity = this._displayGlowIntensity;

    if (intensity <= 0 || this._opened) {
      glow.clear();
      return;
    }

    glow.clear();
    const pulse = 0.5 + 0.5 * Math.sin(time / 300 + this._bobOffset);
    const alpha = intensity * (0.4 + 0.3 * pulse);
    const radius = 24 + pulse * 6;

    glow.fillStyle(this._displayGlowColor, alpha);
    glow.fillCircle(0, 0, radius);

    // Outer ring
    glow.lineStyle(2, this._displayGlowColor, alpha * 0.6);
    glow.strokeCircle(0, 0, radius + 4);
  }

  _drawOpening() {
    const g = this._graphics;
    const c = this._displayColor;
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

    let message;
    let dropType;

    // Content-type chests have deterministic rewards
    if (this._contentKey) {
      switch (this._contentKey) {
        case 'gold':
          dropType = 'goldXp';
          message = this._handleGoldXP(player);
          break;
        case 'weapon':
          dropType = 'newWeapon';
          message = this._handleNewWeapon(player);
          break;
        case 'passive':
          dropType = 'passiveUpgrade';
          message = this._handlePassiveUpgrade(player);
          break;
        case 'mystery':
          dropType = 'mystery';
          message = this._handleMystery(player);
          break;
        default:
          dropType = 'heal';
          message = this._handleHeal(player);
      }
    } else {
      // Legacy rarity-based drop table
      message = this._openLegacyRarity(player);
      dropType = 'legacy';
    }

    // Particles
    if (this.scene.particleSystem) {
      this.scene.particleSystem.emitDeath(this.x, this.y, this._displayParticleColor, this._displayParticleCount);
    }

    // Opening glow burst
    this._spawnOpeningGlow();

    // Toast text
    const prefix = this._getLabel() ? `[${this._getLabel()}] ` : '';
    this._showToast(`${prefix}${message}`, this._displayGlowColor);

    // Emit event for audio
    this.scene.events.emit('chestOpened', {
      x: this.x, y: this.y, dropType, rarity: this._typeKey, content: this._contentKey
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

  // ── Content Type Handlers ──

  /** Gold Chest: Spawn large XP orbs around chest */
  _handleGoldXP(player) {
    const scene = this.scene;
    const orbCount = 8 + Math.floor(Math.random() * 6);
    let totalXP = 0;

    for (let i = 0; i < orbCount; i++) {
      const angle = (Math.PI * 2 / orbCount) * i + (Math.random() - 0.5) * 0.5;
      const dist = 15 + Math.random() * 35;
      const ox = this.x + Math.cos(angle) * dist;
      const oy = this.y + Math.sin(angle) * dist;
      // Large XP values: 15-40 per orb
      const value = 15 + Math.floor(Math.random() * 25);
      totalXP += value;

      if (scene.xpOrbGroup && typeof XPOrb !== 'undefined') {
        const orb = new XPOrb(scene, ox, oy, value);
        scene.xpOrbGroup.add(orb);
        scene.xpOrbs.push(orb);
      }
    }

    return `XP Burst! +${totalXP} XP (${orbCount} orbs)`;
  }

  /** Weapon Chest: Grant a random new weapon if slot available */
  _handleNewWeapon(player) {
    const scene = this.scene;
    const wm = scene.weaponManager;
    if (!wm) return 'No weapon system!';

    const allKeys = Object.keys(WEAPON_TYPES);
    const ownedKeys = wm.weapons.map(function(w) { return w.key; });
    const available = allKeys.filter(function(k) { return !ownedKeys.includes(k); });

    if (available.length === 0) {
      // Fallback: upgrade existing weapon
      return this._handleWeaponUpgrade(player);
    }

    const pick = available[Math.floor(Math.random() * available.length)];
    wm.addWeapon(pick);

    // HUD notification
    if (scene.hud && scene.hud.showWeaponSwap) {
      const name = pick.charAt(0).toUpperCase() + pick.slice(1).replace(/_/g, ' ');
      scene.hud.showWeaponSwap(name);
    }

    const baseType = WEAPON_TYPES[pick];
    return `New Weapon: ${baseType ? baseType.name : pick}!`;
  }

  /** Passive Chest: Apply a random passive upgrade from UPGRADE_TYPES */
  _handlePassiveUpgrade(player) {
    const scene = this.scene;

    // Filter to passive-only upgrades (exclude weapon-specific ones)
    const passivePool = (typeof UPGRADE_TYPES !== 'undefined')
      ? UPGRADE_TYPES.filter(function(u) {
          return u.id !== 'newWeapon' && u.id !== 'weaponUpgrade';
        })
      : [];

    if (passivePool.length === 0) {
      return this._handleHeal(player);
    }

    const pick = passivePool[Math.floor(Math.random() * passivePool.length)];
    if (typeof pick.apply === 'function') {
      pick.apply(player);
    }

    if (scene.hud) {
      scene.hud.updateHP(player.hp, player.maxHp);
    }

    return `${pick.icon} ${pick.name}`;
  }

  /** Mystery Chest: Random reward from all types + bonus HP */
  _handleMystery(player) {
    const subTypes = ['gold', 'weapon', 'passive'];
    const roll = subTypes[Math.floor(Math.random() * subTypes.length)];
    let subMessage;

    switch (roll) {
      case 'gold':
        subMessage = this._handleGoldXP(player);
        break;
      case 'weapon':
        subMessage = this._handleNewWeapon(player);
        break;
      case 'passive':
        subMessage = this._handlePassiveUpgrade(player);
        break;
      default:
        subMessage = this._handleHeal(player);
    }

    // Bonus HP on top
    const bonusHP = 20 + Math.floor(Math.random() * 30);
    player.hp = Math.min(player.hp + bonusHP, player.maxHp);
    if (this.scene.hud) {
      this.scene.hud.updateHP(player.hp, player.maxHp);
    }
    if (this.scene.damageNumbers) {
      this.scene.damageNumbers.show(player.x, player.y - 20, bonusHP, 'heal');
    }

    return `Mystery: ${subMessage} +${bonusHP} HP!`;
  }

  // ── Legacy Rarity Handlers (unchanged) ──

  _openLegacyRarity(player) {
    const rates = this._type.dropRates;
    const roll = Math.random();
    const gameTimeSec = this.scene.gameTime / 1000;

    const healBoost = gameTimeSec < 120 ? 0.15 : 0;
    const weaponBoost = gameTimeSec > 300 ? 0.10 : 0;

    const effectiveRates = {
      weaponUpgrade: rates.weaponUpgrade + weaponBoost,
      heal: rates.heal + healBoost,
      magnetPulse: rates.magnetPulse,
      damageBoost: rates.damageBoost
    };

    if (roll < effectiveRates.weaponUpgrade) {
      return this._handleWeaponUpgrade(player);
    } else if (roll < effectiveRates.weaponUpgrade + effectiveRates.heal) {
      return this._handleHeal(player);
    } else if (roll < effectiveRates.weaponUpgrade + effectiveRates.heal + effectiveRates.magnetPulse) {
      return this._handleMagnetPulse(player);
    } else {
      return this._handleDamageBoost(player);
    }
  }

  _spawnOpeningGlow() {
    if (this._displayGlowIntensity <= 0) return;

    const g = this.scene.add.graphics();
    g.setDepth(6);
    const color = this._displayGlowColor;
    const maxRadius = 40 + this._displayGlowIntensity * 30;

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

    const g = this.scene.add.graphics();
    g.setDepth(4);
    const glowColor = this._displayGlowColor;
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

    if (this._displayGlowIntensity > 0) {
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
