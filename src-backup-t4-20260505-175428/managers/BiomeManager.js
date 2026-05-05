// BiomeManager.js — Handles biome transitions, decorations, ambient particles, ground rendering, vignette, dungeon portal

class BiomeManager {
  constructor(scene) {
    this.scene = scene;
    this._currentBiome = null;
    this._biomeGraphics = scene.add.graphics();
    this._biomeGraphics.setDepth(0);
    this._decorationGraphics = scene.add.graphics();
    this._decorationGraphics.setDepth(1);
    this._decorationPool = []; // lightweight data entries, not Graphics objects
    this._decorationPositionSet = new Set();
    this._lastBiome = null;
    this._biomeTransitioning = false;
    this._biomeOverlay = null;
    this._biomeNameText = null;
    this._ambientParticles = [];
    this._vignetteOverlay = null;
    this._portalMarker = null;
    this._torchFlickerTimers = [];
    this._visitedBiomes = new Set();
    this._hudBiomeBadge = null;
    this._biomeEntryBanner = null;
    this._dungeonFadeRect = null;
    this._swampFogOverlay = null;
    this._swampPoisonPools = [];
    this._swampPoisonTimer = 0;
    this._swampPoisonInterval = 2000; // damage every 2s
    this._BIOME_EMOJI = {
      Graveyard: '⚰', Dark_Forest: '🌲', Blood_Moor: '🩸',
      Catacombs: '💀', Dungeon: '🏚', Cursed_Swamp: '☠️'
    };
    this._initBiomes();
    this._drawGround();
    this._createVignette();
    this._createDungeonPortal();
  }

  _initBiomes() {
    // Set initial background based on player position
    var biome = getBiomeAtPosition(
      this.scene.player.x + GAME_CONFIG.worldWidth / 2,
      this.scene.player.y + GAME_CONFIG.worldHeight / 2
    );
    if (biome) {
      this._currentBiome = biome;
      this._lastBiome = biome.name;
      var col = Phaser.Display.Color.IntegerToColor(biome.bgColor);
      this.scene.cameras.main.setBackgroundColor(col.rgba);
    }
    this._updateBiome();
  }

  update() {
    this._updateBiome();
    this._cullDistantDecorations();
    this._updateTorchFlicker();
    this._updateSwampEffects();
  }

  _updateBiome() {
    var scene = this.scene;
    var bx = scene.player.x + GAME_CONFIG.worldWidth / 2;
    var by = scene.player.y + GAME_CONFIG.worldHeight / 2;
    var biome = getBiomeAtPosition(bx, by);

    if (!biome) return;

    // Smooth color transition at biome boundaries (<200px from edge)
    this._updateBoundaryBlend(bx, by);

    if (this._lastBiome === biome.name) return;

    this._lastBiome = biome.name;
    this._currentBiome = biome;

    // Dungeon fade transition
    var enteringDungeon = biome.isDungeon;
    var leavingDungeon = this._lastBiome && this._wasDungeon && !enteringDungeon;
    this._wasDungeon = enteringDungeon;
    if (enteringDungeon || leavingDungeon) {
      this._doDungeonFade(enteringDungeon);
    }

    this._smoothBiomeTransition(biome);
    this._showBiomeEntryBanner(biome.name);
    this._updateHUDBiomeBadge(biome.name);
    this._spawnAmbientParticles(biome.name);
    this._spawnBiomeDecorations(biome);
    this._updateVignette(biome);
  }

  _updateBoundaryBlend(worldX, worldY) {
    var scene = this.scene;
    var biome = this._currentBiome;
    if (!biome) return;

    // Check distance to nearest biome edge
    var distToEdge = this._distanceToBiomeEdge(worldX, worldY, biome);
    if (distToEdge < 200 && distToEdge >= 0) {
      // Find neighboring biome
      var neighbor = getBiomeAtPosition(worldX, worldY); // will return current biome
      // Blend factor: 0 at edge, 1 at 200px inside
      var blendFactor = distToEdge / 200;

      var currentColor = Phaser.Display.Color.IntegerToColor(biome.bgColor);
      var blendedR = Math.round(currentColor.r * blendFactor);
      var blendedG = Math.round(currentColor.g * blendFactor);
      var blendedB = Math.round(currentColor.b * blendFactor);

      scene.cameras.main.setBackgroundColor(
        'rgba(' + blendedR + ',' + blendedG + ',' + blendedB + ',1)'
      );
    }
  }

