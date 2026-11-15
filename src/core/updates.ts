import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { APP_VERSION, GITHUB_OWNER, GITHUB_REPO } from '../config';
import type { App } from './App';
import { el, showModal } from './modal';
import { isNative, openExternal } from './platform';
import { persist, save } from './save';
import { isNewer, parseSemver } from './semver';

export interface ReleaseInfo {
  version: string;
  notes: string;
  url: string;
  /** true si `url` apunta directamente al APK (se puede descargar dentro de la app). */
  apk: boolean;
  /** Release simulada del modo debug: la barra de descarga se anima sin descargar nada. */
  fake?: boolean;
}

/** Plugin nativo (android/.../UpdaterPlugin.java): descarga el APK y abre el instalador. */
interface UpdaterPlugin {
  download(opts: { url: string }): Promise<{ bytes: number }>;
  install(): Promise<void>;
  addListener(event: 'progress', cb: (p: { received: number; total: number }) => void): Promise<PluginListenerHandle>;
}
const Updater = registerPlugin<UpdaterPlugin>('Updater');

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
    return { version, notes: (j.body ?? '').trim(), url, apk: !!apk };
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
  apk: false,
  fake: true,
};

/** Aviso "Nueva versión disponible". Con `force` se ignora el "Más tarde". */
export function showUpdateNotice(app: App, info: ReleaseInfo, force = false): Promise<void> {
  if (!force && isSnoozed(info.version)) return Promise.resolve();
  return showModal(app, (close) => {
    const body = el('div', { cls: 'body' });
    body.appendChild(el('h3', { text: `Tienes la ${APP_VERSION}` }));
    body.appendChild(el('pre', { text: info.notes || 'Hay una versión nueva disponible.' }));
    const footer = el('footer');

    const button = (label: string, onClick: () => void, secondary = false): HTMLElement => {
      const b = el('button', { cls: secondary ? 'secondary' : '', text: label });
      b.addEventListener('click', onClick);
      return b;
    };
    const browser = () => {
      close();
      openExternal(info.url);
    };

    /** Descarga dentro de la app con barra de progreso y abre el instalador. */
    const download = async () => {
      const fill = el('div');
      const status = el('div', { cls: 'progress-text', text: 'Descargando… 0%' });
      footer.className = 'downloading';
      footer.replaceChildren(el('div', { cls: 'progress' }, [fill]), status);
      const set = (received: number, total: number) => {
        const k = total > 0 ? Math.min(1, received / total) : 0;
        fill.style.width = `${Math.round(k * 100)}%`;
        const mb = (n: number) => (n / 1048576).toFixed(1).replace('.', ',');
        status.textContent =
          total > 0 ? `Descargando… ${Math.round(k * 100)}% (${mb(received)} de ${mb(total)} MB)` : `Descargando… ${mb(received)} MB`;
      };
      const finish = (msg: string, ...buttons: HTMLElement[]) => {
        status.textContent = msg;
        footer.className = '';
        footer.replaceChildren(...buttons);
        body.appendChild(el('p', { cls: 'progress-text', text: msg }));
      };

      if (info.fake) {
        // Simulación: la barra avanza sola para ver cómo queda
        const total = 5 * 1048576;
        let got = 0;
        const timer = setInterval(() => {
          got = Math.min(total, got + total / 40);
          set(got, total);
          if (got >= total) {
            clearInterval(timer);
            finish('Simulación completada: en una actualización real se abriría el instalador.', button('Cerrar', close));
          }
        }, 70);
        return;
      }

      let handle: PluginListenerHandle | null = null;
      try {
        handle = await Updater.addListener('progress', (p) => set(p.received, p.total));
        await Updater.download({ url: info.url });
        fill.style.width = '100%';
        await Updater.install();
        finish(
          'Descarga completada. Si no se ha abierto el instalador, pulsa Instalar.',
          button('Cerrar', close, true),
          button('Instalar', () => void Updater.install().catch(() => {})),
        );
      } catch {
        finish('No se pudo descargar la actualización.', button('Cerrar', close, true), button('Abrir en el navegador', browser));
      } finally {
        void handle?.remove();
      }
    };

    footer.append(
      button(
        'Más tarde',
        () => {
          snooze(info.version);
          close();
        },
        true,
      ),
      button('Descargar', () => {
        if (info.fake || (isNative && info.apk)) void download();
        else browser();
      }),
    );
    return el('div', { cls: 'modal' }, [el('header', {}, [el('h2', { text: `Nueva versión ${info.version} disponible` })]), body, footer]);
  });
}
