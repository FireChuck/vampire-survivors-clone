// UpgradeSystem.js — Level-up pause, 3 random upgrades, XP curve

class UpgradeSystem {
  constructor(scene, player, hud) {
    this.scene = scene;
    this.player = player;
    this.hud = hud;
    this.paused = false;
    this._uiContainer = null;

    this.xpToNext = this._calcXpRequired(1);
  }

  _calcXpRequired(level) {
    const xc = GAME_CONFIG.xpCurve;
    return Math.min(xc.capXP, Math.floor(xc.baseXP * Math.pow(xc.levelMultiplier, level)));
  }

  addXP(amount) {
    if (this.paused) return;

    while (this.player.xp >= this.xpToNext) {
      this.player.xp -= this.xpToNext;
      this.player.level++;
      this.xpToNext = this._calcXpRequired(this.player.level);
      this.player.heal(Math.floor(this.player.maxHp * 0.2));
      this._showUpgradeSelection();
    }

    if (this.hud) {
      this.hud.updateXP(this.player.xp, this.xpToNext, this.player.level);
    }
  }

  _showUpgradeSelection() {
    this.paused = true;

    // Use a Container to hold all UI elements — easy cleanup
    this._uiContainer = this.scene.add.container(0, 0).setDepth(200).setScrollFactor(0);

    // Gold flash effect
    this._playLevelUpFlash();

    // Dark overlay
    const overlay = this.scene.add.rectangle(
      this.scene.scale.width / 2, this.scene.scale.height / 2,
      this.scene.scale.width, this.scene.scale.height,
      0x000000, 0.7
    );
    this._uiContainer.add(overlay);

    // Title with golden glow
    const title = this.scene.add.text(this.scene.scale.width / 2, 40, '⭐ LEVEL UP! ⭐', {
      fontSize: '32px', fontFamily: 'Arial, sans-serif',
      color: '#ffd700', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5);
    this._uiContainer.add(title);

    // Title pulse animation
    this.scene.tweens.add({
      targets: title,
      scaleX: 1.1, scaleY: 1.1,
      duration: 400,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut'
    });

    this._uiContainer.add(this.scene.add.text(this.scene.scale.width / 2, 75, 'Choose an upgrade:', {
      fontSize: '16px', fontFamily: 'Arial, sans-serif', color: '#ccc'
    }).setOrigin(0.5));

    // Build upgrade pool: stats + abilities
    let pool;
    if (typeof UPGRADE_TYPES !== 'undefined') {
      pool = [...UPGRADE_TYPES];
    } else {
      pool = this._defaultUpgrades();
    }

    // Add unowned abilities to the pool
    if (this.scene.abilitySystem) {
      const unowned = this.scene.abilitySystem.getUnownedAbilities();
      for (const ability of unowned) {
        pool.push({
          id: 'ability_' + ability.id,
          name: ability.name,
          description: ability.description,
          icon: ability.icon,
          category: 'ability',
          apply: (player) => {
            this.scene.abilitySystem.equipAbility(ability.id);
          }
        });
      }
    }

    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);

    const cardWidth = 200;
    const cardHeight = 140;
    const gap = 30;
    const totalWidth = shuffled.length * cardWidth + (shuffled.length - 1) * gap;
    const startX = (this.scene.scale.width - totalWidth) / 2;

    shuffled.forEach((upgrade, i) => {
      const cx = startX + i * (cardWidth + gap) + cardWidth / 2;
      const cy = this.scene.scale.height / 2;

      // Rarity system
      const roll = Math.random();
      let rarity, rarityColor, rarityGlow;
      if (roll < 0.05) {
        rarity = 'legendary'; rarityColor = '#cc44ff'; rarityGlow = 0xcc44ff;
      } else if (roll < 0.2) {
        rarity = 'rare'; rarityColor = '#4488ff'; rarityGlow = 0x4488ff;
      } else if (roll < 0.5) {
        rarity = 'uncommon'; rarityColor = '#44cc44'; rarityGlow = 0x44cc44;
      } else {
        rarity = 'common'; rarityColor = '#cccccc'; rarityGlow = 0x888888;
      }

      const card = this.scene.add.rectangle(cx, cy, cardWidth, cardHeight, 0x2a2a4a)
        .setStrokeStyle(2, rarityGlow)
        .setInteractive({ useHandCursor: true });

      // Rarity label
      const rarityLabel = this.scene.add.text(cx, cy - 62, rarity.toUpperCase(), {
        fontSize: '9px', fontFamily: 'Arial, sans-serif',
        color: rarityColor, fontStyle: 'bold'
      }).setOrigin(0.5).setAlpha(0.8);

      // Icon emoji
      const iconText = this.scene.add.text(cx, cy - 45, upgrade.icon || '📦', {
        fontSize: '28px'
      }).setOrigin(0.5);

      const name = this.scene.add.text(cx, cy - 18, upgrade.name, {
        fontSize: '15px', fontFamily: 'Arial, sans-serif',
        color: rarityColor, fontStyle: 'bold'
      }).setOrigin(0.5);

      const desc = this.scene.add.text(cx, cy + 10, upgrade.description || '', {
        fontSize: '11px', fontFamily: 'Arial, sans-serif',
        color: '#aaa', wordWrap: { width: cardWidth - 20 }
      }).setOrigin(0.5);

      // ── Smooth card appearance animation ──
      card.setAlpha(0);
      card.setScale(0.5);
      iconText.setAlpha(0);
      rarityLabel.setAlpha(0);
      name.setAlpha(0);
      desc.setAlpha(0);

      this.scene.tweens.add({
        targets: [card, iconText, rarityLabel, name, desc],
        alpha: 1,
        duration: 350,
        delay: 150 + i * 100,
        ease: 'Back.easeOut'
      });
      this.scene.tweens.add({
        targets: card,
        scaleX: 1, scaleY: 1,
        duration: 400,
        delay: 150 + i * 100,
        ease: 'Back.easeOut'
      });

      // ── Hover: scale up + glow border + tooltip ──
      card.on('pointerover', () => {
        card.setStrokeStyle(3, 0xffd700);
        this.scene.tweens.add({
          targets: card,
          scaleX: 1.08, scaleY: 1.08,
          duration: 150,
          ease: 'Back.easeOut'
        });
        // QoL: Stat tooltip on hover
        this._showUpgradeTooltip(upgrade, cx, cy + cardHeight / 2 + 15);
      });
      card.on('pointerout', () => {
        card.setStrokeStyle(2, rarityGlow);
        this.scene.tweens.add({
          targets: card,
          scaleX: 1, scaleY: 1,
          duration: 150
        });
        this._hideUpgradeTooltip();
      });
      card.on('pointerdown', () => {
        // Selection feedback: card glows and scales up, then fade
        card.setStrokeStyle(3, 0xffd700);
        this.scene.tweens.add({
          targets: card,
          scaleX: 1.15, scaleY: 1.15,
          alpha: 0.5,
          duration: 300,
          ease: 'Sine.easeIn',
          onComplete: () => {
            this._applyUpgrade(upgrade);
            this._closeUpgradeSelection();
          }
        });
      });

      this._uiContainer.add(card);
      this._uiContainer.add(rarityLabel);
      this._uiContainer.add(iconText);
      this._uiContainer.add(name);
      this._uiContainer.add(desc);
    });

    // ── Timer bar (auto-select after 15 seconds) ──
    this._upgradeTimer = 15000;
    const timerBarWidth = totalWidth;
    const timerBarX = startX;
    const timerBarY = this.scene.scale.height / 2 + cardHeight / 2 + 15;
    const timerBg = this.scene.add.rectangle(timerBarX + timerBarWidth / 2, timerBarY, timerBarWidth, 6, 0x333333, 0.8).setOrigin(0.5);
    const timerFill = this.scene.add.rectangle(timerBarX, timerBarY, timerBarWidth, 6, 0xffd700, 0.9).setOrigin(0, 0.5);
    const timerText = this.scene.add.text(timerBarX + timerBarWidth / 2, timerBarY + 14, '15', {
      fontSize: '12px', fontFamily: 'Arial, sans-serif', color: '#888'
    }).setOrigin(0.5);
    this._uiContainer.add(timerBg);
    this._uiContainer.add(timerFill);
    this._uiContainer.add(timerText);

    this._timerEvent = this.scene.time.addEvent({
      delay: 100,
      repeat: 150,
      callback: () => {
        this._upgradeTimer -= 100;
        const ratio = Math.max(0, this._upgradeTimer / 15000);
        timerFill.width = timerBarWidth * ratio;
        timerText.setText(Math.ceil(this._upgradeTimer / 1000).toString());
        if (ratio < 0.3) {
          timerFill.setFillStyle(0xff4444);
        } else if (ratio < 0.6) {
          timerFill.setFillStyle(0xffaa00);
        }
        if (this._upgradeTimer <= 0) {
          // Auto-select first card
          this._closeUpgradeSelection();
        }
      }
    });
  }