  _distanceToBiomeEdge(x, y, biome) {
    var dists = [
      x - biome.x,
      (biome.x + biome.width) - x,
      y - biome.y,
      (biome.y + biome.height) - y
    ];
    return Math.min.apply(null, dists);
  }

  _smoothBiomeTransition(biome) {
    var scene = this.scene;
    if (this._biomeOverlay) this._biomeOverlay.destroy();

    var sw = scene.scale.width;
    var sh = scene.scale.height;

    this._biomeOverlay = scene.add.rectangle(sw / 2, sh / 2, sw, sh, biome.bgColor, 0)
      .setDepth(49).setScrollFactor(0);

    scene.tweens.add({
      targets: this._biomeOverlay,
      alpha: 0.6,
      duration: 400,
      ease: 'Sine.easeOut',
      yoyo: true,
      onComplete: function() {
        var col = Phaser.Display.Color.IntegerToColor(biome.bgColor);
        scene.cameras.main.setBackgroundColor(col.rgba);
        if (this._biomeOverlay) {
          this._biomeOverlay.destroy();
          this._biomeOverlay = null;
        }
      }.bind(this)
    });
  }

  // ── Biome Entry Banner (once per biome) ──

  _showBiomeEntryBanner(biomeName) {
    if (this._visitedBiomes.has(biomeName)) return;
    this._visitedBiomes.add(biomeName);

    var scene = this.scene;
    var displayName = biomeName.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
    var sw = scene.scale.width;
    var sh = scene.scale.height;

    // Full-width banner background
    var bannerBg = scene.add.rectangle(sw / 2, sh * 0.28, sw * 0.8, 80, 0x000000, 0.7)
      .setScrollFactor(0).setDepth(65).setAlpha(0);

    var emoji = this._BIOME_EMOJI[biomeName] || '🗺';
    var bannerText = scene.add.text(sw / 2, sh * 0.28, emoji + '  ' + displayName + '  ' + emoji, {
      fontSize: '36px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 5
    }).setOrigin(0.5).setDepth(66).setScrollFactor(0).setAlpha(0);

    this._biomeEntryBanner = { bg: bannerBg, text: bannerText };

    // Animate: fade in (500ms) → hold (1000ms) → fade out (500ms)
    scene.tweens.add({
      targets: [bannerBg, bannerText],
      alpha: 1,
      duration: 500,
      ease: 'Power2',
      onComplete: function() {
        scene.tweens.add({
          targets: [bannerBg, bannerText],
          alpha: 0,
          duration: 500,
          delay: 1000,
          ease: 'Power2',
          onComplete: function() {
            bannerBg.destroy();
            bannerText.destroy();
            if (this._biomeEntryBanner && this._biomeEntryBanner.bg === bannerBg) {
              this._biomeEntryBanner = null;
            }
          }.bind(this)
        });
      }.bind(this)
    });
  }

  // ── Dungeon Enter/Exit Fade ──

  _doDungeonFade(entering) {
    var scene = this.scene;
    if (this._dungeonFadeRect) this._dungeonFadeRect.destroy();

    this._dungeonFadeRect = scene.add.rectangle(
      scene.scale.width / 2, scene.scale.height / 2,
      scene.scale.width, scene.scale.height, 0x000000, 1
    ).setScrollFactor(0).setDepth(100);

    if (entering) {
      // Start fully black, fade out (300ms)
      this._dungeonFadeRect.setAlpha(1);
      scene.tweens.add({
        targets: this._dungeonFadeRect,
        alpha: 0,
        duration: 300,
        ease: 'Sine.easeOut',
        onComplete: function() {
          if (this._dungeonFadeRect) { this._dungeonFadeRect.destroy(); this._dungeonFadeRect = null; }
        }.bind(this)
      });
    } else {
      // Fade to black (300ms), then remove
      this._dungeonFadeRect.setAlpha(0);
      scene.tweens.add({
        targets: this._dungeonFadeRect,
        alpha: 1,
        duration: 300,
        ease: 'Sine.easeIn',
        onComplete: function() {
          if (this._dungeonFadeRect) { this._dungeonFadeRect.destroy(); this._dungeonFadeRect = null; }
        }.bind(this)
      });
    }
  }

