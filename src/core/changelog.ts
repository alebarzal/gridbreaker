import { APP_VERSION } from '../config';
import data from '../data/changelog.json';
import type { App } from './App';
import { unlockAudio } from './audio';
import { el, showModal } from './modal';
import { persist, save } from './save';
import { compareSemver, isNewer } from './semver';

export interface ChangelogEntry {
  version: string;
  fecha: string;
  novedades: string[];
  resumen: string;
}

/** Entradas ordenadas de más reciente a más antigua. */
export const CHANGELOG: ChangelogEntry[] = [...(data as ChangelogEntry[])].sort((a, b) => compareSemver(b.version, a.version));

/** ¿Hay que mostrar las novedades al abrir? (la versión instalada es mayor que la última vista). */
export function changelogPending(): boolean {
  return !save.lastSeenVersion || isNewer(APP_VERSION, save.lastSeenVersion);
}

export function resetSeenVersion(): void {
  save.lastSeenVersion = null;
  persist();
}

/** Modal "Novedades": versión actual detallada y resumen plegable de las anteriores. */
export function showChangelog(app: App): Promise<void> {
  return showModal(app, (close) => {
    const current = CHANGELOG.find((e) => compareSemver(e.version, APP_VERSION) === 0) ?? CHANGELOG[0];
    const older = CHANGELOG.filter((e) => e !== current && compareSemver(e.version, current.version) < 0);

    const body = el('div', { cls: 'body' });
    body.appendChild(el('h3', { text: `Versión ${current.version} · ${current.fecha}` }));
    body.appendChild(el('ul', {}, current.novedades.map((n) => el('li', { text: n }))));
    if (older.length) {
      body.appendChild(el('h3', { text: 'Versiones anteriores' }));
      for (const e of older) {
        const d = el('details', {}, [el('summary', { text: `v${e.version} · ${e.fecha}` }), el('p', { text: e.resumen })]);
        body.appendChild(d);
      }
    }
    const play = el('button', { text: '¡A jugar!' });
    play.addEventListener('click', () => {
      unlockAudio();
      save.lastSeenVersion = APP_VERSION;
      persist();
      close();
    });
    return el('div', { cls: 'modal' }, [
      el('header', {}, [el('h2', { text: 'Novedades' }), el('small', { text: `Grid Breaker v${APP_VERSION}` })]),
      body,
      el('footer', {}, [play]),
    ]);
  });
}
