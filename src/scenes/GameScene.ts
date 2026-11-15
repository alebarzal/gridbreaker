import { CELL, COLS, GRID_BOTTOM, GRID_Y, MAX_BALLS, W, view } from '../config';
import type { App } from '../core/App';
import { playMusic, sfx, unlockAudio } from '../core/audio';
import { haptic, keepAwake } from '../core/platform';
import { persist, save } from '../core/save';
import { Scene, type Pointer } from '../core/Scene';
import { text } from '../core/ui';
import { Ball } from '../game/Ball';
import { createBoss, type Boss } from '../game/bosses';
import { Cell, Grid, type Cause, type GridHost } from '../game/Grid';
import { LEVELS, type GravityDir, type LevelDef, type Theme } from '../game/levels';
import { Paddle } from '../game/Paddle';
import { Particles } from '../game/Particles';
import { POWERS, PowerUp, randomPower, type PowerInfo } from '../game/PowerUp';
import { Projectile, type ProjectileKind } from '../game/Projectile';
import { GameOverScene } from './GameOverScene';
import { PauseScene } from './PauseScene';
import { VictoryScene } from './VictoryScene';

const BASE_SPEED = 190;
const GRAV: Record<GravityDir, [number, number]> = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
const ARROW: Record<GravityDir, string> = { down: '↓', up: '↑', left: '←', right: '→' };

export interface LevelResult {
  level: LevelDef;
  score: number;
  stars: number;
  time: number;
  pct: number;
  livesLost: number;
  newBest: boolean;
  checks: { label: string; ok: boolean }[];
}

type Fx =
  | { kind: 'ring'; x: number; y: number; max: number; t: number; dur: number; color: string }
  | { kind: 'beam'; x1: number; y1: number; x2: number; y2: number; t: number; dur: number; color: string };

type State = 'ready' | 'play' | 'clearing' | 'over';

/** Escena de juego: simula y pinta una partida de un nivel. */
export class GameScene extends Scene implements GridHost {
  theme: Theme;
  grid = new Grid(this);
  paddle = new Paddle();
  balls: Ball[] = [];
  powerups: PowerUp[] = [];
  projectiles: Projectile[] = [];
  particles = new Particles();
  boss: Boss | null = null;

  state: State = 'ready';
  score = 0;
  lives = 3;
  livesLost = 0;
  time = 0;
  combo = 0;
  mult = 1;
  fireT = 0;
  slowT = 0;
  shieldOn = false;

  private t = 0;
  private shakeAmt = 0;
  private floatCd = 0;
  private sinceDrop = 0;
  private comboT = 0;
  private resumeT = 0;
  private broken = 0;
  private dryT = 0;
  private clearT = 0;
  private fx: Fx[] = [];
  private bannerMsg: { str: string; color: string; t: number } | null = null;
  // Gravedad
  private gDir: GravityDir | null = null;
  private gStrength = 0;
  private gT = 0;
  private gIdx = 0;
  private gWarned = false;
  // Entrada
  private pid = -1;
  private lastX = 0;
  private moved = 0;
  private downT = 0;
  private ambient: { x: number; y: number; s: number }[] = [];

  constructor(
    app: App,
    public level: LevelDef,
  ) {
    super(app);
    this.theme = level.world.theme;
  }

  enter(): void {
    keepAwake(true);
    playMusic(this.level.boss ? 6 : this.level.world.music);
    for (let i = 0; i < 26; i++) this.ambient.push({ x: Math.random() * W, y: Math.random() * 600, s: 0.4 + Math.random() });
    this.grid.load(this.level);
    this.paddle.reset();
    this.paddle.slippery = !!this.level.mods.slippery;
    const g = this.level.mods.gravity;
    if (g) {
      this.gStrength = g.strength * 0.5;
      this.gDir = g.dirs[0] ?? 'down';
    }
    if (this.level.boss) this.boss = createBoss(this.level.boss, this);
    this.newBall();
    this.banner(this.boss ? this.boss.name : `${this.level.id}  ${this.level.name.toUpperCase()}`, this.theme.accent);
  }

  exit(): void {
    keepAwake(false);
  }

  /** Al volver de la pausa da un respiro antes de reanudar. */
  resume(): void {
    if (this.state === 'play') this.resumeT = 1.5;
  }

  // ---------------------------------------------------------------- API ---
  shake(n: number): void {
    if (save.settings.shake) this.shakeAmt = Math.max(this.shakeAmt, n);
  }

  banner(str: string, color = '#fff'): void {
    this.bannerMsg = { str, color, t: 0 };
  }

  addScore(pts: number, x: number, y: number, show: boolean): void {
    this.score += pts;
    if (show || this.floatCd <= 0) {
      this.particles.floatText(x, y - 4, `+${pts}`, show ? '#ffe14d' : '#ffffff', show ? 8 : 6);
      if (!show) this.floatCd = 0.14;
    }
  }

  addRing(x: number, y: number, max: number, color: string): void {
    this.fx.push({ kind: 'ring', x, y, max, t: 0, dur: 0.5, color });
  }

  addBeam(x1: number, y1: number, x2: number, y2: number, color: string): void {
    this.fx.push({ kind: 'beam', x1, y1, x2, y2, t: 0, dur: 0.25, color });
  }

