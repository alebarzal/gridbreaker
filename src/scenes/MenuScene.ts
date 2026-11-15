import { APP_VERSION, W, view } from '../config';
import { playMusic, sfx } from '../core/audio';
import { resetSeenVersion, showChangelog } from '../core/changelog';
import { persist, save, totalStars } from '../core/save';
import type { Pointer } from '../core/Scene';
import { pixelText, star, text } from '../core/ui';
import { FAKE_RELEASE, showUpdateNotice } from '../core/updates';
import { LEVELS } from '../game/levels';
import { showHelp } from '../core/help';
import { GameScene } from './GameScene';
import { LevelSelectScene } from './LevelSelectScene';
import { SettingsScene } from './SettingsScene';
import { UiScene } from './UiScene';

const COLORS = ['#5fbf4a', '#ffa040', '#6fb6ff', '#ff6a2a', '#a07aff'];

/** Menú principal. 5 toques en el título (o tecla D) activan el modo debug. */
export class MenuScene extends UiScene {
  private taps = 0;
  private lastTap = 0;
  private rain: { x: number; y: number; s: number; c: string }[] = [];
  private builtDebug = false;

  enter(): void {
    playMusic(0);
    for (let i = 0; i < 46; i++) {
      this.rain.push({ x: Math.floor(Math.random() * 40) * 6, y: Math.random() * 560, s: 8 + Math.random() * 22, c: COLORS[i % COLORS.length] });
    }
    this.build();
  }

  private build(): void {
    this.buttons.list.length = 0;
    const y0 = Math.round(view.H * 0.44);
    const world = Math.floor(Math.min(save.unlocked - 1, LEVELS.length - 1) / 6);
    const toLevels = () => this.app.scenes.set(new LevelSelectScene(this.app, world));
    let y = y0;
    // Con partida empezada, el botón principal lleva directo al siguiente nivel
    const started = save.unlocked > 1 || Object.keys(save.levels).length > 0;
    if (started) {
      const next = LEVELS[Math.min(save.unlocked, LEVELS.length) - 1];
      this.addButton(`CONTINUAR  ${next.id}`, y, () => this.app.scenes.set(new GameScene(this.app, next)), 150, 28).size = 11;
      y += 36;
      this.addButton('NIVELES', y, toLevels).color = '#b9c0e0';
      y += 28;
    } else {
      this.addButton('JUGAR', y, toLevels, 150, 28).size = 11;
      y += 36;
    }
    this.addButton('AJUSTES', y, () => this.app.scenes.set(new SettingsScene(this.app))).color = '#b9c0e0';
    y += 28;
    this.addButton('CÓMO JUGAR', y, () => void showHelp(this.app)).color = '#b9c0e0';
    y += 28;
    this.addButton('NOVEDADES', y, () => void showChangelog(this.app)).color = '#b9c0e0';
    this.builtDebug = this.app.debug;
    if (this.app.debug) {
      const dy = y + 32;
      const mk = (label: string, i: number, fn: () => void) => {
        const b = this.addButton(label, dy + i * 21, fn, 190, 17);
        b.color = '#7dff7d';
        b.size = 7;
      };
      mk('DEBUG: SIMULAR ACTUALIZACIÓN', 0, () => void showUpdateNotice(this.app, FAKE_RELEASE, true));
      mk('DEBUG: RESET VERSIÓN VISTA', 1, () => {
        resetSeenVersion();
        void showChangelog(this.app);
      });
      mk('DEBUG: DESBLOQUEAR TODO', 2, () => {
        save.unlocked = LEVELS.length;
        persist();
        this.build();
      });
    }
  }

  private toggleDebug(): void {
    this.app.debug = !this.app.debug;
    sfx(this.app.debug ? 'power' : 'bad');
    this.build();
  }

  update(dt: number): void {
    super.update(dt);
    for (const r of this.rain) {
      r.y += r.s * dt;
      if (r.y > view.H) r.y = -6;
    }
    if (this.builtDebug !== this.app.debug) this.build();
  }

  onPointerUp(p: Pointer): void {
    super.onPointerUp(p);
    // 5 toques rápidos en el título → modo debug
    if (p.y > 40 && p.y < 130) {
      this.taps = this.app.time - this.lastTap < 0.6 ? this.taps + 1 : 1;
      this.lastTap = this.app.time;
      if (this.taps >= 5) {
        this.taps = 0;
        this.toggleDebug();
      }
    }
  }

  onKey(key: string): void {
    if (key === 'd') this.toggleDebug();
    else if (key === 'Enter' || key === ' ') this.buttons.list[0]?.onClick();
  }

  render(ctx: CanvasRenderingContext2D): void {
    const H = view.H;
    ctx.fillStyle = '#0b0d14';
    ctx.fillRect(0, 0, W, H);
    for (const r of this.rain) {
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = r.c;
      ctx.fillRect(r.x, Math.round(r.y), 5, 5);
    }
    ctx.globalAlpha = 1;
    pixelText(ctx, 'GRID', W / 2, 52, 6, ['#9dff6a', '#5fbf4a', '#6fd15a'], this.t);
    pixelText(ctx, 'BREAKER', W / 2, 102, 5, ['#ffd166', '#ffa040', '#ff6a2a'], this.t + 1);
    // Pala y bola decorativas
    const px = W / 2 + Math.sin(this.t * 1.3) * 50;
    ctx.fillStyle = '#e9edf7';
    ctx.fillRect(Math.round(px - 19), 168, 38, 5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(px - 2 + Math.sin(this.t * 3) * 8), Math.round(160 - Math.abs(Math.sin(this.t * 4)) * 12), 4, 4);

    this.buttons.draw(ctx);
    star(ctx, W / 2 - 22, H - 36, 5, '#ffd23f');
    text(ctx, `${totalStars()} / ${LEVELS.length * 3}`, W / 2 - 13, H - 36, { size: 8, color: '#ffe14d' });
    text(ctx, 'Created by Alex Barroso', W / 2, H - 20, { size: 7, align: 'center', color: '#9aa6d6' });
    text(ctx, `v${APP_VERSION}${this.app.debug ? '  · DEBUG' : ''}`, W / 2, H - 8, { size: 6, align: 'center', color: '#5b6384' });
  }
}
