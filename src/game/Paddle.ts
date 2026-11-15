import { W, view } from '../config';

export class Paddle {
  x = W / 2;
  y = 0;
  h = 5;
  baseW = 38;
  w = 38;
  vx = 0;
  targetX = W / 2;
  /** Segundos de parálisis restantes. */
  stun = 0;
  wideT = 0;
  narrowT = 0;
  magnetT = 0;
  laserT = 0;
  laserCd = 0;
  slippery = false;
  flash = 0;

  reset(): void {
    this.x = this.targetX = W / 2;
    this.y = view.H - 30;
    this.vx = 0;
    this.stun = 0;
    this.wideT = this.narrowT = this.magnetT = this.laserT = 0;
    this.w = this.baseW;
  }

  get targetW(): number {
    if (this.wideT > 0) return this.baseW * 1.6;
    if (this.narrowT > 0) return this.baseW * 0.6;
    return this.baseW;
  }

  update(dt: number, keyDir: number): void {
    this.y = view.H - 30;
    this.wideT = Math.max(0, this.wideT - dt);
    this.narrowT = Math.max(0, this.narrowT - dt);
    this.magnetT = Math.max(0, this.magnetT - dt);
    this.laserT = Math.max(0, this.laserT - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.w += (this.targetW - this.w) * Math.min(1, dt * 12);
    const half = this.w / 2;
    if (this.stun > 0) {
      this.stun -= dt;
      this.vx = 0;
      this.targetX = this.x;
      return;
    }
    if (keyDir) this.targetX = this.x + keyDir * 200 * dt * (this.slippery ? 3 : 1);
    this.targetX = Math.max(half, Math.min(W - half, this.targetX));
    const prev = this.x;
    if (this.slippery) {
      // Sobre hielo la pala acelera y frena con inercia.
      this.vx += (this.targetX - this.x) * 250 * dt;
      this.vx *= Math.pow(1e-12, dt);
      this.x += this.vx * dt;
    } else {
      this.x += (this.targetX - this.x) * Math.min(1, dt * 40);
      this.vx = (this.x - prev) / dt;
    }
    if (this.x < half) {
      this.x = half;
      this.vx = 0;
    } else if (this.x > W - half) {
      this.x = W - half;
      this.vx = 0;
    }
  }

  draw(ctx: CanvasRenderingContext2D, accent: string, t: number): void {
    const x = Math.round(this.x - this.w / 2);
    const w = Math.round(this.w);
    const y = this.y;
    const stunned = this.stun > 0;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x + 1, y + 2, w, this.h);
    ctx.fillStyle = stunned ? '#6b7280' : this.flash > 0 ? '#ffffff' : '#e9edf7';
    ctx.fillRect(x, y, w, this.h);
    ctx.fillStyle = stunned ? '#4b5563' : accent;
    ctx.fillRect(x, y, 4, this.h);
    ctx.fillRect(x + w - 4, y, 4, this.h);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x, y + this.h - 1, w, 1);
    if (this.magnetT > 0) {
      ctx.fillStyle = '#ff5ad1';
      ctx.fillRect(x + 4, y - 1, w - 8, 1);
    }
    if (this.laserT > 0) {
      ctx.fillStyle = '#ff3b3b';
      ctx.fillRect(x + 1, y - 3, 2, 3);
      ctx.fillRect(x + w - 3, y - 3, 2, 3);
    }
    if (stunned) {
      // Estrellitas de aturdimiento
      ctx.fillStyle = '#ffe14d';
      for (let i = 0; i < 3; i++) {
        const a = t * 8 + (i * Math.PI * 2) / 3;
        ctx.fillRect(Math.round(this.x + Math.cos(a) * 10), Math.round(y - 5 + Math.sin(a) * 2), 2, 2);
      }
    }
  }
}
