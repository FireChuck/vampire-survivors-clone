// BiomeManager.js — Handles biome transitions, decorations, ambient particles, and ground rendering

class BiomeManager {
  constructor(scene) {
    this.scene = scene;
    this._currentBiome = null;
    this._biomeGraphics = scene.add.graphics();
    this._biomeGraphics.setDepth(0);
    this._decorationPool = [];
    this._lastBiome = null;
    this._biomeTransitioning = false;
    this._biomeOverlay = null;
    this._biomeNameText = null;
    this._ambientParticles = [];
    this._initBiomes();
    this._drawGround();
  }

  _initBiomes() {
    this._updateBiome();
  }

  update() {
    this._updateBiome();
  }

  _updateBiome() {
    const scene = this.scene;
    const bx = scene.player.x + GAME_CONFIG.worldWidth / 2;
    const by = scene.player.y + GAME_CONFIG.worldHeight / 2;
    const biome = getBiomeAtPosition(bx, by);

    if (!biome) return;
    if (this._lastBiome === biome.name) return;

    this._lastBiome = biome.name;
    this._currentBiome = biome;
    this._smoothBiomeTransition(biome);
    this._showBiomeName(biome.name);
    this._spawnAmbientParticles(biome.name);
    this._spawnBiomeDecorations(biome);
  }

  _smoothBiomeTransition(biome) {
    const scene = this.scene;
    if (this._biomeOverlay) this._biomeOverlay.destroy();

    const newColor = Phaser.Display.Color.IntegerToColor(biome.bgColor);
    const sw = scene.scale.width;
    const sh = scene.scale.height;

    this._biomeOverlay = scene.add.rectangle(sw / 2, sh / 2, sw, sh, biome.bgColor, 0)
      .setDepth(49).setScrollFactor(0);

    scene.tweens.add({
      targets: this._biomeOverlay,
      alpha: 0.6,
      duration: 400,
      ease: 'Sine.easeOut',
      yoyo: true,
      onComplete: () => {
        scene.cameras.main.setBackgroundColor(newColor.rgba);
        if (this._biomeOverlay) {
          this._biomeOverlay.destroy();
          this._biomeOverlay = null;
        }
      }
    });
  }

