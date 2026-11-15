import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { save } from './save';

/** Integración con la plataforma (Android vía Capacitor, con alternativas web). */
export const isNative = Capacitor.isNativePlatform();

let lastHaptic = 0;

export function haptic(kind: 'light' | 'medium' | 'heavy' = 'light'): void {
  if (!save.settings.haptics) return;
  const now = performance.now();
  // Evita saturar el motor de vibración con decenas de bolas.
  if (now - lastHaptic < (kind === 'light' ? 70 : 40)) return;
  lastHaptic = now;
  try {
    if (isNative) {
      const style = kind === 'heavy' ? ImpactStyle.Heavy : kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light;
      void Haptics.impact({ style }).catch(() => {});
    } else if (navigator.vibrate) {
      navigator.vibrate(kind === 'heavy' ? 40 : kind === 'medium' ? 20 : 8);
    }
  } catch {
    /* sin vibración */
  }
}

export function keepAwake(on: boolean): void {
  if (!isNative) return;
  try {
    void (on ? KeepAwake.keepAwake() : KeepAwake.allowSleep()).catch(() => {});
  } catch {
    /* plugin no disponible */
  }
}

/** Pausa al pasar a segundo plano y botón atrás de Android. */
export function bindLifecycle(onBlur: () => void, onBack: () => boolean): void {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) onBlur();
  });
  if (!isNative) return;
  void CapApp.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) onBlur();
  });
  void CapApp.addListener('backButton', () => {
    if (!onBack()) void CapApp.exitApp();
  });
}

/** Abre una URL en el navegador del sistema. */
export function openExternal(url: string): void {
  if (isNative) window.location.href = url;
  else window.open(url, '_blank', 'noopener');
}
