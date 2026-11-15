import { MAX_H, MIN_H, STEP, W, view } from '../config';
import { SceneManager, type Pointer } from './Scene';

/** Aplicación: canvas, escalado nítido, entrada y bucle con timestep fijo. */
export class App {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scenes = new SceneManager();
  keys = new Set<string>();
  /** Píxeles de dispositivo por píxel lógico (entero, para bordes nítidos). */
  k = 1;
  debug = false;
  fps = 60;
  time = 0;
  /** Si es true, el bucle no avanza la simulación (hay un modal abierto). */
  modalOpen = false;
  private acc = 0;
  private last = 0;
  private frames = 0;
  private fpsT = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => this.resize());
    this.bindInput();
  }

  resize(): void {
    const vw = window.innerWidth || 360;
    const vh = window.innerHeight || 640;
    const aspect = vh / vw;
    view.H = Math.max(MIN_H, Math.min(MAX_H, Math.round(W * aspect)));
    const scale = Math.min(vw / W, vh / view.H);
    const dpr = window.devicePixelRatio || 1;
    this.k = Math.max(1, Math.min(8, Math.ceil(scale * dpr)));
    this.canvas.width = W * this.k;
    this.canvas.height = view.H * this.k;
    this.canvas.style.width = `${Math.floor(W * scale)}px`;
    this.canvas.style.height = `${Math.floor(view.H * scale)}px`;
  }

  private toLogical(e: PointerEvent): Pointer {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * W,
      y: ((e.clientY - r.top) / r.height) * view.H,
      id: e.pointerId,
      touch: e.pointerType !== 'mouse',
    };
  }

  private bindInput(): void {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.modalOpen) return;
      try {
        c.setPointerCapture(e.pointerId);
      } catch {
        /* sin captura */
      }
      this.scenes.top?.onPointerDown(this.toLogical(e));
    });
    c.addEventListener('pointermove', (e) => {
      if (this.modalOpen) return;
      this.scenes.top?.onPointerMove(this.toLogical(e));
    });
    const up = (e: PointerEvent) => {
      if (this.modalOpen) return;
      this.scenes.top?.onPointerUp(this.toLogical(e));
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if (this.modalOpen) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(key)) e.preventDefault();
      if (!e.repeat) {
        if (key === 'Escape') this.back();
        else this.scenes.top?.onKey(key);
      }
      this.keys.add(key);
    });
    window.addEventListener('keyup', (e) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys.delete(key);
    });
    window.addEventListener('blur', () => this.keys.clear());
  }

  /** Botón atrás. Devuelve false si nadie lo gestiona (salir de la app). */
  back(): boolean {
    if (this.modalOpen) return true;
    return this.scenes.top?.onBack() ?? false;
  }

  blur(): void {
    this.keys.clear();
    this.scenes.top?.onBlur();
  }

  start(): void {
    this.last = performance.now();
    const frame = (now: number) => {
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.1) dt = 0.1;
      if (dt < 0) dt = 0;
      this.frames++;
      this.fpsT += dt;
      if (this.fpsT >= 0.5) {
        this.fps = Math.round(this.frames / this.fpsT);
        this.frames = 0;
        this.fpsT = 0;
      }
      if (!this.modalOpen) {
        this.acc += dt;
        while (this.acc >= STEP) {
          this.scenes.update(STEP);
          this.time += STEP;
          this.acc -= STEP;
        }
      }
      const ctx = this.ctx;
      ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
      ctx.imageSmoothingEnabled = false;
      this.scenes.render(ctx);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}