  // ── HUD Biome Indicator Badge ──

  _updateHUDBiomeBadge(biomeName) {
    var scene = this.scene;
    var emoji = this._BIOME_EMOJI[biomeName] || '🗺';
    var displayName = biomeName.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
    var label = emoji + ' ' + displayName;

    if (this._hudBiomeBadge) {
      // Update existing badge text
      this._hudBiomeBadge.text.setText(label);
      // Subtle pulse on change
      scene.tweens.killTweensOf(this._hudBiomeBadge.container);
      this._hudBiomeBadge.container.setAlpha(1);
      scene.tweens.add({
        targets: this._hudBiomeBadge.container,
        alpha: 0.5,
        duration: 400,
        ease: 'Sine.easeOut',
        yoyo: true
      });
      return;
    }

    // Create badge container
    var badgeBg = scene.add.rectangle(0, 0, 150, 28, 0x000000, 0.55)
      .setOrigin(0).setStrokeStyle(1, 0x444444, 0.6);
    var badgeText = scene.add.text(75, 14, label, {
      fontSize: '13px',
      fontFamily: 'Arial, sans-serif',
      color: '#cccccc',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    var container = scene.add.container(12, 40, [badgeBg, badgeText])
      .setScrollFactor(0).setDepth(55).setAlpha(0);

    // Fade in
    scene.tweens.add({
      targets: container,
      alpha: 1,
      duration: 600,
      ease: 'Sine.easeOut'
    });

    this._hudBiomeBadge = { container: container, text: badgeText, bg: badgeBg };
  }

  // ── Vignette Overlay ──

  _createVignette() {
    var scene = this.scene;
    var sw = scene.scale.width;
    var sh = scene.scale.height;

    // Create vignette using a radial gradient texture
    var gfx = scene.make.graphics({ x: 0, y: 0, add: false });
    var cx = sw / 2;
    var cy = sh / 2;
    var maxR = Math.sqrt(cx * cx + cy * cy);

    for (var r = maxR; r > 0; r -= 4) {
      var t = 1 - (r / maxR);
      var alpha = t < 0.5 ? 0 : (t - 0.5) * 2 * 0.7;
      gfx.fillStyle(0x000000, alpha);
      gfx.fillCircle(cx, cy, r);
    }

    var tex = gfx.generateTexture('vignette_tex', sw, sh);
    gfx.destroy();

    this._vignetteOverlay = scene.add.image(sw / 2, sh / 2, 'vignette_tex')
      .setScrollFactor(0).setDepth(48).setAlpha(0).setBlendMode(Phaser.BlendModes.MULTIPLY);
  }

  _updateVignette(biome) {
    if (!this._vignetteOverlay) return;
    if (biome.isDungeon) {
      this.scene.tweens.add({
        targets: this._vignetteOverlay,
        alpha: 1,
        duration: 800,
        ease: 'Sine.easeIn'
      });
    } else {
      this.scene.tweens.add({
        targets: this._vignetteOverlay,
        alpha: 0,
        duration: 600,
        ease: 'Sine.easeOut'
      });
    }
  }

  // ── Dungeon Portal Marker ──

  _createDungeonPortal() {
    var scene = this.scene;
    // Portal at dungeon entrance — world coords: (2200, 2200) minus half world for scene coords
    var portalX = 2200 - GAME_CONFIG.worldWidth / 2;
    var portalY = 2200 - GAME_CONFIG.worldHeight / 2;

    // Portal visual: glowing circle
    var portalGfx = scene.add.graphics();
    portalGfx.fillStyle(0x6b21a8, 0.4);
    portalGfx.fillCircle(0, 0, 30);
    portalGfx.lineStyle(3, 0xa855f7, 0.8);
    portalGfx.strokeCircle(0, 0, 30);
    portalGfx.lineStyle(1, 0xc084fc, 0.5);
    portalGfx.strokeCircle(0, 0, 35);
    portalGfx.setPosition(portalX, portalY).setDepth(3);

    // "DUNGEON" text indicator
    var portalText = scene.add.text(portalX, portalY - 50, 'DUNGEON', {
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      color: '#c084fc',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(4);

    // Floating animation
    scene.tweens.add({
      targets: [portalGfx, portalText],
      y: portalY - 5,
      duration: 1500,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });

    // Pulsing glow
    scene.tweens.add({
      targets: portalGfx,
      alpha: 0.6,
      duration: 1000,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });

    this._portalMarker = { gfx: portalGfx, text: portalText };
  }

  // ── Ambient Particles ──

  _spawnAmbientParticles(biomeName) {
    var scene = this.scene;
    for (var i = 0; i < this._ambientParticles.length; i++) {
      if (this._ambientParticles[i] && this._ambientParticles[i].active) this._ambientParticles[i].destroy();
    }
    this._ambientParticles = [];

    var count = biomeName === 'Dungeon' ? 4 : 8;

    for (var i = 0; i < count; i++) {
      var ox = scene.player.x + (Math.random() - 0.5) * 600;
      var oy = scene.player.y + (Math.random() - 0.5) * 400;

      var color, size, alpha;
      switch (biomeName) {
        case 'graveyard':
          color = 0x888899; size = 4 + Math.random() * 6; alpha = 0.15 + Math.random() * 0.1; break;
        case 'dark_forest':
          color = 0x225522; size = 3 + Math.random() * 4; alpha = 0.2 + Math.random() * 0.15; break;
        case 'blood_moor':
          color = 0x882222; size = 3 + Math.random() * 3; alpha = 0.1 + Math.random() * 0.1; break;
        case 'dungeon':
          color = 0x6b21a8; size = 2 + Math.random() * 3; alpha = 0.08 + Math.random() * 0.06; break;
        default:
          color = 0x666666; size = 3 + Math.random() * 3; alpha = 0.1;
      }

      var p = scene.add.circle(ox, oy, size, color, alpha).setDepth(2);
      this._ambientParticles.push(p);

      var self = this;
      scene.tweens.add({
        targets: p,
        x: ox + (Math.random() - 0.5) * 100,
        y: oy - 40 - Math.random() * 60,
        alpha: 0,
        duration: 4000 + Math.random() * 3000,
        ease: 'Sine.easeInOut',
        repeat: -1,
        delay: Math.random() * 2000,
        onRepeat: function() {
          if (scene.player && scene.player.active) {
            p.x = scene.player.x + (Math.random() - 0.5) * 600;
            p.y = scene.player.y + (Math.random() - 0.5) * 400;
          }
        }
      });
    }
  }

  // ── Biome Decorations ──

  _spawnBiomeDecorations(biome) {
    // Reset decorations — store lightweight data instead of Graphics objects
    this._decorationPool = [];
    this._decorationPositionSet = new Set();
    this._torchFlickerTimers = [];

    var decorations = getDecorationsForBiome(biome.name);
    if (!decorations.length) return;

    var scene = this.scene;
    var chunkSize = 800;
    var cx = scene.player.x;
    var cy = scene.player.y;

    for (var d = 0; d < decorations.length; d++) {
      var decType = decorations[d];
      var count = Math.floor(decType.density * chunkSize * chunkSize * 0.01);
      for (var i = 0; i < count; i++) {
        var x = cx + (Math.random() - 0.5) * chunkSize;
        var y = cy + (Math.random() - 0.5) * chunkSize;

        // Duplicate prevention via grid key
        var gridKey = Math.floor(x / 40) + ',' + Math.floor(y / 40);
        if (this._decorationPositionSet.has(gridKey)) continue;
        this._decorationPositionSet.add(gridKey);

        var alpha = decType.alpha || 1.0;
        this._decorationPool.push({ x: x, y: y, decType: decType, alpha: alpha });

        // Track torch decorations for flicker
        if (decType.type === 'torch' && decType.flicker) {
          this._torchFlickerTimers.push({ idx: this._decorationPool.length - 1, baseAlpha: alpha, timer: Math.random() * 500 });
        }
      }
    }

    // Render immediately
    this._renderDecorations();
  }

  /** Batch-render all decorations into a single Graphics object (1 draw call vs N) */
  _renderDecorations() {
    var gfx = this._decorationGraphics;
    if (!gfx) return;
    gfx.clear();

    var scene = this.scene;
    if (!scene.cameras || !scene.cameras.main) return;

    var cam = scene.cameras.main;
    var margin = 200;
    var viewLeft = cam.worldView.x - margin;
    var viewRight = cam.worldView.x + cam.width + margin;
    var viewTop = cam.worldView.y - margin;
    var viewBottom = cam.worldView.y + cam.height + margin;

    for (var i = 0; i < this._decorationPool.length; i++) {
      var d = this._decorationPool[i];

      // Viewport culling
      if (d.x < viewLeft || d.x > viewRight || d.y < viewTop || d.y > viewBottom) continue;

      // Torch flicker alpha modulation
      var alpha = d.alpha;
      for (var t = 0; t < this._torchFlickerTimers.length; t++) {
        if (this._torchFlickerTimers[t].idx === i) {
          alpha = this._torchFlickerTimers[t]._currentAlpha || alpha;
          break;
        }
      }

      this._drawDecoration(gfx, d.decType, d.x, d.y, alpha);
    }
  }

  _drawDecoration(g, decType, x, y, alpha) {
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
      case 'blood_stain':
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
        // Stick
        g.fillRect(x - 2, y - decType.height, 4, decType.height);
        // Flame
        g.fillStyle(0xff6600, alpha);
        g.fillCircle(x, y - decType.height - 4, 6);
        g.fillStyle(0xffcc00, alpha * 0.7);
        g.fillCircle(x, y - decType.height - 6, 3);
        break;
      case 'crack':
        g.fillRect(x - decType.width / 2, y - 2, decType.width, 4);
        break;
      case 'iron_gate':
        // Two vertical bars
        g.fillRect(x - decType.width / 2, y - decType.height, 4, decType.height);
        g.fillRect(x + decType.width / 2 - 4, y - decType.height, 4, decType.height);
        // Horizontal bars
        g.fillRect(x - decType.width / 2, y - decType.height, decType.width, 3);
        g.fillRect(x - decType.width / 2, y - decType.height * 0.5, decType.width, 3);
        g.fillRect(x - decType.width / 2, y, decType.width, 3);
        // Pointed top
        g.fillTriangle(x - decType.width / 2 - 2, y - decType.height, x - decType.width / 2 + 2, y - decType.height, x - decType.width / 2, y - decType.height - 8);
        g.fillTriangle(x + decType.width / 2 - 2, y - decType.height, x + decType.width / 2 + 2, y - decType.height, x + decType.width / 2, y - decType.height - 8);
        break;
      case 'chains':
        // Vertical chain links
        for (var ci = 0; ci < 4; ci++) {
          var ly = y - ci * 10;
          g.strokeCircle(x, ly, 4);
        }
        break;
      default:
        g.fillCircle(x, y, decType.width / 3);
    }
  }

  _cullDistantDecorations() {
    var scene = this.scene;
    if (!scene.player || !scene.cameras || !scene.cameras.main) return;

    var camX = scene.cameras.main.worldView.x;
    var camY = scene.cameras.main.worldView.y;
    var camW = scene.cameras.main.worldView.width;
    var camH = scene.cameras.main.worldView.height;
    var margin = 600; // Keep a larger buffer to avoid constant respawning

    var minX = camX - margin;
    var maxX = camX + camW + margin;
    var minY = camY - margin;
    var maxY = camY + camH + margin;

    for (var i = this._decorationPool.length - 1; i >= 0; i--) {
      var d = this._decorationPool[i];
      if (d.x < minX || d.x > maxX || d.y < minY || d.y > maxY) {
        this._decorationPool.splice(i, 1);
      }
    }

    // Re-render after culling
    this._renderDecorations();
  }

  _updateTorchFlicker() {
    var needsRender = false;
    for (var i = 0; i < this._torchFlickerTimers.length; i++) {
      var entry = this._torchFlickerTimers[i];
      if (entry.idx >= this._decorationPool.length) continue;
      entry.timer += 16; // ~60fps
      if (entry.timer > 80 + Math.random() * 120) {
        entry.timer = 0;
        entry._currentAlpha = entry.baseAlpha * (0.6 + Math.random() * 0.4);
        needsRender = true;
      }
    }
    if (needsRender) this._renderDecorations();
  }

  // ── Enemy Affinity (public API for SpawnManager) ──

  getCurrentBiomeName() {
    return this._currentBiome ? this._currentBiome.name : null;
  }

  getEnemyAffinityBonus(enemyType) {
    if (!this._currentBiome) return 1.0;
    var affinity = getBiomeEnemyAffinity(this._currentBiome.name);
    if (affinity.indexOf(enemyType) !== -1) return 1.8; // 80% spawn weight bonus
    return 1.0;
  }

  // ── Swamp Fog Overlay & Poison Pools ──

  _updateSwampEffects() {
    var scene = this.scene;
    var player = scene.player;
    if (!player || !player.active) return;

    var inSwamp = this._currentBiome && this._currentBiome.isSwamp;

    // Fog overlay
    if (inSwamp) {
      if (!this._swampFogOverlay) {
        var sw = scene.scale.width;
        var sh = scene.scale.height;
        // Create fog texture
        var fogGfx = scene.make.graphics({ x: 0, y: 0, add: false });
        var cx = sw / 2;
        var cy = sh / 2;
        var maxR = Math.sqrt(cx * cx + cy * cy);
        for (var r = maxR; r > 0; r -= 6) {
          var t = 1 - (r / maxR);
          var alpha = t < 0.4 ? 0 : (t - 0.4) * 1.2 * 0.35;
          fogGfx.fillStyle(0x334422, alpha);
          fogGfx.fillCircle(cx + (Math.random() - 0.5) * 2, cy + (Math.random() - 0.5) * 2, r);
        }
        var fogTex = fogGfx.generateTexture('swamp_fog_tex', sw, sh);
        fogGfx.destroy();

        this._swampFogOverlay = scene.add.image(sw / 2, sh / 2, 'swamp_fog_tex')
          .setScrollFactor(0).setDepth(47).setAlpha(0).setBlendMode(Phaser.BlendModes.MULTIPLY);
      }
      // Fade in fog
      if (this._swampFogOverlay.alpha < 1) {
        this._swampFogOverlay.setAlpha(Math.min(1, this._swampFogOverlay.alpha + 0.02));
      }
      // Drift effect
      this._swampFogOverlay.x = sw / 2 + Math.sin(Date.now() / 3000) * 8;
      this._swampFogOverlay.y = sh / 2 + Math.cos(Date.now() / 4000) * 5;
    } else {
      if (this._swampFogOverlay && this._swampFogOverlay.alpha > 0) {
        this._swampFogOverlay.setAlpha(Math.max(0, this._swampFogOverlay.alpha - 0.03));
        if (this._swampFogOverlay.alpha <= 0) {
          this._swampFogOverlay.destroy();
          this._swampFogOverlay = null;
        }
      }
      // Clean up poison pools when leaving swamp
      if (this._swampPoisonPools.length > 0) {
        for (var i = 0; i < this._swampPoisonPools.length; i++) {
          if (this._swampPoisonPools[i].gfx && this._swampPoisonPools[i].gfx.active) {
            this._swampPoisonPools[i].gfx.destroy();
          }
        }
        this._swampPoisonPools = [];
      }
      return;
    }

    // Spawn poison pools around player periodically
    this._swampPoisonTimer += 16; // ~60fps
    if (this._swampPoisonTimer > 3000 && this._swampPoisonPools.length < 5) {
      this._swampPoisonTimer = 0;
      this._spawnPoisonPool();
    }

    // Check player standing in poison pools
    for (var pi = 0; pi < this._swampPoisonPools.length; pi++) {
      var pool = this._swampPoisonPools[pi];
      if (!pool.active) continue;
      var pdx = player.x - pool.x;
      var pdy = player.y - pool.y;
      if (pdx * pdx + pdy * pdy < pool.radius * pool.radius) {
        // Player in poison — damage tick
        if (!pool._lastDamageTime || Date.now() - pool._lastDamageTime > this._swampPoisonInterval) {
          pool._lastDamageTime = Date.now();
          player.takeDamage(3); // Small poison damage
          if (scene.hud) scene.hud.updateHP(player.hp, player.maxHp);
          // Visual feedback: green flash
          var poisonFlash = scene.add.graphics();
          poisonFlash.fillStyle(0x44aa22, 0.3);
          poisonFlash.fillCircle(player.x, player.y, 20);
          poisonFlash.setDepth(25);
          scene.tweens.add({
            targets: poisonFlash,
            alpha: 0,
            duration: 400,
            onComplete: function() { this.destroy(); }.bind(poisonFlash)
          });
        }
      }
    }
  }

  _spawnPoisonPool() {
    var scene = this.scene;
    var px = scene.player.x + (Math.random() - 0.5) * 400;
    var py = scene.player.y + (Math.random() - 0.5) * 300;
    var radius = 30 + Math.random() * 20;

    var pool = scene.add.graphics();
    pool.fillStyle(0x445522, 0.35);
    pool.fillEllipse(px, py, radius * 2, radius * 1.4);
    pool.fillStyle(0x668833, 0.15);
    pool.fillEllipse(px, py - 2, radius * 1.4, radius);
    // Bubbles
    for (var b = 0; b < 3; b++) {
      var bx = px + (Math.random() - 0.5) * radius;
      var by = py + (Math.random() - 0.5) * radius * 0.5;
      pool.fillStyle(0x77aa44, 0.3);
      pool.fillCircle(bx, by, 2 + Math.random() * 3);
    }
    pool.setDepth(1);

    var poolData = {
      gfx: pool, x: px, y: py, radius: radius,
      active: true, _lastDamageTime: 0,
      _spawnTime: Date.now(), _lifetime: 8000 + Math.random() * 4000
    };
    this._swampPoisonPools.push(poolData);

    // Fade out and remove after lifetime
    scene.tweens.add({
      targets: pool,
      alpha: 0,
      duration: 2000,
      delay: poolData._lifetime,
      ease: 'Sine.easeIn',
      onComplete: function() {
        pool.destroy();
        poolData.active = false;
      }
    });
  }

  // ── Ground Grid ──

  _drawGround() {
    var scene = this.scene;
    var g = scene.add.graphics();
    g.lineStyle(1, 0x222244, 0.3);
    var hw = GAME_CONFIG.worldWidth / 2;
    var hh = GAME_CONFIG.worldHeight / 2;
    var ts = GAME_CONFIG.tileSize;

    // Only draw visible ground grid within camera bounds (not entire world)
    var camW = scene.scale.width;
    var camH = scene.scale.height;
    var startX = Math.floor(-hw / ts) * ts;
    var startY = Math.floor(-hh / ts) * ts;

    // Draw initial viewport area — will be redrawn as camera moves
    this._drawGroundForView(g, -camW / 2, -camH / 2, camW, camH, hw, hh, ts);
    g.setDepth(0);
    this._groundGraphics = g;
  }

  /** Redraw ground grid for current camera viewport */
  _drawGroundForView(g, vx, vy, vw, vh, hw, hh, ts) {
    // Grid is static — draw full world since it's a single one-time cost
    // The grid lines are thin and the draw call is cheap compared to hundreds of graphics objects
    for (var x = -hw; x <= hw; x += ts) {
      g.lineBetween(x, -hh, x, hh);
    }
    for (var y = -hh; y <= hh; y += ts) {
      g.lineBetween(-hw, y, hw, y);
    }
  }
}
