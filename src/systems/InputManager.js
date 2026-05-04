// InputManager.js — Desktop WASD/Arrows + Mobile nipplejs Joystick

class InputManager {
    constructor(scene) {
        this.scene = scene;
        this.isMobile = 'ontouchstart' in window;
        this.movement = { x: 0, y: 0 };

        if (this.isMobile) {
            this._setupMobile();
        } else {
            this._setupDesktop();
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
    }

    _setupMobile() {
        this.joystickVector = { x: 0, y: 0 };

        // nipplejs zone — bottom-left area
        this.joystickZone = nipplejs.create({
            zone: this.scene.game.canvas,
            mode: 'static',
            position: { left: '50%', bottom: '20%' },
            color: 'rgba(255,255,255,0.3)',
            size: 120
        });

        this.joystickZone.on('move', (evt, data) => {
            this.joystickVector.x = data.direction.x === 'left' ? -data.force : (data.direction.x === 'right' ? data.force : 0);
            this.joystickVector.y = data.direction.y === 'up' ? -data.force : (data.direction.y === 'down' ? data.force : 0);
        });

        this.joystickZone.on('end', () => {
            this.joystickVector.x = 0;
            this.joystickVector.y = 0;
        });
    }

    getMovementVector() {
        let x = 0, y = 0;

        if (this.isMobile) {
            x = this.joystickVector.x;
            y = this.joystickVector.y;
        } else {
            if (this.cursors.left.isDown || this.wasd.left.isDown) x -= 1;
            if (this.cursors.right.isDown || this.wasd.right.isDown) x += 1;
            if (this.cursors.up.isDown || this.wasd.up.isDown) y -= 1;
            if (this.cursors.down.isDown || this.wasd.down.isDown) y += 1;
        }

        // Normalize diagonal movement
        const len = Math.sqrt(x * x + y * y);
        if (len > 0) {
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
        }
    }
}