  _playLevelUpFlash() {
    // Gold screen flash + particle burst
    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;

    // Gold flash overlay
    const flash = this.scene.add.rectangle(sw / 2, sh / 2, sw, sh, 0xffd700, 0)
      .setDepth(199).setScrollFactor(0);

    this.scene.tweens.add({
      targets: flash,
      alpha: 0.3,
      duration: 200,
      yoyo: true,
      onComplete: () => flash.destroy()
    });

    // Particle burst from center
    const particleCount = 16;
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 / particleCount) * i;
      const p = this.scene.add.circle(sw / 2, sh / 2, 3 + Math.random() * 3, 0xffd700, 0.9)
        .setDepth(201).setScrollFactor(0);

      const dist = 80 + Math.random() * 120;
      this.scene.tweens.add({
        targets: p,
        x: sw / 2 + Math.cos(angle) * dist,
        y: sh / 2 + Math.sin(angle) * dist,
        alpha: 0,
        scaleX: 0.2, scaleY: 0.2,
        duration: 500 + Math.random() * 300,
        ease: 'Power2',
        onComplete: () => p.destroy()
      });
    }
  }

  _applyUpgrade(upgrade) {
    if (typeof upgrade.apply === 'function') {
      upgrade.apply(this.player);
    } else if (upgrade.stat) {
      const s = this.player.stats;
      switch (upgrade.stat) {
        case 'maxHp':
          s.maxHp += upgrade.value;
          this.player.maxHp = s.maxHp;
          this.player.hp = Math.min(this.player.hp + upgrade.value, this.player.maxHp);
          break;
        case 'speed':
          s.speed += upgrade.value;
          this.player.speed = s.speed;
          break;
        case 'damageMultiplier':
          s.damageMultiplier += upgrade.value;
          break;
        case 'armor':
          s.armor += upgrade.value;
          break;
        case 'hpRegen':
          s.hpRegen += upgrade.value;
          break;
        case 'xpMultiplier':
          s.xpMultiplier += upgrade.value;
          break;
        case 'cooldownReduction':
          s.cooldownReduction = Math.min(0.7, s.cooldownReduction + upgrade.value);
          break;
        case 'pickupRange':
          this.player.pickupRange += upgrade.value;
          break;
      }
    }

    if (this.hud) {
      this.hud.updateHP(this.player.hp, this.player.maxHp);
    }
  }

  _closeUpgradeSelection() {
    if (this._timerEvent) {
      this._timerEvent.destroy();
      this._timerEvent = null;
    }
    this._hideUpgradeTooltip();
    if (this._uiContainer) {
      this._uiContainer.destroy();
      this._uiContainer = null;
    }
    this.paused = false;
  }

  // ── QoL: Stat Tooltip on Hover ──

  _showUpgradeTooltip(upgrade, x, y) {
    this._hideUpgradeTooltip();

    const scene = this.scene;
    const player = scene.player;

    // Build tooltip content based on stat type
    let details = '';
    if (upgrade.stat) {
      switch (upgrade.stat) {
        case 'maxHp':
          details = `Current: ${Math.floor(player.maxHp)} → ${Math.floor(player.maxHp + (upgrade.value || 20))}`;
          break;
        case 'speed':
          details = `Current: ${Math.floor(player.stats.speed)} → ${Math.floor(player.stats.speed * (upgrade.value || 1) + (upgrade.value > 1 ? upgrade.value : 15))}`;
          break;
        case 'damageMultiplier':
          details = `Current: x${player.stats.damageMultiplier.toFixed(1)} → x${(player.stats.damageMultiplier + (upgrade.value || 0.2)).toFixed(1)}`;
          break;
        case 'armor':
          details = `Current: ${Math.round(player.stats.armor * 100)}% reduction → ${Math.round((player.stats.armor + (upgrade.value || 0.15)) * 100)}%`;
          break;
        case 'hpRegen':
          details = `Current: ${player.stats.hpRegen.toFixed(1)}/s → ${(player.stats.hpRegen + (upgrade.value || 0.5)).toFixed(1)}/s`;
          break;
        case 'xpMultiplier':
          details = `Current: x${player.stats.xpMultiplier.toFixed(1)} → x${(player.stats.xpMultiplier * (upgrade.value > 1 ? upgrade.value : 1.2)).toFixed(1)}`;
          break;
        case 'cooldownReduction':
          details = `Current: ${Math.round(player.stats.cooldownReduction * 100)}% → ${Math.round((player.stats.cooldownReduction + (upgrade.value || 0.1)) * 100)}%`;
          break;
        case 'pickupRange':
          details = `Current: ${Math.floor(player.pickupRange)}px → ${Math.floor(player.pickupRange * (upgrade.value > 1 ? upgrade.value : 1.25))}px`;
          break;
        default:
          details = upgrade.description || '';
      }
    } else if (upgrade.category === 'ability') {
      details = 'New ability unlock!';
    } else {
      details = upgrade.description || '';
    }

    if (!details) return;

    // Background
    const tw = 200;
    const th = 28;
    const tx = Math.max(tw / 2 + 5, Math.min(scene.scale.width - tw / 2 - 5, x));
    const ty = Math.min(scene.scale.height - th - 10, y);

    this._tooltipBg = scene.add.rectangle(tx, ty, tw, th, 0x1a1a3a, 0.95)
      .setStrokeStyle(1, 0x4488ff, 0.8)
      .setOrigin(0.5).setScrollFactor(0).setDepth(250);

    this._tooltipText = scene.add.text(tx, ty, details, {
      fontSize: '10px', fontFamily: 'Arial, sans-serif', color: '#88ccff',
      wordWrap: { width: tw - 10 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(251);
  }

  _hideUpgradeTooltip() {
    if (this._tooltipBg) { this._tooltipBg.destroy(); this._tooltipBg = null; }
    if (this._tooltipText) { this._tooltipText.destroy(); this._tooltipText = null; }
  }

  _defaultUpgrades() {
    return [
      { name: 'Max HP +20', description: 'Increases maximum health by 20', stat: 'maxHp', value: 20 },
      { name: 'Speed +20', description: 'Move faster', stat: 'speed', value: 20 },
      { name: 'Damage +20%', description: 'Deal more damage', stat: 'damageMultiplier', value: 0.2 },
      { name: 'Armor +2', description: 'Take less damage', stat: 'armor', value: 2 },
      { name: 'HP Regen', description: 'Regenerate health over time', stat: 'hpRegen', value: 0.5 },
      { name: 'XP Boost', description: 'Gain more experience', stat: 'xpMultiplier', value: 0.15 },
      { name: 'Pickup Range', description: 'Collect items from further away', stat: 'pickupRange', value: 15 },
      { name: 'Attack Speed', description: 'Reduce weapon cooldowns', stat: 'cooldownReduction', value: 0.1 }
    ];
  }

  destroy() {
    this._closeUpgradeSelection();
  }
}
