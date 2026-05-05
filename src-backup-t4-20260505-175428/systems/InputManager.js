// InputManager.js — Desktop WASD/Arrows + Custom Mobile Virtual Joystick + Pause Button
// Pure Phaser 3 touch implementation (no external dependencies)
// T3.3: Mobile-optimized layout — thumb-reach, 375px+ responsive, Portrait+Landscape

class InputManager {
  constructor(scene) {
    this.scene = scene;
    this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.movement = { x: 0, y: 0 };

    // Mobile joystick state
    this._joystickActive = false;
    this._joystickPointer = null;
    this._joystickBaseX = 0;
    this._joystickBaseY = 0;
    this._joystickThumbX = 0;
    this._joystickThumbY = 0;
    this._joystickVecX = 0;
    this._joystickVecY = 0;
    this._joystickMaxRadius = 60;
    this._joystickBaseRadius = 50;
    this._joystickThumbRadius = 25;

    // QoL: Touch sensitivity multiplier
    this._sensitivityMultiplier = 1.0;

    // Graphics objects (created lazily on first touch)
    this._joystickBase = null;
    this._joystickThumb = null;
    this._pauseBtn = null;
    this._pauseBtnText = null;
    this._benchmarkBtn = null;
    this._benchmarkBtnLabel = null;

    this._setupDesktop();

    if (this.isMobile) {
      this._setupMobile();
    }

    // Listen for orientation/resize
    this._resizeListener = () => {
      this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      if (this.isMobile && !this._pauseBtn) {
        this._setupMobile();
      }
      // Reposition buttons on resize/orientation change
      if (this.isMobile) {
        this._repositionMobileButtons();
      }
    };
    window.addEventListener('resize', this._resizeListener);
    if (screen.orientation) {
      screen.orientation.addEventListener('change', () => this._repositionMobileButtons());
    }
  }

