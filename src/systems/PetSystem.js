// PetSystem.js — Pet/Companion system with 3 types
// Pets orbit the player, auto-attack enemies, level up with player

const PET_TYPES = {
  wolf: {
    name: 'Wolf',
    color: 0x8888cc,
    glowColor: 0x6666ff,
    radius: 10,
    attackInterval: 800,
    attackRange: 60,
    attackDamage: 15,
    attackType: 'melee_aoe',  // AoE bite around player
    orbitRadius: 70,
    orbitSpeed: 0.002
  },
  falcon: {
    name: 'Falcon',
    color: 0xcc8844,
    glowColor: 0xffaa44,
    radius: 8,
    attackInterval: 600,
    attackRange: 200,
    attackDamage: 10,
    attackType: 'ranged_homing',  // Homing projectile at nearest enemy
    orbitRadius: 90,
    orbitSpeed: 0.003
  },
  ghost: {
    name: 'Ghost',
    color: 0x88ccaa,
    glowColor: 0x44ffaa,
    radius: 12,
    attackInterval: 500,
    attackRange: 80,
    attackDamage: 8,
    attackType: 'slow_aura',  // Slow aura that damages enemies
    orbitRadius: 60,
    orbitSpeed: 0.0015
  }
};

class Pet {
  constructor(scene, type, player) {
    this.scene = scene;
    this.typeKey = type;
    this.type = PET_TYPES[type] || PET_TYPES.wolf;
    this.player = player;
    this.active = false;

    // Level scaling (scales with player level)
    this.level = 1;
    this.damage = this.type.attackDamage;
    this.attackInterval = this.type.attackInterval;

    // Orbit state
    this.orbitAngle = Math.random() * Math.PI * 2;
    this.orbitRadius = this.type.orbitRadius;

    // Attack state
    this._attackTimer = 0;

    // Visual — simple geometric shape with glow
    this._gfx = scene.add.graphics();
    this._gfx.setDepth(15);

    // Projectile pool for falcon (reuse bullets)
    this._projectiles = [];
    this._projGfx = scene.add.graphics();
    this._projGfx.setDepth(14);
  }

  /** Update pet level based on player level */
  updateLevel(playerLevel) {
    if (playerLevel <= this.level) return;
    this.level = playerLevel;
    // Scale damage +25% per level above 1, reduce interval by 5% per level (min 200ms)
    this.damage = Math.floor(this.type.attackDamage * (1 + (this.level - 1) * 0.25));
    this.attackInterval = Math.max(200, Math.floor(this.type.attackInterval * Math.pow(0.95, this.level - 1)));
  }

  update(time, delta) {
    if (!this.active || !this.player || !this.player.active) return;

    // Orbit player
    this.orbitAngle += this.type.orbitSpeed * delta;
    this.x = this.player.x + Math.cos(this.orbitAngle) * this.orbitRadius;
    this.y = this.player.y + Math.sin(this.orbitAngle) * this.orbitRadius;

    // Attack logic
    this._attackTimer += delta;
    if (this._attackTimer >= this.attackInterval) {
      this._attackTimer = 0;
      this._performAttack();
    }
  }

