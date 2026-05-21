// Axis tick generation and formatting for log-log TCC chart

/** All 1–9 sub-ticks per decade for X axis (10 A – 50 kA) */
export function xTicks() {
  const tks = [];
  for (let d = 1; d <= 100000; d *= 10)
    for (let m = 1; m <= 9; m++) { const v = m * d; if (v >= 10 && v <= 50000) tks.push({ value: v }); }
  return tks;
}

/** All 1–9 sub-ticks per decade for Y axis (0.01 s – 100 s) */
export function yTicks() {
  const tks = [];
  for (let d = 0.001; d <= 100; d *= 10)
    for (let m = 1; m <= 9; m++) { const v = +(m * d).toPrecision(4); if (v >= 0.01 && v <= 100) tks.push({ value: v }); }
  return tks;
}

/** Tick values that get printed labels on X axis (in Amperes internally) */
export const X_LABEL = new Set([10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000]);

/** Tick values that get printed labels on Y axis (seconds) */
export const Y_LABEL = new Set([0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100]);

/** Format Ampere value as kA string — no unit suffix (axis label already states kA) */
export function fmtKA(vA) {
  const kA = vA / 1000;
  if (kA < 0.1) return kA.toFixed(2);
  if (kA < 1)   return kA.toFixed(1);
  return Number.isInteger(kA) ? String(kA) : kA.toFixed(1);
}
