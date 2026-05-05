// ScreenTransition.js — Reusable screen transition effects (static, optional)
// Effects: fade-black, fade-white, curtain, circle-wipe
// Usage: ScreenTransition.transitionTo(this.scene, 'GameScene', data, 'curtain', 600);

var ScreenTransition = (function() {
  var _active = false;
  var _overlay = null;
  var _graphics = null;
  var _scene = null;

  var EFFECTS = ['fade-black', 'fade-white', 'curtain', 'circle-wipe'];

  // ── Main entry point ──
  function transitionTo(scene, targetKey, data, effect, duration) {
    if (_active) return;
    _active = true;
    _scene = scene;

    effect = effect || 'fade-black';
    duration = duration || 500;
    if (EFFECTS.indexOf(effect) === -1) effect = 'fade-black';

    // Create fullscreen overlay
    _overlay = scene.add.rectangle(
      scene.scale.width / 2, scene.scale.height / 2,
      scene.scale.width, scene.scale.height, 0x000000, 0
    ).setScrollFactor(0).setDepth(9999).setInteractive();

    _graphics = scene.add.graphics().setScrollFactor(0).setDepth(10000);

    fadeOut(function() {
      scene.scene.start(targetKey, data);
      // Re-acquire after scene restart
      scene.scene.get(targetKey).events.once('create', function() {
        var newScene = scene.scene.get(targetKey);
        _scene = newScene;
        _overlay = newScene.add.rectangle(
          newScene.scale.width / 2, newScene.scale.height / 2,
          newScene.scale.width, newScene.scale.height,
          effect === 'fade-white' ? 0xffffff : 0x000000, 1
        ).setScrollFactor(0).setDepth(9999).setInteractive();

        _graphics = newScene.add.graphics().setScrollFactor(0).setDepth(10000);
        fadeIn(duration, effect, function() {
          cleanup();
        });
      });
    }, duration, effect);
  }

  // ── Fade Out (cover screen) ──
  function fadeOut(onComplete, duration, effect) {
    var sw = _scene.scale.width;
    var sh = _scene.scale.height;
    var color = effect === 'fade-white' ? 0xffffff : 0x000000;

    switch (effect) {
      case 'fade-black':
      case 'fade-white':
        _overlay.setFillStyle(color, 0);
        _scene.tweens.add({
          targets: _overlay,
          alpha: 1,
          duration: duration,
          onComplete: onComplete
        });
        break;

      case 'curtain':
        // Two vertical strips closing from left/right
        var leftCurtain = _scene.add.rectangle(sw / 4, sh / 2, sw / 2, sh, color, 1)
          .setScrollFactor(0).setDepth(10000);
        var rightCurtain = _scene.add.rectangle(sw * 3 / 4, sh / 2, sw / 2, sh, color, 1)
          .setScrollFactor(0).setDepth(10000);

        leftCurtain.x = -sw / 4;
        rightCurtain.x = sw + sw / 4;

        _scene.tweens.add({
          targets: leftCurtain,
          x: sw / 4,
          duration: duration,
          ease: 'Power2.easeIn'
        });
        _scene.tweens.add({
          targets: rightCurtain,
          x: sw * 3 / 4,
          duration: duration,
          ease: 'Power2.easeIn',
          onComplete: function() {
            leftCurtain.destroy();
            rightCurtain.destroy();
            onComplete();
          }
        });
        break;

      case 'circle-wipe':
        var maxRadius = Math.sqrt(sw * sw + sh * sh);
        _graphics.clear();
        _graphics.fillStyle(color, 1);

        var step = { r: 0 };
        _scene.tweens.add({
          targets: step,
          r: maxRadius,
          duration: duration,
          ease: 'Power2.easeIn',
          onUpdate: function() {
            _graphics.clear();
            _graphics.fillStyle(color, 1);
            _graphics.fillCircle(sw / 2, sh / 2, Math.max(1, step.r));
          },
          onComplete: onComplete
        });
        break;
    }
  }

  // ── Fade In (reveal screen) ──
  function fadeIn(duration, effect, onComplete) {
    var sw = _scene.scale.width;
    var sh = _scene.scale.height;
    var color = effect === 'fade-white' ? 0xffffff : 0x000000;

    switch (effect) {
      case 'fade-black':
      case 'fade-white':
        _scene.tweens.add({
          targets: _overlay,
          alpha: 0,
          duration: duration,
          onComplete: onComplete
        });
        break;

      case 'curtain':
        var leftCurtain = _scene.add.rectangle(sw / 4, sh / 2, sw / 2, sh, color, 1)
          .setScrollFactor(0).setDepth(10000);
        var rightCurtain = _scene.add.rectangle(sw * 3 / 4, sh / 2, sw / 2, sh, color, 1)
          .setScrollFactor(0).setDepth(10000);

        _scene.tweens.add({
          targets: leftCurtain,
          x: -sw / 4,
          duration: duration,
          ease: 'Power2.easeOut'
        });
        _scene.tweens.add({
          targets: rightCurtain,
          x: sw + sw / 4,
          duration: duration,
          ease: 'Power2.easeOut',
          onComplete: function() {
            leftCurtain.destroy();
            rightCurtain.destroy();
            onComplete();
          }
        });
        break;

      case 'circle-wipe':
        var maxRadius = Math.sqrt(sw * sw + sh * sh);
        var step = { r: maxRadius };
        _graphics.clear();
        _graphics.fillStyle(color, 1);
        _graphics.fillCircle(sw / 2, sh / 2, maxRadius);

        _scene.tweens.add({
          targets: step,
          r: 0,
          duration: duration,
          ease: 'Power2.easeOut',
          onUpdate: function() {
            _graphics.clear();
            _graphics.fillStyle(color, 1);
            _graphics.fillCircle(sw / 2, sh / 2, Math.max(1, step.r));
          },
          onComplete: onComplete
        });
        break;
    }
  }

  function cleanup() {
    if (_overlay && _overlay.active) _overlay.destroy();
    if (_graphics && _graphics.active) _graphics.destroy();
    _overlay = null;
    _graphics = null;
    _scene = null;
    _active = false;
  }

  return {
    transitionTo: transitionTo,
    EFFECTS: EFFECTS,
    get active() { return _active; }
  };
})();