  _performAttack() {
    const enemies = this.scene.enemies;
    if (!enemies || enemies.length === 0) return;

    switch (this.type.attackType) {
      case 'melee_aoe': {
        // Wolf: AoE bite around player
        const range = this.type.attackRange;
        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i];
          if (!e.active) continue;
          const dx = e.x - this.player.x;
          const dy = e.y - this.player.y;
          if (dx * dx + dy * dy < range * range) {
            this._damageEnemy(e);
          }
        }
        // Visual flash
        this.scene.screenShake && this.scene.screenShake.add(1, 80);
        break;
      }
      case 'ranged_homing': {
        // Falcon: homing projectile at nearest enemy
        let nearest = null;
        let nearDist = this.type.attackRange * this.type.attackRange;
        for (const e of enemies) {
          if (!e.active) continue;
          const dx = e.x - this.x;
          const dy = e.y - this.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < nearDist) {
            nearDist = d2;
            nearest = e;
          }
        }
        if (nearest) {
          this._projectiles.push({
            x: this.x, y: this.y,
            tx: nearest.x, ty: nearest.y,
            target: nearest,
            speed: 400,
            life: 1000,
            damage: this.damage
          });
        }
        break;
      }
      case 'slow_aura': {
        // Ghost: slow aura damages enemies in range
        const range = this.type.attackRange;
        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i];
          if (!e.active) continue;
          const dx = e.x - this.player.x;
          const dy = e.y - this.player.y;
          if (dx * dx + dy * dy < range * range) {
            this._damageEnemy(e);
            // Slow effect — reduce speed temporarily
            if (!e._petSlowTimer) e._petSlowTimer = 0;
            e._petSlowTimer = 500;
          }
        }
        break;
      }
    }
  }

  _damageEnemy(enemy) {
    if (enemy.hp !== undefined) {
      enemy.hp -= this.damage;
      if (enemy.hp <= 0 && enemy.active) {
        enemy.onDeath();
      }
    }
  }

  /** Update projectile movement (called from PetSystem) */
  updateProjectiles(delta) {
    const gfx = this._projGfx;
    gfx.clear();

    for (let i = this._projectiles.length - 1; i >= 0; i--) {
      const p = this._projectiles[i];
      p.life -= delta;
      if (p.life <= 0) {
        this._projectiles.splice(i, 1);
        continue;
      }

      // Homing: adjust toward target
      if (p.target && p.target.active) {
        p.tx = p.target.x;
        p.ty = p.target.y;
      }

      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 15) {
        // Hit
        if (p.target && p.target.active) {
          this._damageEnemy(p.target);
        }
        this._projectiles.splice(i, 1);
        continue;
      }

      const step = (p.speed * delta) / 1000;
      p.x += (dx / dist) * step;
      p.y += (dy / dist) * step;

      // Draw projectile
      gfx.fillStyle(this.type.glowColor, 0.8);
      gfx.fillCircle(p.x, p.y, 4);
      gfx.fillStyle(0xffffff, 0.5);
      gfx.fillCircle(p.x, p.y, 2);
    }
  }

  draw() {
    const gfx = this._gfx;
    gfx.clear();
    if (!this.active || !this.player || !this.player.active) return;

    const px = this.x;
    const py = this.y;
    const r = this.type.radius;

    // Glow
    gfx.fillStyle(this.type.glowColor, 0.2);
    gfx.fillCircle(px, py, r * 1.8);

    // Body shape per type
    switch (this.typeKey) {
      case 'wolf':
        // Diamond shape
        gfx.fillStyle(this.type.color, 0.9);
        gfx.fillTriangle(px, py - r, px + r, py, px, py + r);
        gfx.fillTriangle(px, py - r, px - r, py, px, py + r);
        // Eyes
        gfx.fillStyle(0xffffff, 1);
        gfx.fillCircle(px - 3, py - 2, 2);
        gfx.fillCircle(px + 3, py - 2, 2);
        gfx.fillStyle(0x000000, 1);
        gfx.fillCircle(px - 3, py - 2, 1);
        gfx.fillCircle(px + 3, py - 2, 1);
        break;
      case 'falcon':
        // Triangle (pointing right-ish)
        gfx.fillStyle(this.type.color, 0.9);
        gfx.fillTriangle(px + r, py, px - r, py - r * 0.7, px - r, py + r * 0.7);
        // Wing accent
        gfx.fillStyle(0xffffff, 0.4);
        gfx.fillTriangle(px, py, px - r * 0.5, py - r * 0.5, px - r * 0.3, py);
        break;
      case 'ghost':
        // Circle with wavy bottom
        gfx.fillStyle(this.type.color, 0.5);
        gfx.fillCircle(px, py - r * 0.2, r);
        gfx.fillRect(px - r, py - r * 0.2, r * 2, r * 0.8);
        // Eyes
        gfx.fillStyle(0xffffff, 0.9);
        gfx.fillCircle(px - 3, py - 3, 3);
        gfx.fillCircle(px + 3, py - 3, 3);
        gfx.fillStyle(0x000000, 1);
        gfx.fillCircle(px - 3, py - 3, 1.5);
        gfx.fillCircle(px + 3, py - 3, 1.5);
        break;
    }

    // Draw projectiles
    this.updateProjectiles(0); // drawing only, delta handled in update
  }

  destroy() {
    if (this._gfx) this._gfx.destroy();
    if (this._projGfx) this._projGfx.destroy();
    this._projectiles = [];
  }
}

