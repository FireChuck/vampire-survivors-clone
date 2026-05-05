// BestiarySystem.js — Enemy codex/bestiary tracking
// Tracks all enemy types encountered and killed. Unlock entries on first kill.
// Accessible from pause menu. Persistent via MetaProgression.

class BestiarySystem {
  constructor(scene) {
    this.scene = scene;
    this._entries = {}; // key: enemyType → { unlocked, killCount, firstKillTime }
    this._panelOpen = false;
    this._panelContainer = null;
    this._scrollOffset = 0;
    this._xpBonusPerUnlock = 15; // XP bonus when first unlocking an entry

    // Build catalog from ENEMY_TYPES
    this._catalog = {};
    for (var key in ENEMY_TYPES) {
      this._catalog[key] = {
        type: key,
        name: ENEMY_TYPES[key].name,
        color: ENEMY_TYPES[key].color,
        hp: ENEMY_TYPES[key].hp,
        speed: ENEMY_TYPES[key].speed,
        damage: ENEMY_TYPES[key].damage,
        xpValue: ENEMY_TYPES[key].xpValue,
        size: ENEMY_TYPES[key].size,
        special: ENEMY_TYPES[key].special || null,
        specialDesc: ENEMY_TYPES[key].specialDesc || null
      };
    }
    // Add boss and mini-boss entries
    this._catalog['boss'] = { type: 'boss', name: 'Boss', color: 0xcc0000, hp: 500, speed: 40, damage: 30, xpValue: 100, size: [48, 48], special: 'boss', specialDesc: 'Powerful enemy that appears periodically' };
    this._catalog['mini_boss'] = { type: 'mini_boss', name: 'Mini-Boss', color: 0xff6600, hp: 200, speed: 50, damage: 20, xpValue: 50, size: [36, 36], special: 'mini_boss', specialDesc: 'Stronger enemy variant' };

    // Load persisted data
    this._loadFromMeta();

    // Listen for kills
    this._onKill = this._onKill.bind(this);
    scene.events.on('enemyKilled', this._onKill);
    scene.events.on('bossKilled', this._onKill);
    scene.events.on('miniBossKilled', this._onKill);
  }

  _onKill(data) {
    var type = data.enemyType || data.type || 'unknown';
    if (!this._entries[type]) {
      this._entries[type] = { unlocked: false, killCount: 0, firstKillTime: 0 };
    }
    this._entries[type].killCount++;

    if (!this._entries[type].unlocked) {
      this._entries[type].unlocked = true;
      this._entries[type].firstKillTime = Date.now();

      // XP bonus for first discovery
      if (this.scene.player) {
        this.scene.player.addXP(this._xpBonusPerUnlock);
        this.scene.damageNumbers.show(this.scene.player.x, this.scene.player.y - 20, '+' + this._xpBonusPerUnlock + ' XP', 'bestiary');
      }

      // Toast notification
      if (this.scene.hud && this.scene.hud.showToast) {
        this.scene.hud.showToast('📖 New Bestiary Entry: ' + (this._catalog[type] ? this._catalog[type].name : type), 3000);
      }
    }

    this._saveToMeta();
  }

  _loadFromMeta() {
    if (this.scene.meta && this.scene.meta.data.bestiary) {
      this._entries = JSON.parse(JSON.stringify(this.scene.meta.data.bestiary));
    }
  }

  _saveToMeta() {
    if (this.scene.meta) {
      this.scene.meta.data.bestiary = JSON.parse(JSON.stringify(this._entries));
      this.scene.meta._save();
    }
  }

  getCompletionPercent() {
    var total = 0;
    var unlocked = 0;
    for (var key in this._catalog) {
      total++;
      if (this._entries[key] && this._entries[key].unlocked) unlocked++;
    }
    return total > 0 ? Math.round((unlocked / total) * 100) : 0;
  }

  getUnlockedCount() {
    var count = 0;
    for (var key in this._catalog) {
      if (this._entries[key] && this._entries[key].unlocked) count++;
    }
    return count;
  }