  spawnProjectile(kind: ProjectileKind, x: number, y: number, vx: number, vy: number): void {
    if (this.projectiles.length < 80) this.projectiles.push(new Projectile(kind, x, y, vx, vy));
  }

  clearEnemyProjectiles(): void {
    for (const p of this.projectiles) {
      if (!p.friendly) {
        p.alive = false;
        this.particles.burst(p.x, p.y, 4, '#ffffff', 40, 0.3);
      }
    }
  }

  setGravity(dir: GravityDir): void {
    this.gDir = dir;
  }

  // ------------------------------------------------------------ GridHost ---
  onCellDestroyed(type: Cell, x: number, y: number, counted: boolean, cause: Cause): void {
    const th = this.theme;
    const col =
      type === Cell.Explosive ? '#ffb11f'
      : type === Cell.Regen ? '#ff9a2e'
      : type === Cell.Ice ? '#d6f3ff'
      : type === Cell.Key ? '#ffd23f'
      : type === Cell.Door || type === Cell.Shield || type === Cell.Metal ? '#b9c0d0'
      : type === Cell.Hard ? th.hard[0]
      : th.cells[0];
    this.particles.burst(x, y, cause === 'ball' || cause === 'laser' ? 3 : 2, col, 45, 0.35);
    if (cause === 'system' || cause === 'boss') return;
    this.combo++;
    this.broken++;
    const m = Math.min(8, 1 + Math.floor(this.combo / 12));
    if (m > this.mult) {
      this.mult = m;
      this.comboT = 1;
      sfx('star', 1 + m * 0.06);
    }
    const base = type === Cell.Hard || type === Cell.Ice ? 20 : type === Cell.Explosive ? 30 : type === Cell.Key ? 100 : 10;
    this.addScore(base * this.mult, x, y, type === Cell.Key);
    sfx('break', 1 + Math.min(this.combo, 48) * 0.012);
    if (type === Cell.Hard || type === Cell.Ice) haptic('light');
    // Con pocas bolas hay un power-up asegurado cada cierto número de celdas,
    // para que la partida nunca se quede atascada con una sola bola.
    this.sinceDrop++;
    const few = this.balls.length < 4;
    if (type === Cell.Power) this.dropPower(x, y, few);
    else if ((counted || this.boss) && this.powerups.length < 6 && ((few && this.sinceDrop >= 14) || Math.random() < this.level.drops)) {
      this.dropPower(x, y, few);
    }
  }

  onCellHit(type: Cell, x: number, y: number): void {
    if (type === Cell.Hard || type === Cell.Ice) {
      sfx('hard');
      haptic('light');
      this.particles.burst(x, y, 2, '#ffffff', 30, 0.2);
    } else {
      sfx('metal');
      this.particles.spawn(x, y, (Math.random() - 0.5) * 40, -20, 0.2, '#ffffff');
    }
  }

  onExplosion(x: number, y: number): void {
    this.particles.burst(x, y, 14, '#ffb11f', 110, 0.5, 2);
    this.addRing(x, y, 16, '#ffe14d');
    this.shake(3);
    sfx('explode');
  }

  onDoorsOpen(): void {
    this.banner('¡PUERTAS ABIERTAS!', '#ffd23f');
    sfx('unlock');
    this.shake(3);
  }

  cellBlocked(c: number, r: number): boolean {
    const x0 = c * CELL - 2.5;
    const x1 = x0 + CELL + 5;
    const y0 = GRID_Y + r * CELL - 2.5;
    const y1 = y0 + CELL + 5;
    for (const b of this.balls) if (b.x > x0 && b.x < x1 && b.y > y0 && b.y < y1) return true;
    return false;
  }

  // ------------------------------------------------------------- bolas ---
  private newBall(): void {
    const b = new Ball(this.paddle.x, this.paddle.y - 2);
    b.stuck = true;
    b.stuckOffset = 0;
    b.stuckT = Infinity;
    this.balls.push(b);
    this.state = 'ready';
  }

  private launch(): void {
    let any = false;
    for (const b of this.balls) {
      if (!b.stuck) continue;
      this.release(b);
      any = true;
    }
    if (any) {
      sfx('launch');
      if (this.state === 'ready') this.state = 'play';
    }
  }

  private release(b: Ball): void {
    b.stuck = false;
    const rel = Math.max(-1, Math.min(1, b.stuckOffset / (this.paddle.w / 2)));
    b.setAngle(rel * 0.9 + (Math.abs(rel) < 0.05 ? (Math.random() - 0.5) * 0.5 : 0));
  }

  private dropPower(x: number, y: number, preferMulti = false): void {
    this.sinceDrop = 0;
    this.dryT = 0;
    let info = preferMulti && Math.random() < 0.7 ? POWERS[0] : randomPower();
    // Con muchas bolas, evita seguir multiplicando sin fin
    const cap = this.boss ? 24 : 90;
    while ((info.id === 'double' || info.id === 'multi3') && this.balls.length > cap) info = randomPower();
    this.powerups.push(new PowerUp(x, y, info));
  }

