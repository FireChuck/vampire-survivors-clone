// ExploderEnemy.js — DLC Enemy: Exploder
// Fast enemy that explodes on death, can chain-trigger other Exploders

class ExploderEnemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, null);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.enemyTypeKey = 'exploder';
    this.enemyTypeName = 'Exploder';
    this.hp = 30;
    this.maxHp = 30;
    this.speed = 90;
    this.damage = 10;
    this.xpValue = 10;
    this.color = 0xff3333;
    this.size = [20, 20];

    this.body.setSize(20, 20);
    this.body.setOffset(-10, -10);

    this._damageCooldown = false;
    this._animTimer = 0;
    this._baseSize = 10;

    this._graphics = scene.add.graphics();
    this._graphics.setDepth(5);
    this._drawVisual();
  }

  _drawVisual() {
    const g = this._graphics;
    g.clear();

    const dx = this.scene.player ? this.scene.player.x - this.x : 0;
    const dy = this.scene.player ? this.scene.player.y - this.y : 0;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    // Pulse bigger when closer to player (min 1, max 1.5)
    const pulseFactor = 1 + Math.max(0, 1 - dist / 300) * 0.5;
    const r = this._baseSize * pulseFactor;

    // Outer glow
    g.fillStyle(0xff3300, 0.15);
    g.fillCircle(0, 0, r + 4);

    // Body
    g.fillStyle(0xff3333, 0.9);
    g.fillCircle(0, 0, r);

    // Inner core
    g.fillStyle(0xff6600, 0.7);
    g.fillCircle(0, 0, r * 0.6);

    // Fuse/trigger indicator
    g.fillStyle(0xffff00, 0.8);
    g.fillCircle(0, -r * 0.3, 2);

    g.setPosition(this.x, this.y);
  }

  update(time, delta, player, speedMultiplier) {
    if (!player || !player.active) return;
    if (!this.active) return;

    const spdMult = speedMultiplier || 1;
    this._animTimer += delta;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    // Direct chase — fast and aggressive
    this.setVelocity(dx / dist * this.speed * spdMult, dy / dist * this.speed * spdMult);

    // Redraw with pulse
    this._drawVisual();

    // HP bar
    if (this.hp < this.maxHp) {
      const barW = 24;
      const barH = 3;
      const y = -18;
      const ratio = Math.max(0, this.hp / this.maxHp);
      this._graphics.fillStyle(0x333333, 0.8);
      this._graphics.fillRect(-barW / 2, y, barW, barH);
      const c = ratio > 0.5 ? 0x22cc22 : ratio > 0.25 ? 0xcccc22 : 0xcc2222;
      this._graphics.fillStyle(c, 1);
      this._graphics.fillRect(-barW / 2, y, barW * ratio, barH);
    }
  }

  takeDamage(amount) {
    this.hp -= amount;

    // Flash
    this._graphics.clear();
    this._graphics.fillStyle(0xffffff, 0.9);
    this._graphics.fillCircle(0, 0, 12);

    this._spawnDamageNumber(amount);

    this.scene.time.delayedCall(80, () => {
      if (this.active) this._drawVisual();
    });

    if (this.hp <= 0) {
      this.onDeath();
    }
  }

  _spawnDamageNumber(amount) {
    const text = this.scene.add.text(
      this.x + (Math.random() - 0.5) * 20,
      this.y - 16,
      Math.floor(amount).toString(),
      {
        fontSize: amount >= 20 ? '16px' : '12px',
        fontFamily: 'Arial, sans-serif',
        color: amount >= 20 ? '#ff4444' : '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      }
    ).setOrigin(0.5).setDepth(30);

    this.scene.tweens.add({
      targets: text,
      y: text.y - 40,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => text.destroy()
    });
  }

  onDeath() {
    // Trigger explosion
    this._explode();

    // Emit normal death event
    this.scene.events.emit('enemyKilled', {
      x: this.x,
      y: this.y,
      xpValue: this.xpValue,
      enemyType: 'exploder'
    });

    if (this.scene.killCount !== undefined) {
      this.scene.killCount++;
    }

    this.destroy();
  }

  _explode() {
    const scene = this.scene;
    const radius = 80;
    const explosionDamage = 30;

    // Visual: explosion ring + particles
    if (scene.particleSystem) {
      scene.particleSystem.emitExplosion(this.x, this.y, radius);
    }

    const g = scene.add.graphics();
    g.fillStyle(0xff4400, 0.5);
    g.fillCircle(this.x, this.y, radius);
    g.lineStyle(3, 0xffaa00, 0.8);
    g.strokeCircle(this.x, this.y, radius);
    g.setDepth(20);

    scene.tweens.add({
      targets: g,
      alpha: 0,
      scaleX: 1.8,
      scaleY: 1.8,
      duration: 400,
      onComplete: () => g.destroy()
    });

    // Damage player if in range
    if (scene.player && scene.player.active) {
      const pdx = scene.player.x - this.x;
      const pdy = scene.player.y - this.y;
      if (pdx * pdx + pdy * pdy < radius * radius) {
        scene.player.takeDamage(explosionDamage);
        if (scene.hud) {
          scene.hud.updateHP(scene.player.hp, scene.player.maxHp);
        }
        if (scene.particleSystem) {
          scene.particleSystem.emitHit(scene.player.x, scene.player.y, 0xff4400);
        }
      }
    }

    // Chain explosion: damage other Exploders in range
    for (const enemy of scene.enemies) {
      if (!enemy || !enemy.active) continue;
      if (enemy === this) continue;

      const edx = enemy.x - this.x;
      const edy = enemy.y - this.y;

      if (edx * edx + edy * edy < radius * radius) {
        if (enemy.enemyTypeKey === 'exploder') {
          // Chain trigger — kill the other exploder which triggers its own explosion
          enemy.hp = 0;
          enemy.onDeath();
        } else {
          // Damage non-exploder enemies
          enemy.takeDamage(explosionDamage * 0.5);
        }
      }
    }
  }

  canDamagePlayer() {
    return !this._damageCooldown;
  }

  startDamageCooldown() {
    this._damageCooldown = true;
    this.scene.time.delayedCall(800, () => {
      if (this.active) this._damageCooldown = false;
    });
  }

  destroy() {
    if (this._graphics) this._graphics.destroy();
    super.destroy();
  }
}
