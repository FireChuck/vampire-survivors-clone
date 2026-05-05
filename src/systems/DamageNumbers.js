// DamageNumbers.js — Floating damage/heal/XP numbers with type-based color coding
// Color-coded by damage type, crit highlighting, smooth fade-out

class DamageNumbers {
  constructor(scene) {
    this.scene = scene;
    this._pool = [];
    this._maxPool = 50;

    // Damage type color mapping
    this.typeColors = {
      fire:     { color: '#ff6622', glow: '#ff9944' },
      ice:      { color: '#44aaff', glow: '#88ccff' },
      lightning:{ color: '#ffee44', glow: '#ffffaa' },
      holy:     { color: '#ffffcc', glow: '#ffffff' },
      poison:   { color: '#44dd44', glow: '#88ff88' },
      physical: { color: '#ff4444', glow: '#ff8888' },
      arcane:   { color: '#cc44ff', glow: '#dd88ff' },
      default:  { color: '#ff4444', glow: '#ff8888' }
    };

    // Crit threshold: damage above this value is a crit (relative to enemy maxHP usually)
    this.critThreshold = 50;
    this.critMultiplier = 2.0;
  }

  /**
   * Spawn a floating number.
   * @param {number} x - world x
   * @param {number} y - world y
   * @param {number} value - number to display
   * @param {string} type - 'damage' | 'heal' | 'xp' | 'crit'
   * @param {string} [damageType] - 'fire' | 'ice' | 'lightning' | 'holy' | 'poison' | 'physical' | 'arcane'
   * @param {boolean} [isCrit] - force critical hit display
   */
  show(x, y, value, type, damageType, isCrit) {
    const text = this._getOrCreate(x, y, value, type, damageType, isCrit);
    if (!text) return;

    const startY = y;
    const floatDist = (type === 'crit' || isCrit) ? 60 : type === 'xp' ? 30 : 45;
    const duration = (type === 'crit' || isCrit) ? 1200 : 800;

    // Crit: start BIG and scale down with bounce
    if (type === 'crit' || isCrit) {
      text.setScale(2.0, 2.0);
    }

    // Horizontal scatter for multiple hits
    const scatterX = x + (Math.random() - 0.5) * 24;
    text.setPosition(scatterX, y);

    this.scene.tweens.add({
      targets: text,
      y: startY - floatDist,
      alpha: 0,
      scaleX: (type === 'crit' || isCrit) ? 1.0 : 1,
      scaleY: (type === 'crit' || isCrit) ? 1.0 : 1,
      duration: duration,
      ease: (type === 'crit' || isCrit) ? 'Back.easeOut' : 'Power2',
      onComplete: () => {
        text.setActive(false).setVisible(false);
        this._pool.push(text);
      }
    });
  }

  /**
   * Convenience: show damage with element type.
   * Auto-detects crits based on value threshold.
   */
  showDamage(x, y, value, damageType) {
    const isCrit = value >= this.critThreshold;
    this.show(x, y, value, isCrit ? 'crit' : 'damage', damageType, isCrit);
  }

  _getOrCreate(x, y, value, type, damageType, isCrit) {
    // Reuse from pool
    for (const t of this._pool) {
      if (!t.active) {
        t.setActive(true).setVisible(true).setAlpha(1).setScale(1);
        t.setPosition(x, y);
        this._styleText(t, value, type, damageType, isCrit);
        return t;
      }
    }

    // Create new if pool not full
    if (this._pool.length >= this._maxPool) return null;

    const t = this.scene.add.text(x, y, '', {
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
      shadow: { offsetX: 0, offsetY: 1, color: '#000', blur: 2, fill: true }
    }).setOrigin(0.5).setDepth(35);

    this._pool.push(t);
    this._styleText(t, value, type, damageType, isCrit);
    return t;
  }

  _styleText(text, value, type, damageType, isCrit) {
    const displayVal = Math.floor(value);
    const typeColor = this.typeColors[damageType] || this.typeColors.default;

    switch (type) {
      case 'damage':
        // Size scales with damage amount
        const dmgSize = displayVal >= 30 ? '18px' : displayVal >= 15 ? '16px' : '14px';
        text.setStyle({ color: typeColor.color, fontSize: dmgSize });
        text.setText(`${displayVal}`);
        // Subtle glow for typed damage
        if (damageType && damageType !== 'physical') {
          text.setShadow(0, 0, typeColor.glow, 4, true, true);
        }
        break;

      case 'crit':
        text.setStyle({ color: '#ffcc00', fontSize: '24px' });
        text.setText(`${displayVal} CRIT!`);
        text.setShadow(0, 0, '#ff8800', 6, true, true);
        break;

      case 'heal':
        text.setStyle({ color: '#44ff44', fontSize: '16px' });
        text.setText(`+${displayVal}`);
        text.setShadow(0, 0, '#22aa22', 3, true, true);
        break;

      case 'xp':
        text.setStyle({ color: '#ffd700', fontSize: '12px' });
        text.setText(`+${displayVal} XP`);
        break;

      default:
        text.setStyle({ color: '#ffffff', fontSize: '14px' });
        text.setText(`${displayVal}`);
    }
  }

  /**
   * Set the crit threshold dynamically (e.g., based on enemy maxHP).
   */
  setCritThreshold(threshold) {
    this.critThreshold = threshold;
  }

  destroy() {
    for (const t of this._pool) {
      if (t && t.active) t.destroy();
    }
    this._pool = [];
  }
}