  _showBiomeName(biomeName) {
    const scene = this.scene;
    if (this._biomeNameText) this._biomeNameText.destroy();

    const displayName = biomeName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const sw = scene.scale.width;

    this._biomeNameText = scene.add.text(sw / 2, scene.scale.height * 0.3, `~ ${displayName} ~`, {
      fontSize: '28px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(60).setScrollFactor(0).setAlpha(0);

    scene.tweens.add({
      targets: this._biomeNameText,
      alpha: 1,
      duration: 600,
      ease: 'Sine.easeIn',
      hold: 1200,
      yoyo: true,
      onComplete: () => {
        if (this._biomeNameText) {
          this._biomeNameText.destroy();
          this._biomeNameText = null;
        }
      }
    });
  }

  _spawnAmbientParticles(biomeName) {
    const scene = this.scene;
    for (const p of this._ambientParticles) {
      if (p && p.active) p.destroy();
    }
    this._ambientParticles = [];

    const count = 8;

    for (let i = 0; i < count; i++) {
      const ox = scene.player.x + (Math.random() - 0.5) * 600;
      const oy = scene.player.y + (Math.random() - 0.5) * 400;

      let color, size, alpha;
      switch (biomeName) {
        case 'graveyard':
          color = 0x888899;
          size = 4 + Math.random() * 6;
          alpha = 0.15 + Math.random() * 0.1;
          break;
        case 'dark_forest':
          color = 0x225522;
          size = 3 + Math.random() * 4;
          alpha = 0.2 + Math.random() * 0.15;
          break;
        case 'blood_lands':
          color = 0x882222;
          size = 3 + Math.random() * 3;
          alpha = 0.1 + Math.random() * 0.1;
          break;
        default:
          color = 0x666666;
          size = 3 + Math.random() * 3;
          alpha = 0.1;
      }

      const p = scene.add.circle(ox, oy, size, color, alpha).setDepth(2);
      this._ambientParticles.push(p);

      scene.tweens.add({
        targets: p,
        x: ox + (Math.random() - 0.5) * 100,
        y: oy - 40 - Math.random() * 60,
        alpha: 0,
        duration: 4000 + Math.random() * 3000,
        ease: 'Sine.easeInOut',
        repeat: -1,
        delay: Math.random() * 2000,
        onRepeat: () => {
          if (scene.player && scene.player.active) {
            p.x = scene.player.x + (Math.random() - 0.5) * 600;
            p.y = scene.player.y + (Math.random() - 0.5) * 400;
          }
        }
      });
    }
  }

  _spawnBiomeDecorations(biome) {
    const scene = this.scene;
    for (const d of this._decorationPool) {
      if (d && d.active) d.destroy();
    }
    this._decorationPool = [];

    const decorations = getDecorationsForBiome(biome.name);
    if (!decorations.length) return;

    const chunkSize = 800;
    const cx = scene.player.x;
    const cy = scene.player.y;

    for (const decType of decorations) {
      const count = Math.floor(decType.density * chunkSize * chunkSize * 0.01);
      for (let i = 0; i < count; i++) {
        const x = cx + (Math.random() - 0.5) * chunkSize;
        const y = cy + (Math.random() - 0.5) * chunkSize;
        const g = scene.add.graphics();
        const alpha = decType.alpha || 1.0;

        g.fillStyle(decType.color, alpha);

        switch (decType.type) {
          case 'tombstone':
          case 'pillar':
          case 'dead_tree':
            g.fillRect(x - decType.width / 2, y - decType.height, decType.width, decType.height);
            break;
          case 'cross':
            g.fillRect(x - 2, y - decType.height, 4, decType.height);
            g.fillRect(x - decType.width / 2, y - decType.height * 0.6, decType.width, 4);
            break;
          case 'tree':
            g.fillStyle(0x5c3a1e, alpha);
            g.fillRect(x - 4, y - decType.height * 0.4, 8, decType.height * 0.4);
            g.fillStyle(decType.color, alpha);
            g.fillCircle(x, y - decType.height * 0.6, decType.width / 2);
            break;
          case 'mushroom':
            g.fillRect(x - 2, y - 6, 4, 6);
            g.fillCircle(x, y - 8, decType.width / 2);
            break;
          case 'rock':
          case 'rubble':
            g.fillRoundedRect(x - decType.width / 2, y - decType.height / 2, decType.width, decType.height, 4);
            break;
          case 'bush':
            g.fillCircle(x, y, decType.width / 2);
            break;
          case 'fog_patch':
            g.fillCircle(x, y, decType.width / 2);
            break;
          case 'blood_pool':
          case 'bone_pile':
            g.fillEllipse(x, y, decType.width, decType.height * 0.6);
            break;
          case 'skull':
            g.fillCircle(x, y, decType.width / 2);
            g.fillStyle(0x1a1a1a, alpha);
            g.fillCircle(x - 3, y - 1, 2);
            g.fillCircle(x + 3, y - 1, 2);
            break;
          case 'corpse':
            g.fillRect(x - decType.width / 2, y - 4, decType.width, 8);
            break;
          case 'torch':
            g.fillRect(x - 2, y - decType.height, 4, decType.height);
            g.fillStyle(0xff6600, alpha);
            g.fillCircle(x, y - decType.height - 4, 6);
            g.fillStyle(0xffcc00, alpha * 0.7);
            g.fillCircle(x, y - decType.height - 6, 3);
            break;
          case 'crack':
            g.fillRect(x - decType.width / 2, y - 2, decType.width, 4);
            break;
          default:
            g.fillCircle(x, y, decType.width / 3);
        }

        g.setDepth(1);
        this._decorationPool.push(g);
      }
    }
  }

  _drawGround() {
    const scene = this.scene;
    const g = scene.add.graphics();
    g.lineStyle(1, 0x222244, 0.3);
    const hw = GAME_CONFIG.worldWidth / 2;
    const hh = GAME_CONFIG.worldHeight / 2;
    const ts = GAME_CONFIG.tileSize;
    for (let x = -hw; x <= hw; x += ts) {
      g.lineBetween(x, -hh, x, hh);
    }
    for (let y = -hh; y <= hh; y += ts) {
      g.lineBetween(-hw, y, hw, y);
    }
    g.setDepth(0);
  }
}
