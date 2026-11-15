import { APP_VERSION, GITHUB_OWNER, GITHUB_REPO } from '../config';
import type { App } from './App';
import { el, showModal } from './modal';
import { openExternal } from './platform';
import { persist, save } from './save';
import { isNewer, parseSemver } from './semver';

export interface ReleaseInfo {
  version: string;
  notes: string;
  url: string;
}

const API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const TIMEOUT_MS = 4000;

/**
 * Consulta la última release en GitHub. Nunca lanza ni bloquea: si no hay
 * conexión, tarda demasiado o la respuesta no es válida, devuelve null.
 */
export async function checkForUpdate(): Promise<ReleaseInfo | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API, { signal: ctrl.signal, headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      tag_name?: string;
      body?: string;
      html_url?: string;
      assets?: { name?: string; browser_download_url?: string }[];
    };
    const version = (j.tag_name ?? '').replace(/^v/i, '');
    if (!parseSemver(version) || !isNewer(version, APP_VERSION)) return null;
    const apk = j.assets?.find((a) => a.name?.toLowerCase().endsWith('.apk'))?.browser_download_url;
    const url = apk ?? j.html_url ?? `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
    return { version, notes: (j.body ?? '').trim(), url };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** ¿El usuario pidió "Más tarde" para esta versión y aún no ha llegado el día siguiente? */
export function isSnoozed(version: string, now = Date.now()): boolean {
  const s = save.updateSnooze;
  return !!s && s.version === version && now < s.until;
}

function snooze(version: string): void {
  const d = new Date();
  d.setHours(24, 0, 0, 0); // medianoche local: no vuelve a avisar hasta mañana
  save.updateSnooze = { version, until: d.getTime() };
  persist();
}

/** Release falsa para probar el aviso (modo debug / ?testUpdate=1). */
export const FAKE_RELEASE: ReleaseInfo = {
  version: '99.0.0',
  notes:
    'Notas de ejemplo (actualización simulada):\n\n- Mundo 6: Abismo, con 6 niveles nuevos\n- Nuevo jefe: Kraken de las Profundidades\n- Power-up nuevo: bola fantasma\n- Correcciones y mejoras de rendimiento',
  url: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
};

/** Aviso "Nueva versión disponible". Con `force` se ignora el "Más tarde". */
export function showUpdateNotice(app: App, info: ReleaseInfo, force = false): Promise<void> {
  if (!force && isSnoozed(info.version)) return Promise.resolve();
  return showModal(app, (close) => {
    const body = el('div', { cls: 'body' });
    body.appendChild(el('h3', { text: `Tienes la ${APP_VERSION}` }));
    body.appendChild(el('pre', { text: info.notes || 'Hay una versión nueva disponible.' }));
    const later = el('button', { cls: 'secondary', text: 'Más tarde' });
    later.addEventListener('click', () => {
      snooze(info.version);
      close();
    });
    const dl = el('button', { text: 'Descargar' });
    dl.addEventListener('click', () => {
      close();
      openExternal(info.url);
    });
    return el('div', { cls: 'modal' }, [
      el('header', {}, [el('h2', { text: `Nueva versión ${info.version} disponible` })]),
      body,
      el('footer', {}, [later, dl]),
    ]);
  });
}