  getTotalCount() {
    var count = 0;
    for (var key in this._catalog) count++;
    return count;
  }

  togglePanel() {
    if (this._panelOpen) {
      this._closePanel();
    } else {
      this._openPanel();
    }
  }

  _openPanel() {
    if (this._panelOpen) return;
    this._panelOpen = true;
    this._scrollOffset = 0;

    var scene = this.scene;
    var sw = scene.scale.width;
    var sh = scene.scale.height;

    this._panelContainer = scene.add.container(0, 0).setScrollFactor(0).setDepth(100);

    // Dim background
    var bg = scene.add.rectangle(sw / 2, sh / 2, sw, sh, 0x000000, 0.75).setInteractive();
    this._panelContainer.add(bg);
    bg.on('pointerdown', function() { this.togglePanel(); }.bind(this));

    // Panel frame
    var panelW = Math.min(500, sw - 40);
    var panelH = Math.min(450, sh - 80);
    var panelX = sw / 2 - panelW / 2;
    var panelY = sh / 2 - panelH / 2;

    var frame = scene.add.rectangle(sw / 2, sh / 2, panelW, panelH, 0x1a1a2e, 0.95).setStrokeStyle(2, 0x6b5ce7);
    this._panelContainer.add(frame);

    // Title
    var completion = this.getCompletionPercent();
    var titleText = scene.add.text(sw / 2, panelY + 16, '📖 Bestiary (' + completion + '%)', {
      fontSize: '18px', fontFamily: 'monospace', color: '#e0d0ff', fontStyle: 'bold'
    }).setOrigin(0.5, 0);
    this._panelContainer.add(titleText);

    // Close hint
    var closeHint = scene.add.text(sw / 2, panelY + panelH - 14, '[ Click outside to close ]', {
      fontSize: '11px', fontFamily: 'monospace', color: '#888'
    }).setOrigin(0.5, 1);
    this._panelContainer.add(closeHint);

    // Entry list
    var entryY = panelY + 40;
    var entryX = panelX + 16;
    var entryW = panelW - 32;
    var lineH = 22;

    var catalogKeys = Object.keys(this._catalog);
    for (var i = 0; i < catalogKeys.length; i++) {
      if (entryY + lineH > panelY + panelH - 30) break;

      var key = catalogKeys[i];
      var cat = this._catalog[key];
      var entry = this._entries[key];
      var unlocked = entry && entry.unlocked;

      // Color swatch
      var swatchColor = unlocked ? cat.color : 0x333333;
      var swatch = scene.add.rectangle(entryX + 6, entryY + lineH / 2, 12, 12, swatchColor).setStrokeStyle(1, 0x555555);
      this._panelContainer.add(swatch);

      // Name
      var nameStr = unlocked ? cat.name : '???';
      var nameColor = unlocked ? '#ffffff' : '#555555';
      var name = scene.add.text(entryX + 22, entryY + 2, nameStr, {
        fontSize: '13px', fontFamily: 'monospace', color: nameColor
      });
      this._panelContainer.add(name);

      // Kill count & stats
      if (unlocked) {
        var stats = 'HP:' + cat.hp + ' SPD:' + cat.speed + ' DMG:' + cat.damage + ' Kills:' + entry.killCount;
        var statText = scene.add.text(entryX + 22, entryY + 14, stats, {
          fontSize: '9px', fontFamily: 'monospace', color: '#aaaacc'
        });
        this._panelContainer.add(statText);
        entryY += lineH + 8;
      } else {
        entryY += lineH;
      }
    }
  }

  _closePanel() {
    if (this._panelContainer) {
      this._panelContainer.destroy(true);
      this._panelContainer = null;
    }
    this._panelOpen = false;
  }

  destroy() {
    if (this.scene && this.scene.events) {
      this.scene.events.off('enemyKilled', this._onKill);
      this.scene.events.off('bossKilled', this._onKill);
      this.scene.events.off('miniBossKilled', this._onKill);
    }
    this._closePanel();
  }
}
