import { text } from '../core/ui';

const MAX = 700;

/** Sistema de partículas con arrays planos (sin reservas por fotograma). */
export class Particles {
  private x = new Float32Array(MAX);
  private y = new Float32Array(MAX);
  private vx = new Float32Array(MAX);
  private vy = new Float32Array(MAX);
  private life = new Float32Array(MAX);
  private max = new Float32Array(MAX);
  private size = new Uint8Array(MAX);
  private grav = new Float32Array(MAX);
  private color: string[] = new Array<string>(MAX).fill('#fff');
  private n = 0;
  private texts: { x: number; y: number; t: number; str: string; color: string; size: number }[] = [];

  spawn(x: number, y: number, vx: number, vy: number, life: number, color: string, size = 1, grav = 160): void {
    if (this.n >= MAX) return;
    const i = this.n++;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.life[i] = this.max[i] = life;
    this.color[i] = color;
    this.size[i] = size;
    this.grav[i] = grav;
  }

  burst(x: number, y: number, count: number, color: string, speed = 50, life = 0.4, size = 1): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s - 15, life * (0.5 + Math.random() * 0.5), color, size);
    }
  }

  floatText(x: number, y: number, str: string, color = '#fff', size = 7): void {
    if (this.texts.length > 24) this.texts.shift();
    this.texts.push({ x, y, t: 0, str, color, size });
  }

  clear(): void {
    this.n = 0;
    this.texts.length = 0;
  }

  update(dt: number): void {
    for (let i = this.n - 1; i >= 0; i--) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        // Sustituye por la última viva
        const l = --this.n;
        if (i !== l) {
          this.x[i] = this.x[l];
          this.y[i] = this.y[l];
          this.vx[i] = this.vx[l];
          this.vy[i] = this.vy[l];
          this.life[i] = this.life[l];
          this.max[i] = this.max[l];
          this.color[i] = this.color[l];
          this.size[i] = this.size[l];
          this.grav[i] = this.grav[l];
        }
        continue;
      }
      this.vy[i] += this.grav[i] * dt;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.t += dt;
      t.y -= 18 * dt;
      if (t.t > 0.9) this.texts.splice(i, 1);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    let last = '';
    for (let i = 0; i < this.n; i++) {
      const c = this.color[i];
      if (c !== last) {
        ctx.fillStyle = c;
        last = c;
      }
      const s = this.life[i] / this.max[i] < 0.35 ? 1 : this.size[i];
      ctx.fillRect(Math.round(this.x[i]), Math.round(this.y[i]), s, s);
    }
    for (const t of this.texts) {
      text(ctx, t.str, t.x, t.y, { size: t.size, color: t.color, align: 'center', alpha: Math.min(1, (0.9 - t.t) * 3) });
    }
  }
}
