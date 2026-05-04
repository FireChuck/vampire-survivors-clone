// GameScene.js — Main gameplay: player, enemies, weapons, upgrades, HUD

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        // Groups for collision
        this.enemyGroup = this.physics.add.group();
        this.projectileGroup = this.physics.add.group();
        this.xpOrbGroup = this.physics.add.group();

        // Input
        this.inputManager = new InputManager(this);

        // Player — check if Player class exists, else use fallback
        if (typeof Player !== 'undefined') {
            this.player = new Player(this, 400, 300);
        } else {
            // Fallback player (in case Clawd 2's file isn't loaded yet)
            this._createFallbackPlayer();
        }

        // Systems
        this.weaponSystem = new WeaponSystem(this, this.player);
        this.hud = new HUD(this);
        this.upgradeSystem = new UpgradeSystem(this, this.player, this.hud);

        // State
        this.score = 0;
        this.killCount = 0;
        this.enemies = [];
        this.spawnTimer = 0;
        this.spawnInterval = 2000; // ms, decreases over time
        this.gameTime = 0;
        this.gameOverTriggered = false;

        // HUD
        this.hud.updateHP(this.player.hp, this.player.stats.maxHp);
        this.hud.updateXP(this.player.xp, this.upgradeSystem.xpToNext, this.player.level);
        this.hud.startTimer();

        // Collisions
        this.physics.add.overlap(this.player.sprite, this.enemyGroup, (player, enemySprite) => {
            this._onPlayerHitEnemy(enemySprite);
        });

        this.physics.add.overlap(this.projectileGroup, this.enemyGroup, (proj, enemySprite) => {
            this._onProjectileHit(proj, enemySprite);
        });

        this.physics.add.overlap(this.player.sprite, this.xpOrbGroup, (player, orbSprite) => {
            this._onPlayerCollectXP(orbSprite);
        });

        // Start enemy spawning
        this.spawnTimer = this.time.now;
    }

    _createFallbackPlayer() {
        const sprite = this.add.circle(400, 300, 14, 0x4ecdc4);
        this.physics.add.existing(sprite);
        this.player = {
            sprite: sprite,
            hp: 100,
            maxHp: 100,
            xp: 0,
            level: 1,
            stats: {
                speed: 160,
                maxHp: 100,
                damageMultiplier: 1,
                armor: 0,
                hpRegen: 0,
                xpMultiplier: 1,
                cooldownReduction: 0
            }
        };
    }

    update(time, delta) {
        if (this.upgradeSystem.paused || this.gameOverTriggered) return;

        this.gameTime += delta;

        // Player movement
        const move = this.inputManager.getMovementVector();
        if (this.player.sprite.body) {
            this.player.sprite.body.setVelocity(
                move.x * this.player.stats.speed,
                move.y * this.player.stats.speed
            );
        }

        // Clamp player to world bounds
        this.player.sprite.x = Phaser.Math.Clamp(this.player.sprite.x, 16, this.scale.width - 16);
        this.player.sprite.y = Phaser.Math.Clamp(this.player.sprite.y, 16, this.scale.height - 16);

        // HP regen
        if (this.player.stats.hpRegen > 0) {
            this.player.hp = Math.min(this.player.hp + this.player.stats.hpRegen * delta / 1000, this.player.stats.maxHp);
            this.hud.updateHP(this.player.hp, this.player.stats.maxHp);
        }

        // Weapon system
        this.weaponSystem.enemies = this.enemies;
        this.weaponSystem.update(time, delta);

        // Enemy spawning — difficulty increases over time
        this.spawnInterval = Math.max(300, 2000 - this.gameTime / 100);
        if (time - this.spawnTimer > this.spawnInterval) {
            this.spawnTimer = time;
            this._spawnEnemy();
        }

        // Move enemies toward player
        for (const enemy of this.enemies) {
            if (!enemy.sprite || !enemy.sprite.active) continue;
            this._moveEnemyTowardPlayer(enemy);
        }

        // Score
        this.hud.updateScore(this.score);
    }

    _spawnEnemy() {
        // Use Clawd 2's ENEMY_TYPES or fallback
        let types;
        if (typeof ENEMY_TYPES !== 'undefined') {
            types = Object.values(ENEMY_TYPES);
        } else {
            types = [{ name: 'Zombie', hp: 20, speed: 60, damage: 8, xp: 5, color: 0x2ecc71, size: 12 }];
        }

        // Pick type based on game time
        const available = types.filter(e => e.minTime === undefined || this.gameTime >= e.minTime);
        const template = available[Math.floor(Math.random() * available.length)];

        // Spawn outside screen edges
        const side = Math.floor(Math.random() * 4);
        let x, y;
        if (side === 0) { x = -20; y = Math.random() * 600; }
        else if (side === 1) { x = 820; y = Math.random() * 600; }
        else if (side === 2) { x = Math.random() * 800; y = -20; }
        else { x = Math.random() * 800; y = 620; }

        // Scale HP with game time
        const hpScale = 1 + this.gameTime / 60000;
        const hp = Math.floor(template.hp * hpScale);

        let enemy;
        if (typeof Enemy !== 'undefined') {
            enemy = new Enemy(this, x, y, template, hp);
        } else {
            // Fallback enemy
            const sprite = this.add.circle(x, y, template.size || 12, template.color || 0x2ecc71);
            this.physics.add.existing(sprite);
            this.enemyGroup.add(sprite);
            enemy = {
                sprite: sprite,
                hp: hp,
                maxHp: hp,
                damage: template.damage || 8,
                xp: template.xp || 5,
                speed: template.speed || 60,
                name: template.name || 'Enemy',
                takeDamage: function (dmg) {
                    this.hp -= dmg;
                }
            };
        }

        this.enemyGroup.add(enemy.sprite);
        this.enemies.push(enemy);
    }

    _moveEnemyTowardPlayer(enemy) {
        const dx = this.player.sprite.x - enemy.sprite.x;
        const dy = this.player.sprite.y - enemy.sprite.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0 && enemy.sprite.body) {
            const speed = enemy.speed || 60;
            enemy.sprite.body.setVelocity(
                (dx / dist) * speed,
                (dy / dist) * speed
            );
        }
    }

    _onPlayerHitEnemy(enemySprite) {
        // Damage cooldown — simple approach
        if (this.player._hitCooldown && this.time.now < this.player._hitCooldown) return;
        this.player._hitCooldown = this.time.now + 500;

        const damage = 10; // fallback damage
        const reduced = Math.max(1, damage - (this.player.stats.armor || 0));
        this.player.hp -= reduced;
        this.hud.updateHP(this.player.hp, this.player.stats.maxHp);

        if (this.player.hp <= 0) {
            this._triggerGameOver();
        }
    }

    _onProjectileHit(proj, enemySprite) {
        // Find enemy object
        const enemy = this.enemies.find(e => e.sprite === enemySprite);
        if (!enemy) return;

        this.weaponSystem.onProjectileHitEnemy(proj, enemy);

        if (enemy.hp <= 0) {
            this._killEnemy(enemy);
        }
    }

    _killEnemy(enemy) {
        // Drop XP orb
        this._spawnXPOrb(enemy.sprite.x, enemy.sprite.y, enemy.xp || 5);

        // Remove enemy
        enemy.sprite.destroy();
        const idx = this.enemies.indexOf(enemy);
        if (idx !== -1) this.enemies.splice(idx, 1);

        this.killCount++;
        this.score += (enemy.xp || 5) * 10;
    }

    _spawnXPOrb(x, y, value) {
        const orb = this.add.circle(x, y, 6, 0x9b59b6);
        this.physics.add.existing(orb);
        this.xpOrbGroup.add(orb);
        orb._xpValue = value * (this.player.stats.xpMultiplier || 1);
    }

    _onPlayerCollectXP(orbSprite) {
        const value = orbSprite._xpValue || 5;
        this.upgradeSystem.addXP(value);
        orbSprite.destroy();
    }

    _triggerGameOver() {
        if (this.gameOverTriggered) return;
        this.gameOverTriggered = true;

        const stats = {
            score: this.score,
            killCount: this.killCount,
            level: this.player.level,
            time: this.hud.getElapsedTime()
        };

        this.inputManager.destroy();
        this.weaponSystem.destroy();
        this.upgradeSystem.destroy();
        this.hud.destroy();

        this.scene.start('GameOverScene', stats);
    }
}
