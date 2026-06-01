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

/** Like makeCurve but applies MoP saturation: curve up to mop×ip, then flat horizontal to hi. */
function makeCurveWithMoP(ip, tms, ct, lo, hi, mop) {
  const capI = (mop > 0) ? mop * ip : Infinity;
  const effHi = Math.min(hi, capI);
  const pts = makeCurve(ip, tms, ct, lo, effHi);
  if (mop > 0 && capI < hi && capI > lo) {
    const tSat = iecT(capI, ip, tms, ct);
    if (tSat !== null && tSat > 0) {
      pts.push({ x: capI, y: tSat });
      pts.push({ x: hi,   y: tSat });
    }
  }
  return pts;
}

/**
 * Returns { s1Full, s2Full, s1Eff, s2Eff, dtD }
 * Full = complete curve (faded reference)
 * Eff  = effective zone (solid, directional-crossover-aware)
 * dtD  = DT step line points
 */
export function build(en1, en2, en3, ip1, ip2, ip3, tms1, tms2, ct1, ct2, td_raw, mop1=0, mop2=0) {
  const td     = Math.max(+td_raw || 0, 0);       // actual td — 0 is valid (instantaneous)
  const tdPlot = Math.max(td, 0.0005);             // minimum y for log-scale chart rendering only
  const ipLim  = en3 ? ip3 : X_MAX;

  const s1Full = en1 ? makeCurveWithMoP(ip1, tms1, ct1, ip1, X_MAX, mop1) : [];
  const s2Full = en2 ? makeCurveWithMoP(ip2, tms2, ct2, ip2, X_MAX, mop2) : [];

  let s1Eff, s2Eff;
  if (en1 && en2) {
    const cross = findCrossAny(ip1, tms1, ct1, ip2, tms2, ct2, ipLim);
    if (cross !== null) {
      const { cx, s1FasterBefore } = cross;
      if (s1FasterBefore) {
        s1Eff = makeCurveWithMoP(ip1, tms1, ct1, ip1, cx,     mop1);
        s2Eff = makeCurveWithMoP(ip2, tms2, ct2, cx,  ipLim,  mop2);
      } else {
        s1Eff = makeCurveWithMoP(ip1, tms1, ct1, cx,  ipLim,  mop1);
        s2Eff = makeCurveWithMoP(ip2, tms2, ct2, ip2, cx,     mop2);
      }
    } else {
      s1Eff = makeCurveWithMoP(ip1, tms1, ct1, ip1, ipLim, mop1);
      s2Eff = makeCurveWithMoP(ip2, tms2, ct2, ip2, ipLim, mop2);
    }
  } else {
    s1Eff = en1 ? makeCurveWithMoP(ip1, tms1, ct1, ip1, ipLim, mop1) : [];
    s2Eff = en2 ? makeCurveWithMoP(ip2, tms2, ct2, ip2, ipLim, mop2) : [];
  }

  const dtD = [];
  if (en3) {
    const t1p  = en1 ? applyMoP(iecT(ip3, ip1, tms1, ct1), ip3, ip1, tms1, ct1, mop1) : null;
    const t2p  = en2 ? applyMoP(iecT(ip3, ip2, tms2, ct2), ip3, ip2, tms2, ct2, mop2) : null;
    const tops = [t1p, t2p].filter(v => v !== null);
    const topY = tops.length ? Math.min(...tops) : 10;
    dtD.push({ x: ip3, y: topY }, { x: ip3, y: tdPlot });
    let rx = X_MAX;
    if (en1) { const c = findIdmtHitsVal(ip1, tms1, ct1, tdPlot, ip3, X_MAX); if (c) rx = Math.min(rx, c); }
    if (en2) { const c = findIdmtHitsVal(ip2, tms2, ct2, tdPlot, ip3, X_MAX); if (c) rx = Math.min(rx, c); }
    dtD.push({ x: rx, y: tdPlot });
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
/** Apply MoP saturation: if I_A is at or beyond mop×ip, return the saturated time. */
function applyMoP(t, I_A, ip, tms, ct, mop) {
  if (!mop || mop <= 0 || t === null) return t;
  const mopI = mop * ip;
  if (I_A < mopI) return t;
  return iecT(mopI, ip, tms, ct) ?? t;
}

export function operateTime(I_A, v) {
  const mop1 = v.mop1 || 0;
  const mop2 = v.mop2 || 0;

  // Rule 1 — DT stage: if enabled and I_A ≥ ip3, DT is the effective stage
  if (v.en3 && I_A >= v.ip3) {
    return Math.max(v.td, 0);
  }

  // Rule 2 — IDMT stages (current is below DT pickup or DT is off)
  const ipLim = v.en3 ? v.ip3 : X_MAX;

  if (v.en1 && v.en2) {
    // Both IDMT stages — find crossover to determine which is effective at I_A
    const cross = findCrossAny(v.ip1, v.tms1, v.ct1, v.ip2, v.tms2, v.ct2, ipLim);
    if (cross !== null) {
      const { cx, s1FasterBefore } = cross;
      if (s1FasterBefore) {
        if (I_A > v.ip1 * 1.001 && I_A <= cx) return applyMoP(iecT(I_A, v.ip1, v.tms1, v.ct1), I_A, v.ip1, v.tms1, v.ct1, mop1);
        if (I_A > cx && I_A > v.ip2 * 1.001)  return applyMoP(iecT(I_A, v.ip2, v.tms2, v.ct2), I_A, v.ip2, v.tms2, v.ct2, mop2);
      } else {
        if (I_A > v.ip2 * 1.001 && I_A <= cx) return applyMoP(iecT(I_A, v.ip2, v.tms2, v.ct2), I_A, v.ip2, v.tms2, v.ct2, mop2);
        if (I_A > cx && I_A > v.ip1 * 1.001)  return applyMoP(iecT(I_A, v.ip1, v.tms1, v.ct1), I_A, v.ip1, v.tms1, v.ct1, mop1);
      }
      return null;
    } else {
      const t1 = (I_A > v.ip1 * 1.001) ? applyMoP(iecT(I_A, v.ip1, v.tms1, v.ct1), I_A, v.ip1, v.tms1, v.ct1, mop1) : null;
      const t2 = (I_A > v.ip2 * 1.001) ? applyMoP(iecT(I_A, v.ip2, v.tms2, v.ct2), I_A, v.ip2, v.tms2, v.ct2, mop2) : null;
      const times = [t1, t2].filter(t => t !== null);
      return times.length ? Math.min(...times) : null;
    }
  } else if (v.en1) {
    return (I_A > v.ip1 * 1.001) ? applyMoP(iecT(I_A, v.ip1, v.tms1, v.ct1), I_A, v.ip1, v.tms1, v.ct1, mop1) : null;
  } else if (v.en2) {
    return (I_A > v.ip2 * 1.001) ? applyMoP(iecT(I_A, v.ip2, v.tms2, v.ct2), I_A, v.ip2, v.tms2, v.ct2, mop2) : null;
  }
  return null;
}
