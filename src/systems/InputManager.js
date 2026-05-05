// InputManager.js — Desktop WASD/Arrows + Mobile nipplejs Joystick
// Dynamic detection: switches mode if device changes

class InputManager {
  constructor(scene) {
    this.scene = scene;
    this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.movement = { x: 0, y: 0 };
    this.joystickZone = null;
    this._resizeListener = null;

    if (this.isMobile) {
      this._setupMobile();
    }
    // Desktop keyboard always works (doesn't hurt to have on mobile too)

    this._setupDesktop();

    // Listen for orientation/resize to re-detect
    this._resizeListener = () => {
      const wasMobile = this.isMobile;
      this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      if (this.isMobile && !wasMobile && !this.joystickZone) {
        this._setupMobile();
      }
    };
    window.addEventListener('resize', this._resizeListener);
  }

  _setupDesktop() {
    this.cursors = this.scene.input.keyboard.createCursorKeys();
    this.wasd = this.scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    });
  }

  _setupMobile() {
    // Only create joystick if nipplejs is available
    if (typeof nipplejs === 'undefined') {
      console.warn('nipplejs not loaded — mobile joystick unavailable');
      return;
    }

    this.joystickVector = { x: 0, y: 0 };

    // Create joystick zone on left side of screen
    this.joystickZone = nipplejs.create({
      zone: this.scene.game.canvas,
      mode: 'static',
      position: { left: '25%', bottom: '25%' },
      color: 'rgba(255,255,255,0.15)',
      size: 150,
      restOpacity: 0.4
    });

    this.joystickZone.on('move', (evt, data) => {
      if (data.direction) {
        this.joystickVector.x = data.direction.x === 'left' ? -data.force :
          (data.direction.x === 'right' ? data.force : 0);
        this.joystickVector.y = data.direction.y === 'up' ? -data.force :
          (data.direction.y === 'down' ? data.force : 0);
      }
    });

    this.joystickZone.on('end', () => {
      this.joystickVector.x = 0;
      this.joystickVector.y = 0;
    });
  }

  getMovementVector() {
    let x = 0, y = 0;

    // Desktop input (always active)
    if (this.cursors) {
      if (this.cursors.left.isDown || (this.wasd && this.wasd.left.isDown)) x -= 1;
      if (this.cursors.right.isDown || (this.wasd && this.wasd.right.isDown)) x += 1;
      if (this.cursors.up.isDown || (this.wasd && this.wasd.up.isDown)) y -= 1;
      if (this.cursors.down.isDown || (this.wasd && this.wasd.down.isDown)) y += 1;
    }

    // Mobile joystick (overrides desktop if active)
    if (this.isMobile && this.joystickVector) {
      const jx = this.joystickVector.x;
      const jy = this.joystickVector.y;
      if (Math.abs(jx) > 0.1 || Math.abs(jy) > 0.1) {
        x = jx;
        y = jy;
      }
    }

    // Normalize diagonal
    const len = Math.sqrt(x * x + y * y);
    if (len > 1) {
      x /= len;
      y /= len;
    }

    this.movement.x = x;
    this.movement.y = y;
    return this.movement;
  }

  destroy() {
    if (this.joystickZone) {
      this.joystickZone.destroy();
      this.joystickZone = null;
    }
    if (this._resizeListener) {
      window.removeEventListener('resize', this._resizeListener);
    }
  }
}
