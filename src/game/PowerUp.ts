import { view } from '../config';

export type PowerId = 'multi3' | 'double' | 'wide' | 'narrow' | 'fire' | 'magnet' | 'laser' | 'shield' | 'slow' | 'life';

export interface PowerInfo {
  id: PowerId;
  label: string;
  name: string;
  color: string;
  weight: number;
  good: boolean;
}

export const POWERS: PowerInfo[] = [
  { id: 'multi3', label: '+3', name: '+3 BOLAS', color: '#4dd2ff', weight: 5, good: true },
  { id: 'double', label: 'x2', name: 'BOLAS x2', color: '#7c7cff', weight: 2.4, good: true },
  { id: 'wide', label: '<>', name: 'PALA ANCHA', color: '#5ee06a', weight: 1.8, good: true },
  { id: 'narrow', label: '><', name: 'PALA ESTRECHA', color: '#ff4d4d', weight: 1.0, good: false },
  { id: 'fire', label: 'F', name: 'BOLA DE FUEGO', color: '#ff8a1f', weight: 1.2, good: true },
  { id: 'magnet', label: 'M', name: 'IMÁN', color: '#ff5ad1', weight: 0.9, good: true },
  { id: 'laser', label: 'L', name: 'LÁSER', color: '#ff3b3b', weight: 1.2, good: true },
  { id: 'shield', label: 'S', name: 'ESCUDO', color: '#3df0c2', weight: 1.1, good: true },
  { id: 'slow', label: 'Z', name: 'RALENTIZAR', color: '#c9d0de', weight: 0.9, good: true },
  { id: 'life', label: '♥', name: 'VIDA EXTRA', color: '#ff6b9a', weight: 0.25, good: true },
];

const TOTAL_WEIGHT = POWERS.reduce((s, p) => s + p.weight, 0);

export function randomPower(): PowerInfo {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const p of POWERS) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return POWERS[0];
}

export class PowerUp {
  alive = true;
  vy = 55;
  t = 0;
  constructor(
    public x: number,
    public y: number,
    public info: PowerInfo,
  ) {}

  update(dt: number): void {
    this.t += dt;
    this.y += this.vy * dt;
    if (this.y > view.H + 10) this.alive = false;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const x = Math.round(this.x - 7);
    const y = Math.round(this.y - 4);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x + 1, y + 1, 14, 8);
    ctx.fillStyle = this.info.color;
    ctx.fillRect(x, y, 14, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(x, y, 14, 1);
    if (Math.floor(this.t * 6) % 2 === 0) ctx.fillRect(x, y, 1, 8);
    ctx.fillStyle = '#10131f';
    ctx.font = 'bold 7px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.info.label, x + 7, y + 4.5);
  }
}
