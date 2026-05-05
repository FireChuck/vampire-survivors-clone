// Boss.js — Vampire Survivors Clone
// Boss enemy entity with special attack patterns

class Boss extends Enemy {
  constructor(scene, x, y, bossType) {
    // Base enemy type for stats
    super(scene, x, y, 'golem');
    
    this.isBoss = true;
    this.bossType = bossType; // 'necromancer', 'dragon', 'giant'
    
    // Override base stats — 10x HP, bigger, slower
    const bossMultiplier = 10;
    this.hp = Math.floor(this.hp * bossMultiplier);
    this.maxHp = this.hp;
    this.damage = Math.floor(this.damage * 2);
    this.xpValue = this.xpValue * 5;
    
    // Boss size
    this.size = [50, 50];
    this.body.setSize(50, 50);
    this.body.setOffset(-25, -25);
    
    // Boss colors per type
    switch (bossType) {
      case 'necromancer':
        this.color = 0x6600cc;
        this.bossName = 'Necromancer';
        break;
      case 'dragon':
        this.color = 0xff4400;
        this.bossName = 'Dragon';
        break;
      case 'giant':
        this.color = 0x666666;
        this.bossName = 'Giant';
        this.size = [60, 60];
        this.body.setSize(60, 60);
        this.body.setOffset(-30, -30);
        break;
      default:
        this.color = 0xff0000;
        this.bossName = 'Boss';
    }
    
    // Boss-specific AI state
    this._attackTimer = 0;
    this._attackCooldown = 3000; // ms between special attacks
    this._isAttacking = false;
    this._chargeTarget = null;
    this._summonCooldown = 0;
    
    // HP Bar
    this._hpBarBg = scene.add.graphics();
    this._hpBarFill = scene.add.graphics();
    this._hpBarBg.setDepth(40);
    this._hpBarFill.setDepth(41);
    
    // Boss name label
    this._nameText = scene.add.text(0, 0, this.bossName, {
      fontSize: '12px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffd700',
      fontStyle: 'bold',
      stroke: '#000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(42);
    
    this._drawBossVisual();
  }

  _drawBossVisual() {
    this._graphics.clear();
    const hw = this.size[0] / 2;
    const hh = this.size[1] / 2;

    switch (this.bossType) {
      case 'necromancer':
        // Dark robed figure with glowing eyes
        this._graphics.fillStyle(this.color, 1);
        this._graphics.fillRect(-hw, -hh, this.size[0], this.size[1]);
        // Hood
        this._graphics.fillTriangle(-hw, -hh, hw, -hh, 0, -hh - 15);
        // Eyes
        this._graphics.fillStyle(0xff00ff, 1);
        this._graphics.fillCircle(-8, -5, 4);
        this._graphics.fillCircle(8, -5, 4);
        // Staff
        this._graphics.lineStyle(2, 0x8844ff, 1);
        this._graphics.lineBetween(hw, -hh, hw + 5, hh);
        // Staff orb
        this._graphics.fillStyle(0xcc44ff, 1);
        this._graphics.fillCircle(hw + 5, -hh - 5, 6);
        break;

      case 'dragon':
        // Large winged beast
        this._graphics.fillStyle(this.color, 1);
        this._graphics.fillRect(-hw * 0.6, -hh, hw * 1.2, this.size[1]);
        // Wings
        this._graphics.fillTriangle(-hw * 0.6, 0, -hw, -hh, -hw * 0.6, hh);
        this._graphics.fillTriangle(hw * 0.6, 0, hw, -hh, hw * 0.6, hh);
        // Head
        this._graphics.fillStyle(0xff6600, 1);
        this._graphics.fillCircle(0, -hh - 8, 12);
        // Eyes
        this._graphics.fillStyle(0xffff00, 1);
        this._graphics.fillCircle(-4, -hh - 10, 3);
        this._graphics.fillCircle(4, -hh - 10, 3);
        // Fire breath particles (static representation)
        this._graphics.fillStyle(0xffcc00, 0.6);
        this._graphics.fillCircle(0, -hh - 25, 8);
        break;

      case 'giant':
        // Massive hulking figure
        this._graphics.fillStyle(this.color, 1);
        this._graphics.fillRect(-hw, -hh, this.size[0], this.size[1]);
        // Arms
        this._graphics.fillRect(-hw - 12, -hh + 10, 14, 30);
        this._graphics.fillRect(hw - 2, -hh + 10, 14, 30);
        // Head
        this._graphics.fillStyle(0x888888, 1);
        this._graphics.fillCircle(0, -hh - 10, 14);
        // Eyes
        this._graphics.fillStyle(0xff0000, 1);
        this._graphics.fillCircle(-5, -hh - 12, 3);
        this._graphics.fillCircle(5, -hh - 12, 3);
        // Mouth
        this._graphics.lineStyle(2, 0x333333, 1);
        this._graphics.lineBetween(-5, -hh - 5, 5, -hh - 5);
        break;

      default:
        this._graphics.fillStyle(this.color, 1);
        this._graphics.fillRect(-hw, -hh, this.size[0], this.size[1]);
    }

    this._graphics.setDepth(5);
  }

  update(time, delta, player) {
    if (!player || !player.active) return;

    this._attackTimer += delta;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const dirX = dx / dist;
    const dirY = dy / dist;

    switch (this.bossType) {
      case 'necromancer':
        this._updateNecromancer(time, delta, player, dirX, dirY, dist);
        break;
      case 'dragon':
        this._updateDragon(time, delta, player, dirX, dirY, dist);
        break;
      case 'giant':
        this._updateGiant(time, delta, player, dirX, dirY, dist);
        break;
      default:
        // Default boss: slow chase
        this.setVelocity(dirX * this.speed, dirY * this.speed);
    }

    // Update HP bar
    this._updateHPBar();

    // Update name text
    this._nameText.setPosition(this.x, this.y - this.size[1] / 2 - 20);

    // Update graphics position
    this._graphics.setPosition(this.x, this.y);
  }

  _updateNecromancer(time, delta, player, dirX, dirY, dist) {
    // Necromancer: keeps distance, summons minions
    const preferDist = 200;
    let speed = this.speed * 0.7;
    let moveX = dirX;
    let moveY = dirY;

    if (dist < preferDist) {
      // Move away from player
      moveX = -dirX;
      moveY = -dirY;
      speed = this.speed;
    }

    this.setVelocity(moveX * speed, moveY * speed);

    // Summon minions periodically
    this._summonCooldown += delta;
    if (this._summonCooldown >= 5000 && !this._isAttacking) {
      this._summonCooldown = 0;
      this._isAttacking = true;
      this._summonMinions(3);
      this.scene.time.delayedCall(500, () => { this._isAttacking = false; });
    }
  }

  _summonMinions(count) {
    if (!this.scene || !this.scene._spawnEnemy) return;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i;
      const spawnDist = 60;
      const sx = this.x + Math.cos(angle) * spawnDist;
      const sy = this.y + Math.sin(angle) * spawnDist;
      
      // Spawn a skeleton near the boss
      const enemy = new Enemy(this.scene, sx, sy, 'skeleton');
      const hpScale = 1 + this.scene.gameTime / 60000;
      enemy.hp = Math.floor(enemy.hp * hpScale * 0.7); // Weaker minions
      enemy.maxHp = enemy.hp;
      this.scene.enemyGroup.add(enemy);
      this.scene.enemies.push(enemy);

      // Spawn effect
      this._spawnSummonEffect(sx, sy);
    }
  }

  _spawnSummonEffect(x, y) {
    const g = this.scene.add.graphics();
    g.lineStyle(2, 0x6600cc, 0.8);
    g.strokeCircle(x, y, 15);
    g.setDepth(20);
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 400,
      onComplete: () => g.destroy()
    });
  }

  _updateDragon(time, delta, player, dirX, dirY, dist) {
    // Dragon: charges at player, area fire attack
    if (this._isAttacking) {
      this.setVelocity(0, 0);
      return;
    }

    // Fire breath area attack
    if (this._attackTimer >= this._attackCooldown && dist < 300) {
      this._attackTimer = 0;
      this._isAttacking = true;
      this._fireBreath(dirX, dirY);
      this.scene.time.delayedCall(800, () => { this._isAttacking = false; });
      return;
    }

    // Chase
    let speed = this.speed;
    if (dist > 300) speed = this.speed * 1.5;
    this.setVelocity(dirX * speed, dirY * speed);
  }

  _fireBreath(dirX, dirY) {
    // Area damage in a cone in front of the dragon
    const range = 200;
    const angle = Math.atan2(dirY, dirX);
    const coneWidth = 0.8; // radians

    // Visual: fire cone
    const g = this.scene.add.graphics();
    g.fillStyle(0xff6600, 0.4);
    g.beginPath();
    g.moveTo(this.x, this.y);
    g.arc(this.x, this.y, range, angle - coneWidth, angle + coneWidth);
    g.closePath();
    g.fillPath();
    g.setDepth(20);

    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 600,
      onComplete: () => g.destroy()
    });

    // Damage enemies... wait, damage the PLAYER
    const playerDist = Math.sqrt(
      (this.scene.player.x - this.x) ** 2 +
      (this.scene.player.y - this.y) ** 2
    );
    if (playerDist < range) {
      const playerAngle = Math.atan2(
        this.scene.player.y - this.y,
        this.scene.player.x - this.x
      );
      let angleDiff = playerAngle - angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      if (Math.abs(angleDiff) < coneWidth) {
        this.scene.player.takeDamage(this.damage);
        if (this.scene.hud) {
          this.scene.hud.updateHP(this.scene.player.hp, this.scene.player.maxHp);
        }
      }
    }
  }

  _updateGiant(time, delta, player, dirX, dirY, dist) {
    // Giant: slow approach, charge attack, stomp AOE
    if (this._isAttacking) {
      this.setVelocity(0, 0);
      return;
    }

    // Stomp attack when close
    if (this._attackTimer >= this._attackCooldown && dist < 150) {
      this._attackTimer = 0;
      this._isAttacking = true;
      this._stomp();
      this.scene.time.delayedCall(600, () => { this._isAttacking = false; });
      return;
    }

    // Charge attack: rush at player
    if (this._attackTimer >= this._attackCooldown * 0.6 && dist > 150 && dist < 400) {
      this._attackTimer = 0;
      this._isAttacking = true;
      this._chargeTarget = { x: player.x, y: player.y };
      this.setVelocity(dirX * this.speed * 4, dirY * this.speed * 4);
      this.scene.time.delayedCall(800, () => {
        this._isAttacking = false;
        this._chargeTarget = null;
        // Stomp on arrival
        if (this.active) this._stomp();
        this.scene.time.delayedCall(600, () => { this._isAttacking = false; });
      });
      return;
    }

    // Normal slow chase
    this.setVelocity(dirX * this.speed, dirY * this.speed);
  }

  _stomp() {
    const range = 120;
    const damage = this.damage * 1.5;

    // Visual: shockwave ring
    const g = this.scene.add.graphics();
    g.lineStyle(3, 0xffffff, 0.6);
    g.strokeCircle(this.x, this.y, 10);
    g.setDepth(20);
    this.scene.tweens.add({
      targets: g,
      scaleX: 12,
      scaleY: 12,
      alpha: 0,
      duration: 500,
      onComplete: () => g.destroy()
    });

    // Damage player if in range
    const playerDist = Math.sqrt(
      (this.scene.player.x - this.x) ** 2 +
      (this.scene.player.y - this.y) ** 2
    );
    if (playerDist < range) {
      this.scene.player.takeDamage(damage);
      if (this.scene.hud) {
        this.scene.hud.updateHP(this.scene.player.hp, this.scene.player.maxHp);
      }
    }
  }

  _updateHPBar() {
    const barWidth = 60;
    const barHeight = 6;
    const barY = this.y - this.size[1] / 2 - 12;
    const ratio = Math.max(0, this.hp / this.maxHp);

    this._hpBarBg.clear();
    this._hpBarBg.fillStyle(0x333333, 0.8);
    this._hpBarBg.fillRect(this.x - barWidth / 2, barY, barWidth, barHeight);

    this._hpBarFill.clear();
    // Color: green > yellow > red
    let barColor = 0x44ff44;
    if (ratio < 0.5) barColor = 0xffff00;
    if (ratio < 0.25) barColor = 0xff4444;
    this._hpBarFill.fillStyle(barColor, 1);
    this._hpBarFill.fillRect(this.x - barWidth / 2, barY, barWidth * ratio, barHeight);
  }

  onDeath() {
    // Extra death particles for bosses — use ParticleSystem
    if (this.scene.particleSystem) {
      this.scene.particleSystem.emitBossDeath(this.x, this.y, this.color);
    } else {
      this._spawnBossDeathEffect();
    }

    // Drop multiple XP orbs
    const orbCount = 5 + Math.floor(Math.random() * 5);
    for (let i = 0; i < orbCount; i++) {
      const angle = (Math.PI * 2 / orbCount) * i;
      const dist = 20 + Math.random() * 30;
      this.scene.events.emit('enemyKilled', {
        x: this.x + Math.cos(angle) * dist,
        y: this.y + Math.sin(angle) * dist,
        xpValue: Math.floor(this.xpValue / orbCount),
        enemyType: this.bossType
      });
    }

    if (this.scene.killCount !== undefined) {
      this.scene.killCount++;
    }

    // Clean up boss-specific elements
    if (this._hpBarBg) this._hpBarBg.destroy();
    if (this._hpBarFill) this._hpBarFill.destroy();
    if (this._nameText) this._nameText.destroy();

    this.destroy();
  }

  _spawnBossDeathEffect() {
    // Large explosion effect
    for (let i = 0; i < 20; i++) {
      const p = this.scene.add.rectangle(
        this.x + (Math.random() - 0.5) * 40,
        this.y + (Math.random() - 0.5) * 40,
        4 + Math.random() * 6, 4 + Math.random() * 6,
        this.color
      ).setDepth(20);

      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 150;

      this.scene.tweens.add({
        targets: p,
        x: p.x + Math.cos(angle) * (40 + Math.random() * 60),
        y: p.y + Math.sin(angle) * (40 + Math.random() * 60),
        alpha: 0,
        angle: Math.random() * 360,
        duration: 600 + Math.random() * 400,
        ease: 'Power1',
        onComplete: () => p.destroy()
      });
    }

    // Flash effect
    const flash = this.scene.add.graphics();
    flash.fillStyle(0xffffff, 0.5);
    flash.fillCircle(this.x, this.y, 80);
    flash.setDepth(25);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 300,
      onComplete: () => flash.destroy()
    });
  }

  destroy() {
    if (this._hpBarBg) this._hpBarBg.destroy();
    if (this._hpBarFill) this._hpBarFill.destroy();
    if (this._nameText) this._nameText.destroy();
    super.destroy();
  }
}
