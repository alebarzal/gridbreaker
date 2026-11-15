import type { App } from './App';

export interface Pointer {
  x: number;
  y: number;
  id: number;
  touch: boolean;
}

/** Una escena del juego. Las escenas "overlay" se pintan encima de la anterior. */
export abstract class Scene {
  overlay = false;
  constructor(public app: App) {}
  enter(): void {}
  exit(): void {}
  /** Se llama cuando la escena vuelve a estar arriba de la pila. */
  resume(): void {}
  abstract update(dt: number): void;
  abstract render(ctx: CanvasRenderingContext2D): void;
  onPointerDown(_p: Pointer): void {}
  onPointerMove(_p: Pointer): void {}
  onPointerUp(_p: Pointer): void {}
  onKey(_key: string): void {}
  /** Botón atrás (Android / Escape). Devuelve true si lo gestiona. */
  onBack(): boolean {
    return false;
  }
  /** La app pasa a segundo plano. */
  onBlur(): void {}
}

export class SceneManager {
  private stack: Scene[] = [];

  get top(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }

  /** Sustituye toda la pila por una escena. */
  set(scene: Scene): void {
    while (this.stack.length) this.stack.pop()!.exit();
    this.stack.push(scene);
    scene.enter();
  }

  push(scene: Scene): void {
    this.stack.push(scene);
    scene.enter();
  }

  pop(): void {
    const s = this.stack.pop();
    s?.exit();
    this.top?.resume();
  }

  update(dt: number): void {
    this.top?.update(dt);
  }

  render(ctx: CanvasRenderingContext2D): void {
    let start = this.stack.length - 1;
    while (start > 0 && this.stack[start].overlay) start--;
    for (let i = Math.max(0, start); i < this.stack.length; i++) this.stack[i].render(ctx);
  }
}
