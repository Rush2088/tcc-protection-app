// Numerical helpers: log-spacing, bisection, crossover detection
import { iecT } from './curves.js';

/** Generate n logarithmically-spaced points between lo and hi */
export function logPts(lo, hi, n) {
  if (lo >= hi || lo <= 0) return [];
  const pts = [];
  for (let i = 0; i < n; i++) pts.push(lo * Math.pow(hi / lo, i / (n - 1)));
  return pts;
}

/** Log-space bisection — returns value where fn flips from true to false */
export function bisect(fn, lo, hi) {
  for (let i = 0; i < 60; i++) { const m = Math.sqrt(lo * hi); fn(m) ? lo = m : hi = m; }
  return Math.sqrt(lo * hi);
}

/**
 * Find the crossover point between two IDMT curves.
 * Returns { cx, s1FasterBefore } or null if no crossing in [lo, hi].
 * s1FasterBefore = true  → Stage 1 is faster below cx (use S1 left, S2 right)
 * s1FasterBefore = false → Stage 2 is faster below cx (use S2 left, S1 right)
 */
export function findCrossAny(ip1, tms1, ct1, ip2, tms2, ct2, hi) {
  const lo = Math.max(ip1, ip2) * 1.005;
  const hiC = hi * 0.999;
  if (lo >= hiC) return null;
  const N = 300;
  let prevX = null, prevD = null;
  for (let i = 0; i < N; i++) {
    const x = lo * Math.pow(hiC / lo, i / (N - 1));
    const t1 = iecT(x, ip1, tms1, ct1);
    const t2 = iecT(x, ip2, tms2, ct2);
    if (t1 === null || t2 === null) { prevX = null; prevD = null; continue; }
    const d = t1 - t2;
    if (prevD !== null && prevX !== null && prevD * d < 0) {
      const signAtLo = prevD;
      const cx = bisect(m => {
        const a = iecT(m, ip1, tms1, ct1);
        const b = iecT(m, ip2, tms2, ct2);
        if (a === null || b === null) return signAtLo >= 0;
        return (a - b) * signAtLo >= 0;
      }, prevX, x);
      return { cx, s1FasterBefore: signAtLo < 0 };
    }
    prevX = x; prevD = d;
  }
  return null;
}

/**
 * Find the current at which an IDMT curve hits a target time (from above).
 * Used to terminate the DT line where IDMT reaches td.
 */
export function findIdmtHitsVal(ip, tms, type, target, lo, hi) {
  const tlo = iecT(lo, ip, tms, type);
  if (!tlo || tlo <= target) return null;
  const thi = iecT(hi, ip, tms, type);
  if (thi === null || thi > target) return null;
  return bisect(m => { const t = iecT(m, ip, tms, type); return t === null || t > target; }, lo, hi);
}
