// FireElementalEnemy.js — Volcanic enemy: fast, leaves fire trail, explodes on death

class FireElementalEnemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, null);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.enemyTypeKey = 'fire_elemental';
    this.enemyTypeName = 'Fire Elemental';
    var baseType = ENEMY_TYPES.fire_elemental || {};
    this.hp = baseType.hp || 60;
    this.maxHp = this.hp;
    this.speed = baseType.speed || 130;
    this.damage = baseType.damage || 18;
    this.xpValue = baseType.xpValue || 22;
    this.color = baseType.color || 0xff6600;
    this.size = baseType.size || [20, 20];

    this.body.setSize(this.size[0], this.size[1]);
    this.body.setOffset(-this.size[0] / 2, -this.size[1] / 2);

    this._damageCooldown = false;
    this._animTimer = 0;
    this._fireTrailTimer = 0;
    this._fireTrailInterval = 200; // leave trail every 200ms
    this._fireTrails = [];

    this._graphics = scene.add.graphics();
    this._graphics.setDepth(5);
    this._drawVisual();
  }

  _drawVisual() {
    var g = this._graphics;
    g.clear();
    var r = this.size[0] / 2;

    // Outer glow
    g.fillStyle(0xff3300, 0.2);
    g.fillCircle(0, 0, r + 4);

    // Body
    g.fillStyle(this.color, 0.9);
    g.fillCircle(0, 0, r);

    // Inner bright core
    g.fillStyle(0xffcc00, 0.7);
    g.fillCircle(0, 0, r * 0.4);
  }

  update(time, delta, player) {
    if (!this.active || !player || !player.active) return;

    // Chase player
    var dx = player.x - this.x;
    var dy = player.y - this.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      this.body.setVelocity((dx / dist) * this.speed, (dy / dist) * this.speed);
    }

    // Fire trail
    this._fireTrailTimer += delta;
    if (this._fireTrailTimer >= this._fireTrailInterval) {
      this._fireTrailTimer = 0;
      this._spawnFireTrail();
    }

    // Animate
    this._animTimer += delta;
    var pulse = Math.sin(this._animTimer / 150) * 0.15;
    this._graphics.setScale(1 + pulse, 1 + pulse);
    this._graphics.setPosition(this.x, this.y);

    // Fade old trails
    this._updateFireTrails(delta);
  }

  _spawnFireTrail() {
    var scene = this.scene;
    var trail = scene.add.graphics();
    trail.fillStyle(0xff4400, 0.5);
    trail.fillCircle(0, 0, 6);
    trail.fillStyle(0xff8800, 0.3);
    trail.fillCircle(0, 0, 3);
    trail.setPosition(this.x, this.y);
    trail.setDepth(1);

    var trailData = { gfx: trail, life: 3000, age: 0 };
    this._fireTrails.push(trailData);

    // Check if player is standing on fire trail
    if (scene.player && scene.player.active) {
      var pdx = scene.player.x - this.x;
      var pdy = scene.player.y - this.y;
      if (pdx * pdx + pdy * pdy < 400) { // within 20px
        if (!this._lastTrailDamage || Date.now() - this._lastTrailDamage > 1000) {
          this._lastTrailDamage = Date.now();
          scene.player.takeDamage && scene.player.takeDamage(3);
        }
      }
    }
  }

  _updateFireTrails(delta) {
    for (var i = this._fireTrails.length - 1; i >= 0; i--) {
      var t = this._fireTrails[i];
      t.age += delta;
      if (t.age >= t.life) {
        t.gfx.destroy();
        this._fireTrails.splice(i, 1);
      } else {
        t.gfx.setAlpha(1 - (t.age / t.life));
      }
    }
  }

  onDeath() {
    // Explosion on death — damage nearby player
    var scene = this.scene;
    if (scene.player && scene.player.active) {
      var dx = scene.player.x - this.x;
      var dy = scene.player.y - this.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 60) {
        scene.player.takeDamage && scene.player.takeDamage(12);
      }
    }

    // Emit death event
    scene.events.emit('enemyKilled', {
      x: this.x, y: this.y,
      xpValue: this.xpValue,
      enemyType: this.enemyTypeKey,
      color: this.color
    });

    // Death particles
    if (scene.particleSystem) {
      scene.particleSystem.emitDeath(this.x, this.y, 0xff6600, 12);
    }
    if (scene.screenShake) scene.screenShake.shake('explosion', { duration: 200, intensity: 0.008 });

    // Clean up fire trails
    for (var i = 0; i < this._fireTrails.length; i++) {
      if (this._fireTrails[i].gfx && this._fireTrails[i].gfx.active) {
        this._fireTrails[i].gfx.destroy();
      }
    }
    this._fireTrails = [];
  }

  takeDamage(amount) {
    if (this._damageCooldown) return;
    this.hp -= amount;
    this._damageCooldown = true;
    this.scene.time.delayedCall(200, function() { this._damageCooldown = false; }.bind(this));

    // Flash white on hit
    this._graphics.setTint(0xffffff);
    this.scene.time.delayedCall(80, function() { this._graphics.clearTint(); }.bind(this));

    if (this.hp <= 0) {
      this.onDeath();
      return true;
    }
    return false;
  }

  destroy() {
    if (this._graphics && this._graphics.active) this._graphics.destroy();
    for (var i = 0; i < this._fireTrails.length; i++) {
      if (this._fireTrails[i].gfx && this._fireTrails[i].gfx.active) {
        this._fireTrails[i].gfx.destroy();
      }
    }
    this._fireTrails = [];
    super.destroy();
  }
}
