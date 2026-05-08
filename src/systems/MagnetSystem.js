// MagnetSystem.js — Vampire Survivors Clone
// Pulls XP gems toward the player within a level-scaled radius

class MagnetSystem {
  constructor(scene) {
    this.scene = scene;
    this.baseRadius = 80;
    this.perLevel = 10;
    this.maxRadius = 150;
    this.attractSpeed = 280;
  }

  getRadius() {
    const level = this.scene.player ? this.scene.player.level : 1;
    return Math.min(this.baseRadius + (level - 1) * this.perLevel, this.maxRadius);
  }

  update() {
    const player = this.scene.player;
    if (!player || !player.active) return;

    const magnetRadius = this.magnetRadius = this.getRadius();
    const magnetRadiusSq = magnetRadius * magnetRadius;
    const xpOrbs = this.scene.xpOrbs;
    const px = player.x;
    const py = player.y;

    for (let i = 0, len = xpOrbs.length; i < len; i++) {
      const orb = xpOrbs[i];
      orb._attracted = false;
      if (!orb || !orb.active || orb._attracted) continue;

      const dx = px - orb.x;
      const dy = py - orb.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < magnetRadiusSq) {
        const dist = Math.sqrt(distSq);
        // Speed scales: closer = faster (50% at edge, 100% at center)
        const factor = 1 - (dist / magnetRadius) * 0.5;
        const speed = this.attractSpeed * factor;
        orb.setVelocity(dx / dist * speed, dy / dist * speed);
        orb._attracted = true;
      }
    }
  }
}
