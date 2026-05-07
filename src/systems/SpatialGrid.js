// SpatialGrid.js — Grid-based spatial partitioning for fast proximity queries
// Divides the world into cells; entities are inserted by position.
// query() and queryRect() return only entities in relevant cells.

class SpatialGrid {
  constructor(cellSize, worldWidth, worldHeight) {
    this.cellSize = cellSize || 128;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    // Offset to convert world coords (centered) to grid indices
    this._offsetX = worldWidth / 2;
    this._offsetY = worldHeight / 2;

    this.cols = Math.ceil(worldWidth / this.cellSize);
    this.rows = Math.ceil(worldHeight / this.cellSize);

    // Flat array: cells[col * rows + row] = [entity, ...]
    this._cells = new Array(this.cols * this.rows);
    this._entityCell = new Map(); // entity -> cell index

    // Dirty flag — skip rebuild when nothing moved
    this._dirty = true;
  }

  /** Mark grid as needing rebuild (call when entities move) */
  markDirty() {
    this._dirty = true;
  }

  /** Returns true if rebuild is needed */
  get needsRebuild() {
    return this._dirty;
  }

  clear() {
    // Fast clear: only null out cells that were actually populated
    // instead of iterating all cells (1457 for 6000x4000 @ 128px cells)
    if (this._entityCell.size === 0) {
      this._dirty = false;
      return;
    }
    // Clear only occupied cells using the entityCell map
    for (const idx of this._entityCell.values()) {
      this._cells[idx] = null;
    }
    this._entityCell.clear();
    this._dirty = false;
  }

  _toCell(x, y) {
    const col = Math.floor((x + this._offsetX) / this.cellSize);
    const row = Math.floor((y + this._offsetY) / this.cellSize);
    return { col, row };
  }

  _cellIndex(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return -1;
    return col * this.rows + row;
  }

  insert(entity) {
    if (!entity || !entity.active) return;
    const { col, row } = this._toCell(entity.x, entity.y);
    const idx = this._cellIndex(col, row);
    if (idx === -1) return;

    if (!this._cells[idx]) this._cells[idx] = [];
    this._cells[idx].push(entity);
    this._entityCell.set(entity, idx);
  }

  // Remove entity from grid (e.g. when deactivated)
  remove(entity) {
    const idx = this._entityCell.get(entity);
    if (idx === undefined) return;
    const cell = this._cells[idx];
    if (cell) {
      const i = cell.indexOf(entity);
      if (i !== -1) cell.splice(i, 1);
    }
    this._entityCell.delete(entity);
  }

  query(x, y, radius) {
    const r2 = radius * radius;
    const minC = Math.max(0, Math.floor((x + this._offsetX - radius) / this.cellSize));
    const maxC = Math.min(this.cols - 1, Math.floor((x + this._offsetX + radius) / this.cellSize));
    const minR = Math.max(0, Math.floor((y + this._offsetY - radius) / this.cellSize));
    const maxR = Math.min(this.rows - 1, Math.floor((y + this._offsetY + radius) / this.cellSize));

    const results = [];
    for (let c = minC; c <= maxC; c++) {
      for (let r = minR; r <= maxR; r++) {
        const cell = this._cells[c * this.rows + r];
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) {
          const e = cell[i];
          if (!e || !e.active) continue;
          const dx = e.x - x;
          const dy = e.y - y;
          if (dx * dx + dy * dy <= r2) {
            results.push(e);
          }
        }
      }
    }
    return results;
  }

  queryRect(x, y, w, h) {
    const minC = Math.max(0, Math.floor((x + this._offsetX - w / 2) / this.cellSize));
    const maxC = Math.min(this.cols - 1, Math.floor((x + this._offsetX + w / 2) / this.cellSize));
    const minR = Math.max(0, Math.floor((y + this._offsetY - h / 2) / this.cellSize));
    const maxR = Math.min(this.rows - 1, Math.floor((y + this._offsetY + h / 2) / this.cellSize));

    const results = [];
    for (let c = minC; c <= maxC; c++) {
      for (let r = minR; r <= maxR; r++) {
        const cell = this._cells[c * this.rows + r];
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) {
          const e = cell[i];
          if (e && e.active) results.push(e);
        }
      }
    }
    return results;
  }
}