  private applyPower(info: PowerInfo): void {
    const p = this.paddle;
    switch (info.id) {
      case 'multi3': {
        const src = this.balls.find((b) => b.alive && !b.stuck) ?? this.balls[0];
        if (!src) break;
        const a0 = src.stuck ? 0 : Math.atan2(src.dx, -src.dy);
        for (const off of [-0.45, 0.2, 0.5]) {
          if (this.balls.length >= MAX_BALLS) break;
          const b = new Ball(src.x, src.y - (src.stuck ? 1 : 0));
          b.setAngle(a0 + off);
          this.balls.push(b);
        }
        if (this.state === 'ready') this.launch();
        this.particles.burst(src.x, src.y, 10, info.color, 70, 0.4);
        break;
      }
      case 'double': {
        const n = this.balls.length;
        for (let i = 0; i < n && this.balls.length < MAX_BALLS; i++) {
          const s = this.balls[i];
          if (!s.alive || s.stuck) continue;
          const b = new Ball(s.x, s.y);
          const a = Math.atan2(s.dx, -s.dy) + (Math.random() < 0.5 ? -0.4 : 0.4);
          b.setAngle(a);
          this.balls.push(b);
        }
        break;
      }
      case 'wide':
        p.wideT = 14;
        p.narrowT = 0;
        break;
      case 'narrow':
        p.narrowT = 10;
        p.wideT = 0;
        break;
      case 'fire':
        this.fireT = 5;
        break;
      case 'magnet':
        p.magnetT = 12;
        break;
      case 'laser':
        p.laserT = 7;
        break;
      case 'shield':
        this.shieldOn = true;
        break;
      case 'slow':
        this.slowT = 8;
        break;
      case 'life':
        this.lives = Math.min(9, this.lives + 1);
        break;
    }
    this.score += 50;
    this.particles.floatText(p.x, p.y - 10, info.name, info.color, 8);
    sfx(info.good ? 'power' : 'bad');
  }

  private overlapsSolid(b: Ball): boolean {
    if (b.y - b.r >= GRID_BOTTOM) return false;
    const c0 = Math.floor((b.x - b.r) / CELL);
    const c1 = Math.floor((b.x + b.r - 0.001) / CELL);
    const r0 = Math.floor((b.y - b.r - GRID_Y) / CELL);
    const r1 = Math.floor((b.y + b.r - 0.001 - GRID_Y) / CELL);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (this.grid.solid(c, r)) return true;
    return false;
  }

