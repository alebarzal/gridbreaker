import type { App } from './App';

/** Crea un elemento HTML con clase, texto e hijos. El texto nunca se interpreta como HTML. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts: { cls?: string; text?: string } = {},
  children: HTMLElement[] = [],
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (opts.cls) e.className = opts.cls;
  if (opts.text !== undefined) e.textContent = opts.text;
  for (const c of children) e.appendChild(c);
  return e;
}

const queue: (() => void)[] = [];
let open = false;

/**
 * Muestra un modal HTML sobre el juego (pausando la simulación).
 * Si ya hay uno abierto, se encola y aparece al cerrarse el anterior.
 * `build` recibe la función `close` y devuelve el contenido del modal.
 */
export function showModal(app: App, build: (close: () => void) => HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const run = () => {
      const overlay = document.getElementById('overlay')!;
      open = true;
      app.modalOpen = true;
      const close = () => {
        overlay.replaceChildren();
        overlay.classList.remove('open');
        open = false;
        app.modalOpen = false;
        resolve();
        queue.shift()?.();
      };
      overlay.replaceChildren(build(close));
      overlay.classList.add('open');
    };
    if (open) queue.push(run);
    else run();
  });
}