class PetSystem {
  constructor(scene) {
    this.scene = scene;
    this.pets = [];        // all collected pets (max pool)
    this.activePets = [];   // currently equipped (max 2)
    this.maxActive = 2;
    this.maxCollection = 6; // max collectible

    // Pet drop data
    this._dropChance = 0.15; // 15% from special enemies/chests
    this._petTypes = ['wolf', 'falcon', 'ghost'];

    // UI
    this._slotGfx = scene.add.graphics().setScrollFactor(0).setDepth(50);
    this._slotTexts = [];
    for (let i = 0; i < 2; i++) {
      this._slotTexts.push(
        scene.add.text(0, 0, '', {
          fontSize: '9px', fontFamily: 'Arial, sans-serif', color: '#aaa'
        }).setScrollFactor(0).setDepth(51).setAlpha(0)
      );
    }
  }

  /** Try to drop a pet from a chest/special enemy */
  tryDrop(x, y, sourceType) {
    if (this.pets.length >= this.maxCollection) return false;
    if (Math.random() > this._dropChance) return false;

    const type = this._petTypes[Math.floor(Math.random() * this._petTypes.length)];

    // Check if already collected
    if (this.pets.find(p => p.typeKey === type)) {
      // Duplicate — buff existing pet instead
      const existing = this.pets.find(p => p.typeKey === type);
      existing.damage = Math.floor(existing.damage * 1.2);
      return false;
    }

    const pet = new Pet(this.scene, type, this.scene.player);
    pet.x = x;
    pet.y = y;
    this.pets.push(pet);

    // Auto-equip if slot available
    if (this.activePets.length < this.maxActive) {
      this._equipPet(pet);
    }

    return true;
  }

  _equipPet(pet) {
    if (this.activePets.length >= this.maxActive) return;
    pet.active = true;
    // Stagger orbit angles for visual variety
    pet.orbitAngle = this.activePets.length * Math.PI;
    this.activePets.push(pet);
    this._updateSlotUI();
  }

  /** Swap active pet at slot index with a collected pet */
  swapPet(slotIndex, petIndex) {
    if (slotIndex >= this.maxActive || petIndex >= this.pets.length) return;
    if (this.activePets[slotIndex] === this.pets[petIndex]) return;

    // Deactivate current
    if (this.activePets[slotIndex]) {
      this.activePets[slotIndex].active = false;
    }

    // Equip new
    this._equipPet(this.pets[petIndex]);

    // Remove old from activePets if it was there
    this.activePets = this.activePets.filter(p => p.active);
  }

  update(time, delta) {
    for (const pet of this.activePets) {
      // Update level scaling
      if (this.scene.player) {
        pet.updateLevel(this.scene.player.level);
      }
      pet.update(time, delta);
      pet.draw();
    }

    // Update falcon projectiles with delta
    for (const pet of this.activePets) {
      if (pet.typeKey === 'falcon') {
        pet.updateProjectiles(delta);
      }
    }
  }

  _updateSlotUI() {
    const pad = 10;
    const sw = this.scene.scale.width;
    const startY = 75; // Below combo area

    this._slotGfx.clear();
    for (let i = 0; i < 2; i++) {
      const x = sw - pad - 40;
      const y = startY + i * 28;

      // Slot background
      this._slotGfx.fillStyle(0x222222, 0.6);
      this._slotGfx.fillRoundedRect(x, y, 35, 22, 4);

      if (this.activePets[i]) {
        const pet = this.activePets[i];
        this._slotGfx.fillStyle(pet.type.color, 0.8);
        this._slotGfx.fillRoundedRect(x + 2, y + 2, 18, 18, 3);

        this._slotTexts[i].setText(`${pet.type.name} Lv${pet.level}`);
        this._slotTexts[i].setPosition(x + 22, y + 5);
        this._slotTexts[i].setAlpha(1);
      } else {
        this._slotTexts[i].setText('Empty');
        this._slotTexts[i].setPosition(x + 8, y + 5);
        this._slotTexts[i].setAlpha(0.5);
      }
    }
  }

  reset() {
    for (const pet of this.pets) pet.destroy();
    this.pets = [];
    this.activePets = [];
    this._slotGfx.clear();
    for (const t of this._slotTexts) t.setAlpha(0);
  }
}
