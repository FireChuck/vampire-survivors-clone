// ObjectPool.js — Generic Object Pool for performance
// Reuses objects instead of creating/destroying them every frame

class ObjectPool {
  constructor(createFn, resetFn, initialSize) {
    this._createFn = createFn;
    this._resetFn = resetFn;
    this._pool = [];
    this._activeCount = 0;
    this._totalCreated = 0;

    // Pre-allocate pool objects
    // Skip on mobile — physics body creation at scene start causes main-thread freeze on Android Chrome
    const size = window.IS_MOBILE ? 0 : (initialSize || 10);
    for (let i = 0; i < size; i++) {
      const obj = this._createFn();
      obj.setActive(false);
      obj.setVisible(false);
      if (obj.body) obj.body.enable = false;
      this._pool.push(obj);
      this._totalCreated++;
    }
  }

  get() {
    let obj = this._pool.pop();
    if (!obj) {
      obj = this._createFn();
      this._totalCreated++;
    }
    this._resetFn(obj);
    obj.setActive(true);
    obj.setVisible(true);
    if (obj.body) obj.body.enable = true;
    // Re-add to display list when reactivated
    if (typeof obj.addToDisplayList === 'function') obj.addToDisplayList();
    this._activeCount++;
    return obj;
  }

  release(obj) {
    if (!obj) return;
    obj.setActive(false);
    obj.setVisible(false);
    if (obj.body) obj.body.enable = false;
    // Remove from display list so WebGL renderer skips it entirely
    if (typeof obj.removeFromDisplayList === 'function') obj.removeFromDisplayList();
    this._pool.push(obj);
    if (this._activeCount > 0) this._activeCount--;
  }

  get size() {
    return this._activeCount;
  }

  get totalCreated() {
    return this._totalCreated;
  }

  get poolSize() {
    return this._pool.length;
  }
}
