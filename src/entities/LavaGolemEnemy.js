// LavaGolemEnemy.js — Volcanic enemy: slow, high HP, throws lava projectiles

class LavaGolemEnemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, null);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.enemyTypeKey = 'lava_golem';
    this.enemyTypeName = 'Lava Golem';
    var baseType = ENEMY_TYPES.lava_golem || {};
    this.hp = baseType.hp || 200;
    this.maxHp = this.hp;
    this.speed = baseType.speed || 30;
    this.damage = baseType.damage || 28;
    this.xpValue = baseType.xpValue || 45;
    this.color = baseType.color || 0xaa3300;
    this.size = baseType.size || [34, 34];

    this.body.setSize(this.size[0], this.size[1]);
    this.body.setOffset(-this.size[0] / 2, -this.size[1] / 2);

    this._damageCooldown = false;
    this._animTimer = 0;
    this._projectileTimer = 0;
    this._projectileInterval = 2500; // throw every 2.5s
    this._projectileRange = 300; // only throw when within range
    this._projectileSpeed = 120;
    this._projectiles = [];

    this._graphics = scene.add.graphics();
    this._graphics.setDepth(5);
    this._drawVisual();
  }

  _drawVisual() {
    var g = this._graphics;
    g.clear();
    var w = this.size[0] / 2;
    var h = this.size[1] / 2;

    // Rock body
    g.fillStyle(0x553322, 0.9);
    g.fillRoundedRect(-w, -h, this.size[0], this.size[1], 4);

    // Lava cracks
    g.lineStyle(2, 0xff4400, 0.8);
    g.lineBetween(-w * 0.5, -h * 0.3, w * 0.2, h * 0.1);
    g.lineBetween(w * 0.1, -h * 0.5, -w * 0.3, h * 0.4);
    g.lineBetween(-w * 0.2, h * 0.2, w * 0.4, h * 0.5);

    // Glowing eyes
    g.fillStyle(0xff6600, 1);
    g.fillCircle(-5, -4, 3);
    g.fillCircle(5, -4, 3);
  }

  update(time, delta, player) {
    if (!this.active || !player || !player.active) return;

    var dx = player.x - this.x;
    var dy = player.y - this.y;
    var dist = Math.sqrt(dx * dx + dy * dy);

    // Slow chase
    if (dist > 50) {
      this.body.setVelocity((dx / dist) * this.speed, (dy / dist) * this.speed);
    } else {
      this.body.setVelocity(0, 0);
    }

    // Throw lava projectiles
    this._projectileTimer += delta;
    if (dist < this._projectileRange && this._projectileTimer >= this._projectileInterval) {
      this._projectileTimer = 0;
      this._throwProjectile(dx, dy, dist);
    }

    // Animate
    this._animTimer += delta;
    var bob = Math.sin(this._animTimer / 400) * 2;
    this._graphics.setPosition(this.x, this.y + bob);

    // Update projectiles
    this._updateProjectiles(delta);
  }

  _throwProjectile(dx, dy, dist) {
    var scene = this.scene;
    var proj = scene.add.graphics();
    proj.fillStyle(0xff4400, 0.9);
    proj.fillCircle(0, 0, 5);
    proj.fillStyle(0xffaa00, 0.6);
    proj.fillCircle(0, 0, 3);
    proj.setPosition(this.x, this.y);
    proj.setDepth(6);

    var vx = (dx / dist) * this._projectileSpeed;
    var vy = (dy / dist) * this._projectileSpeed;

    var projData = {
      gfx: proj,
      vx: vx, vy: vy,
      life: 3000, age: 0,
      damage: Math.floor(this.damage * 0.6)
    };
    this._projectiles.push(projData);
  }

  _updateProjectiles(delta) {
    var scene = this.scene;
    for (var i = this._projectiles.length - 1; i >= 0; i--) {
      var p = this._projectiles[i];
      p.age += delta;

      if (p.age >= p.life) {
        p.gfx.destroy();
        this._projectiles.splice(i, 1);
        continue;
      }

      p.gfx.x += p.vx * (delta / 1000);
      p.gfx.y += p.vy * (delta / 1000);

      // Check collision with player
      if (scene.player && scene.player.active) {
        var pdx = scene.player.x - p.gfx.x;
        var pdy = scene.player.y - p.gfx.y;
        if (pdx * pdx + pdy * pdy < 225) { // within 15px
          scene.player.takeDamage && scene.player.takeDamage(p.damage);
          p.gfx.destroy();
          this._projectiles.splice(i, 1);
          continue;
        }
      }
    }
  }

  onDeath() {
    var scene = this.scene;

    scene.events.emit('enemyKilled', {
      x: this.x, y: this.y,
      xpValue: this.xpValue,
      enemyType: this.enemyTypeKey,
      color: this.color
    });

    if (scene.particleSystem) {
      scene.particleSystem.emitDeath(this.x, this.y, 0xff4400, 8);
    }
    if (scene.screenShake) scene.screenShake.shake('playerHit', { duration: 200, intensity: 0.006 });

    // Clean up projectiles
    for (var i = 0; i < this._projectiles.length; i++) {
      if (this._projectiles[i].gfx && this._projectiles[i].gfx.active) {
        this._projectiles[i].gfx.destroy();
      }
    }
    this._projectiles = [];
  }

  takeDamage(amount) {
    if (this._damageCooldown) return;
    this.hp -= amount;
    this._damageCooldown = true;
    this.scene.time.delayedCall(200, function() { this._damageCooldown = false; }.bind(this));

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
    for (var i = 0; i < this._projectiles.length; i++) {
      if (this._projectiles[i].gfx && this._projectiles[i].gfx.active) {
        this._projectiles[i].gfx.destroy();
      }
    }
    this._projectiles = [];
    super.destroy();
  }
}
