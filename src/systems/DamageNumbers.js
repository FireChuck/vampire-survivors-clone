// DamageNumbers.js — Floating damage/heal/XP numbers
// Red = damage, Green = heal, Gold = XP, Big + "CRIT!" for crits

class DamageNumbers {
  constructor(scene) {
    this.scene = scene;
    this._pool = [];
    this._maxPool = 40;
  }

  /**
   * Spawn a floating number.
   * @param {number} x - world x
   * @param {number} y - world y
   * @param {number} value - number to display
   * @param {string} type - 'damage' | 'heal' | 'xp' | 'crit'
   */
  show(x, y, value, type) {
    const text = this._getOrCreate(x, y, value, type);
    if (!text) return;

    const startY = y;
    const floatDist = type === 'crit' ? 60 : type === 'xp' ? 30 : 45;
    const duration = type === 'crit' ? 1200 : 800;

    // Crit: start BIG (2x) and scale down with bounce
    if (type === 'crit') {
      text.setScale(2.0, 2.0);
    }

    this.scene.tweens.add({
      targets: text,
      y: startY - floatDist,
      alpha: 0,
      scaleX: type === 'crit' ? 1.0 : 1,
      scaleY: type === 'crit' ? 1.0 : 1,
      duration: duration,
      ease: type === 'crit' ? 'Back.easeOut' : 'Power2',
      onComplete: () => {
        text.setActive(false).setVisible(false);
        this._pool.push(text);
      }
    });
  }

  _getOrCreate(x, y, value, type) {
    // Reuse from pool
    for (const t of this._pool) {
      if (!t.active) {
        t.setActive(true).setVisible(true).setAlpha(1).setScale(1);
        t.setPosition(x + (Math.random() - 0.5) * 20, y);
        this._styleText(t, value, type);
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
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(35);

    this._pool.push(t);
    this._styleText(t, value, type);
    return t;
  }

  _styleText(text, value, type) {
    const displayVal = Math.floor(value);
    switch (type) {
      case 'damage':
        text.setStyle({ color: '#ff4444', fontSize: displayVal >= 30 ? '18px' : '14px' });
        text.setText(`${displayVal}`);
        break;
      case 'crit':
        text.setStyle({ color: '#ffcc00', fontSize: '22px' });
        text.setText(`${displayVal} CRIT!`);
        break;
      case 'heal':
        text.setStyle({ color: '#44ff44', fontSize: '16px' });
        text.setText(`+${displayVal}`);
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

  destroy() {
    for (const t of this._pool) {
      if (t && t.active) t.destroy();
    }
    this._pool = [];
  }
}
