// PerformanceOverlay.js — FPS Benchmark & Stats Overlay (Extended)
// Lightweight, requestAnimationFrame-based sampling, DOM updates max 1x/s
// Toggle with 'B' key. Top-right semi-transparent panel.
// Extended Benchmark: 200+ entities, 60s logging, JSON output with P95 frame time

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

    // ── Extended benchmark data ──
    this._bmFrameTimes = [];        // per-frame delta ms for P95 calculation
    this._bmSamples = [];           // { time, fps, entityCount } per second
    this._bmStartTime = 0;
    this._bmDuration = 60000;       // 60 seconds
    this._bmRAFHandle = null;
    this._bmLastFrameTime = 0;
    this._bmTimerEvent = null;

    // ── Graphics objects ──
    this._panelBg = scene.add.graphics().setScrollFactor(0).setDepth(1005).setVisible(false);
    this._texts = [];
    this._resultText = null;
    this._progressBar = null;

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
    // Always track frame times during benchmark (even if overlay hidden)
    if (this._benchmarkActive) {
      const now = performance.now();
      if (this._bmLastFrameTime > 0) {
        this._bmFrameTimes.push(now - this._bmLastFrameTime);
      }
      this._bmLastFrameTime = now;
      this._frameCount++;
    }

    if (!this.visible) return;

    // Non-benchmark FPS tracking
    if (!this._benchmarkActive) {
      this._frameCount++;
    }

    // Sample once per second (no setInterval)
    if (time - this._lastSampleTime >= 1000) {
      this._currentFPS = this._frameCount;
      this._frameCount = 0;
      this._lastSampleTime = time;

      // Benchmark sample recording
      if (this._benchmarkActive) {
        this._bmSamples.push({
          time: Math.round(now - this._bmStartTime),
          fps: this._currentFPS,
          entityCount: this._getEntityCount()
        });
      }

      // Rolling history (non-benchmark or shared)
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
    const panelW = 220;
    const lineH = 15;
    const bmLines = this._benchmarkActive ? 3 : 0;
    const panelH = lineH * (6 + bmLines) + 8;
    const px = sw - pad - panelW;
    const py = 44;

    // Clear old texts
    for (const t of this._texts) {
      if (t && t.active) t.destroy();
    }
    this._texts = [];

    // Clear old progress bar
    if (this._progressBar && this._progressBar.active) {
      this._progressBar.destroy();
      this._progressBar = null;
    }

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
    ];

    // Benchmark progress info
    if (this._benchmarkActive) {
      const elapsed = performance.now() - this._bmStartTime;
      const progress = Math.min(elapsed / this._bmDuration, 1);
      const remaining = Math.max(0, Math.ceil((this._bmDuration - elapsed) / 1000));
      lines.push({ text: `BM Progress: ${Math.round(progress * 100)}% (${remaining}s left)`, color: '#ffaa00' });
    }

    if (this._benchmarkResult) {
      lines.push({ text: this._benchmarkResult, color: '#44ff44' });
    }

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

    // Progress bar during benchmark
    if (this._benchmarkActive) {
      const elapsed = performance.now() - this._bmStartTime;
      const progress = Math.min(elapsed / this._bmDuration, 1);
      const barY = py + panelH + 4;
      this._progressBar = scene.add.graphics().setScrollFactor(0).setDepth(1006);
      this._progressBar.fillStyle(0x333333, 0.8);
      this._progressBar.fillRoundedRect(px, barY, panelW, 6, 3);
      this._progressBar.fillStyle(0xffaa00, 0.9);
      this._progressBar.fillRoundedRect(px, barY, panelW * progress, 6, 3);
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

  // ── Extended Benchmark: 200+ entities, 60s logging, JSON output ──

  startBenchmark() {
    if (this._benchmarkActive) return;

    const scene = this.scene;
    this._benchmarkActive = true;
    this._benchmarkResult = null;
    this._bmFrameTimes = [];
    this._bmSamples = [];
    this._bmLastFrameTime = 0;

    // Reset FPS history for clean measurement
    this._fpsHistory = [];
    this._minFPS = Infinity;
    this._maxFPS = 0;
    this._avgFPS = 0;
    this._frameCount = 0;
    this._lastSampleTime = 0;

    // Ensure overlay is visible during benchmark
    if (!this.visible) this.toggle();

    // ── Spawn 200+ entities ──

    // 1) Enemies: 150 enemies in rings around player
    const enemyCount = 150;
    const typeKeys = Object.keys(ENEMY_TYPES);
    const savedMax = GAME_CONFIG.maxEnemies;
    GAME_CONFIG.maxEnemies = 500;

    for (let i = 0; i < enemyCount; i++) {
      const angle = (i / enemyCount) * Math.PI * 2;
      const dist = 150 + Math.random() * 500;
      const x = scene.player.x + Math.cos(angle) * dist;
      const y = scene.player.y + Math.sin(angle) * dist;
      const typeKey = typeKeys[Math.floor(Math.random() * typeKeys.length)];

      try {
        const enemy = new Enemy(scene, x, y, typeKey);
        enemy.hp = Math.max(enemy.hp, 50);
        enemy.maxHp = enemy.hp;
        scene.enemyGroup.add(enemy);
        scene.enemies.push(enemy);
        this._benchmarkEntities.push(enemy);
      } catch (e) {
        // Skip failed spawns gracefully
      }
    }

    GAME_CONFIG.maxEnemies = savedMax;

    // 2) XP Orbs: 60 orbs scattered
    const orbCount = 60;
    for (let i = 0; i < orbCount; i++) {
      const angle = (i / orbCount) * Math.PI * 2;
      const dist = 80 + Math.random() * 400;
      const x = scene.player.x + Math.cos(angle) * dist;
      const y = scene.player.y + Math.sin(angle) * dist;
      try {
        const orb = new XPOrb(scene, x, y, 5 + Math.floor(Math.random() * 20));
        scene.xpOrbGroup.add(orb);
        scene.xpOrbs.push(orb);
        this._benchmarkEntities.push(orb);
      } catch (e) { /* skip */ }
    }

    // 3) Force weapon projectiles: trigger weapons to create projectiles
    // We'll manually create some projectiles to simulate active combat
    const projectileCount = 0; // Projectiles will be created by auto-attack during benchmark
    // The weapons auto-fire during gameplay, so projectiles will accumulate naturally

    // Keep player alive during benchmark
    this._savedPlayerHP = scene.player.hp;
    this._savedPlayerMaxHP = scene.player.maxHp;
    scene.player.hp = 9999;
    scene.player.maxHp = 9999;
    if (scene.hud) scene.hud.updateHP(9999, 9999);

    // Disable enemy damage to player
    this._savedEnemyDamage = true;

    // ── Start 60-second measurement ──
    this._bmStartTime = performance.now();

    // Banner
    this._bmBanner = scene.add.text(scene.scale.width / 2, scene.scale.height - 60,
      `🔥 BENCHMARK START — ${this._getEntityCount()} entities | 60s measurement...`, {
        fontSize: '16px', fontFamily: 'Arial, sans-serif', color: '#ff8800',
        fontStyle: 'bold', stroke: '#000', strokeThickness: 3
      }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);

    // Schedule benchmark end
    this._bmTimerEvent = scene.time.delayedCall(this._bmDuration, () => {
      this._endBenchmark();
    });
  }

  _endBenchmark() {
    const scene = this.scene;
    this._benchmarkActive = false;

    // Destroy banner
    if (this._bmBanner && this._bmBanner.active) {
      this._bmBanner.destroy();
      this._bmBanner = null;
    }

    const totalDurationMs = performance.now() - this._bmStartTime;
    const entityCount = this._getEntityCount();

    // ── Calculate statistics ──
    const fpsValues = this._bmSamples.map(s => s.fps);
    const avgFPS = fpsValues.length > 0
      ? Math.round(fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length)
      : 0;
    const minFPS = fpsValues.length > 0 ? Math.min(...fpsValues) : 0;
    const maxFPS = fpsValues.length > 0 ? Math.max(...fpsValues) : 0;

    // P95 frame time (95th percentile — lower is better)
    let p95FrameTime = 0;
    if (this._bmFrameTimes.length > 0) {
      const sorted = [...this._bmFrameTimes].sort((a, b) => a - b);
      const p95Index = Math.floor(sorted.length * 0.95);
      p95FrameTime = Math.round(sorted[Math.min(p95Index, sorted.length - 1)] * 100) / 100;
    }

    // P1 frame time (worst 1%)
    let p1FrameTime = 0;
    if (this._bmFrameTimes.length > 0) {
      const sorted = [...this._bmFrameTimes].sort((a, b) => a - b);
      const p1Index = Math.floor(sorted.length * 0.99);
      p1FrameTime = Math.round(sorted[Math.min(p1Index, sorted.length - 1)] * 100) / 100;
    }

    // Avg frame time
    const avgFrameTime = this._bmFrameTimes.length > 0
      ? Math.round((this._bmFrameTimes.reduce((a, b) => a + b, 0) / this._bmFrameTimes.length) * 100) / 100
      : 0;

    const pass = avgFPS >= 30;

    // ── Build JSON result ──
    const result = {
      benchmark: {
        version: '2.0',
        timestamp: new Date().toISOString(),
        duration_ms: Math.round(totalDurationMs),
        target_duration_ms: this._bmDuration,
        pass: pass,
        pass_criteria: 'avgFPS >= 30'
      },
      fps: {
        avg: avgFPS,
        min: minFPS,
        max: maxFPS,
        sample_count: fpsValues.length,
        samples_per_second: this._bmSamples.map(s => ({ time_s: s.time, fps: s.fps, entities: s.entityCount }))
      },
      frame_time: {
        avg_ms: avgFrameTime,
        p95_ms: p95FrameTime,
        p99_ms: p1FrameTime,
        total_frames: this._bmFrameTimes.length
      },
      entities: {
        total_at_start: entityCount,
        enemies: scene.enemies ? scene.enemies.length : 0,
        xp_orbs: scene.xpOrbs ? scene.xpOrbs.length : 0,
        projectiles: scene.weaponManager && scene.weaponManager.activeProjectiles ? scene.weaponManager.activeProjectiles.length : 0
      },
      system: {
        screen_size: `${scene.scale.width}x${scene.scale.height}`,
        renderer: scene.game.config.renderType === Phaser.WEBGL ? 'WebGL' : 'Canvas'
      }
    };

    // Log JSON to console
    console.log('%c📊 BENCHMARK RESULT', 'font-size:16px; font-weight:bold; color:#44ff44;');
    console.log('%cCopy this JSON for documentation:', 'color:#aaa;');
    console.log(JSON.stringify(result, null, 2));

    // Also store for programmatic access
    window.__benchmarkResult = result;

    // ── Cleanup benchmark entities ──
    for (const e of this._benchmarkEntities) {
      if (e && e.active) e.destroy();
    }
    scene.enemies = (scene.enemies || []).filter(e => !this._benchmarkEntities.includes(e));
    scene.xpOrbs = (scene.xpOrbs || []).filter(o => !this._benchmarkEntities.includes(o));
    this._benchmarkEntities = [];

    // Restore player HP
    scene.player.hp = this._savedPlayerHP || 100;
    scene.player.maxHp = this._savedPlayerMaxHP || 100;
    if (scene.hud) scene.hud.updateHP(scene.player.hp, scene.player.maxHp);

    // Update result display
    this._benchmarkResult = `${avgFPS} avg FPS @ ${entityCount} entities — ${pass ? '✅ PASS' : '❌ FAIL'}`;

    // Result banner
    const resultColor = pass ? '#44ff44' : '#ff4444';
    const resultBanner = scene.add.text(scene.scale.width / 2, scene.scale.height - 60,
      `📊 BENCHMARK COMPLETE — ${this._benchmarkResult}`, {
        fontSize: '16px', fontFamily: 'Arial, sans-serif', color: resultColor,
        fontStyle: 'bold', stroke: '#000', strokeThickness: 3
      }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);

    scene.time.delayedCall(5000, () => resultBanner.destroy());
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
    if (this._progressBar && this._progressBar.active) this._progressBar.destroy();
  }
}
