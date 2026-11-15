import { W, view } from '../config';
import type { App } from '../core/App';
import { playMusic, sfx, unlockAudio } from '../core/audio';
import { save, totalStars } from '../core/save';
import type { Pointer } from '../core/Scene';
import { shade, star, text } from '../core/ui';
import { LEVELS, WORLDS, type LevelDef } from '../game/levels';
import { GameScene } from './GameScene';
import { MenuScene } from './MenuScene';
import { UiScene } from './UiScene';

// Posiciones de los 6 nodos del mapa (camino en zigzag, de abajo a arriba)
const NODES = [
  { x: 56, y: 0.86 },
  { x: 150, y: 0.74 },
  { x: 70, y: 0.6 },
  { x: 170, y: 0.47 },
  { x: 84, y: 0.34 },
  { x: 120, y: 0.17 },
];

/** Selector de niveles: un mapa por mundo, con candados y estrellas. */
export class LevelSelectScene extends UiScene {
  private swipeX: number | null = null;

  constructor(
    app: App,
    private world = 0,
  ) {
    super(app);
    this.world = Math.max(0, Math.min(WORLDS.length - 1, world));
  }

  enter(): void {
    playMusic(0);
    this.buttons.list.length = 0;
    const H = view.H;
    const back = this.addButton('MENÚ', H - 30, () => this.app.scenes.set(new MenuScene(this.app)), 60, 20, 8);
    back.color = '#b9c0e0';
    back.size = 8;
    const prev = this.addButton('<', H - 30, () => this.go(-1), 30, 20, W - 76);
    const next = this.addButton('>', H - 30, () => this.go(1), 30, 20, W - 38);
    prev.enabled = this.world > 0;
    next.enabled = this.world < WORLDS.length - 1;
  }

  private go(d: number): void {
    const w = this.world + d;
    if (w < 0 || w >= WORLDS.length) return;
    this.world = w;
    this.enter();
  }

  private unlocked(l: LevelDef): boolean {
    return this.app.debug || l.index < save.unlocked;
  }

  private nodePos(i: number): { x: number; y: number } {
    const top = 44;
    const bottom = view.H - 44;
    return { x: NODES[i].x, y: Math.round(top + NODES[i].y * (bottom - top)) };
  }

  onPointerDown(p: Pointer): void {
    super.onPointerDown(p);
    this.swipeX = p.x;
  }

  onPointerUp(p: Pointer): void {
    super.onPointerUp(p);
    if (this.swipeX !== null && Math.abs(p.x - this.swipeX) > 50) {
      this.go(p.x < this.swipeX ? 1 : -1);
      this.swipeX = null;
      return;
    }
    this.swipeX = null;
    const levels = WORLDS[this.world].levels;
    for (let i = 0; i < levels.length && i < NODES.length; i++) {
      const n = this.nodePos(i);
      if (Math.abs(p.x - n.x) < 17 && Math.abs(p.y - n.y) < 17) {
        unlockAudio();
        if (this.unlocked(levels[i])) {
          sfx('click');
          this.app.scenes.set(new GameScene(this.app, levels[i]));
        } else sfx('bad');
        return;
      }
    }
  }

  onKey(key: string): void {
    if (key === 'ArrowLeft') this.go(-1);
    else if (key === 'ArrowRight') this.go(1);
    else if (key === 'd') this.app.debug = !this.app.debug;
  }

  onBack(): boolean {
    this.app.scenes.set(new MenuScene(this.app));
    return true;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const H = view.H;
    const world = WORLDS[this.world];
    const th = world.theme;
    ctx.fillStyle = th.bg;
    ctx.fillRect(0, 0, W, H);
    // Fondo decorativo de celdas
    for (let i = 0; i < 60; i++) {
      const x = ((i * 53) % 40) * 6;
      const y = 40 + ((i * 97) % Math.floor((H - 90) / 6)) * 6;
      ctx.fillStyle = shade(th.cells[i % th.cells.length], -0.55);
      ctx.fillRect(x, y, 5, 5);
    }
    // Cabecera
    ctx.fillStyle = '#0b0d14';
    ctx.fillRect(0, 0, W, 34);
    ctx.fillStyle = th.accent;
    ctx.fillRect(0, 33, W, 1);
    text(ctx, `MUNDO ${world.id}`, 8, 10, { size: 7, color: '#b9c0e0' });
    text(ctx, world.name.toUpperCase(), 8, 23, { size: 12, color: th.accent });
    star(ctx, W - 50, 17, 6, '#ffd23f');
    text(ctx, `${totalStars()}/${LEVELS.length * 3}`, W - 41, 17, { size: 8, color: '#ffe14d' });

    // Camino
    const levels = world.levels;
    ctx.fillStyle = shade(th.accent, -0.5);
    for (let i = 0; i < levels.length - 1 && i < NODES.length - 1; i++) {
      const a = this.nodePos(i);
      const b = this.nodePos(i + 1);
      const steps = Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / 7);
      for (let s = 1; s < steps; s++) {
        ctx.fillRect(Math.round(a.x + ((b.x - a.x) * s) / steps) - 1, Math.round(a.y + ((b.y - a.y) * s) / steps) - 1, 3, 3);
      }
    }
    // Nodos
    levels.forEach((l, i) => {
      if (i >= NODES.length) return;
      const n = this.nodePos(i);
      const open = this.unlocked(l);
      const rec = save.levels[l.id];
      const boss = !!l.boss;
      const r = boss ? 15 : 12;
      const current = open && !rec;
      const bob = current ? Math.round(Math.sin(this.t * 4) * 2) : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(n.x - r + 2, n.y - r + 3, r * 2, r * 2);
      ctx.fillStyle = open ? (boss ? '#ff6b6b' : th.accent) : '#3a4058';
      ctx.fillRect(n.x - r, n.y - r + bob, r * 2, r * 2);
      ctx.fillStyle = open ? (boss ? '#7a1f1f' : shade(th.accent, -0.6)) : '#262b40';
      ctx.fillRect(n.x - r + 2, n.y - r + 2 + bob, r * 2 - 4, r * 2 - 4);
      if (open) {
        text(ctx, boss ? 'JEFE' : `${l.num}`, n.x, n.y + bob, { size: boss ? 8 : 12, align: 'center', color: '#ffffff' });
        for (let s = 0; s < 3; s++) star(ctx, n.x + (s - 1) * 9, n.y + r + 7, 4, rec && s < rec.stars ? '#ffd23f' : '#2c3350');
        text(ctx, l.name, n.x, n.y - r - 6, { size: 6, align: 'center', color: '#e8ecff' });
      } else {
        // Candado
        ctx.fillStyle = '#8a93a6';
        ctx.fillRect(n.x - 4, n.y - 1, 8, 7);
        ctx.fillRect(n.x - 3, n.y - 5, 1, 4);
        ctx.fillRect(n.x + 2, n.y - 5, 1, 4);
        ctx.fillRect(n.x - 3, n.y - 6, 6, 1);
        ctx.fillStyle = '#262b40';
        ctx.fillRect(n.x - 1, n.y + 1, 2, 3);
      }
    });

    // Paginación
    for (let i = 0; i < WORLDS.length; i++) {
      ctx.fillStyle = i === this.world ? th.accent : '#3a4058';
      ctx.fillRect(W / 2 - WORLDS.length * 4 + i * 8 - 12, H - 22, 5, 5);
    }
    this.buttons.draw(ctx);
  }
}
