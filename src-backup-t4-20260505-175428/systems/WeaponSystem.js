// WeaponSystem.js — Auto-attack timer, nearest-enemy targeting, projectiles

class WeaponSystem {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.projectiles = [];
        this.enemies = []; // set by GameScene

        // Load weapon config from Clawd 2's WEAPON_TYPES or fallback
        this.weapons = [];
        if (typeof WEAPON_TYPES !== 'undefined') {
            const startWeapon = WEAPON_TYPES.staff || { name: 'Basic Shot', damage: 15, cooldown: 800, speed: 300, piercing: 0, color: 0xffdd00, size: 5 };
            this.weapons.push({ ...startWeapon, timer: 0 });
        } else {
            this.weapons.push({ name: 'Basic Shot', damage: 15, cooldown: 800, speed: 300, piercing: 0, color: 0xffdd00, size: 5, timer: 0 });
        }
    }

    addWeapon(weaponConfig) {
        this.weapons.push({ ...weaponConfig, timer: 0 });
    }

    update(time, delta) {
        for (const weapon of this.weapons) {
            weapon.timer += delta;
            if (weapon.timer >= weapon.cooldown) {
                weapon.timer = 0;
                this._fireWeapon(weapon);
            }
        }

        this._updateProjectiles(delta);
    }

    _fireWeapon(weapon) {
        const target = this._findNearestEnemy();
        if (!target) return;

        const px = this.player.x;
        const py = this.player.y;
        const ex = (target.sprite || target).x;
        const ey = (target.sprite || target).y;

        const angle = Math.atan2(ey - py, ex - px);

        // Create projectile using Phaser Graphics
        const p = this.scene.add.circle(px, py, weapon.size || 5, weapon.color || 0xffdd00);
        this.scene.physics.add.existing(p);

        p.body.setVelocity(
            Math.cos(angle) * weapon.speed,
            Math.sin(angle) * weapon.speed
        );

        p._weapon = weapon;
        p._piercing = weapon.piercing || 0;
        p._hits = 0;
        p._damage = weapon.damage * (this.player.damageMultiplier || this.player.stats?.damageMultiplier || 1);

        this.projectiles.push(p);
    }

    _findNearestEnemy() {
        if (!this.enemies.length) return null;

        const px = this.player.sprite.x;
        const py = this.player.sprite.y;
        let nearest = null;
        let minDist = Infinity;

        for (const enemy of this.enemies) {
            if (!enemy || !enemy.active) continue;
            const sprite = enemy.sprite || enemy;
            if (!sprite.active) continue;
            const dx = sprite.x - px;
            const dy = sprite.y - py;
            const dist = dx * dx + dy * dy;
            if (dist < minDist) {
                minDist = dist;
                nearest = enemy;
            }
        }

        return nearest;
    }

    _updateProjectiles(delta) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];

            // Remove if out of bounds
            if (!p.active || p.x < -50 || p.x > 850 || p.y < -50 || p.y > 650) {
                p.destroy();
                this.projectiles.splice(i, 1);
            }
        }
    }

    onProjectileHitEnemy(projectile, enemy) {
        if (enemy.takeDamage) {
            enemy.takeDamage(projectile._damage);
        }

        projectile._hits++;
        if (projectile._hits > projectile._piercing) {
            // Remove projectile
            const idx = this.projectiles.indexOf(projectile);
            if (idx !== -1) this.projectiles.splice(idx, 1);
            projectile.destroy();
        }
    }

    destroy() {
        for (const p of this.projectiles) {
            if (p.active) p.destroy();
        }
        this.projectiles = [];
    }
}