  /** Mueve la bola en un eje y resuelve colisiones solo con las celdas vecinas. */
  private moveAxis(b: Ball, mx: number, my: number, ghost: boolean, bossGhost: boolean): void {
    const broken0 = this.broken;
    b.x += mx;
    b.y += my;
    if (mx) {
      if (b.x < b.r) {
        b.x = b.r;
        b.dx = Math.abs(b.dx);
      } else if (b.x > W - b.r) {
        b.x = W - b.r;
        b.dx = -Math.abs(b.dx);
      }
    } else if (b.y < GRID_Y + b.r) {
      b.y = GRID_Y + b.r;
      b.dy = Math.abs(b.dy);
    }
    let reflect = false;
    if (!ghost && b.y - b.r < GRID_BOTTOM) {
      const grid = this.grid;
      const c0 = Math.floor((b.x - b.r) / CELL);
      const c1 = Math.floor((b.x + b.r - 0.001) / CELL);
      const r0 = Math.floor((b.y - b.r - GRID_Y) / CELL);
      const r1 = Math.floor((b.y + b.r - 0.001 - GRID_Y) / CELL);
      const fire = this.fireT > 0;
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (grid.solid(c, r) && grid.hit(c, r, fire, 'ball')) reflect = true;
        }
      }
    }
    if (this.broken !== broken0) b.idle = 0;
    const boss = this.boss;
    if (boss && !bossGhost && boss.boxes.length) {
      for (let i = 0; i < boss.boxes.length; i++) {
        const h = boss.boxes[i];
        if (h.w <= 0) continue;
        if (b.x + b.r > h.x && b.x - b.r < h.x + h.w && b.y + b.r > h.y && b.y - b.r < h.y + h.h) {
          reflect = true;
          if (b.bossCd <= 0) {
            b.bossCd = 0.2;
            b.idle = 0;
            if (h.weak) boss.damage(1, b.x, b.y);
            else {
              boss.onArmorHit(i, b.x, b.y);
              sfx('metal');
            }
          }
          break;
        }
      }
    }
    if (reflect) {
      b.x -= mx;
      b.y -= my;
      if (mx) b.dx = -b.dx;
      else b.dy = -b.dy;
    }
  }

  private stepBall(b: Ball, dt: number, speed: number): void {
    const p = this.paddle;
    if (b.portalCd > 0) b.portalCd -= dt;
    if (b.bossCd > 0) b.bossCd -= dt;
    if (b.stuck) {
      b.x = Math.max(b.r, Math.min(W - b.r, p.x + b.stuckOffset));
      b.y = p.y - b.r;
      b.stuckT -= dt;
      if (b.stuckT <= 0) this.release(b);
      return;
    }
    if (b.frozen > 0) {
      b.frozen -= dt;
      return;
    }
    if (this.gDir && this.gStrength) {
      const g = GRAV[this.gDir];
      b.dx += g[0] * this.gStrength * dt;
      b.dy += g[1] * this.gStrength * dt;
      b.normalize();
    }
    // Evita trayectorias casi horizontales eternas
    if (Math.abs(b.dy) < 0.16) {
      b.dy = b.dy < 0 ? -0.16 : 0.16;
      b.normalize();
    }
    // Si algo ha aparecido encima de la bola, la deja salir sin colisionar
    // Antiatasco: si lleva mucho sin romper nada ni tocar la pala, cambia de rumbo
    b.idle += dt;
    if (b.idle > 9) {
      b.idle = 0;
      b.setAngle(Math.atan2(b.dx, -b.dy) + (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.5));
    }
    const ghost = this.overlapsSolid(b);
    let bossGhost = false;
    const boss = this.boss;
    if (boss) {
      for (const h of boss.boxes) {
        if (h.w > 0 && b.x + b.r > h.x && b.x - b.r < h.x + h.w && b.y + b.r > h.y && b.y - b.r < h.y + h.h) {
          bossGhost = true;
          const ox = b.x - (h.x + h.w / 2);
          const oy = b.y - (h.y + h.h / 2);
          const l = Math.hypot(ox, oy) || 1;
          b.dx = ox / l;
          b.dy = oy / l;
          break;
        }
      }
    }
    const dist = speed * dt;
    const n = Math.max(1, Math.ceil(dist / 1.5));
    const s = dist / n;
    for (let i = 0; i < n; i++) {
      this.moveAxis(b, b.dx * s, 0, ghost, bossGhost);
      this.moveAxis(b, 0, b.dy * s, ghost, bossGhost);
      // Pala
      if (
        b.dy > 0 &&
        b.y + b.r >= p.y &&
        b.y - b.r < p.y + p.h &&
        b.x > p.x - p.w / 2 - b.r &&
        b.x < p.x + p.w / 2 + b.r
      ) {
        const rel = Math.max(-1, Math.min(1, (b.x - p.x) / (p.w / 2)));
        let a = rel * 1.05;
        if (p.slippery) a += Math.max(-0.4, Math.min(0.4, p.vx / 350)); // sobre hielo la pala arrastra la bola
        b.setAngle(Math.max(-1.3, Math.min(1.3, a)));
        b.y = p.y - b.r;
        p.flash = 0.06;
        b.idle = 0;
        this.combo = 0;
        this.mult = 1;
        sfx('paddle');
        if (p.magnetT > 0) {
          b.stuck = true;
          b.stuckOffset = b.x - p.x;
          b.stuckT = 2.5;
          return;
        }
      }
      // Escudo inferior de un solo uso
      if (this.shieldOn && b.dy > 0 && b.y + b.r >= view.H - 8) {
        b.dy = -Math.abs(b.dy);
        b.y = view.H - 8 - b.r;
        this.shieldOn = false;
        this.particles.burst(b.x, view.H - 8, 16, '#3df0c2', 80, 0.5);
        sfx('hard');
      }
      if (b.y - b.r > view.H) {
        b.alive = false;
        return;
      }
    }
  }

  // ----------------------------------------------------------- update ---
  update(dt: number): void {
    this.t += dt;
    this.floatCd -= dt;
    this.shakeAmt *= Math.pow(0.002, dt);
    if (this.bannerMsg && (this.bannerMsg.t += dt) > 1.8) this.bannerMsg = null;
    for (let i = this.fx.length - 1; i >= 0; i--) if ((this.fx[i].t += dt) >= this.fx[i].dur) this.fx.splice(i, 1);
    this.particles.update(dt);

    if (this.state === 'over') return;
    this.comboT = Math.max(0, this.comboT - dt);
    // Cuenta atrás al volver de la pausa
    if (this.resumeT > 0) {
      this.resumeT -= dt;
      return;
    }
    if (this.state === 'clearing') {
      this.clearT -= dt;
      if (Math.random() < dt * 10) {
        const c = [this.theme.accent, '#ffe14d', '#ffffff'][Math.floor(Math.random() * 3)];
        this.particles.burst(20 + Math.random() * (W - 40), GRID_Y + 30 + Math.random() * 220, 14, c, 90, 0.7, 2);
      }
      if (this.clearT <= 0) this.finish();
      return;
    }

    const keys = this.app.keys;
    const dir = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
    this.paddle.update(dt, dir);

    if (this.state === 'play') {
      this.time += dt;
      this.fireT = Math.max(0, this.fireT - dt);
      // Ayuda: con pocas bolas y un rato sin power-ups, cae uno desde arriba
      if (this.balls.length < 4) {
        this.dryT += dt;
        if (this.dryT > 12 && this.powerups.length < 6) {
          this.dropPower(30 + Math.random() * (W - 60), GRID_Y + 6, true);
          this.particles.floatText(W / 2, GRID_BOTTOM + 26, '¡AYUDA EN CAMINO!', this.theme.accent, 8);
        }
      } else this.dryT = 0;
      this.slowT = Math.max(0, this.slowT - dt);
      // Ciclo de gravedad variable
      const g = this.level.mods.gravity;
      if (g && g.period > 0 && g.dirs.length > 1) {
        this.gT += dt;
        if (!this.gWarned && g.period - this.gT < 1.5) {
          this.gWarned = true;
          sfx('warn');
        }
        if (this.gT >= g.period) {
          this.gT = 0;
          this.gWarned = false;
          this.gIdx = (this.gIdx + 1) % g.dirs.length;
          this.gDir = g.dirs[this.gIdx];
        }
      }
      // Láser de la pala
      if (this.paddle.laserT > 0) {
        this.paddle.laserCd -= dt;
        if (this.paddle.laserCd <= 0) {
          this.paddle.laserCd = 0.32;
          const hw = this.paddle.w / 2 - 2;
          this.spawnProjectile('laser', this.paddle.x - hw, this.paddle.y - 4, 0, -260);
          this.spawnProjectile('laser', this.paddle.x + hw, this.paddle.y - 4, 0, -260);
          sfx('laser');
        }
      }
    }

    // Bolas
    const speed = BASE_SPEED * this.level.speed * (this.slowT > 0 ? 0.62 : 1);
    const balls = this.balls;
    for (let i = 0; i < balls.length; i++) this.stepBall(balls[i], dt, speed);
    let w = 0;
    for (let i = 0; i < balls.length; i++) if (balls[i].alive) balls[w++] = balls[i];
    balls.length = w;
    if (this.fireT > 0 && Math.random() < dt * 40 && balls.length) {
      const b = balls[Math.floor(Math.random() * balls.length)];
      this.particles.spawn(b.x, b.y, 0, 10, 0.25, '#ff8a1f', 2, 0);
    }

    // Power-ups
    const p = this.paddle;
    for (const pu of this.powerups) {
      pu.update(dt);
      if (pu.alive && pu.y + 4 >= p.y && pu.y - 4 <= p.y + p.h && Math.abs(pu.x - p.x) < p.w / 2 + 7) {
        pu.alive = false;
        this.applyPower(pu.info);
      }
    }
    this.powerups = this.powerups.filter((x) => x.alive);

    this.updateProjectiles(dt);
    this.grid.update(dt);
    if (this.boss && (this.state !== 'ready' || this.boss.dead)) {
      this.boss.update(dt);
      if (this.boss.done && this.state === 'play') this.win();
    }

    if (this.state === 'play') {
      if (!this.boss && this.grid.pct >= this.level.target) this.win();
      else if (balls.length === 0) this.loseLife();
    }
  }

  private updateProjectiles(dt: number): void {
    const p = this.paddle;
    const grid = this.grid;
    for (const pr of this.projectiles) {
      pr.update(dt);
      if (!pr.alive) continue;
      const c = Math.floor(pr.x / CELL);
      const r = Math.floor((pr.y - GRID_Y) / CELL);
      if (pr.friendly) {
        if (pr.y < GRID_Y) {
          pr.alive = false;
          continue;
        }
        if (grid.solid(c, r)) {
          grid.hit(c, r, false, 'laser');
          pr.alive = false;
          continue;
        }
        const boss = this.boss;
        if (boss) {
          for (let i = 0; i < boss.boxes.length; i++) {
            const h = boss.boxes[i];
            if (h.w > 0 && pr.x > h.x && pr.x < h.x + h.w && pr.y > h.y && pr.y < h.y + h.h) {
              if (h.weak) boss.damage(1, pr.x, pr.y);
              else boss.onArmorHit(i, pr.x, pr.y);
              pr.alive = false;
              break;
            }
          }
        }
        continue;
      }
      // Bolas de fuego: prenden las celdas que tocan y dejan brasas
      if (pr.kind === 'fire' && grid.inBounds(c, r)) {
        const idx = r * COLS + c;
        if (idx !== pr.lastCell) {
          pr.lastCell = idx;
          const t = grid.get(c, r);
          if (t === Cell.Normal || t === Cell.Hard || t === Cell.Ice) grid.place(c, r, Cell.Regen);
          else if (t === Cell.Empty && Math.random() < 0.3) grid.ember(c, r, 2 + Math.random() * 2);
        }
      }
      if (pr.y + pr.r >= p.y && pr.y - pr.r <= p.y + p.h && Math.abs(pr.x - p.x) < p.w / 2 + pr.r) {
        pr.alive = false;
        p.stun = Math.max(p.stun, pr.stun);
        this.particles.burst(pr.x, p.y, 12, '#ffe14d', 80, 0.4);
        this.particles.floatText(p.x, p.y - 12, '¡PARALIZADA!', '#ff6b6b', 8);
        this.shake(4);
        sfx('stun');
        haptic('medium');
      }
    }
    this.projectiles = this.projectiles.filter((x) => x.alive);
  }

  private loseLife(): void {
    this.lives--;
    this.livesLost++;
    this.combo = 0;
    this.mult = 1;
    this.fireT = this.slowT = 0;
    this.powerups.length = 0;
    this.projectiles.length = 0;
    this.shake(7);
    sfx('lose');
    haptic('heavy');
    this.particles.burst(this.paddle.x, this.paddle.y, 24, '#ff6b6b', 110, 0.7, 2);
    if (this.lives <= 0) {
      this.state = 'over';
      this.app.scenes.push(new GameOverScene(this.app, this));
      return;
    }
    const keepShield = this.shieldOn;
    this.paddle.reset();
    this.shieldOn = keepShield;
    this.newBall();
  }

  /** Completa el nivel (también lo usa el modo debug para saltar). */
  win(): void {
    if (this.state === 'clearing' || this.state === 'over') return;
    this.state = 'clearing';
    this.clearT = 1.5;
    this.projectiles.length = 0;
    this.powerups.length = 0;
    this.banner(this.boss ? '¡JEFE DERROTADO!' : '¡NIVEL SUPERADO!', '#ffe14d');
    sfx('win');
    haptic('medium');
  }

  private finish(): void {
    const lv = this.level;
    const timeOk = this.time <= lv.par;
    const livesOk = this.livesLost === 0;
    const stars = 1 + (timeOk ? 1 : 0) + (livesOk ? 1 : 0);
    if (this.boss) this.score += 5000;
    this.score += this.lives * 500 + Math.max(0, Math.round(lv.par - this.time)) * 10;
    const prev = save.levels[lv.id];
    const newBest = !prev || this.score > prev.best;
    save.levels[lv.id] = { stars: Math.max(prev?.stars ?? 0, stars), best: Math.max(prev?.best ?? 0, this.score) };
    save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, lv.index + 2));
    persist();
    this.state = 'over';
    const result: LevelResult = {
      level: lv,
      score: this.score,
      stars,
      time: this.time,
      pct: this.grid.pct,
      livesLost: this.livesLost,
      newBest,
      checks: [
        { label: this.boss ? 'Jefe derrotado' : `${Math.round(lv.target * 100)}% destruido`, ok: true },
        { label: `Tiempo ≤ ${lv.par}s (${Math.round(this.time)}s)`, ok: timeOk },
        { label: 'Sin perder vidas', ok: livesOk },
      ],
    };
    this.app.scenes.push(new VictoryScene(this.app, result));
  }

  pause(): void {
    if (this.state === 'over' || this.state === 'clearing') return;
    if (this.app.scenes.top !== this) return;
    this.pid = -1;
    this.app.scenes.push(new PauseScene(this.app, this));
  }

  // ----------------------------------------------------------- entrada ---
  onPointerDown(p: Pointer): void {
    unlockAudio();
    if (p.y < GRID_Y) {
      if (p.x > W - 20) return this.pause();
      if (p.x > W - 40) {
        save.settings.sound = !save.settings.sound;
        persist();
        return;
      }
    }
    this.pid = p.id;
    this.lastX = p.x;
    this.moved = 0;
    this.downT = this.app.time;
    if (!p.touch) this.paddle.targetX = p.x;
  }

  onPointerMove(p: Pointer): void {
    if (!p.touch) {
      if (this.paddle.stun <= 0) this.paddle.targetX = p.x;
      return;
    }
    if (p.id !== this.pid) return;
    const d = p.x - this.lastX;
    this.lastX = p.x;
    this.moved += Math.abs(d);
    this.paddle.targetX += d * save.sensitivity;
  }

  onPointerUp(p: Pointer): void {
    if (p.id !== this.pid) return;
    this.pid = -1;
    if (!p.touch || (this.moved < 6 && this.app.time - this.downT < 0.4)) this.launch();
  }

  onKey(key: string): void {
    unlockAudio();
    if (key === ' ' || key === 'ArrowUp' || key === 'Enter') this.launch();
    else if (key === 'p') this.pause();
    else if (key === 'm') {
      save.settings.sound = !save.settings.sound;
      persist();
    } else if (key === 'd') this.app.debug = !this.app.debug;
    else if (this.app.debug) {
      if (key === 'n') this.win();
      else if (key === 'b') {
        for (let i = 0; i < 25 && this.balls.length < MAX_BALLS; i++) {
          const b = new Ball(this.paddle.x, this.paddle.y - 10);
          b.setAngle((Math.random() - 0.5) * 2.2);
          this.balls.push(b);
        }
        if (this.state === 'ready') this.launch();
      } else if (key === 'k') this.boss?.damage(4, this.boss.x, this.boss.y);
      else if (key === 'l') this.lives = Math.min(9, this.lives + 1);
      else if (key === 'u') this.dropPower(this.paddle.x, GRID_BOTTOM);
    }
  }

  onBack(): boolean {
    this.pause();
    return true;
  }

  onBlur(): void {
    this.pause();
  }

  // ----------------------------------------------------------- dibujo ---
  render(ctx: CanvasRenderingContext2D): void {
    const H = view.H;
    const th = this.theme;
    ctx.fillStyle = th.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (this.shakeAmt > 0.3) {
      ctx.translate(Math.round((Math.random() - 0.5) * this.shakeAmt * 2), Math.round((Math.random() - 0.5) * this.shakeAmt * 2));
    }
    // Fondo del campo
    ctx.fillStyle = th.bg2;
    ctx.fillRect(0, GRID_Y, W, GRID_BOTTOM - GRID_Y);
    this.drawAmbient(ctx);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, GRID_BOTTOM, W, 1);

    this.grid.draw(ctx);
    if (this.boss && !this.boss.done) {
      this.boss.draw(ctx);
      this.boss.drawTelegraphs(ctx);
    }
    if (this.shieldOn) {
      ctx.fillStyle = Math.floor(this.t * 8) % 2 ? '#3df0c2' : '#9ff7e1';
      ctx.fillRect(0, H - 8, W, 2);
    }
    for (const pu of this.powerups) pu.draw(ctx);
    for (const pr of this.projectiles) pr.draw(ctx);
    this.drawBalls(ctx);
    this.paddle.draw(ctx, th.accent, this.t);
    this.particles.draw(ctx);
    for (const f of this.fx) {
      const k = f.t / f.dur;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = f.color;
      if (f.kind === 'ring') {
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 2 + f.max * k, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.lineWidth = 3 * (1 - k) + 1;
        ctx.beginPath();
        ctx.moveTo(f.x1, f.y1);
        ctx.lineTo(f.x2, f.y2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    this.drawHud(ctx);

    if (this.state === 'ready') {
      const blink = Math.floor(this.t * 2.5) % 2 === 0;
      if (blink) text(ctx, 'TOCA PARA LANZAR', W / 2, this.paddle.y - 26, { size: 8, align: 'center', color: '#ffffff' });
    }
    if (this.comboT > 0) {
      text(ctx, `COMBO x${this.mult}`, W / 2, GRID_BOTTOM + 26, { size: 11, align: 'center', color: th.accent, alpha: Math.min(1, this.comboT * 2.5) });
    }
    if (this.resumeT > 0) {
      text(ctx, `${Math.ceil(this.resumeT / 0.5)}`, W / 2, GRID_BOTTOM + 74, { size: 30, align: 'center', color: '#ffffff' });
    }
    if (this.mult > 1 && this.state === 'play') {
      text(ctx, `x${this.mult}`, W - 6, GRID_BOTTOM + 12, { size: 10, align: 'right', color: th.accent });
    }
    if (this.bannerMsg) {
      const b = this.bannerMsg;
      const a = Math.min(1, b.t * 6, (1.8 - b.t) * 3);
      ctx.globalAlpha = Math.max(0, a) * 0.75;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, GRID_BOTTOM + 34, W, 18);
      ctx.globalAlpha = 1;
      text(ctx, b.str, W / 2, GRID_BOTTOM + 43, { size: 9, align: 'center', color: b.color, alpha: Math.max(0, a) });
    }
    if (this.app.debug) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, GRID_Y, 96, 26);
      text(ctx, `FPS ${this.app.fps}  BOLAS ${this.balls.length}`, 3, GRID_Y + 6, { size: 6, color: '#7dff7d' });
      text(ctx, `N:saltar B:+25 K:jefe`, 3, GRID_Y + 13, { size: 6, color: '#7dff7d' });
      text(ctx, `L:vida U:power  ${Math.round(this.grid.pct * 100)}%`, 3, GRID_Y + 20, { size: 6, color: '#7dff7d' });
    }
  }

  private drawAmbient(ctx: CanvasRenderingContext2D): void {
    const kind = this.theme.ambient;
    const t = this.t;
    const span = view.H - GRID_Y;
    for (const a of this.ambient) {
      let x = a.x;
      let y = a.y;
      let col = 'rgba(255,255,255,0.25)';
      if (kind === 'snow') {
        y = (a.y + t * 14 * a.s) % span;
        x = a.x + Math.sin(t * a.s + a.y) * 6;
        col = 'rgba(220,240,255,0.5)';
      } else if (kind === 'ember') {
        y = span - ((a.y + t * 20 * a.s) % span);
        x = a.x + Math.sin(t * 2 * a.s + a.y) * 4;
        col = a.s > 0.9 ? 'rgba(255,170,60,0.6)' : 'rgba(255,90,40,0.5)';
      } else if (kind === 'stars') {
        y = a.y % span;
        col = Math.sin(t * 2 * a.s + a.x) > 0.3 ? 'rgba(255,255,255,0.7)' : 'rgba(200,160,255,0.3)';
      } else if (kind === 'dust') {
        y = (a.y + t * 5 * a.s) % span;
        col = 'rgba(255,200,140,0.22)';
      } else {
        y = span - ((a.y + t * 6 * a.s) % span);
        x = a.x + Math.sin(t * a.s + a.y) * 10;
        col = 'rgba(200,255,150,0.35)';
      }
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(x), Math.round(GRID_Y + y), 1, 1);
    }
  }

  private drawBalls(ctx: CanvasRenderingContext2D): void {
    const fire = this.fireT > 0;
    const main = fire ? '#ff8a1f' : '#ffffff';
    const core = fire ? '#fff3a0' : '#dfe6ff';
    for (const b of this.balls) {
      const x = Math.round(b.x);
      const y = Math.round(b.y);
      if (b.frozen > 0) {
        ctx.fillStyle = '#5ac8ff';
        ctx.fillRect(x - 4, y - 4, 8, 8);
        ctx.fillStyle = '#e8f7ff';
        ctx.fillRect(x - 3, y - 3, 6, 6);
        ctx.fillStyle = '#5ac8ff';
        ctx.fillRect(x - 1, y - 1, 2, 2);
        continue;
      }
      ctx.fillStyle = main;
      ctx.fillRect(x - 2, y - 1, 4, 2);
      ctx.fillRect(x - 1, y - 2, 2, 4);
      ctx.fillStyle = core;
      ctx.fillRect(x - 1, y - 1, 1, 1);
    }
  }

  private drawHud(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#0b0d14';
    ctx.fillRect(0, 0, W, GRID_Y);
    ctx.fillStyle = this.theme.accent;
    ctx.fillRect(0, GRID_Y - 1, W, 1);
    // Vidas
    ctx.fillStyle = '#ff6b9a';
    ctx.fillRect(3, 7, 3, 3);
    ctx.fillRect(7, 7, 3, 3);
    ctx.fillRect(3, 9, 7, 2);
    ctx.fillRect(4, 11, 5, 1);
    ctx.fillRect(5, 12, 3, 1);
    ctx.fillRect(6, 13, 1, 1);
    text(ctx, `${this.lives}`, 13, 10, { size: 9 });
    text(ctx, `${this.score}`, 26, 10, { size: 8, color: '#ffe14d' });
    // Progreso / vida del jefe
    const bx = 84;
    const bw = 84;
    ctx.fillStyle = '#232842';
    ctx.fillRect(bx, 11, bw, 5);
    if (this.boss) {
      const k = this.boss.hp / this.boss.maxHp;
      text(ctx, this.boss.name, bx + bw / 2, 5.5, { size: 6, align: 'center', color: '#ff8a8a' });
      ctx.fillStyle = this.boss.flash > 0 ? '#ffffff' : k > 0.5 ? '#ff5a5a' : k > 0.25 ? '#ff9a2e' : '#ffe14d';
      ctx.fillRect(bx, 11, Math.round(bw * k), 5);
      // Marcas de fase
      ctx.fillStyle = '#0b0d14';
      const marks = this.level.boss === 'core' ? [1 / 3, 2 / 3] : this.level.boss === 'golem' ? [] : [0.5];
      for (const m of marks) ctx.fillRect(bx + Math.round(bw * m), 11, 1, 5);
    } else {
      const k = Math.min(1, this.grid.pct / this.level.target);
      text(ctx, `${this.level.id}  ${Math.floor(this.grid.pct * 100)}% / ${Math.round(this.level.target * 100)}%`, bx + bw / 2, 5.5, {
        size: 6,
        align: 'center',
        color: '#b9c0e0',
      });
      ctx.fillStyle = this.theme.accent;
      ctx.fillRect(bx, 11, Math.round(bw * k), 5);
    }
    // Reloj: se pone rojo al superar el tiempo de la estrella
    const secs = Math.floor(this.time);
    text(ctx, `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, bx + bw + 4, 6, {
      size: 6,
      color: this.time > this.level.par ? '#ff8a8a' : '#b9c0e0',
    });
    // Llaves pendientes
    if (this.grid.hasDoors && this.grid.keysLeft > 0) {
      text(ctx, `LLAVE`, bx + bw + 4, 14.5, { size: 5, color: '#ffd23f' });
    }
    // Sonido
    const sx = W - 36;
    ctx.fillStyle = '#b9c0e0';
    ctx.fillRect(sx + 3, 8, 3, 4);
    ctx.fillRect(sx + 6, 6, 2, 8);
    if (save.settings.sound) {
      ctx.fillRect(sx + 10, 7, 1, 6);
      ctx.fillRect(sx + 12, 5, 1, 10);
    } else {
      ctx.fillStyle = '#ff6b6b';
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(sx + 9 + i, 8 + i, 1, 1);
        ctx.fillRect(sx + 13 - i, 8 + i, 1, 1);
      }
    }
    // Pausa
    ctx.fillStyle = '#b9c0e0';
    ctx.fillRect(W - 14, 5, 3, 10);
    ctx.fillRect(W - 8, 5, 3, 10);

    // Indicadores bajo el campo: gravedad y power-ups activos
    const H = view.H;
    if (this.gDir && this.gStrength) {
      const g = this.level.mods.gravity;
      const warn = this.gWarned && g ? g.dirs[(this.gIdx + 1) % g.dirs.length] : null;
      text(ctx, `G${ARROW[this.gDir]}`, 4, GRID_BOTTOM + 12, { size: 10, color: '#c8a0ff' });
      if (warn && Math.floor(this.t * 8) % 2) text(ctx, `→ ${ARROW[warn]}`, 24, GRID_BOTTOM + 12, { size: 10, color: '#ff6ad5' });
    }
    const p = this.paddle;
    const timers: [number, number, string][] = [
      [this.fireT, 5, '#ff8a1f'],
      [this.slowT, 8, '#c9d0de'],
      [p.magnetT, 12, '#ff5ad1'],
      [p.laserT, 7, '#ff3b3b'],
      [p.wideT, 14, '#5ee06a'],
      [p.narrowT, 10, '#ff4d4d'],
    ];
    let tx = 4;
    for (const [v, max, col] of timers) {
      if (v <= 0) continue;
      ctx.fillStyle = '#232842';
      ctx.fillRect(tx, H - 5, 24, 3);
      ctx.fillStyle = col;
      ctx.fillRect(tx, H - 5, Math.ceil((24 * v) / max), 3);
      tx += 28;
    }
  }
}
