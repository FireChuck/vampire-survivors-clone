// TankEnemy.js — Vampire Survivors Clone
// Tank enemy: slow, high HP, damage-reduction aura for nearby allies, larger/different color, rare spawn

class TankEnemy extends Enemy {
  constructor(scene, x, y) {
    // Base: use golem stats as template
    super(scene, x, y, 'golem');

    this.enemyTypeKey = 'tank';
    this.enemyTypeName = 'Tank';

    // Override stats: 3-5x HP, slower, same damage
    this.hp = Math.floor(this.hp * 4);
    this.maxHp = this.hp;
    this.speed = Math.floor(this.speed * 0.5); // half golem speed = 15
    this.xpValue = this.xpValue * 3;
    this.damage = Math.floor(this.damage * 1.5);

    // Larger size
    this.size = [38, 38];
    this.body.setSize(38, 38);
    this.body.setOffset(-19, -19);

    // Aura system
    this._auraRange = 100;
    this._auraReduction = 0.3; // 30% damage reduction for allies in range
    this._auraGraphics = scene.add.graphics();
    this._auraGraphics.setDepth(3);
    this._auraPulseTimer = 0;

    // Override color
    this.color = 0x2266aa;

    // Redraw visual
    this._graphics.clear();
    this._drawVisual();
  }

  _drawVisual() {
    this._graphics.clear();
    const hw = this.size[0] / 2;
    const hh = this.size[1] / 2;

    // Aura ring (pulsing)
    this._auraGraphics.clear();
    this._auraGraphics.lineStyle(2, 0x4488ff, 0.3);
    this._auraGraphics.strokeCircle(0, 0, this._auraRange);
    this._auraGraphics.fillStyle(0x4488ff, 0.05);
    this._auraGraphics.fillCircle(0, 0, this._auraRange);

    // Main body: armored rectangle with shield plates
    this._graphics.fillStyle(this.color, 1);
    this._graphics.fillRoundedRect(-hw, -hh, this.size[0], this.size[1], 6);

    // Shield plates (darker blue armor)
    this._graphics.fillStyle(0x1a4488, 0.8);
    this._graphics.fillRoundedRect(-hw + 3, -hh + 3, this.size[0] - 6, this.size[1] / 2 - 2, 4);

    // Shoulder pads
    this._graphics.fillStyle(0x1155aa, 1);
    this._graphics.fillRect(-hw - 4, -hh + 2, 8, 14);
    this._graphics.fillRect(hw - 4, -hh + 2, 8, 14);

    // Eyes
    this._graphics.fillStyle(0x00ccff, 1);
    this._graphics.fillCircle(-6, -4, 3);
    this._graphics.fillCircle(6, -4, 3);
    // Pupils
    this._graphics.fillStyle(0x001133, 1);
    this._graphics.fillCircle(-6, -4, 1.5);
    this._graphics.fillCircle(6, -4, 1.5);

    // Shield icon on chest
    this._graphics.lineStyle(1, 0x88bbff, 0.6);
    this._graphics.strokeTriangle(0, -hh * 0.3, -6, hh * 0.1, 6, hh * 0.1);

    // HP bar
    if (this.hp < this.maxHp) {
      this._drawHPBar();
    }

    this._graphics.setDepth(5);
  }

  update(time, delta, player, speedMultiplier) {
    if (!player || !player.active) return;

    const spdMult = speedMultiplier || 1;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const dirX = dx / dist;
    const dirY = dy / dist;

    // Tank AI: slow, steady march toward player
    // Speeds up slightly when very close
    let speed = this.speed;
    if (dist < 80) speed = this.speed * 1.3;

    this.setVelocity(dirX * speed * spdMult, dirY * speed * spdMult);

    // Update aura visuals
    this._auraPulseTimer += delta;
    this._auraGraphics.setPosition(this.x, this.y);
    const pulseAlpha = 0.2 + Math.sin(this._auraPulseTimer / 500) * 0.1;
    this._auraGraphics.clear();
    this._auraGraphics.lineStyle(2, 0x4488ff, pulseAlpha);
    this._auraGraphics.strokeCircle(0, 0, this._auraRange);
    this._auraGraphics.fillStyle(0x4488ff, pulseAlpha * 0.15);
    this._auraGraphics.fillCircle(0, 0, this._auraRange);

    // Update graphics position
    this._graphics.setPosition(this.x, this.y);
  }

  // Public API: check if an enemy is within the tank's aura
  isInAura(enemyX, enemyY) {
    const dx = enemyX - this.x;
    const dy = enemyY - this.y;
    return (dx * dx + dy * dy) <= this._auraRange * this._auraRange;
  }

  getAuraReduction() {
    return this._auraReduction;
  }

  onDeath() {
    // Cleanup aura
    if (this._auraGraphics) this._auraGraphics.destroy();

    // Drop extra XP
    this.scene.events.emit('enemyKilled', {
      x: this.x,
      y: this.y,
      xpValue: this.xpValue,
      enemyType: 'tank'
    });

    if (this.scene.killCount !== undefined) {
      this.scene.killCount++;
    }

    // Death effect: shield shatter
    this._spawnShieldShatter();

    this.destroy();
  }

  _spawnShieldShatter() {
    for (let i = 0; i < 12; i++) {
      const p = this.scene.add.rectangle(
        this.x + (Math.random() - 0.5) * 20,
        this.y + (Math.random() - 0.5) * 20,
        3 + Math.random() * 5, 3 + Math.random() * 5,
        0x4488ff
      ).setDepth(20);

      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 100;

      this.scene.tweens.add({
        targets: p,
        x: p.x + Math.cos(angle) * 30,
        y: p.y + Math.sin(angle) * 30,
        alpha: 0,
        duration: 500 + Math.random() * 300,
        ease: 'Power1',
        onComplete: () => p.destroy()
      });
    }
  }

  destroy() {
    if (this._auraGraphics) this._auraGraphics.destroy();
    super.destroy();
  }
}
