/** Utilidades de dibujo de interfaz en canvas con estética píxel. */
export const FONT = 'ui-monospace, Menlo, Consolas, "Courier New", monospace';

export interface TextOpts {
  size?: number;
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  shadow?: string | null;
  bold?: boolean;
  alpha?: number;
}

export function text(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, o: TextOpts = {}): void {
  const size = o.size ?? 8;
  ctx.font = `${o.bold === false ? '' : 'bold '}${size}px ${FONT}`;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.baseline ?? 'middle';
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  if (o.shadow !== null) {
    ctx.fillStyle = o.shadow ?? 'rgba(0,0,0,0.6)';
    ctx.fillText(str, x + 1, y + 1);
  }
  ctx.fillStyle = o.color ?? '#fff';
  ctx.fillText(str, x, y);
  if (o.alpha !== undefined) ctx.globalAlpha = 1;
}

/** Parte un texto en líneas que caben en un ancho dado. */
export function wrap(ctx: CanvasRenderingContext2D, str: string, maxW: number, size: number): string[] {
  ctx.font = `bold ${size}px ${FONT}`;
  const out: string[] = [];
  let line = '';
  for (const word of str.split(' ')) {
    const t = line ? `${line} ${word}` : word;
    if (ctx.measureText(t).width > maxW && line) {
      out.push(line);
      line = word;
    } else line = t;
  }
  if (line) out.push(line);
  return out;
}

export function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill = '#161a2b', border = '#5d6bff'): void {
  ctx.fillStyle = '#000';
  ctx.fillRect(x + 2, y + 2, w, h);
  ctx.fillStyle = border;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
}

export class Button {
  pressed = false;
  enabled = true;
  visible = true;
  color = '#ffd166';
  textColor = '#141826';
  size = 9;
  constructor(
    public x: number,
    public y: number,
    public w: number,
    public h: number,
    public label: string,
    public onClick: () => void,
  ) {}

  hit(px: number, py: number): boolean {
    return this.visible && this.enabled && px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.visible) return;
    const off = this.pressed ? 2 : 0;
    ctx.globalAlpha = this.enabled ? 1 : 0.4;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(this.x, this.y + 3, this.w, this.h);
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y + off, this.w, this.h);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(this.x, this.y + off, this.w, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(this.x, this.y + off + this.h - 2, this.w, 2);
    text(ctx, this.label, this.x + this.w / 2, this.y + off + this.h / 2, {
      size: this.size,
      color: this.textColor,
      align: 'center',
      shadow: null,
    });
    ctx.globalAlpha = 1;
  }
}

/** Gestiona pulsaciones sobre un conjunto de botones. */
export class ButtonSet {
  list: Button[] = [];
  private active: Button | null = null;

  add(b: Button): Button {
    this.list.push(b);
    return b;
  }

  down(x: number, y: number): boolean {
    this.active = null;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i];
      if (b.hit(x, y)) {
        this.active = b;
        b.pressed = true;
        return true;
      }
    }
    return false;
  }

  up(x: number, y: number): Button | null {
    const b = this.active;
    this.active = null;
    if (!b) return null;
    b.pressed = false;
    if (b.hit(x, y)) {
      b.onClick();
      return b;
    }
    return null;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const b of this.list) b.draw(ctx);
  }
}

// --------------------------------------------------- fuente píxel (título) ---
const GLYPHS: Record<string, string[]> = {
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
};

/** Dibuja texto con bloques tipo ladrillo (solo letras de "GRID BREAKER"). */
export function pixelText(
  ctx: CanvasRenderingContext2D,
  str: string,
  cx: number,
  y: number,
  px: number,
  colors: string[],
  t = 0,
): void {
  const cw = 6 * px;
  let x = Math.round(cx - (str.length * cw - px) / 2);
  for (let n = 0; n < str.length; n++) {
    const g = GLYPHS[str[n]];
    if (g) {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 5; c++) {
          if (g[r][c] !== '1') continue;
          const bob = Math.round(Math.sin(t * 2 + n * 0.6) * 1.5);
          const col = colors[(r + n) % colors.length];
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(x + c * px + 1, y + r * px + bob + 1, px, px);
          ctx.fillStyle = col;
          ctx.fillRect(x + c * px, y + r * px + bob, px - 1, px - 1);
        }
      }
    }
    x += cw;
  }
}

// ------------------------------------------------------------- colores ---
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + (amt > 0 ? (255 - v) * amt : v * amt))));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}
