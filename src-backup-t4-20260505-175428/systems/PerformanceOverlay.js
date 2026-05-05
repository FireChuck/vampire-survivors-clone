// PerformanceOverlay.js — FPS Benchmark & Stats Overlay
// Lightweight, requestAnimationFrame-based sampling, DOM updates max 1x/s
// Toggle with 'B' key. Top-right semi-transparent panel.

class PerformanceOverlay {
  constructor(scene) {
    this.scene = scene;
    this.visible = false;

    // ── FPS Sampling (RAF-based, no setInterval) ──
    this._frameCount = 0;
    this._lastSampleTime = 0;
    this._currentFPS = 0;
    this._fpsHistory = [];          // rolling window of FPS samples (1 per second)
    this._historyMaxSamples = 30;   // 30 seconds of history
    this._minFPS = Infinity;
    this._maxFPS = 0;
    this._avgFPS = 0;

    // ── Benchmark state ──
    this._benchmarkActive = false;
    this._benchmarkEntities = [];
    this._benchmarkResult = null;

    // ── Graphics objects ──
    this._panelBg = scene.add.graphics().setScrollFactor(0).setDepth(1005).setVisible(false);
    this._texts = [];
    this._resultText = null;

    // ── Keyboard toggle ──
    if (scene.input.keyboard) {
      scene.input.keyboard.on('keydown-B', () => this.toggle());
    }

    // ── Mobile toggle button ──
    this._mobileToggle = null;
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      this._createMobileToggle();
    }
  }

  _createMobileToggle() {
    const scene = this.scene;
    const sw = scene.scale.width;
    const btnSize = 36;
    const btnX = sw - 14 - btnSize;
    const btnY = scene.scale.height - 14 - btnSize;

    this._mobileToggle = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this._mobileToggle.fillStyle(0x000000, 0.5);
    this._mobileToggle.fillRoundedRect(btnX, btnY, btnSize, btnSize, 8);
    this._mobileToggle.lineStyle(1, 0xffffff, 0.3);
    this._mobileToggle.strokeRoundedRect(btnX, btnY, btnSize, btnSize, 8);

    this._mobileToggle.setInteractive(
      new Phaser.Geom.Rectangle(btnX, btnY, btnSize, btnSize),
      Phaser.Geom.Rectangle.Contains
    );
    this._mobileToggle.on('pointerdown', () => this.toggle());

    // "B" label
    this._mobileToggleLabel = scene.add.text(btnX + btnSize / 2, btnY + btnSize / 2, 'B', {
      fontSize: '14px', fontFamily: 'monospace', color: '#aaa', fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
  }

  toggle() {
    this.visible = !this.visible;
    this._panelBg.setVisible(this.visible);
    for (const t of this._texts) {
      if (t && t.active) t.setVisible(this.visible);
    }
    if (this._resultText && this._resultText.active) {
      this._resultText.setVisible(this.visible);
    }
  }

  /** Called every frame from GameScene.update() — lightweight counter only */
  tick(time) {
    if (!this.visible) return;
    this._frameCount++;

    // Sample once per second (no setInterval)
    if (time - this._lastSampleTime >= 1000) {
      this._currentFPS = this._frameCount;
      this._frameCount = 0;
      this._lastSampleTime = time;

      // Rolling history
      this._fpsHistory.push(this._currentFPS);
      if (this._fpsHistory.length > this._historyMaxSamples) {
        this._fpsHistory.shift();
      }

      // Stats
      this._minFPS = Math.min(...this._fpsHistory);
      this._maxFPS = Math.max(...this._fpsHistory);
      this._avgFPS = Math.round(this._fpsHistory.reduce((a, b) => a + b, 0) / this._fpsHistory.length);

      // Update DOM max 1x/s (already gated by the 1s check above)
      this._updateDisplay();
    }
  }

  _updateDisplay() {
    const scene = this.scene;
    const sw = scene.scale.width;
    const pad = 10;
    const panelW = 170;
    const lineH = 15;
    const panelH = lineH * 6 + 8;
    const px = sw - pad - panelW;
    const py = 44;

    // Clear old texts
    for (const t of this._texts) {
      if (t && t.active) t.destroy();
    }
    this._texts = [];

    // Background panel
    this._panelBg.clear();
    this._panelBg.fillStyle(0x000000, 0.6);
    this._panelBg.fillRoundedRect(px, py, panelW, panelH, 5);
    this._panelBg.lineStyle(1, 0x44ff44, 0.3);
    this._panelBg.strokeRoundedRect(px, py, panelW, panelH, 5);

    // FPS color based on performance
    const fpsColor = this._currentFPS >= 55 ? '#44ff44' : this._currentFPS >= 30 ? '#ffaa00' : '#ff4444';

    const lines = [
      { text: `FPS: ${this._currentFPS}`, color: fpsColor, bold: true },
      { text: `Avg: ${this._avgFPS} | Min: ${this._minFPS}`, color: '#bbb' },
      { text: `Max: ${this._maxFPS} (30s window)`, color: '#999' },
      { text: `Entities: ${this._getEntityCount()}`, color: '#88ccff' },
      { text: `Benchmark: ${this._benchmarkActive ? 'RUNNING' : this._benchmarkResult ? 'DONE' : 'OFF'}`, color: this._benchmarkActive ? '#ffaa00' : this._benchmarkResult ? '#44ff44' : '#666' },
      { text: this._benchmarkResult || '', color: '#44ff44' },
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.text) continue;
      const txt = scene.add.text(px + 8, py + 5 + i * lineH, line.text, {
        fontSize: line.bold ? '12px' : '10px',
        fontFamily: 'monospace',
        color: line.color,
        fontStyle: line.bold ? 'bold' : 'normal'
      }).setScrollFactor(0).setDepth(1006);
      this._texts.push(txt);
    }
  }

  _getEntityCount() {
    const scene = this.scene;
    let count = 0;
    if (scene.enemies) count += scene.enemies.length;
    if (scene.xpOrbs) count += scene.xpOrbs.length;
    if (scene.weaponManager && scene.weaponManager.activeProjectiles) count += scene.weaponManager.activeProjectiles.length;
    return count;
  }

  // ── Benchmark: Spawn 100+ entities and measure FPS ──

  startBenchmark() {
    if (this._benchmarkActive) return;

    const scene = this.scene;
    this._benchmarkActive = true;
    this._benchmarkResult = null;

    // Reset FPS history for clean measurement
    this._fpsHistory = [];
    this._minFPS = Infinity;
    this._maxFPS = 0;
    this._avgFPS = 0;

    // Ensure overlay is visible during benchmark
    if (!this.visible) this.toggle();

    // Save original max enemies and boost it
    const savedMax = GAME_CONFIG.maxEnemies;
    GAME_CONFIG.maxEnemies = 500;

    // Spawn 120 enemies in a ring around the player
    const count = 120;
    const typeKeys = Object.keys(ENEMY_TYPES);

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const dist = 200 + Math.random() * 400;
      const x = scene.player.x + Math.cos(angle) * dist;
      const y = scene.player.y + Math.sin(angle) * dist;
      const typeKey = typeKeys[Math.floor(Math.random() * typeKeys.length)];

      const enemy = new Enemy(scene, x, y, typeKey);
      enemy.hp = Math.max(enemy.hp, 50);
      enemy.maxHp = enemy.hp;
      scene.enemyGroup.add(enemy);
      scene.enemies.push(enemy);
      this._benchmarkEntities.push(enemy);
    }

    GAME_CONFIG.maxEnemies = savedMax;

    // Keep player alive during benchmark
    this._savedPlayerHP = scene.player.hp;
    this._savedPlayerMaxHP = scene.player.maxHp;
    scene.player.hp = 9999;
    scene.player.maxHp = 9999;
    if (scene.hud) scene.hud.updateHP(9999, 9999);

    // Banner
    const banner = scene.add.text(scene.scale.width / 2, scene.scale.height - 60,
      `🔥 BENCHMARK — ${count} Entities spawned! Measuring FPS...`, {
        fontSize: '16px', fontFamily: 'Arial, sans-serif', color: '#ff8800',
        fontStyle: 'bold', stroke: '#000', strokeThickness: 3
      }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);

    // Wait 5 seconds for FPS to stabilize, then collect results
    scene.time.delayedCall(5000, () => {
      banner.destroy();

      // Also spawn XP orbs for extra entity load
      const orbCount = 50;
      for (let i = 0; i < orbCount; i++) {
        const angle = (i / orbCount) * Math.PI * 2;
        const dist = 100 + Math.random() * 300;
        const x = scene.player.x + Math.cos(angle) * dist;
        const y = scene.player.y + Math.sin(angle) * dist;
        const orb = new XPOrb(scene, x, y, 5 + Math.floor(Math.random() * 20));
        scene.xpOrbGroup.add(orb);
        scene.xpOrbs.push(orb);
        this._benchmarkEntities.push(orb);
      }

      // Wait another 3 seconds with XP orbs
      scene.time.delayedCall(3000, () => {
        this._benchmarkActive = false;

        const totalEntities = this._getEntityCount();
        const pass = this._avgFPS >= 30;
        this._benchmarkResult = `${this._avgFPS} avg FPS @ ${totalEntities} entities — ${pass ? '✅ PASS' : '❌ FAIL'}`;

        // Cleanup benchmark entities
        for (const e of this._benchmarkEntities) {
          if (e && e.active) e.destroy();
        }
        // Remove from arrays
        scene.enemies = scene.enemies.filter(e => !this._benchmarkEntities.includes(e));
        scene.xpOrbs = scene.xpOrbs.filter(o => !this._benchmarkEntities.includes(o));
        this._benchmarkEntities = [];

        // Restore player HP
        scene.player.hp = this._savedPlayerHP || 100;
        scene.player.maxHp = this._savedPlayerMaxHP || 100;
        if (scene.hud) scene.hud.updateHP(scene.player.hp, scene.player.maxHp);

        // Result banner
        const resultColor = pass ? '#44ff44' : '#ff4444';
        const resultBanner = scene.add.text(scene.scale.width / 2, scene.scale.height - 60,
          `📊 BENCHMARK COMPLETE — ${this._benchmarkResult}`, {
            fontSize: '16px', fontFamily: 'Arial, sans-serif', color: resultColor,
            fontStyle: 'bold', stroke: '#000', strokeThickness: 3
          }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);

        scene.time.delayedCall(5000, () => resultBanner.destroy());
      });
    });
  }

  getBenchmarkResult() {
    return this._benchmarkResult;
  }

  destroy() {
    if (this._panelBg) this._panelBg.destroy();
    for (const t of this._texts) {
      if (t && t.active) t.destroy();
    }
    if (this._mobileToggle) this._mobileToggle.destroy();
    if (this._mobileToggleLabel) this._mobileToggleLabel.destroy();
  }
}
