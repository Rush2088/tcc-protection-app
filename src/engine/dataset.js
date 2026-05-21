// Builds all chart datasets from relay settings — pure calculation, no DOM/Chart.js
import { iecT } from './curves.js';
import { logPts, findCrossAny, findIdmtHitsVal } from './math.js';

const X_MAX = 50000;
const N_PTS = 200;

function makeCurve(ip, tms, ct, lo, hi) {
  if (lo >= hi || lo <= 0) return [];
  const start = Math.max(lo, ip * 1.002);
  if (start >= hi) return [];
  return logPts(start, hi, N_PTS)
    .map(x => { const t = iecT(x, ip, tms, ct); return t ? { x, y: t } : null; })
    .filter(Boolean);
}

/**
 * Returns { s1Full, s2Full, s1Eff, s2Eff, dtD }
 * Full = complete curve (faded reference)
 * Eff  = effective zone (solid, directional-crossover-aware)
 * dtD  = DT step line points
 */
export function build(en1, en2, en3, ip1, ip2, ip3, tms1, tms2, ct1, ct2, td_raw) {
  const td   = Math.max(+td_raw || 0, 0.02);
  const ipLim = en3 ? ip3 : X_MAX;

  const s1Full = en1 ? makeCurve(ip1, tms1, ct1, ip1, X_MAX) : [];
  const s2Full = en2 ? makeCurve(ip2, tms2, ct2, ip2, X_MAX) : [];

  let s1Eff, s2Eff;
  if (en1 && en2) {
    const cross = findCrossAny(ip1, tms1, ct1, ip2, tms2, ct2, ipLim);
    if (cross !== null) {
      const { cx, s1FasterBefore } = cross;
      if (s1FasterBefore) {
        s1Eff = makeCurve(ip1, tms1, ct1, ip1, cx);
        s2Eff = makeCurve(ip2, tms2, ct2, cx, ipLim);
      } else {
        s1Eff = makeCurve(ip1, tms1, ct1, cx, ipLim);
        s2Eff = makeCurve(ip2, tms2, ct2, ip2, cx);
      }
    } else {
      s1Eff = makeCurve(ip1, tms1, ct1, ip1, ipLim);
      s2Eff = makeCurve(ip2, tms2, ct2, ip2, ipLim);
    }
  } else {
    s1Eff = en1 ? makeCurve(ip1, tms1, ct1, ip1, ipLim) : [];
    s2Eff = en2 ? makeCurve(ip2, tms2, ct2, ip2, ipLim) : [];
  }

  const dtD = [];
  if (en3) {
    const t1p  = en1 ? iecT(ip3, ip1, tms1, ct1) : null;
    const t2p  = en2 ? iecT(ip3, ip2, tms2, ct2) : null;
    const tops = [t1p, t2p].filter(v => v !== null);
    const topY = tops.length ? Math.min(...tops) : 10;
    dtD.push({ x: ip3, y: topY }, { x: ip3, y: td });
    let rx = X_MAX;
    if (en1) { const c = findIdmtHitsVal(ip1, tms1, ct1, td, ip3, X_MAX); if (c) rx = Math.min(rx, c); }
    if (en2) { const c = findIdmtHitsVal(ip2, tms2, ct2, td, ip3, X_MAX); if (c) rx = Math.min(rx, c); }
    dtD.push({ x: rx, y: td });
  }

  return { s1Full, s2Full, s1Eff, s2Eff, dtD };
}

/**
 * Effective operate time at a given fault current.
 * Mirrors the build() effective-curve logic exactly:
 *   - DT stage overrides all IDMT at or above its pickup current
 *   - Below the DT pickup, the IDMT crossover determines which stage is active
 *   - With no crossover both stages cover the full range → minimum time applies
 * @param {number} I_A  fault current in Amperes
 * @param {object} v    relay settings from getV()
 */
export function operateTime(I_A, v) {
  // Rule 1 — DT stage: if enabled and I_A ≥ ip3, DT is the effective stage
  if (v.en3 && I_A >= v.ip3) {
    return Math.max(v.td, 0.02);
  }

  // Rule 2 — IDMT stages (current is below DT pickup or DT is off)
  const ipLim = v.en3 ? v.ip3 : X_MAX;

  if (v.en1 && v.en2) {
    // Both IDMT stages — find crossover to determine which is effective at I_A
    const cross = findCrossAny(v.ip1, v.tms1, v.ct1, v.ip2, v.tms2, v.ct2, ipLim);
    if (cross !== null) {
      const { cx, s1FasterBefore } = cross;
      if (s1FasterBefore) {
        // S1 effective from ip1 → cx, S2 effective from cx → ipLim
        if (I_A > v.ip1 * 1.001 && I_A <= cx) return iecT(I_A, v.ip1, v.tms1, v.ct1);
        if (I_A > cx && I_A > v.ip2 * 1.001)  return iecT(I_A, v.ip2, v.tms2, v.ct2);
      } else {
        // S2 effective from ip2 → cx, S1 effective from cx → ipLim
        if (I_A > v.ip2 * 1.001 && I_A <= cx) return iecT(I_A, v.ip2, v.tms2, v.ct2);
        if (I_A > cx && I_A > v.ip1 * 1.001)  return iecT(I_A, v.ip1, v.tms1, v.ct1);
      }
      return null; // current falls in a gap (between pickups, not in either effective zone)
    } else {
      // No crossover — both stages fully effective across their ranges → minimum
      const t1 = (I_A > v.ip1 * 1.001) ? iecT(I_A, v.ip1, v.tms1, v.ct1) : null;
      const t2 = (I_A > v.ip2 * 1.001) ? iecT(I_A, v.ip2, v.tms2, v.ct2) : null;
      const times = [t1, t2].filter(t => t !== null);
      return times.length ? Math.min(...times) : null;
    }
  } else if (v.en1) {
    return (I_A > v.ip1 * 1.001) ? iecT(I_A, v.ip1, v.tms1, v.ct1) : null;
  } else if (v.en2) {
    return (I_A > v.ip2 * 1.001) ? iecT(I_A, v.ip2, v.tms2, v.ct2) : null;
  }
  return null;
}
