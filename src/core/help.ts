import { POWERS, type PowerId } from '../game/PowerUp';
import type { App } from './App';
import { el, showModal } from './modal';

const POWER_HELP: Record<PowerId, string> = {
  multi3: 'Salen 3 bolas más desde una de las tuyas.',
  double: 'Duplica todas las bolas en juego.',
  wide: 'Pala más ancha durante unos segundos.',
  narrow: 'Pala más estrecha. ¡Esquívalo!',
  fire: 'Las bolas atraviesan las celdas sin rebotar (5 s).',
  magnet: 'Las bolas se pegan a la pala; toca para soltarlas.',
  laser: 'La pala dispara sola hacia arriba.',
  shield: 'Barrera bajo la pala que salva una bola.',
  slow: 'Las bolas van más despacio un rato.',
  life: 'Una vida extra.',
};

const CELLS: [string, string, string][] = [
  ['#5fbf4a', 'Normal', 'se rompe de un golpe.'],
  ['#c9e85a', 'Dura', '2 o 3 golpes; cambia de color.'],
  ['#8a93a6', 'Metal', 'indestructible.'],
  ['#ff4d3d', 'Explosiva', 'revienta las celdas de alrededor.'],
  ['#ffd23f', 'Llave', 'al romperlas todas se abren las puertas.'],
  ['#ff9a2e', 'Lava', 'vuelve a crecer a los pocos segundos.'],
];

function row(color: string, label: string, name: string, desc: string): HTMLElement {
  const chip = el('span', { cls: 'chip', text: label });
  chip.style.background = color;
  return el('li', { cls: 'help-row' }, [chip, el('span', { text: `${name}: ${desc}` })]);
}

/** Modal "Cómo jugar": controles, power-ups, celdas y estrellas. */
export function showHelp(app: App): Promise<void> {
  return showModal(app, (close) => {
    const body = el('div', { cls: 'body' });
    body.appendChild(el('h3', { text: 'Controles' }));
    body.appendChild(
      el('ul', {}, [
        el('li', { text: 'Arrastra el dedo (o mueve el ratón / flechas) para mover la pala.' }),
        el('li', { text: 'Toque corto, clic o espacio para lanzar la bola.' }),
        el('li', { text: 'Rompe el porcentaje indicado arriba para superar el nivel.' }),
        el('li', { text: 'Romper muchas celdas sin tocar la pala sube el combo y multiplica los puntos.' }),
      ]),
    );
    body.appendChild(el('h3', { text: 'Power-ups' }));
    body.appendChild(el('ul', { cls: 'help-list' }, POWERS.map((p) => row(p.color, p.label, p.name, POWER_HELP[p.id]))));
    body.appendChild(el('h3', { text: 'Celdas' }));
    body.appendChild(el('ul', { cls: 'help-list' }, CELLS.map(([c, n, d]) => row(c, '', n, d))));
    body.appendChild(el('h3', { text: 'Estrellas' }));
    body.appendChild(
      el('ul', {}, [
        el('li', { text: 'Una por superar el nivel.' }),
        el('li', { text: 'Una por hacerlo dentro del tiempo (el reloj de arriba se pone rojo al pasarte).' }),
        el('li', { text: 'Una por no perder ninguna vida.' }),
      ]),
    );
    const ok = el('button', { text: 'Entendido' });
    ok.addEventListener('click', close);
    return el('div', { cls: 'modal' }, [el('header', {}, [el('h2', { text: 'Cómo jugar' })]), body, el('footer', {}, [ok])]);
  });
}