  _setupDesktop() {
    this.cursors = this.scene.input.keyboard.createCursorKeys();
    this.wasd = this.scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    });

    // ESC key for pause (desktop)
    this.scene.input.keyboard.on('keydown-ESC', function() {
      if (this.scene._togglePause) this.scene._togglePause();
    }.bind(this));
  }

  _setupMobile() {
    var scene = this.scene;
    var self = this;

    // ── Create joystick graphics (initially hidden) ──
    this._joystickBase = scene.add.graphics().setDepth(90).setVisible(false);
    this._joystickThumb = scene.add.graphics().setDepth(91).setVisible(false);

    // ── Responsive sizing based on screen width ──
    var sw = scene.scale.width;
    var sh = scene.scale.height;
    var isSmall = sw < 420;
    var isPortrait = sh > sw;

    // Scale joystick for small screens
    if (isSmall) {
      this._joystickMaxRadius = 45;
      this._joystickBaseRadius = 38;
      this._joystickThumbRadius = 18;
    }

    // ── Create pause button (top-right) ──
    var btnSize = isSmall ? 38 : 44;
    var btnPad = isSmall ? 10 : 16;

    this._pauseBtn = scene.add.graphics().setDepth(90);
    this._drawPauseButton(sw - btnPad - btnSize / 2, btnPad + btnSize / 2, btnSize);
    this._pauseBtn.setInteractive(
      new Phaser.Geom.Circle(sw - btnPad - btnSize / 2, btnPad + btnSize / 2, btnSize / 2),
      Phaser.Geom.Circle.Contains
    );

    this._pauseBtnText = scene.add.text(sw - btnPad - btnSize / 2, btnPad + btnSize / 2, '\u23F8', {
      fontSize: isSmall ? '16px' : '20px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(91).setScrollFactor(0);

    // Pause button tap handler
    this._pauseBtn.on('pointerdown', function() {
      if (scene._togglePause) scene._togglePause();
    });

    // ── Benchmark button (below pause) ──
    var benchBtnY = btnPad + btnSize + btnPad;
    this._benchmarkBtn = scene.add.graphics().setDepth(90);
    this._drawBenchmarkButton(sw - btnPad - btnSize / 2, benchBtnY + btnSize / 2, btnSize);
    this._benchmarkBtn.setInteractive(
      new Phaser.Geom.Circle(sw - btnPad - btnSize / 2, benchBtnY + btnSize / 2, btnSize / 2),
      Phaser.Geom.Circle.Contains
    );

    this._benchmarkBtnLabel = scene.add.text(sw - btnPad - btnSize / 2, benchBtnY + btnSize / 2, 'B', {
      fontSize: isSmall ? '13px' : '15px',
      fontFamily: 'monospace',
      color: '#aaa',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(91).setScrollFactor(0);

    this._benchmarkBtn.on('pointerdown', function() {
      if (scene.performanceOverlay) scene.performanceOverlay.toggle();
    });

    // ── Touch handling for joystick ──
    scene.input.on('pointerdown', function(pointer) {
      if (self._joystickActive) return;

      var screenW = scene.scale.width;
      var screenH = scene.scale.height;

      // Joystick zone: left 50% of screen, below 35% from top
      // This avoids overlap with HUD elements and ability bar
      if (pointer.x < screenW * 0.5 && pointer.y > screenH * 0.35) {
        self._joystickActive = true;
        self._joystickPointer = pointer.id;
        self._joystickBaseX = pointer.x;
        self._joystickBaseY = pointer.y;
        self._joystickThumbX = pointer.x;
        self._joystickThumbY = pointer.y;
        self._joystickVecX = 0;
        self._joystickVecY = 0;

        self._drawJoystick();
        self._joystickBase.setVisible(true);
        self._joystickThumb.setVisible(true);
      }
    });

    scene.input.on('pointermove', function(pointer) {
      if (!self._joystickActive || pointer.id !== self._joystickPointer) return;

      var dx = pointer.x - self._joystickBaseX;
      var dy = pointer.y - self._joystickBaseY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var maxR = self._joystickMaxRadius;

      if (dist > maxR) {
        dx = (dx / dist) * maxR;
        dy = (dy / dist) * maxR;
        dist = maxR;
      }

      self._joystickThumbX = self._joystickBaseX + dx;
      self._joystickThumbY = self._joystickBaseY + dy;

      if (dist > 0) {
        self._joystickVecX = dx / maxR * self._sensitivityMultiplier;
        self._joystickVecY = dy / maxR * self._sensitivityMultiplier;
        // Clamp to max 1.0
        const vecLen = Math.sqrt(self._joystickVecX * self._joystickVecX + self._joystickVecY * self._joystickVecY);
        if (vecLen > 1) {
          self._joystickVecX /= vecLen;
          self._joystickVecY /= vecLen;
        }
      } else {
        self._joystickVecX = 0;
        self._joystickVecY = 0;
      }

      self._drawJoystick();
    });

    scene.input.on('pointerup', function(pointer) {
      if (!self._joystickActive || pointer.id !== self._joystickPointer) return;

      self._joystickActive = false;
      self._joystickPointer = null;
      self._joystickVecX = 0;
      self._joystickVecY = 0;

      self._joystickBase.setVisible(false);
      self._joystickThumb.setVisible(false);
    });

    scene.input.on('gameout', function() {
      if (self._joystickActive) {
        self._joystickActive = false;
        self._joystickPointer = null;
        self._joystickVecX = 0;
        self._joystickVecY = 0;
        self._joystickBase.setVisible(false);
        self._joystickThumb.setVisible(false);
      }
    });
  }

  /** Reposition mobile buttons on resize/orientation change */
  _repositionMobileButtons() {
    var scene = this.scene;
    var sw = scene.scale.width;
    var sh = scene.scale.height;
    var isSmall = sw < 420;
    var btnSize = isSmall ? 38 : 44;
    var btnPad = isSmall ? 10 : 16;

    // Scale joystick for small screens
    if (isSmall) {
      this._joystickMaxRadius = 45;
      this._joystickBaseRadius = 38;
      this._joystickThumbRadius = 18;
    } else {
      this._joystickMaxRadius = 60;
      this._joystickBaseRadius = 50;
      this._joystickThumbRadius = 25;
    }

    // Pause button position
    var pauseX = sw - btnPad - btnSize / 2;
    var pauseY = btnPad + btnSize / 2;

    if (this._pauseBtn) {
      this._pauseBtn.clear();
      this._drawPauseButton(pauseX, pauseY, btnSize);
      this._pauseBtn.setPosition(pauseX, pauseY);
      this._pauseBtn.hitArea = new Phaser.Geom.Circle(pauseX, pauseY, btnSize / 2);
    }
    if (this._pauseBtnText) {
      this._pauseBtnText.setPosition(pauseX, pauseY);
      this._pauseBtnText.setFontSize(isSmall ? '16px' : '20px');
    }

    // Benchmark button position
    var benchBtnY = btnPad + btnSize + btnPad;
    if (this._benchmarkBtn) {
      this._benchmarkBtn.clear();
      this._drawBenchmarkButton(sw - btnPad - btnSize / 2, benchBtnY + btnSize / 2, btnSize);
      this._benchmarkBtn.setPosition(sw - btnPad - btnSize / 2, benchBtnY + btnSize / 2);
      this._benchmarkBtn.hitArea = new Phaser.Geom.Circle(sw - btnPad - btnSize / 2, benchBtnY + btnSize / 2, btnSize / 2);
    }
    if (this._benchmarkBtnLabel) {
      this._benchmarkBtnLabel.setPosition(sw - btnPad - btnSize / 2, benchBtnY + btnSize / 2);
    }
  }

  _drawJoystick() {
    var base = this._joystickBase;
    var thumb = this._joystickThumb;
    var bR = this._joystickBaseRadius;
    var tR = this._joystickThumbRadius;

    base.clear();
    base.fillStyle(0xffffff, 0.12);
    base.lineStyle(2, 0xffffff, 0.25);
    base.fillCircle(this._joystickBaseX, this._joystickBaseY, bR);
    base.strokeCircle(this._joystickBaseX, this._joystickBaseY, bR);

    thumb.clear();
    thumb.fillStyle(0xffffff, 0.4);
    thumb.fillCircle(this._joystickThumbX, this._joystickThumbY, tR);
  }

  _drawPauseButton(cx, cy, size) {
    var btn = this._pauseBtn;
    var half = size / 2;

    btn.clear();
    btn.fillStyle(0x000000, 0.5);
    btn.fillRoundedRect(cx - half, cy - half, size, size, 10);

    var barW = 5;
    var barH = 18;
    var gap = 6;
    btn.fillStyle(0xffffff, 0.9);
    btn.fillRect(cx - gap - barW, cy - barH / 2, barW, barH);
    btn.fillRect(cx + gap, cy - barH / 2, barW, barH);
  }

  _drawBenchmarkButton(cx, cy, size) {
    var btn = this._benchmarkBtn;
    var half = size / 2;

    btn.clear();
    btn.fillStyle(0x000000, 0.5);
    btn.fillRoundedRect(cx - half, cy - half, size, size, 10);
    btn.lineStyle(1, 0x44ff44, 0.3);
    btn.strokeRoundedRect(cx - half, cy - half, size, size, 10);
  }

  getMovementVector() {
    var x = 0, y = 0;

    if (this.cursors) {
      if (this.cursors.left.isDown || (this.wasd && this.wasd.left.isDown)) x -= 1;
      if (this.cursors.right.isDown || (this.wasd && this.wasd.right.isDown)) x += 1;
      if (this.cursors.up.isDown || (this.wasd && this.wasd.up.isDown)) y -= 1;
      if (this.cursors.down.isDown || (this.wasd && this.wasd.down.isDown)) y += 1;
    }

    if (this._joystickActive) {
      var jx = this._joystickVecX;
      var jy = this._joystickVecY;
      if (Math.abs(jx) > 0.05 || Math.abs(jy) > 0.05) {
        x = jx;
        y = jy;
      }
    }

    var len = Math.sqrt(x * x + y * y);
    if (len > 1) {
      x /= len;
      y /= len;
    }

    this.movement.x = x;
    this.movement.y = y;
    return this.movement;
  }

  destroy() {
    if (this._joystickBase) { this._joystickBase.destroy(); this._joystickBase = null; }
    if (this._joystickThumb) { this._joystickThumb.destroy(); this._joystickThumb = null; }
    if (this._pauseBtn) { this._pauseBtn.destroy(); this._pauseBtn = null; }
    if (this._pauseBtnText) { this._pauseBtnText.destroy(); this._pauseBtnText = null; }
    if (this._benchmarkBtn) { this._benchmarkBtn.destroy(); this._benchmarkBtn = null; }
    if (this._benchmarkBtnLabel) { this._benchmarkBtnLabel.destroy(); this._benchmarkBtnLabel = null; }
    if (this._resizeListener) {
      window.removeEventListener('resize', this._resizeListener);
    }
  }
}
