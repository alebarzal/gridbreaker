/** Comparación semver sencilla y correcta (1.10.0 > 1.9.0, 1.0.0 > 1.0.0-beta). */
export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  pre: string[];
}

export function parseSemver(v: string): SemVer | null {
  const m = /^\s*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+.*)?\s*$/.exec(v);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2] ?? 0),
    patch: Number(m[3] ?? 0),
    pre: m[4] ? m[4].split('.') : [],
  };
}

/** Devuelve >0 si a > b, <0 si a < b, 0 si son iguales (o no se pueden comparar). */
export function compareSemver(a: string, b: string): number {
  const x = parseSemver(a);
  const y = parseSemver(b);
  if (!x || !y) return 0;
  if (x.major !== y.major) return x.major - y.major;
  if (x.minor !== y.minor) return x.minor - y.minor;
  if (x.patch !== y.patch) return x.patch - y.patch;
  // Una versión sin prerelease es mayor que la misma con prerelease.
  if (!x.pre.length && y.pre.length) return 1;
  if (x.pre.length && !y.pre.length) return -1;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i];
    const q = y.pre[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    const pn = /^\d+$/.test(p);
    const qn = /^\d+$/.test(q);
    if (pn && qn) {
      if (Number(p) !== Number(q)) return Number(p) - Number(q);
    } else if (pn !== qn) {
      return pn ? -1 : 1;
    } else if (p !== q) {
      return p < q ? -1 : 1;
    }
  }
  return 0;
}

export const isNewer = (candidate: string, current: string): boolean => compareSemver(candidate, current) > 0;
